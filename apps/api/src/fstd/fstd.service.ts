import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  FcsCharacteristic,
  FcsFidelityLevel,
  FstdDeviceType,
  FstdQualificationBasisType,
  LegacyLevel,
  QtgDocumentType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

const FIDELITY_RANK: Record<FcsFidelityLevel, number> = { N: 0, G: 1, R: 2, S: 3 };

export interface TaskCapabilityResult {
  eligible: boolean;
  basis: FstdQualificationBasisType;
  reason?: string;
  missingCharacteristics?: { characteristic: FcsCharacteristic; required: FcsFidelityLevel; actual: FcsFidelityLevel | null }[];
}

@Injectable()
export class FstdService {
  constructor(private readonly prisma: PrismaService) {}

  /// fstdId 路由拿不到 organizationId, 需要反查设备所属机构再校验租户 (TenantGuard 覆盖不到这类路径)
  private async findFstdOrThrow(fstdId: string, tenantId: string) {
    const fstd = await this.prisma.fstd.findUnique({
      where: { id: fstdId },
      include: { organization: true },
    });
    if (!fstd || fstd.organization.tenantId !== tenantId) throw new NotFoundException(`FSTD ${fstdId} not found`);
    return fstd;
  }

  // 需求清单 3.3.1: EASA双轨, qualificationBasisType 默认 EASA_LEGACY_LEVEL, 三期启用 EASA_FCS 分支
  create(data: {
    organizationId: string;
    deviceCode: string;
    representedAircraft: string;
    deviceType: FstdDeviceType;
    serialNumber?: string;
    location?: string;
    legacyLevel?: LegacyLevel;
    qualificationBasisType?: FstdQualificationBasisType;
  }) {
    return this.prisma.fstd.create({
      data: {
        organizationId: data.organizationId,
        deviceCode: data.deviceCode,
        representedAircraft: data.representedAircraft,
        deviceType: data.deviceType,
        serialNumber: data.serialNumber,
        location: data.location,
        qualificationBasisType: data.qualificationBasisType ?? 'EASA_LEGACY_LEVEL',
        ...(data.legacyLevel
          ? { legacyLevel: { create: { level: data.legacyLevel } } }
          : {}),
      },
      include: { legacyLevel: true },
    });
  }

  findAll(organizationId: string) {
    return this.prisma.fstd.findMany({
      where: { organizationId },
      include: { legacyLevel: true, qualifiedTasks: true, fcsCapabilities: true },
    });
  }

  async findOne(id: string, tenantId: string) {
    await this.findFstdOrThrow(id, tenantId);
    return this.prisma.fstd.findUnique({
      where: { id },
      include: {
        legacyLevel: true,
        qualifiedTasks: true,
        fcsCapabilities: true,
        recurrentEvals: { orderBy: { periodStart: 'desc' } },
        discrepancies: { where: { status: 'open' } },
      },
    });
  }

  // 需求清单 3.3.3: 已鉴定任务清单, 连接设备与训练科目
  async addQualifiedTask(
    fstdId: string,
    tenantId: string,
    data: { taskCode: string; taskName: string; requiresSpecialAuth?: boolean },
  ) {
    await this.findFstdOrThrow(fstdId, tenantId);
    return this.prisma.fstdQualifiedTask.create({ data: { fstdId, ...data } });
  }

  // ---- 3.3.2 FCS能力矩阵 (qualificationBasisType=EASA_FCS时使用) ----

  async setFcsCapability(
    fstdId: string,
    tenantId: string,
    data: { characteristic: FcsCharacteristic; fidelityLevel: FcsFidelityLevel; subsystem?: string; isAssigned?: boolean },
  ) {
    const fstd = await this.findFstdOrThrow(fstdId, tenantId);
    if (fstd.qualificationBasisType !== 'EASA_FCS') {
      throw new BadRequestException(`FSTD ${fstd.deviceCode} 的鉴定基础是 ${fstd.qualificationBasisType}, 不是 EASA_FCS, 无法登记FCS能力`);
    }
    // 复合唯一键含可空的subsystem字段, upsert对null的处理在部分Prisma版本下类型推导不稳定, 改用手动find+create/update
    const existing = await this.prisma.fstdFcsCapability.findFirst({
      where: { fstdId, characteristic: data.characteristic, subsystem: data.subsystem ?? null },
    });
    if (existing) {
      return this.prisma.fstdFcsCapability.update({
        where: { id: existing.id },
        data: { fidelityLevel: data.fidelityLevel, isAssigned: data.isAssigned ?? false },
      });
    }
    return this.prisma.fstdFcsCapability.create({
      data: {
        fstdId,
        characteristic: data.characteristic,
        fidelityLevel: data.fidelityLevel,
        subsystem: data.subsystem,
        isAssigned: data.isAssigned ?? false,
      },
    });
  }

