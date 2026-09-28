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

type MissingCharacteristic = { characteristic: FcsCharacteristic; required: FcsFidelityLevel; actual: FcsFidelityLevel | null };

export interface TaskCapabilityResult {
  basis: FstdQualificationBasisType;
  /// 可开始训练 (AMC1 to Appendix 9: 达到T阈值即可commence/practise, 但不能据此发放/续发签注学时)
  canStartTraining: boolean;
  /// 可完成训练并计入学时 (达到TP阈值; legacy体系下与canStartTraining相同, 因legacy只有二元的"已鉴定/未鉴定")
  canCompleteTraining: boolean;
  reason?: string;
  missingForStart?: MissingCharacteristic[];
  missingForCompletion?: MissingCharacteristic[];
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

  // ---- 装备规格清单 ESL (AMC1/AMC2 ORA.FSTD.120): 每台FSTD证书须配套一份, 含legacy设备(除BITD), 按14特征组织 ----

  /// 新修订生效时自动将该设备现有"当前修订版本"标记为已替代, 保证同一FSTD永远只有一个current ESL
  async createEslRevision(
    fstdId: string,
    tenantId: string,
    data: {
      revisionNumber: string;
      revisionDate: string;
      entries: { characteristic: FcsCharacteristic; fidelityLevel?: FcsFidelityLevel; equipmentDescription?: string; limitations?: string }[];
    },
  ) {
    await this.findFstdOrThrow(fstdId, tenantId);
    await this.prisma.equipmentSpecificationList.updateMany({
      where: { fstdId, supersededAt: null },
      data: { supersededAt: new Date() },
    });
    return this.prisma.equipmentSpecificationList.create({
      data: {
        fstdId,
        revisionNumber: data.revisionNumber,
        revisionDate: new Date(data.revisionDate),
        entries: { create: data.entries },
      },
      include: { entries: true },
    });
  }

