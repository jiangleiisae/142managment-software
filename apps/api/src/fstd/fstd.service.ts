import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  FcsCharacteristic,
  FcsFidelityLevel,
  FstdDeviceType,
  FstdQualificationBasisType,
  LegacyLevel,
  PmCheckLevel,
  PmTaskStatus,
  Prisma,
  QtgDocumentType,
  RetentionCategory,
} from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const CN_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_GROUNDING_DAYS_AHEAD = 366;

/// 训练中心按北京时间(UTC+8, 无夏令时)划分日历日, 停飞日历也按北京时间的日期记录
function cnTodayString(): string {
  return new Date(Date.now() + CN_OFFSET_MS).toISOString().slice(0, 10);
}

/// 把 YYYY-MM-DD 解析为当日 00:00 UTC 的 Date (用于 @db.Date 列); 不是真实存在的日期则抛错
function parseCalendarDate(date: string): Date {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new BadRequestException(`日期 "${date}" 不是有效的日历日`);
  }
  return parsed;
}

/// 北京时间某日历日对应的 [开始, 结束) UTC 时刻
function cnDayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getTime() - CN_OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

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

/// CCAR-60 附录B: 飞行模拟训练设备质量管理系统要求清单 ((b)指定管理人员 + (c)(1)-(21)逐项书面程序)
export const FSTD_QMS_CHECKLIST_ITEMS = [
  '已指定至少一名管理人员, 负责建立/纠正QMS政策措施程序, 并就本规则事宜与民航局联系', // (b)
  '管理部门确保满足规则/鉴定性能标准/建立质量系统重要性的方法', // (c)(1)
  '管理部门确定满足规章标准和QMS要求的方法, 及不符合时的纠正与防止再发生方法', // (c)(2)
  '管理部门确定能及时正常提供合格FSTD的方法', // (c)(3)
  'FSTD正常维护/维修/零件更换/改装等工艺的标准、定义或描述, 及由谁/何时/如何确认符合标准', // (c)(4)
  '保存和控制技术参考文件、训练记录和其他文档的方法', // (c)(5)
  '选择从事FSTD检查/测试/维修(预防性和纠正性)人员的标准(如训练或经验)', // (c)(6)
  '对FSTD的检查/测试/维修(预防性和纠正性)进行跟踪的方法', // (c)(7)
  '向训练大纲审批部门报告民航局计划实施的鉴定及每次鉴定结果的方法', // (c)(8)
  '确保飞行教员/检查员/考试员/执行日常飞行前检查的人员能够发现FSTD缺陷的方法', // (c)(9)
  '确保上述人员在故障记录本或故障记录系统中记录FSTD故障及缺件/故障/不工作部件的方法', // (c)(10)
  '确保完整准确记录FSTD中断次数、耽误训练/考试/检查/获取飞行经历的时间及中断原因的方法', // (c)(11)
  '通知FSTD使用者因缺件/故障/不工作部件而引起的使用限制的方法', // (c)(12)
  '记录民航局实施的鉴定和其他检查(如日常飞行前检查、运营人自查)的方法, 含日期/结果/缺陷/建议/纠正措施', // (c)(13)
  '确保FSTD与所模拟航空器构型一致, 以及改装后最新构型系统功能正常的方法', // (c)(14)
  '确定预计的航空器/FSTD改装是否影响性能操纵等特性, 并与训练管理部门、其他用户和民航局沟通的方法', // (c)(15)
  '根据故障记录本/系统信息排除故障, 必要时修改现行维护程序的方法', // (c)(16)
  '确定何时/怎样完成软硬件更改并跟踪记录(自初始QMS评估审核以来所有更改)的方法', // (c)(17)
  '确定FSTD在日常使用中满足相应标准的方法', // (c)(18)
  '获取飞行教员/检查员/考试员及FSTD技术维修人员关于FSTD运行的独立反馈意见, 并说明处理方法', // (c)(19)
  '对检验/测量/监控FSTD正确运行的设备进行精度校准调整的方法, 含可追溯性及保持良好运行状态的方法', // (c)(20)
  '由何人、如何、以多长周期进行质量保证计划的内部审计, 审计结果如何保管并向管理部门和民航局报告', // (c)(21)
];

interface FstdQmsChecklistItem {
  item: string;
  compliant: boolean;
  notes?: string;
}

/// 已建立QMS: establishedAt已填写, 且21+1项清单全部合规 (60.19条有效期档位的判定依据)
function isFstdQmsEstablished(qms: { establishedAt: Date | null; itemsJson: unknown } | null | undefined): boolean {
  if (!qms?.establishedAt) return false;
  const items = Array.isArray(qms.itemsJson) ? (qms.itemsJson as FstdQmsChecklistItem[]) : [];
  return items.length === FSTD_QMS_CHECKLIST_ITEMS.length && items.every((i) => i.compliant);
}