  async listFcsCapabilities(fstdId: string, tenantId: string) {
    await this.findFstdOrThrow(fstdId, tenantId);
    return this.prisma.fstdFcsCapability.findMany({ where: { fstdId }, orderBy: { characteristic: 'asc' } });
  }

  // ---- 3.3.3 训练矩阵 (Part-FCL Appendix 9训练科目 x 14特征, 全局配置表, 非租户范围) ----

  addTrainingMatrixEntry(data: {
    taskCode: string;
    taskName: string;
    characteristic: FcsCharacteristic;
    thresholdT: FcsFidelityLevel;
    thresholdTP: FcsFidelityLevel;
  }) {
    return this.prisma.trainingMatrixEntry.upsert({
      where: { taskCode_characteristic: { taskCode: data.taskCode, characteristic: data.characteristic } },
      create: data,
      update: { taskName: data.taskName, thresholdT: data.thresholdT, thresholdTP: data.thresholdTP },
    });
  }

  listTrainingMatrixEntries(taskCode?: string) {
    return this.prisma.trainingMatrixEntry.findMany({
      where: taskCode ? { taskCode } : undefined,
      orderBy: [{ taskCode: 'asc' }, { characteristic: 'asc' }],
    });
  }

  /// 设备在某一特征上的实际保真度: SYS等可展开子系统的特征取所有子系统中的最低者 (整体能力受限于最弱子系统)
  private capabilityRankFor(capabilities: { characteristic: FcsCharacteristic; fidelityLevel: FcsFidelityLevel }[], characteristic: FcsCharacteristic) {
    const rows = capabilities.filter((c) => c.characteristic === characteristic);
    if (rows.length === 0) return { rank: -1, level: null as FcsFidelityLevel | null };
    const worst = rows.reduce((min, r) => (FIDELITY_RANK[r.fidelityLevel] < FIDELITY_RANK[min.fidelityLevel] ? r : min));
    return { rank: FIDELITY_RANK[worst.fidelityLevel], level: worst.fidelityLevel };
  }

  /// 统一的设备能力判定入口 (需求清单3.3.3 can_device_perform_task): 内部按qualificationBasisType分流,
  /// legacy体系查FstdQualifiedTask, FCS体系逐特征比对训练矩阵thresholdT要求 vs 设备实际保真度
  async canDevicePerformTask(fstdId: string, taskCode: string): Promise<TaskCapabilityResult> {
    const fstd = await this.prisma.fstd.findUnique({ where: { id: fstdId } });
    if (!fstd) throw new NotFoundException(`FSTD ${fstdId} not found`);

    if (fstd.qualificationBasisType === 'EASA_LEGACY_LEVEL') {
      const task = await this.prisma.fstdQualifiedTask.findFirst({ where: { fstdId, taskCode } });
      return {
        eligible: !!task,
        basis: 'EASA_LEGACY_LEVEL',
        reason: task ? undefined : `设备未鉴定训练科目 ${taskCode}`,
      };
    }

    // EASA_FCS 分支
    const requirements = await this.prisma.trainingMatrixEntry.findMany({ where: { taskCode } });
    if (requirements.length === 0) {
      return { eligible: false, basis: 'EASA_FCS', reason: `训练科目 ${taskCode} 尚未定义训练矩阵要求` };
    }
    const capabilities = await this.prisma.fstdFcsCapability.findMany({ where: { fstdId } });
    const missing: { characteristic: FcsCharacteristic; required: FcsFidelityLevel; actual: FcsFidelityLevel | null }[] = [];
    for (const req of requirements) {
      const actual = this.capabilityRankFor(capabilities, req.characteristic);
      if (actual.rank < FIDELITY_RANK[req.thresholdT]) {
        missing.push({ characteristic: req.characteristic, required: req.thresholdT, actual: actual.level });
      }
    }
    return {
      eligible: missing.length === 0,
      basis: 'EASA_FCS',
      reason:
        missing.length > 0
          ? `以下特征保真度不足: ${missing.map((m) => `${m.characteristic}(需要${m.required}, 实际${m.actual ?? '无'})`).join(', ')}`
          : undefined,
      missingCharacteristics: missing.length > 0 ? missing : undefined,
    };
  }