  async listEsls(fstdId: string, tenantId: string) {
    await this.findFstdOrThrow(fstdId, tenantId);
    return this.prisma.equipmentSpecificationList.findMany({
      where: { fstdId },
      include: { entries: { orderBy: { characteristic: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /// ESL须由ORA.GEN.210(b)提名的合规负责人(NOMINATED_PERSON_COMPLIANCE)或其代表声明确认, 呼应安全政策的签署校验模式
  async declareEsl(eslId: string, tenantId: string, personnelId: string) {
    const esl = await this.prisma.equipmentSpecificationList.findUnique({
      where: { id: eslId },
      include: { fstd: { include: { organization: true } } },
    });
    if (!esl || esl.fstd.organization.tenantId !== tenantId) {
      throw new NotFoundException(`ESL ${eslId} not found`);
    }
    const hasRole = await this.prisma.personnelRoleAssignment.findFirst({
      where: { organizationId: esl.fstd.organizationId, personnelId, role: 'NOMINATED_PERSON_COMPLIANCE', endDate: null },
    });
    if (!hasRole) {
      throw new BadRequestException(
        `Personnel ${personnelId} does not currently hold the NOMINATED_PERSON_COMPLIANCE role for this organization`,
      );
    }
    return this.prisma.equipmentSpecificationList.update({
      where: { id: eslId },
      data: { declaredById: personnelId, declaredAt: new Date() },
    });
  }

  // ---- FSTD性能指标 (AMC1 ORA.FSTD.100(d)): 逐月上报, 官方公式计算可用率/可靠率 ----

  async recordPerformanceMetric(
    fstdId: string,
    tenantId: string,
    data: {
      year: number;
      month: number;
      plannedAvailableHours: number;
      scheduledTrainingHours: number;
      supportHours: number;
      fstdFailureHours: number;
      externalFailureHours: number;
      lostTrainingHours: number;
      discrepancyCount: number;
      interruptionCount: number;
    },
  ) {
    await this.findFstdOrThrow(fstdId, tenantId);
    if (data.month < 1 || data.month > 12) {
      throw new BadRequestException(`month must be 1-12, got ${data.month}`);
    }
    const metric = await this.prisma.fstdPerformanceMetric.upsert({
      where: { fstdId_year_month: { fstdId, year: data.year, month: data.month } },
      create: { fstdId, ...data },
      update: { ...data },
    });
    return this.withComputedMetrics(metric);
  }

  /// AMC1 ORA.FSTD.100(d)(c): 逐月数据 + 前12个月汇总, 一次性返回供合规看板使用
  async getPerformanceMetrics(fstdId: string, tenantId: string) {
    await this.findFstdOrThrow(fstdId, tenantId);
    const all = await this.prisma.fstdPerformanceMetric.findMany({
      where: { fstdId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 11); // 含当月共12个月窗口
    const cutoffYear = cutoff.getFullYear();
    const cutoffMonth = cutoff.getMonth() + 1;
    const recent = all.filter((m) => m.year > cutoffYear || (m.year === cutoffYear && m.month >= cutoffMonth));

    const sum = (key: 'plannedAvailableHours' | 'scheduledTrainingHours' | 'supportHours' | 'fstdFailureHours' | 'externalFailureHours' | 'lostTrainingHours' | 'discrepancyCount' | 'interruptionCount') =>
      recent.reduce((acc, m) => acc + m[key], 0);

    const plannedAvailableHours = sum('plannedAvailableHours');
    const fstdFailureHours = sum('fstdFailureHours');
    const externalFailureHours = sum('externalFailureHours');
    const downtimeHours = fstdFailureHours + externalFailureHours;

    return {
      monthly: all.map((m) => this.withComputedMetrics(m)),
      last12Months: {
        monthCount: recent.length,
        plannedAvailableHours,
        scheduledTrainingHours: sum('scheduledTrainingHours'),
        supportHours: sum('supportHours'),
        fstdFailureHours,
        externalFailureHours,
        downtimeHours,
        lostTrainingHours: sum('lostTrainingHours'),
        discrepancyCount: sum('discrepancyCount'),
        interruptionCount: sum('interruptionCount'),
        availabilityPercent: plannedAvailableHours > 0 ? ((plannedAvailableHours - downtimeHours) / plannedAvailableHours) * 100 : null,
        reliabilityPercent: plannedAvailableHours > 0 ? ((plannedAvailableHours - fstdFailureHours) / plannedAvailableHours) * 100 : null,
      },
    };
  }

  /// 官方公式 (AMC1 ORA.FSTD.100(d)(b)(8)(9)): downtime = fstdFailure + externalFailure (无论原因);
  /// availability% = (planned-downtime)/planned*100; reliability% = (planned-fstdFailure)/planned*100
  private withComputedMetrics<T extends { plannedAvailableHours: number; fstdFailureHours: number; externalFailureHours: number }>(
    m: T,
  ) {
    const downtimeHours = m.fstdFailureHours + m.externalFailureHours;
    const availabilityPercent = m.plannedAvailableHours > 0 ? ((m.plannedAvailableHours - downtimeHours) / m.plannedAvailableHours) * 100 : null;
    const reliabilityPercent = m.plannedAvailableHours > 0 ? ((m.plannedAvailableHours - m.fstdFailureHours) / m.plannedAvailableHours) * 100 : null;
    return { ...m, downtimeHours, availabilityPercent, reliabilityPercent };
  }

  // ---- 3.3.3 训练矩阵 (Part-FCL Appendix 9训练科目 x 14特征, 全局配置表, 非租户范围) ----

  addTrainingMatrixEntry(data: {
    taskCode: string;
    taskName: string;
    characteristic: FcsCharacteristic;
    thresholdT: FcsFidelityLevel;
    thresholdTP: FcsFidelityLevel;
  }) {
    // TP(完成训练)所需保真度理应不低于T(可开始训练), 否则数据本身自相矛盾 (AMC1 to Appendix 9的T/TP定义隐含此顺序)
    if (FIDELITY_RANK[data.thresholdTP] < FIDELITY_RANK[data.thresholdT]) {
      throw new BadRequestException(
        `thresholdTP (${data.thresholdTP}) 不能低于 thresholdT (${data.thresholdT}): TP要求应等于或高于T`,
      );
    }
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
  /// legacy体系查FstdQualifiedTask (二元判定), FCS体系逐特征比对训练矩阵thresholdT/thresholdTP要求 vs 设备实际保真度。
  /// 依据 AMC1 to Appendix 9 Section A point 1f: T=可开始训练(commence/practise), TP=可完成训练并计入学时,
  /// 两者是独立的判定点, 不能用同一个阈值替代——达到T不代表达到TP。
  async canDevicePerformTask(fstdId: string, taskCode: string): Promise<TaskCapabilityResult> {
    const fstd = await this.prisma.fstd.findUnique({ where: { id: fstdId } });
    if (!fstd) throw new NotFoundException(`FSTD ${fstdId} not found`);

    if (fstd.qualificationBasisType === 'EASA_LEGACY_LEVEL') {
      const task = await this.prisma.fstdQualifiedTask.findFirst({ where: { fstdId, taskCode } });
      return {
        basis: 'EASA_LEGACY_LEVEL',
        canStartTraining: !!task,
        canCompleteTraining: !!task,
        reason: task ? undefined : `设备未鉴定训练科目 ${taskCode}`,
      };
    }

    // EASA_FCS 分支
    const requirements = await this.prisma.trainingMatrixEntry.findMany({ where: { taskCode } });
    if (requirements.length === 0) {
      return {
        basis: 'EASA_FCS',
        canStartTraining: false,
        canCompleteTraining: false,
        reason: `训练科目 ${taskCode} 尚未定义训练矩阵要求`,
      };
    }
    const capabilities = await this.prisma.fstdFcsCapability.findMany({ where: { fstdId } });
    const missingForStart: MissingCharacteristic[] = [];
    const missingForCompletion: MissingCharacteristic[] = [];
    for (const req of requirements) {
      const actual = this.capabilityRankFor(capabilities, req.characteristic);
      if (actual.rank < FIDELITY_RANK[req.thresholdT]) {
        missingForStart.push({ characteristic: req.characteristic, required: req.thresholdT, actual: actual.level });
      }
      if (actual.rank < FIDELITY_RANK[req.thresholdTP]) {
        missingForCompletion.push({ characteristic: req.characteristic, required: req.thresholdTP, actual: actual.level });
      }
    }
    const describe = (missing: MissingCharacteristic[]) =>
      missing.map((m) => `${m.characteristic}(需要${m.required}, 实际${m.actual ?? '无'})`).join(', ');
    const reasonParts: string[] = [];
    if (missingForStart.length > 0) reasonParts.push(`不满足可开始训练(T)要求: ${describe(missingForStart)}`);
    if (missingForCompletion.length > 0) reasonParts.push(`不满足可完成训练(TP)要求: ${describe(missingForCompletion)}`);
    return {
      basis: 'EASA_FCS',
      canStartTraining: missingForStart.length === 0,
      canCompleteTraining: missingForCompletion.length === 0,
      reason: reasonParts.length > 0 ? reasonParts.join('; ') : undefined,
      missingForStart: missingForStart.length > 0 ? missingForStart : undefined,
      missingForCompletion: missingForCompletion.length > 0 ? missingForCompletion : undefined,
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
  /// pointerUrl: 未上传文件时的手填外部引用链接; 上传文件时改由storedFileName等参数携带实际文件元数据, 两者互斥
  async addQtgDocument(
    fstdId: string,
    tenantId: string,
    data: {
      documentType: QtgDocumentType;
      version: string;
      effectiveDate: string;
      pointerUrl?: string;
      storedFileName?: string;
      originalFileName?: string;
      mimeType?: string;
      fileSize?: number;
    },
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
        pointerUrl: data.storedFileName ?? data.pointerUrl,
        originalFileName: data.originalFileName,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
      },
    });
  }

  async listQtgDocuments(fstdId: string, tenantId: string) {
    await this.findFstdOrThrow(fstdId, tenantId);
    return this.prisma.fstdQtgDocument.findMany({ where: { fstdId }, orderBy: { createdAt: 'desc' } });
  }

  /// 下载入口的租户校验: 通过文档反查所属设备的机构再核对租户, 与其余fstdId间接子资源的校验模式一致
  async findQtgDocumentForDownload(docId: string, tenantId: string) {
    const doc = await this.prisma.fstdQtgDocument.findUnique({
      where: { id: docId },
      include: { fstd: { include: { organization: true } } },
    });
    if (!doc || doc.fstd.organization.tenantId !== tenantId) {
      throw new NotFoundException(`QTG document ${docId} not found`);
    }
    if (!doc.originalFileName) {
      throw new BadRequestException(`QTG document ${docId} 没有已上传的文件 (仅登记了外部引用链接)`);
    }
    return doc;
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