/// CCAR-60第60.37条(c): 飞行前功能检查内容——(a)(2)每个飞行日历日开始使用前、(a)(3)每7个连续日历日内至少一次,
/// 两款共用同一份检查项目, 同一天完成一次即可同时满足两款要求
export const FSTD_PRE_FLIGHT_CHECK_ITEMS = [
  '外部液压、气源和电器连接的检查', // (c)(1)
  '运动系统行程范围内无潜在障碍物检查', // (c)(2)
  '飞行模拟训练设备故障记录检查', // (c)(3)
  '接通主电源(含运动系统)并使其达到稳定状态', // (c)(4)(i)
  '接通航空器电源(快速起动发动机/辅助动力装置/地面电源)', // (c)(4)(ii)
  '全面检查照明灯泡功能、带灯光仪表和电门、故障警告旗或其他指示', // (c)(4)(iii)
  '检查飞行管理系统在有效日期范围内', // (c)(4)(iv)
  '选择起飞位置, 从任一驾驶员位置观察视景系统运行(光点、颜色平衡与汇聚、边缘匹配等)', // (c)(4)(v)
  '调整能见度值并解冻位置/飞行冻结, 检查声音系统和发动机仪表反应、滑行、减速板刹车可靠性、运动系统、反推', // (c)(4)(vi)
  '选择五边位置观察视景图像, 检查起落架/襟翼正常操作、操纵感觉和自由度、飞机正确反应', // (c)(4)(vii)
  '放出起落架和襟翼(如适用)', // (c)(4)(viii)
  '飞行到机场并着陆或者选择起飞位置', // (c)(4)(ix)
  '关停发动机, 关闭灯光、主电源和运动系统', // (c)(4)(x)
  '发现缺件、故障或不工作部件时记录在故障记录本或故障记录系统中', // (c)(4)(xi)
];

const PRE_FLIGHT_CHECK_WINDOW_DAYS = 7;

/// 各鉴定基础允许的等级: EASA legacy 为 CS-FSTD(A) Issue 2 的 FFS A-D / FTD 1-2 / FNPT / BITD;
/// CCAR-60 为 FFS A-D / FTD 1-7 (第60.71条)。EASA_FCS 体系不按等级鉴定, 保留既有的宽松处理(存量设备可同时记 legacy 等级)。
const CCAR_60_LEVELS: LegacyLevel[] = ['FFS_A', 'FFS_B', 'FFS_C', 'FFS_D', 'FTD_1', 'FTD_2', 'FTD_3', 'FTD_4', 'FTD_5', 'FTD_6', 'FTD_7'];
const EASA_LEGACY_LEVELS: LegacyLevel[] = ['FFS_A', 'FFS_B', 'FFS_C', 'FFS_D', 'FTD_1', 'FTD_2', 'FNPT_I', 'FNPT_II', 'FNPT_II_MCC', 'BITD'];

function assertLevelMatchesBasis(basis: FstdQualificationBasisType, level: LegacyLevel | undefined) {
  if (!level) return;
  if (basis === 'CCAR_60' && !CCAR_60_LEVELS.includes(level)) {
    throw new BadRequestException(`CCAR-60 鉴定基础下等级只能是 FFS A-D 或 FTD 1-7, 不能是 ${level}`);
  }
  if (basis === 'EASA_LEGACY_LEVEL' && !EASA_LEGACY_LEVELS.includes(level)) {
    throw new BadRequestException(`EASA legacy 鉴定基础下不能使用等级 ${level} (FTD 3-7 仅适用于 CCAR-60)`);
  }
}

/// CCAR-60第60.19条: 合格证有效期档位。方向与EASA相反——建立QMS后有效期更长, 未建立则更短,
/// 而非EASA"12个月为标准、24/36个月需专门申请延期"的例外逻辑。
/// (a)款: 模拟大型飞机(多发、公共航空运输)的FFS, 单独档位 12/6个月。
/// (b)款: 其他FSTD, FFS为24/12个月, 飞行训练器(FTD/FNPT视同训练器)为36/18个月。
/// BITD在CCAR-60中无对应分类, 不适用本函数, 沿用既有EASA式固定周期。
export function computeCaacValidityMonths(
  deviceType: FstdDeviceType,
  isLargeAircraftPublicTransport: boolean,
  qmsEstablished: boolean,
): number {
  if (deviceType === 'FFS' && isLargeAircraftPublicTransport) {
    return qmsEstablished ? 12 : 6;
  }
  if (deviceType === 'FFS') {
    return qmsEstablished ? 24 : 12;
  }
  return qmsEstablished ? 36 : 18;
}