  /// 兼容性包装: 供FstdController的租户校验入口使用
  async canPerformTask(fstdId: string, tenantId: string, taskCode: string): Promise<TaskCapabilityResult> {
    await this.findFstdOrThrow(fstdId, tenantId);
    return this.canDevicePerformTask(fstdId, taskCode);
  }

  // 需求清单 3.3.7: 缺陷处理, 吸收FAA 30天修复时限规则; Kiosk交互额外采集打分与培训损失时间
  async reportDiscrepancy(
    fstdId: string,
    tenantId: string,
    data: {
      description: string;
      isMmi?: boolean;
      reportedById?: string;
      severityRating?: number;
      trainingTimeLostMinutes?: number;
    },
  ) {
    await this.findFstdOrThrow(fstdId, tenantId);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // 吸收 FAA §60.25 30天规则 (EASA条文未给出具体天数)
    return this.prisma.discrepancyLog.create({
      data: {
        fstdId,
        description: data.description,
        isMmi: data.isMmi ?? false,
        reportedById: data.reportedById,
        severityRating: data.severityRating,
        trainingTimeLostMinutes: data.trainingTimeLostMinutes,
        dueDate,
      },
    });
  }

  async listDiscrepancies(fstdId: string, tenantId: string) {
    await this.findFstdOrThrow(fstdId, tenantId);
    return this.prisma.discrepancyLog.findMany({ where: { fstdId }, orderBy: { reportedAt: 'desc' } });
  }

  /// 已逾期30天修复时限仍未纠正的缺陷 (仪表盘告警, 呼应其余到期类告警的统一模式)
  async findOverdueDiscrepancies(tenantId: string) {
    return this.prisma.discrepancyLog.findMany({
      where: { status: 'open', fstd: { organization: { tenantId } }, dueDate: { lt: new Date() } },
      include: { fstd: true },
      orderBy: { dueDate: 'asc' },
    });
  }

  async correctDiscrepancy(
    discrepancyId: string,
    tenantId: string,
    data: { correctiveAction: string; correctedById?: string },
  ) {
    const discrepancy = await this.prisma.discrepancyLog.findUnique({
      where: { id: discrepancyId },
      include: { fstd: { include: { organization: true } } },
    });
    if (!discrepancy || discrepancy.fstd.organization.tenantId !== tenantId) {
      throw new NotFoundException(`Discrepancy ${discrepancyId} not found`);
    }
    if (discrepancy.status !== 'open') {
      throw new BadRequestException(`Discrepancy ${discrepancyId} is already ${discrepancy.status}`);
    }
    return this.prisma.discrepancyLog.update({
      where: { id: discrepancyId },
      data: {
        correctiveAction: data.correctiveAction,
        correctedById: data.correctedById,
        correctedAt: new Date(),
        status: 'corrected',
      },
    });
  }

  // ---- 3.3.5 周期性评估: 标准周期12个月(BITD为3年), 评估窗口内完成即视为按时 ----

  async recordRecurrentEvaluation(
    fstdId: string,
    tenantId: string,
    data: { periodStart: string; periodEnd: string; evaluationType?: string; result?: string },
  ) {
    const fstd = await this.findFstdOrThrow(fstdId, tenantId);
    const periodEnd = new Date(data.periodEnd);
    const nextDueDate = new Date(periodEnd);
    // BITD 标准周期3年, 其余(FFS/FTD/FNPT) 标准周期12个月 (需求清单3.3.5)
    if (fstd.deviceType === 'BITD') {
      nextDueDate.setFullYear(nextDueDate.getFullYear() + 3);
    } else {
      nextDueDate.setMonth(nextDueDate.getMonth() + 12);
    }
    return this.prisma.fstdRecurrentEvaluation.create({
      data: {
        fstdId,
        periodStart: new Date(data.periodStart),
        periodEnd,
        evaluationType: data.evaluationType ?? 'standard',
        result: data.result,
        nextDueDate,
      },
    });
  }

  async listRecurrentEvaluations(fstdId: string, tenantId: string) {
    await this.findFstdOrThrow(fstdId, tenantId);
    return this.prisma.fstdRecurrentEvaluation.findMany({ where: { fstdId }, orderBy: { periodEnd: 'desc' } });
  }