@Injectable()
export class FstdService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

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
    isLargeAircraftPublicTransport?: boolean;
  }) {
    assertLevelMatchesBasis(data.qualificationBasisType ?? 'EASA_LEGACY_LEVEL', data.legacyLevel);
    return this.prisma.fstd
      .create({
        data: {
          organizationId: data.organizationId,
          deviceCode: data.deviceCode,
          representedAircraft: data.representedAircraft,
          deviceType: data.deviceType,
          serialNumber: data.serialNumber,
          location: data.location,
          qualificationBasisType: data.qualificationBasisType ?? 'EASA_LEGACY_LEVEL',
          isLargeAircraftPublicTransport: data.isLargeAircraftPublicTransport ?? false,
          ...(data.legacyLevel
            ? { legacyLevel: { create: { level: data.legacyLevel } } }
            : {}),
        },
        include: { legacyLevel: true, organization: true },
      })
      .then(async (fstd) => {
        await this.auditLog.write(fstd.organization.tenantId, 'Fstd', fstd.id, 'create', null, fstd);
        return fstd;
      });
  }

  async updateFstd(id: string, tenantId: string, data: { isLargeAircraftPublicTransport?: boolean }) {
    const before = await this.findFstdOrThrow(id, tenantId);
    const updated = await this.prisma.fstd.update({
      where: { id },
      data: { isLargeAircraftPublicTransport: data.isLargeAircraftPublicTransport },
    });
    await this.auditLog.write(tenantId, 'Fstd', id, 'update', before, updated);
    return updated;
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
    // fstdId 单独赋值且放在最后, 避免请求体里携带的同名字段覆盖路径参数校验过的fstdId
    return this.prisma.fstdQualifiedTask.create({
      data: { taskCode: data.taskCode, taskName: data.taskName, requiresSpecialAuth: data.requiresSpecialAuth, fstdId },
    });
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
      const updated = await this.prisma.fstdFcsCapability.update({
        where: { id: existing.id },
        data: { fidelityLevel: data.fidelityLevel, isAssigned: data.isAssigned ?? false },
      });
      await this.auditLog.write(tenantId, 'FstdFcsCapability', updated.id, 'update', existing, updated);
      return updated;
    }
    const created = await this.prisma.fstdFcsCapability.create({
      data: {
        fstdId,
        characteristic: data.characteristic,
        fidelityLevel: data.fidelityLevel,
        subsystem: data.subsystem,
        isAssigned: data.isAssigned ?? false,
      },
    });
    await this.auditLog.write(tenantId, 'FstdFcsCapability', created.id, 'create', null, created);
    return created;
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
    const superseded = await this.prisma.equipmentSpecificationList.findMany({ where: { fstdId, supersededAt: null } });
    await this.prisma.equipmentSpecificationList.updateMany({
      where: { fstdId, supersededAt: null },
      data: { supersededAt: new Date() },
    });
    const created = await this.prisma.equipmentSpecificationList.create({
      data: {
        fstdId,
        revisionNumber: data.revisionNumber,
        revisionDate: new Date(data.revisionDate),
        entries: { create: data.entries },
      },
      include: { entries: true },
    });
    await this.auditLog.write(
      tenantId,
      'EquipmentSpecificationList',
      created.id,
      superseded.length > 0 ? 'create_supersedes_previous' : 'create',
      superseded,
      created,
    );
    return created;
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
    const updated = await this.prisma.equipmentSpecificationList.update({
      where: { id: eslId },
      data: { declaredById: personnelId, declaredAt: new Date() },
    });
    await this.auditLog.write(tenantId, 'EquipmentSpecificationList', eslId, 'declare', esl, updated);
    return updated;
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
    const metricFields = {
      year: data.year,
      month: data.month,
      plannedAvailableHours: data.plannedAvailableHours,
      scheduledTrainingHours: data.scheduledTrainingHours,
      supportHours: data.supportHours,
      fstdFailureHours: data.fstdFailureHours,
      externalFailureHours: data.externalFailureHours,
      lostTrainingHours: data.lostTrainingHours,
      discrepancyCount: data.discrepancyCount,
      interruptionCount: data.interruptionCount,
    };
    const metric = await this.prisma.fstdPerformanceMetric.upsert({
      where: { fstdId_year_month: { fstdId, year: data.year, month: data.month } },
      create: { ...metricFields, fstdId },
      update: metricFields,
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

    // legacy 与 CCAR-60 都按"已鉴定训练科目清单"二元判定; 只有 EASA_FCS 走训练矩阵
    if (fstd.qualificationBasisType !== 'EASA_FCS') {
      const task = await this.prisma.fstdQualifiedTask.findFirst({ where: { fstdId, taskCode } });
      return {
        basis: fstd.qualificationBasisType,
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

  /// 机构范围内所有开放中的缺陷 (跨设备), 供备件出入库登记时选择"关联缺陷"下拉框使用
  async listOpenDiscrepanciesForOrg(organizationId: string, tenantId: string) {
    return this.prisma.discrepancyLog.findMany({
      where: { status: 'open', fstd: { organizationId, organization: { tenantId } } },
      include: { fstd: true },
      orderBy: { reportedAt: 'desc' },
    });
  }

  private async findDiscrepancyOrThrow(discrepancyId: string, tenantId: string) {
    const discrepancy = await this.prisma.discrepancyLog.findUnique({
      where: { id: discrepancyId },
      include: { fstd: { include: { organization: true } } },
    });
    if (!discrepancy || discrepancy.fstd.organization.tenantId !== tenantId) {
      throw new NotFoundException(`Discrepancy ${discrepancyId} not found`);
    }
    return discrepancy;
  }

  async correctDiscrepancy(
    discrepancyId: string,
    tenantId: string,
    data: { correctiveAction: string; correctedById?: string },
  ) {
    const discrepancy = await this.findDiscrepancyOrThrow(discrepancyId, tenantId);
    if (discrepancy.status !== 'open') {
      throw new BadRequestException(`Discrepancy ${discrepancyId} is already ${discrepancy.status}`);
    }
    const updated = await this.prisma.discrepancyLog.update({
      where: { id: discrepancyId },
      data: {
        correctiveAction: data.correctiveAction,
        correctedById: data.correctedById,
        correctedAt: new Date(),
        status: 'corrected',
      },
    });
    await this.auditLog.write(tenantId, 'DiscrepancyLog', discrepancyId, 'status_change:open->corrected', discrepancy, updated);
    return updated;
  }

  /// 故障保留分级 (吸收天津飞安实践, 类似MEL的Category体系): 允许经评估的开放缺陷正式"带病运行",
  /// 设置后该缺陷不再被3.8排班引擎的Training Restriction规则阻断 (见scheduling.service.ts)。
  async setDiscrepancyRetention(
    discrepancyId: string,
    tenantId: string,
    data: { category: RetentionCategory; justification: string; approvedById: string; expiresAt?: string },
  ) {
    const discrepancy = await this.findDiscrepancyOrThrow(discrepancyId, tenantId);
    if (discrepancy.status !== 'open') {
      throw new BadRequestException(`只能对开放中的缺陷设置保留分级, 当前状态: ${discrepancy.status}`);
    }
    const updated = await this.prisma.discrepancyLog.update({
      where: { id: discrepancyId },
      data: {
        retentionCategory: data.category,
        retentionJustification: data.justification,
        retentionApprovedById: data.approvedById,
        retentionApprovedAt: new Date(),
        retentionExpiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    });
    await this.auditLog.write(tenantId, 'DiscrepancyLog', discrepancyId, 'set_retention', discrepancy, updated);
    return updated;
  }

  async clearDiscrepancyRetention(discrepancyId: string, tenantId: string) {
    const discrepancy = await this.findDiscrepancyOrThrow(discrepancyId, tenantId);
    const updated = await this.prisma.discrepancyLog.update({
      where: { id: discrepancyId },
      data: {
        retentionCategory: null,
        retentionJustification: null,
        retentionApprovedById: null,
        retentionApprovedAt: null,
        retentionExpiresAt: null,
      },
    });
    await this.auditLog.write(tenantId, 'DiscrepancyLog', discrepancyId, 'clear_retention', discrepancy, updated);
    return updated;
  }

  // ---- 3.3.5 周期性评估: 标准周期12个月(BITD为3年), 满足条件可延长至24/36个月, 评估窗口内完成即视为按时 ----

  /// 评估窗口 (3.3.5: 周期开始前60天至开始后30天完成视为按时), 基于上一次评估的到期日计算; 首次评估无从比较返回null
  private computeIsWithinWindow(periodStart: Date, previousNextDueDate: Date | null): boolean | null {
    if (!previousNextDueDate) return null;
    const windowStart = new Date(previousNextDueDate);
    windowStart.setDate(windowStart.getDate() - 60);
    const windowEnd = new Date(previousNextDueDate);
    windowEnd.setDate(windowEnd.getDate() + 30);
    return periodStart >= windowStart && periodStart <= windowEnd;
  }

  async recordRecurrentEvaluation(
    fstdId: string,
    tenantId: string,
    data: { periodStart: string; periodEnd: string; evaluationType?: string; extensionMonths?: number; result?: string },
  ) {
    const fstd = await this.findFstdOrThrow(fstdId, tenantId);
    const periodStart = new Date(data.periodStart);
    const periodEnd = new Date(data.periodEnd);
    const nextDueDate = new Date(periodEnd);
    let evaluationType = data.evaluationType ?? 'standard';
    // BITD在CCAR-60中无对应分类, 两套标准下均沿用固定3年周期
    if (fstd.deviceType === 'BITD') {
      nextDueDate.setFullYear(nextDueDate.getFullYear() + 3);
    } else if (fstd.organization.regulatoryStandard === 'CAAC') {
      // CCAR-60第60.19条: 有效期档位由QMS建立状态决定, 不采用EASA的人工申请延期流程 (见computeCaacValidityMonths)
      const qms = await this.prisma.fstdQms.findUnique({ where: { organizationId: fstd.organizationId } });
      const qmsEstablished = isFstdQmsEstablished(qms);
      const months = computeCaacValidityMonths(fstd.deviceType, fstd.isLargeAircraftPublicTransport, qmsEstablished);
      nextDueDate.setMonth(nextDueDate.getMonth() + months);
      evaluationType = qmsEstablished ? 'caac_qms_established' : 'caac_qms_not_established';
    } else if (evaluationType === 'extended') {
      // 满足延长条件(见checkExtensionEligibility)可延长至24/36个月; 其余标准周期12个月 (需求清单3.3.5)
      nextDueDate.setMonth(nextDueDate.getMonth() + (data.extensionMonths === 36 ? 36 : 24));
    } else {
      nextDueDate.setMonth(nextDueDate.getMonth() + 12);
    }

    const previous = await this.prisma.fstdRecurrentEvaluation.findFirst({ where: { fstdId }, orderBy: { periodEnd: 'desc' } });
    const isWithinWindow = this.computeIsWithinWindow(periodStart, previous?.nextDueDate ?? null);

    const evaluation = await this.prisma.fstdRecurrentEvaluation.create({
      data: { fstdId, periodStart, periodEnd, evaluationType, result: data.result, nextDueDate },
    });
    return { ...evaluation, isWithinWindow };
  }

  async listRecurrentEvaluations(fstdId: string, tenantId: string) {
    await this.findFstdOrThrow(fstdId, tenantId);
    const evals = await this.prisma.fstdRecurrentEvaluation.findMany({ where: { fstdId }, orderBy: { periodEnd: 'desc' } });
    // evals按periodEnd降序排列, 故下标i+1即为上一次(更早)的评估记录
    return evals.map((e, i) => ({
      ...e,
      isWithinWindow: this.computeIsWithinWindow(e.periodStart, evals[i + 1]?.nextDueDate ?? null),
    }));
  }

  /// 延长周期资格建议 (3.3.5: 连续36个月合规记录+管理体系年度审计+指定合格人员自评, 满足可延长至24/36个月)。
  /// 前两项可由系统核实, 第三项(指定合格人员自评)需机构在登记延长评估时人工确认, 最终是否批准延长仍由主管机关判断——
  /// 本接口仅提供参考建议, 不做强制阻断。
  async checkExtensionEligibility(fstdId: string, tenantId: string) {
    const fstd = await this.findFstdOrThrow(fstdId, tenantId);
    const recentEvals = await this.prisma.fstdRecurrentEvaluation.findMany({
      where: { fstdId },
      orderBy: { periodEnd: 'desc' },
      take: 3,
    });
    const has36MonthsCompliantRecord = recentEvals.length === 3 && recentEvals.every((e) => e.result === 'pass');

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const recentAudit = await this.prisma.auditTask.findFirst({
      where: {
        auditSchedule: { organizationId: fstd.organizationId },
        status: 'completed',
        performedAt: { gte: oneYearAgo },
      },
    });

    return {
      has36MonthsCompliantRecord,
      hasAnnualManagementAudit: !!recentAudit,
      requiresManualSelfAssessmentConfirmation: true,
    };
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

  // ---- CCAR-60第60.37条(a)(2)(3): 飞行前功能检查 (每日使用前 + 每7日保底) ----

  listPreFlightCheckItems() {
    return FSTD_PRE_FLIGHT_CHECK_ITEMS;
  }

  async recordPreFlightCheck(
    fstdId: string,
    tenantId: string,
    data: { checkDate: string; performedById?: string; items: { item: string; passed: boolean; notes?: string }[] },
  ) {
    await this.findFstdOrThrow(fstdId, tenantId);
    const checkDate = new Date(data.checkDate);
    const nextDueDate = new Date(checkDate);
    nextDueDate.setDate(nextDueDate.getDate() + PRE_FLIGHT_CHECK_WINDOW_DAYS);
    const overallResult = data.items.every((i) => i.passed) ? 'pass' : 'issues_found';
    return this.prisma.fstdPreFlightCheck.upsert({
      where: { fstdId_checkDate: { fstdId, checkDate } },
      create: { fstdId, checkDate, performedById: data.performedById, itemsJson: data.items, overallResult, nextDueDate },
      update: { performedById: data.performedById, itemsJson: data.items, overallResult, nextDueDate },
    });
  }

  async listPreFlightChecks(fstdId: string, tenantId: string) {
    await this.findFstdOrThrow(fstdId, tenantId);
    return this.prisma.fstdPreFlightCheck.findMany({ where: { fstdId }, orderBy: { checkDate: 'desc' } });
  }

// ---- 停飞日历 (R3) ----

  /// 机构内某月(YYYY-MM)的停飞记录 (含过去的历史)
  async listGroundings(organizationId: string | undefined, month: string) {
    if (!organizationId) throw new BadRequestException('缺少 organizationId');
    if (!/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException('month 必须是 YYYY-MM 格式');
    const start = parseCalendarDate(`${month}-01`);
    const next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    const rows = await this.prisma.fstdGrounding.findMany({
      where: { fstd: { organizationId }, date: { gte: start, lt: next } },
      orderBy: [{ date: 'asc' }],
    });
    return rows.map((r) => ({ fstdId: r.fstdId, date: r.date.toISOString().slice(0, 10), note: r.note }));
  }

  private async resolveGroundingEntries(organizationId: string, entries: { fstdId: string; date: string }[], maxAhead: boolean) {
    const today = cnTodayString();
    const limit = parseCalendarDate(today).getTime() + MAX_GROUNDING_DAYS_AHEAD * DAY_MS;
    const parsed = entries.map((e) => ({ fstdId: e.fstdId, date: e.date, dateValue: parseCalendarDate(e.date) }));
    for (const e of parsed) {
      if (e.date < today) throw new BadRequestException(`不能修改过去日期(${e.date})的停飞标记, 过去的记录作为历史保留`);
      if (maxAhead && e.dateValue.getTime() > limit) throw new BadRequestException(`停飞日期(${e.date})超出可标记范围 (最多提前${MAX_GROUNDING_DAYS_AHEAD}天)`);
    }
    const ids = [...new Set(parsed.map((e) => e.fstdId))];
    const owned = await this.prisma.fstd.findMany({ where: { id: { in: ids }, organizationId }, select: { id: true } });
    if (owned.length !== ids.length) throw new BadRequestException('包含不属于该机构的设备');
    return parsed;
  }

  /// 标记停飞 (幂等)。返回已存在的预订冲突供用户处理——这里只提示, 不会自动取消预订。
  async markGroundings(tenantId: string, organizationId: string, entries: { fstdId: string; date: string }[], note?: string) {
    const parsed = await this.resolveGroundingEntries(organizationId, entries, true);
    const created = await this.prisma.fstdGrounding.createMany({
      data: parsed.map((e) => ({ fstdId: e.fstdId, date: e.dateValue, note })),
      skipDuplicates: true,
    });
    const conflicts = await this.findBookingConflicts(parsed);
    await this.auditLog.write(tenantId, 'FstdGrounding', organizationId, 'mark', null, { entries, note });
    return { requested: parsed.length, created: created.count, conflictingBookings: conflicts };
  }

  /// 取消停飞 (只能取消当天及以后)
  async cancelGroundings(tenantId: string, organizationId: string, entries: { fstdId: string; date: string }[]) {
    const parsed = await this.resolveGroundingEntries(organizationId, entries, false);
    const result = await this.prisma.fstdGrounding.deleteMany({
      where: { OR: parsed.map((e) => ({ fstdId: e.fstdId, date: e.dateValue })) },
    });
    await this.auditLog.write(tenantId, 'FstdGrounding', organizationId, 'cancel', { entries }, null);
    return { requested: parsed.length, removed: result.count };
  }

  private async findBookingConflicts(entries: { fstdId: string; date: string; dateValue: Date }[]) {
    const bounds = entries.map((e) => ({ ...e, ...cnDayBounds(e.dateValue) }));
    const bookings = await this.prisma.booking.findMany({
      where: {
        resourceType: 'FSTD',
        status: 'confirmed',
        resourceId: { in: [...new Set(entries.map((e) => e.fstdId))] },
        startAt: { lt: new Date(Math.max(...bounds.map((b) => b.end.getTime()))) },
        endAt: { gt: new Date(Math.min(...bounds.map((b) => b.start.getTime()))) },
      },
      select: { id: true, resourceId: true, startAt: true, endAt: true, trainingType: true },
    });
    return bounds.flatMap((b) =>
      bookings
        .filter((k) => k.resourceId === b.fstdId && k.startAt < b.end && k.endAt > b.start)
        .map((k) => ({ bookingId: k.id, fstdId: k.resourceId, date: b.date, startAt: k.startAt, endAt: k.endAt, trainingType: k.trainingType })),
    );
  }

  /// 找出飞行前功能检查已超过7日未做(或从未做过)的设备——60.37条(a)(3)"每7个连续日历日至少一次"的保底要求
  async findPreFlightChecksDueSoon(tenantId: string, withinDays = 2) {
    const fstds = await this.prisma.fstd.findMany({
      where: { organization: { tenantId }, status: 'active' },
      include: {
        preFlightChecks: { orderBy: { checkDate: 'desc' }, take: 1 },
        groundings: { where: { date: parseCalendarDate(cnTodayString()) }, select: { id: true } },
      },
    });
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + withinDays);
    return fstds
      // 今天处于停飞日历内的设备不再提醒飞行前功能检查超期 (停飞期间设备不使用, 无须检查)
      .filter((f) => f.groundings.length === 0)
      .filter((f) => {
        const latest = f.preFlightChecks[0];
        return !latest || latest.nextDueDate <= cutoff;
      })
      .map((f) => ({
        fstdId: f.id,
        deviceCode: f.deviceCode,
        nextDueDate: f.preFlightChecks[0]?.nextDueDate ?? null,
        lastResult: f.preFlightChecks[0]?.overallResult ?? null,
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
    const superseded = await this.prisma.fstdQtgDocument.findMany({
      where: { fstdId, documentType: data.documentType, supersededAt: null },
    });
    await this.prisma.fstdQtgDocument.updateMany({
      where: { fstdId, documentType: data.documentType, supersededAt: null },
      data: { supersededAt: new Date() },
    });
    const created = await this.prisma.fstdQtgDocument.create({
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
    await this.auditLog.write(
      tenantId,
      'FstdQtgDocument',
      created.id,
      superseded.length > 0 ? 'create_supersedes_previous' : 'create',
      superseded,
      created,
    );
    return created;
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

  // 3.3.6 变更管理已迁移至通用 /change-requests 接口 (entityType=Fstd), 见 change-management 模块

  // ==================== 3.3.10 常规维护(PM)排期 (吸收天津飞安实践) ====================
  // 独立于3.3.4 QTG(按季度滚动)和3.3.5周期性评估(按年/三年)的第三套周期性机制,
  // 服务于机构内部更高频的日常维护节奏, 与3.3.7缺陷处理共享"设备技术记录"入口。

  private computePmNextDueDate(level: PmCheckLevel, from: Date): Date {
    const next = new Date(from);
    switch (level) {
      case PmCheckLevel.WEEKLY:
        next.setDate(next.getDate() + 7);
        break;
      case PmCheckLevel.MONTHLY:
        next.setMonth(next.getMonth() + 1);
        break;
      case PmCheckLevel.SEMI_ANNUAL:
        next.setMonth(next.getMonth() + 6);
        break;
      case PmCheckLevel.ANNUAL:
        next.setMonth(next.getMonth() + 12);
        break;
    }
    return next;
  }

  /// 每层级对应一套可配置检查单模板(而非硬编码检查项), 每机构每层级一套, 按level upsert
  async setPmChecklistTemplate(organizationId: string, tenantId: string, data: { level: PmCheckLevel; itemsJson: { item: string }[] }) {
    const before = await this.prisma.pmChecklistTemplate.findUnique({
      where: { organizationId_level: { organizationId, level: data.level } },
    });
    const template = await this.prisma.pmChecklistTemplate.upsert({
      where: { organizationId_level: { organizationId, level: data.level } },
      create: { organizationId, level: data.level, itemsJson: data.itemsJson },
      update: { itemsJson: data.itemsJson },
    });
    await this.auditLog.write(tenantId, 'PmChecklistTemplate', template.id, before ? 'update' : 'create', before, template);
    return template;
  }

  listPmChecklistTemplates(organizationId: string) {
    return this.prisma.pmChecklistTemplate.findMany({ where: { organizationId }, orderBy: { level: 'asc' } });
  }

  // ---- CCAR-60 附录B: FSTD质量管理系统 (按机构建立, 覆盖其全部FSTD) ----

  listQmsChecklistItems() {
    return FSTD_QMS_CHECKLIST_ITEMS;
  }

  async getQms(organizationId: string) {
    const qms = await this.prisma.fstdQms.findUnique({ where: { organizationId } });
    return { ...qms, isEstablished: isFstdQmsEstablished(qms) };
  }

  async upsertQms(
    organizationId: string,
    tenantId: string,
    data: { establishedAt?: string; designatedManagerName?: string; items?: FstdQmsChecklistItem[]; lastInternalAuditAt?: string },
  ) {
    const before = await this.prisma.fstdQms.findUnique({ where: { organizationId } });
    const payload = {
      establishedAt: data.establishedAt ? new Date(data.establishedAt) : before?.establishedAt ?? null,
      designatedManagerName: data.designatedManagerName ?? before?.designatedManagerName,
      itemsJson: (data.items ?? before?.itemsJson ?? []) as Prisma.InputJsonValue,
      lastInternalAuditAt: data.lastInternalAuditAt ? new Date(data.lastInternalAuditAt) : before?.lastInternalAuditAt ?? null,
    };
    const qms = await this.prisma.fstdQms.upsert({
      where: { organizationId },
      create: { organizationId, ...payload },
      update: payload,
    });
    await this.auditLog.write(tenantId, 'FstdQms', qms.id, before ? 'update' : 'create', before, qms);
    return { ...qms, isEstablished: isFstdQmsEstablished(qms) };
  }

  /// 执行阶段: 执行人逐项登记检查结果, 进入PENDING_REVIEW等待审核 (须已为该层级配置检查单模板)
  async createPmTask(
    fstdId: string,
    tenantId: string,
    data: {
      level: PmCheckLevel;
      taskDate: string;
      performedById?: string;
      responsibleIds?: string[];
      itemResultsJson: { item: string; passed: boolean; notes?: string }[];
    },
  ) {
    const fstd = await this.findFstdOrThrow(fstdId, tenantId);
    const template = await this.prisma.pmChecklistTemplate.findUnique({
      where: { organizationId_level: { organizationId: fstd.organizationId, level: data.level } },
    });
    if (!template) {
      throw new BadRequestException(`该机构尚未配置 ${data.level} 层级的检查单模板, 请先配置后再登记任务`);
    }
    const task = await this.prisma.pmTask.create({
      data: {
        fstdId,
        checklistTemplateId: template.id,
        level: data.level,
        taskDate: new Date(data.taskDate),
        performedById: data.performedById,
        responsibleIds: data.responsibleIds ?? [],
        itemResultsJson: data.itemResultsJson,
      },
    });
    await this.auditLog.write(tenantId, 'PmTask', task.id, 'create', null, task);
    return task;
  }

  async listPmTasks(fstdId: string, tenantId: string) {
    await this.findFstdOrThrow(fstdId, tenantId);
    return this.prisma.pmTask.findMany({ where: { fstdId }, orderBy: { taskDate: 'desc' } });
  }

  private async findPmTaskOrThrow(id: string, tenantId: string) {
    const task = await this.prisma.pmTask.findUnique({ where: { id }, include: { fstd: { include: { organization: true } } } });
    if (!task || task.fstd.organization.tenantId !== tenantId) throw new NotFoundException(`PmTask ${id} not found`);
    return task;
  }

  /// 审核阶段: 审核人须与执行人不同, 形成有效的交叉核查留痕而非自我签署
  async reviewPmTask(id: string, tenantId: string, data: { approve: boolean; reviewedById: string; reviewNotes?: string }) {
    const task = await this.findPmTaskOrThrow(id, tenantId);
    if (task.status !== PmTaskStatus.PENDING_REVIEW) {
      throw new BadRequestException(`Cannot review PM task from status ${task.status}`);
    }
    if (task.performedById && data.reviewedById === task.performedById) {
      throw new BadRequestException('审核人须与执行人不同, 不能自己审核自己执行的任务');
    }
    const updated = await this.prisma.pmTask.update({
      where: { id },
      data: {
        status: data.approve ? PmTaskStatus.APPROVED : PmTaskStatus.REJECTED,
        reviewedById: data.reviewedById,
        reviewedAt: new Date(),
        reviewNotes: data.reviewNotes,
      },
    });
    await this.auditLog.write(tenantId, 'PmTask', id, `status_change:PENDING_REVIEW->${updated.status}`, task, updated);
    return updated;
  }

  /// 各(设备,层级)下次到期日 = 最近一次审核通过(APPROVED)任务的日期 + 该层级间隔; 仅统计已配置模板的层级,
  /// 未配置模板的层级说明机构未启用该频率, 不纳入告警避免噪音。
  async findPmTasksDueSoon(tenantId: string, withinDays = 60) {
    const templates = await this.prisma.pmChecklistTemplate.findMany({ where: { organization: { tenantId } } });
    const configuredLevels = new Set(templates.map((t) => `${t.organizationId}:${t.level}`));

    const fstds = await this.prisma.fstd.findMany({
      where: { organization: { tenantId } },
      include: { pmTasks: { where: { status: PmTaskStatus.APPROVED }, orderBy: { taskDate: 'desc' } } },
    });
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + withinDays);

    const levels = Object.values(PmCheckLevel);
    const results: { fstdId: string; deviceCode: string; level: PmCheckLevel; nextDueDate: Date | null }[] = [];
    for (const fstd of fstds) {
      for (const level of levels) {
        if (!configuredLevels.has(`${fstd.organizationId}:${level}`)) continue;
        const latest = fstd.pmTasks.find((t) => t.level === level);
        const nextDueDate = latest ? this.computePmNextDueDate(level, latest.taskDate) : null;
        if (!latest || (nextDueDate && nextDueDate <= cutoff)) {
          results.push({ fstdId: fstd.id, deviceCode: fstd.deviceCode, level, nextDueDate });
        }
      }
    }
    return results;
  }
}