  /// 找出评估窗口即将到期(或已过期)的设备, 每台设备只看最近一次评估记录 (供仪表盘/告警使用)
  async findEvaluationsDueSoon(tenantId: string, withinDays = 60) {
    const fstds = await this.prisma.fstd.findMany({
      where: { organization: { tenantId }, status: 'active' },
      include: { recurrentEvals: { orderBy: { periodEnd: 'desc' }, take: 1 } },
    });
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + withinDays);
    return fstds
      .filter((f) => {
        const latest = f.recurrentEvals[0];
        return !latest || (latest.nextDueDate && latest.nextDueDate <= cutoff); // 从未评估过的也算需要立即安排
      })
      .map((f) => ({
        fstdId: f.id,
        deviceCode: f.deviceCode,
        nextDueDate: f.recurrentEvals[0]?.nextDueDate ?? null,
        lastResult: f.recurrentEvals[0]?.result ?? null,
      }));
  }

  // ---- 3.3.8 安全设施年检 (ORA.FSTD.115(b)): 急停/应急照明等, 标准周期12个月 ----

  async recordSafetyFacilityCheck(
    fstdId: string,
    tenantId: string,
    data: { checkedAt: string; checkedById?: string; items: { item: string; passed: boolean; notes?: string }[] },
  ) {
    await this.findFstdOrThrow(fstdId, tenantId);
    const checkedAt = new Date(data.checkedAt);
    const nextDueDate = new Date(checkedAt);
    nextDueDate.setMonth(nextDueDate.getMonth() + 12);
    const overallResult = data.items.every((i) => i.passed) ? 'pass' : 'issues_found';
    return this.prisma.fstdSafetyFacilityCheck.create({
      data: {
        fstdId,
        checkedAt,
        checkedById: data.checkedById,
        itemsJson: data.items,
        overallResult,
        nextDueDate,
      },
    });
  }

  async listSafetyFacilityChecks(fstdId: string, tenantId: string) {
    await this.findFstdOrThrow(fstdId, tenantId);
    return this.prisma.fstdSafetyFacilityCheck.findMany({ where: { fstdId }, orderBy: { checkedAt: 'desc' } });
  }

  /// 找出安全设施年检即将到期(或已过期, 或从未检查过)的设备 (仪表盘告警, 镜像3.3.5周期性评估的模式)
  async findSafetyChecksDueSoon(tenantId: string, withinDays = 60) {
    const fstds = await this.prisma.fstd.findMany({
      where: { organization: { tenantId }, status: 'active' },
      include: { safetyFacilityChecks: { orderBy: { checkedAt: 'desc' }, take: 1 } },
    });
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + withinDays);
    return fstds
      .filter((f) => {
        const latest = f.safetyFacilityChecks[0];
        return !latest || latest.nextDueDate <= cutoff;
      })
      .map((f) => ({
        fstdId: f.id,
        deviceCode: f.deviceCode,
        nextDueDate: f.safetyFacilityChecks[0]?.nextDueDate ?? null,
        lastResult: f.safetyFacilityChecks[0]?.overallResult ?? null,
      }));
  }

  // ---- 3.3.4 QTG/MQTG生命周期: 文档版本管理 (SOC/VDR/MQTG) ----

  /// 新版本生效时自动将同类型现有"当前版本"标记为已替代, 保证同一documentType永远只有一个current版本
  async addQtgDocument(
    fstdId: string,
    tenantId: string,
    data: { documentType: QtgDocumentType; version: string; effectiveDate: string; pointerUrl?: string },
  ) {
    await this.findFstdOrThrow(fstdId, tenantId);
    await this.prisma.fstdQtgDocument.updateMany({
      where: { fstdId, documentType: data.documentType, supersededAt: null },
      data: { supersededAt: new Date() },
    });
    return this.prisma.fstdQtgDocument.create({
      data: {
        fstdId,
        documentType: data.documentType,
        version: data.version,
        effectiveDate: new Date(data.effectiveDate),
        pointerUrl: data.pointerUrl,
      },
    });
  }

  async listQtgDocuments(fstdId: string, tenantId: string) {
    await this.findFstdOrThrow(fstdId, tenantId);
    return this.prisma.fstdQtgDocument.findMany({ where: { fstdId }, orderBy: { createdAt: 'desc' } });
  }

  // ---- 3.3.4 年度QTG按季度滚动运行 (吸收FAA细节: 不允许年检前突击补测) ----

  private quarterDateRange(year: number, quarter: number) {
    const startMonth = (quarter - 1) * 3;
    const start = new Date(year, startMonth, 1);
    const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
    return { start, end };
  }

  async recordQuarterlyQtgRun(
    fstdId: string,
    tenantId: string,
    data: { year: number; quarter: number; completedAt?: string; result?: string; notes?: string },
  ) {
    await this.findFstdOrThrow(fstdId, tenantId);
    if (data.quarter < 1 || data.quarter > 4) {
      throw new BadRequestException(`quarter must be 1-4, got ${data.quarter}`);
    }
    const completedAt = data.completedAt ? new Date(data.completedAt) : new Date();
    const run = await this.prisma.fstdQtgQuarterlyRun.upsert({
      where: { fstdId_year_quarter: { fstdId, year: data.year, quarter: data.quarter } },
      create: { fstdId, year: data.year, quarter: data.quarter, completedAt, result: data.result, notes: data.notes },
      update: { completedAt, result: data.result, notes: data.notes },
    });
    return { ...run, burstTested: this.isBurstTested(run) };
  }

  async listQuarterlyQtgRuns(fstdId: string, tenantId: string) {
    await this.findFstdOrThrow(fstdId, tenantId);
    const runs = await this.prisma.fstdQtgQuarterlyRun.findMany({
      where: { fstdId },
      orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
    });
    return runs.map((r) => ({ ...r, burstTested: this.isBurstTested(r) }));
  }

  /// 突击补测判定: 该季度记录的完成日期落在自己所属日历季度范围之外 (如Q1的测试拖到年底才做)
  private isBurstTested(run: { year: number; quarter: number; completedAt: Date | null }): boolean {
    if (!run.completedAt) return false;
    const { start, end } = this.quarterDateRange(run.year, run.quarter);
    return run.completedAt < start || run.completedAt > end;
  }

  /// 合规问题仪表盘: 本年度已过季度中, 逾期未测 或 突击补测(完成日期不在所属季度内) 的设备清单
  async findQuarterlyQtgIssues(tenantId: string) {
    const now = new Date();
    const year = now.getFullYear();
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;

    const fstds = await this.prisma.fstd.findMany({
      where: { organization: { tenantId }, status: 'active' },
      include: { qtgQuarterlyRuns: { where: { year } } },
    });

    const issues: Array<{
      fstdId: string;
      deviceCode: string;
      year: number;
      quarter: number;
      issueType: 'overdue' | 'burst_tested';
    }> = [];

    for (const fstd of fstds) {
      for (let q = 1; q <= currentQuarter; q++) {
        const run = fstd.qtgQuarterlyRuns.find((r) => r.quarter === q);
        if (!run || !run.completedAt) {
          const { end } = this.quarterDateRange(year, q);
          if (now > end) {
            issues.push({ fstdId: fstd.id, deviceCode: fstd.deviceCode, year, quarter: q, issueType: 'overdue' });
          }
        } else if (this.isBurstTested(run)) {
          issues.push({ fstdId: fstd.id, deviceCode: fstd.deviceCode, year, quarter: q, issueType: 'burst_tested' });
        }
      }
    }
    return issues;
  }

  // ---- 3.3.6 变更/改装/搬迁/停用: draft -> submitted(已通知主管机关) -> approved / rejected ----

  async createChangeRequest(fstdId: string, tenantId: string, data: { changeType: string; description?: string }) {
    await this.findFstdOrThrow(fstdId, tenantId);
    return this.prisma.fstdChangeRequest.create({ data: { fstdId, ...data } });
  }

  async listChangeRequests(fstdId: string, tenantId: string) {
    await this.findFstdOrThrow(fstdId, tenantId);
    return this.prisma.fstdChangeRequest.findMany({ where: { fstdId }, orderBy: { createdAt: 'desc' } });
  }

  private async findChangeRequestOrThrow(id: string, tenantId: string) {
    const cr = await this.prisma.fstdChangeRequest.findUnique({
      where: { id },
      include: { fstd: { include: { organization: true } } },
    });
    if (!cr || cr.fstd.organization.tenantId !== tenantId) throw new NotFoundException(`Change request ${id} not found`);
    return cr;
  }

  /// 提前告知主管机关 (需求清单3.3.6: EASA条文只要求"提前告知", FAA的21天等待期可作为默认SLA参考)
  async submitChangeRequest(id: string, tenantId: string) {
    await this.findChangeRequestOrThrow(id, tenantId);
    return this.prisma.fstdChangeRequest.update({
      where: { id },
      data: { status: 'submitted', notifiedAuthorityAt: new Date() },
    });
  }

  async approveChangeRequest(id: string, tenantId: string) {
    await this.findChangeRequestOrThrow(id, tenantId);
    return this.prisma.fstdChangeRequest.update({ where: { id }, data: { status: 'approved' } });
  }

  async rejectChangeRequest(id: string, tenantId: string) {
    await this.findChangeRequestOrThrow(id, tenantId);
    return this.prisma.fstdChangeRequest.update({ where: { id }, data: { status: 'rejected' } });
  }
}
