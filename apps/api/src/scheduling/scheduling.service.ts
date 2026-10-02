import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingResourceType } from '@prisma/client';
import ExcelJS from 'exceljs';
import { AuditLogService } from '../audit-log/audit-log.service.js';
import { FstdService } from '../fstd/fstd.service.js';
import { isInstructorInitialTrainingComplete } from '../personnel/personnel.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/// CCAR-142第142.69条(b)款: 任何连续24个小时内的教学时间不得超过8小时(讲评时间除外, 本系统暂未区分讲评与教学时段)
const INSTRUCTOR_FATIGUE_WINDOW_HOURS = 24;
const INSTRUCTOR_FATIGUE_LIMIT_HOURS = 8;

/// Excel 导入排班表固定列顺序(对应 scripts/生成的"排班登记表模板.xlsx"的"排班登记 Schedule"工作表):
/// A日期 B开始时间 C结束时间 D模拟机/设备编号 E训练科目 F航司/客户名称 G飞行员姓名 H教员姓名 I联系电话 J收入 K备注
const EXCEL_COLUMNS = {
  date: 1,
  startTime: 2,
  endTime: 3,
  deviceCode: 4,
  taskCode: 5,
  customerName: 6,
  pilotName: 7,
  instructorName: 8,
  contactPhone: 9,
  revenue: 10,
  notes: 11,
} as const;

function excelSerialToUtcDate(serial: number): Date {
  const epoch = Date.UTC(1899, 11, 30);
  return new Date(epoch + serial * 86400000);
}

function parseExcelDate(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return excelSerialToUtcDate(value);
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value.trim());
    if (!Number.isNaN(d.getTime())) return d;
  }
  return undefined;
}

function parseExcelTime(value: unknown): { hours: number; minutes: number } | undefined {
  if (value instanceof Date) return { hours: value.getUTCHours(), minutes: value.getUTCMinutes() };
  if (typeof value === 'number') {
    const totalMinutes = Math.round(value * 24 * 60);
    return { hours: Math.floor(totalMinutes / 60) % 24, minutes: totalMinutes % 60 };
  }
  if (typeof value === 'string') {
    const m = value.trim().match(/^(\d{1,2}):(\d{2})/);
    if (m) return { hours: Number(m[1]), minutes: Number(m[2]) };
  }
  return undefined;
}

function cellText(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'object') {
    // exceljs 富文本单元格 { richText: [{ text }, ...] } 或 { text, hyperlink }
    const { richText, text } = value as { richText?: { text?: unknown }[]; text?: unknown };
    if (Array.isArray(richText)) {
      const joined = richText.map((r) => (typeof r.text === 'string' ? r.text : '')).join('').trim();
      return joined || undefined;
    }
    return typeof text === 'string' ? text.trim() || undefined : undefined;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const s = String(value).trim();
    return s || undefined;
  }
  return undefined;
}

function cellNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value.replace(/[,\s]/g, ''));
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

/// "1800-2200" / "18:00-22:00" / "2010-0010"(跨午夜) / "2000-2400"(24点即次日0点)
function parseTimeRange(value: unknown): { start: { hours: number; minutes: number }; end: { hours: number; minutes: number } } | undefined {
  const text = cellText(value)?.replace(/[：:\s]/g, '');
  const m = text?.match(/^(\d{3,4})[-–—~至](\d{3,4})$/);
  if (!m) return undefined;
  const toHm = (digits: string) => {
    const padded = digits.padStart(4, '0');
    return { hours: Number(padded.slice(0, 2)), minutes: Number(padded.slice(2)) };
  };
  const start = toHm(m[1]);
  const end = toHm(m[2]);
  if (start.hours > 23 || end.hours > 24 || start.minutes > 59 || end.minutes > 59) return undefined;
  return { start, end };
}

/// 表里"训练地点/模拟机编号"一列的写法不固定: "天津飞安/FSD-051"(地点/编号)、"FFS#1 B757/767"(编号 机型)、"FFS#1"等,
/// 按"设备编号"或"设备编号+代表机型"与已登记的模拟机匹配。顺序: 整串精确匹配 → 按"/"、空白拆出的片段与设备编号精确匹配 →
/// 以设备编号开头(其后不是数字, 避免 FFS#1 误配 FFS#10)且只有唯一一台设备符合。匹配不上返回 undefined。
function resolveFstdByLabel<T extends { deviceCode: string; representedAircraft: string }>(raw: string, fstds: T[]): T | undefined {
  const norm = (v: string) => v.toLowerCase().replace(/\s+/g, '');
  const whole = norm(raw);
  const byWhole = fstds.find((f) => whole === norm(f.deviceCode) || whole === norm(f.deviceCode + f.representedAircraft));
  if (byWhole) return byWhole;
  const tokens = new Set(raw.split(/[/／\s,，、]+/).map(norm).filter(Boolean));
  const byToken = fstds.find((f) => tokens.has(norm(f.deviceCode)));
  if (byToken) return byToken;
  const prefixed = fstds.filter((f) => {
    const code = norm(f.deviceCode);
    return code.length > 0 && whole.startsWith(code) && !/\d/.test(whole.charAt(code.length));
  });
  return prefixed.length === 1 ? prefixed[0] : undefined;
}

/// 训练计划表(如"XX航空B737机型2026年9月模拟机训练计划")的表头识别: 按列名而不是列序号映射, 兼容列顺序不同的变体
interface TrainingPlanHeader {
  row: number;
  device: number;
  date: number;
  time: number;
  trainingType?: number;
  trainees?: number;
  instructor?: number;
  examiner?: number;
  customer?: number;
}

function findTrainingPlanHeader(sheet: ExcelJS.Worksheet): TrainingPlanHeader | undefined {
  for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
    const cols: Record<string, number> = {};
    sheet.getRow(r).eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const text = cellText(cell.value);
      if (!text) return;
      if (text.includes('模拟机编号') || text.includes('训练地点')) cols.device = colNumber;
      else if (text.includes('训练类型')) cols.trainingType = colNumber;
      else if (text === '日期') cols.date = colNumber;
      else if (text === '时间') cols.time = colNumber;
      else if (text.includes('受训')) cols.trainees = colNumber;
      else if (text === '教员') cols.instructor = colNumber;
      else if (text.includes('检查员')) cols.examiner = colNumber;
      else if (text === '客户' || text.includes('客户名称')) cols.customer = colNumber;
    });
    if (cols.device && cols.date && cols.time) return { row: r, ...cols } as TrainingPlanHeader;
  }
  return undefined;
}

@Injectable()
export class SchedulingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fstdService: FstdService,
    private readonly auditLog: AuditLogService,
  ) {}

  /// 需求清单 3.8: 排课引擎作为消费方, 校验资源在时间段内无冲突
  private async assertNoConflict(resourceType: BookingResourceType, resourceId: string, startAt: Date, endAt: Date) {
    const conflict = await this.prisma.booking.findFirst({
      where: {
        resourceType,
        resourceId,
        status: 'confirmed',
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });
    if (conflict) {
      throw new BadRequestException(
        `Resource ${resourceType}:${resourceId} already booked ${conflict.startAt.toISOString()} - ${conflict.endAt.toISOString()}`,
      );
    }
  }

  /// 需求清单 3.8: "排课引擎作为消费方调用各模块暴露的校验服务" —— 这里是该原则的落地:
  /// FSTD资源校验设备状态与已鉴定任务清单(3.3.3), 学员资源校验体检证有效性(ORA.ATO.145/3.7)。
  /// 校验不通过直接抛错阻断排课, 而不是仅仅记录时间冲突。
  private async assertResourceEligible(data: {
    organizationId: string;
    resourceType: BookingResourceType;
    resourceId: string;
    taskCode?: string;
    studentId?: string;
    startAt: Date;
    endAt: Date;
  }) {
    if (data.resourceType === 'FSTD') {
      const fstd = await this.prisma.fstd.findUnique({ where: { id: data.resourceId } });
      if (!fstd || fstd.organizationId !== data.organizationId) {
        throw new BadRequestException(`FSTD ${data.resourceId} 不属于该机构`);
      }
      if (fstd.status !== 'active') {
        throw new BadRequestException(`FSTD ${fstd.deviceCode} 当前状态为 ${fstd.status}, 不可排课`);
      }
      // 停飞日历: 预订时间段覆盖的任一北京时间日历日被标记停飞则拒绝
      const localDay = (ms: number) => new Date(Math.floor((ms + 8 * 60 * 60 * 1000) / 86400000) * 86400000);
      const grounded = await this.prisma.fstdGrounding.findFirst({
        where: { fstdId: fstd.id, date: { gte: localDay(data.startAt.getTime()), lte: localDay(data.endAt.getTime() - 1) } },
        orderBy: { date: 'asc' },
      });
      if (grounded) {
        throw new BadRequestException(`FSTD ${fstd.deviceCode} 在 ${grounded.date.toISOString().slice(0, 10)} 已标记停飞, 不可排课`);
      }
      if (data.taskCode) {
        // 统一能力判定入口 (需求清单3.3.3 can_device_perform_task): 内部按qualificationBasisType自动分流到
        // legacy已鉴定任务清单校验, 或FCS体系的训练矩阵逐特征保真度比对, 排课引擎作为消费方无需关心具体判定逻辑。
        // 排课只要求达到T(可开始训练)即可预订; 是否达到TP(可完成训练/计入学时)留给训练记录/进度卡在结课时判断。
        const capability = await this.fstdService.canDevicePerformTask(data.resourceId, data.taskCode);
        if (!capability.canStartTraining) {
          throw new BadRequestException(`FSTD ${fstd.deviceCode} 不满足训练科目 "${data.taskCode}" 的能力要求: ${capability.reason}`);
        }
        // Training Restriction: 若该科目所需部件存在未修复的MMI缺陷, 阻止排课 (吸收FAA §60.20 Training Restriction概念)
        // 已设置故障保留分级(吸收天津飞安实践)且尚未过期的缺陷视为已评估"带病运行", 不再阻断排课
        const blockingDiscrepancy = await this.prisma.discrepancyLog.findFirst({
          where: {
            fstdId: data.resourceId,
            isMmi: true,
            status: 'open',
            OR: [{ retentionCategory: null }, { retentionExpiresAt: { lt: new Date() } }],
          },
        });
        if (blockingDiscrepancy) {
          throw new BadRequestException(
            `FSTD ${fstd.deviceCode} 存在未修复的MMI缺陷 ("${blockingDiscrepancy.description}"), 该科目暂时受限 (Training Restriction)`,
          );
        }
      }
    }

    if (data.studentId) {
      const student = await this.prisma.student.findUnique({ where: { id: data.studentId } });
      if (!student || student.organizationId !== data.organizationId) {
        throw new BadRequestException(`Student ${data.studentId} 不属于该机构`);
      }
      if (student.medicalCertExpiry && student.medicalCertExpiry < new Date()) {
        throw new BadRequestException(
          `学员 ${student.firstName}${student.lastName} 体检证已于 ${student.medicalCertExpiry.toLocaleDateString()} 过期, 不能安排训练 (ORA.ATO.145)`,
        );
      }
    }

    if (data.resourceType === 'INSTRUCTOR') {
      const org = await this.prisma.organization.findUnique({ where: { id: data.organizationId } });
      if (!org) throw new BadRequestException(`Organization ${data.organizationId} 不存在`);
      const instructor = await this.prisma.personnel.findUnique({
        where: { id: data.resourceId },
        include: { instructorProfile: { include: { initialTraining: true } }, qualifications: true },
      });
      if (!instructor || instructor.tenantId !== org.tenantId) {
        throw new BadRequestException(`Instructor ${data.resourceId} 不属于该机构`);
      }
      if (!instructor.instructorProfile) {
        throw new BadRequestException(`${instructor.firstName}${instructor.lastName} 尚未登记为教员 (缺少教员档案)`);
      }
      const expired = instructor.qualifications.find((q) => q.validUntil && q.validUntil < new Date());
      if (expired) {
        throw new BadRequestException(
          `教员 ${instructor.firstName}${instructor.lastName} 的资质 "${expired.qualificationType}" 已于 ${expired.validUntil!.toLocaleDateString()} 过期, 不能安排训练`,
        );
      }
      if (org.regulatoryStandard === 'CAAC') {
        // CCAR-142第142.61条(c)款: 初始聘任前须完成≥8小时地面训练并通过笔试
        if (!isInstructorInitialTrainingComplete(instructor.instructorProfile.initialTraining)) {
          throw new BadRequestException(
            `教员 ${instructor.firstName}${instructor.lastName} 尚未完成CCAR-142第142.61(c)条规定的初始培训(≥8小时地面训练+笔试), 不能安排教学`,
          );
        }
        // CCAR-142第142.69条(b)款: 任何连续24小时内教学时间不得超过8小时
        await this.assertInstructorNotFatigued(data.resourceId, data.startAt, data.endAt, `${instructor.firstName}${instructor.lastName}`);
      }
    }
  }

  /// 检查将该教员的新预订加入后, 是否会导致"任何连续24小时窗口内教学时长超过8小时" (142.69(b))。
  /// 候选锚点取"新预订+范围内已有预订"各自的开始时刻——对于固定长度的滑动窗口求最大覆盖时长, 最大值必在某个区间起点处取得, 故枚举这些锚点即可保证不遗漏任何真实超限情形。
  private async assertInstructorNotFatigued(resourceId: string, newStartAt: Date, newEndAt: Date, instructorName: string) {
    const windowMs = INSTRUCTOR_FATIGUE_WINDOW_HOURS * 60 * 60 * 1000;
    const candidateFrom = new Date(newStartAt.getTime() - windowMs);
    const candidateTo = new Date(newEndAt.getTime() + windowMs);
    const existing = await this.prisma.booking.findMany({
      where: {
        resourceType: 'INSTRUCTOR',
        resourceId,
        status: 'confirmed',
        startAt: { lt: candidateTo },
        endAt: { gt: candidateFrom },
      },
      select: { startAt: true, endAt: true },
    });
    const sessions = [...existing, { startAt: newStartAt, endAt: newEndAt }];
    const anchors = [...new Set(sessions.map((s) => s.startAt.getTime()))];
    for (const anchor of anchors) {
      const windowEnd = anchor + windowMs;
      const overlapMs = sessions.reduce((sum, s) => {
        const start = Math.max(s.startAt.getTime(), anchor);
        const end = Math.min(s.endAt.getTime(), windowEnd);
        return end > start ? sum + (end - start) : sum;
      }, 0);
      const overlapHours = overlapMs / (60 * 60 * 1000);
      if (overlapHours > INSTRUCTOR_FATIGUE_LIMIT_HOURS) {
        throw new BadRequestException(
          `教员 ${instructorName} 在 ${new Date(anchor).toLocaleString()} 起的连续24小时内教学时长将达到 ${overlapHours.toFixed(1)} 小时, 超过CCAR-142第142.69(b)条规定的8小时上限`,
        );
      }
    }
  }

  async create(
    tenantId: string,
    data: {
      organizationId: string;
      resourceType: BookingResourceType;
      resourceId: string;
      startAt: string;
      endAt: string;
      courseId?: string;
      studentId?: string;
      taskCode?: string;
      customerName?: string;
      pilotName?: string;
      instructorName?: string;
      examinerName?: string;
      trainingType?: string;
      contactPhone?: string;
      revenue?: number;
      notes?: string;
    },
  ) {
    const startAt = new Date(data.startAt);
    const endAt = new Date(data.endAt);
    if (startAt >= endAt) throw new BadRequestException('startAt must be before endAt');

    // organizationId 的租户归属已由全局 TenantGuard 校验
    await this.assertResourceEligible({ ...data, startAt, endAt });
    await this.assertNoConflict(data.resourceType, data.resourceId, startAt, endAt);

    const booking = await this.prisma.booking.create({
      data: {
        organizationId: data.organizationId,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        startAt,
        endAt,
        courseId: data.courseId,
        studentId: data.studentId,
        taskCode: data.taskCode,
        customerName: data.customerName,
        pilotName: data.pilotName,
        instructorName: data.instructorName,
        examinerName: data.examinerName,
        trainingType: data.trainingType,
        contactPhone: data.contactPhone,
        revenue: data.revenue,
        notes: data.notes,
      },
    });
    await this.auditLog.write(tenantId, 'Booking', booking.id, 'create', null, booking);
    return booking;
  }

  private requireOrganizationId(organizationId: string | undefined): string {
    if (!organizationId) throw new BadRequestException('缺少 organizationId');
    return organizationId;
  }

  /// 训练计划视图: 机构内与 [from, to) 有重叠的模拟机预订, 可按设备、教员(教员或检查员姓名包含)筛选。
  /// 不返回收入/联系电话等商业字段, 计划视图用不到。
  listPlan(organizationId: string | undefined, from: string, to: string, resourceId?: string, instructor?: string) {
    const orgId = this.requireOrganizationId(organizationId);
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) throw new BadRequestException('from/to 必须是有效的日期时间');
    if (fromDate >= toDate) throw new BadRequestException('from 必须早于 to');
    if (toDate.getTime() - fromDate.getTime() > 93 * 24 * 60 * 60 * 1000) throw new BadRequestException('查询范围不能超过93天');
    const keyword = instructor?.trim();
    return this.prisma.booking.findMany({
      where: {
        organizationId: orgId,
        resourceType: 'FSTD',
        status: 'confirmed',
        startAt: { lt: toDate },
        endAt: { gt: fromDate },
        ...(resourceId ? { resourceId } : {}),
        ...(keyword
          ? { OR: [{ instructorName: { contains: keyword, mode: 'insensitive' as const } }, { examinerName: { contains: keyword, mode: 'insensitive' as const } }] }
          : {}),
      },
      omit: { revenue: true, contactPhone: true },
      orderBy: { startAt: 'asc' },
    });
  }

  listCustomers(organizationId: string | undefined) {
    return this.prisma.bookingCustomer.findMany({ where: { organizationId: this.requireOrganizationId(organizationId) }, orderBy: { name: 'asc' } });
  }

  /// 整体保存客户配置: 提交列表里没有的客户会被移除 (只影响配色, 已有预订上的客户名称文本不受影响)
  async setCustomers(tenantId: string, organizationId: string, customers: { name: string; color: string }[]) {
    const normalized = customers.map((c) => ({ name: c.name.trim(), color: c.color.toLowerCase() }));
    const names = normalized.map((c) => c.name);
    if (names.some((n) => !n)) throw new BadRequestException('客户名称不能为空');
    if (new Set(names).size !== names.length) throw new BadRequestException('客户名称不能重复');
    const before = await this.listCustomers(organizationId);
    await this.prisma.$transaction([
      this.prisma.bookingCustomer.deleteMany({ where: { organizationId, name: { notIn: names } } }),
      ...normalized.map((c) =>
        this.prisma.bookingCustomer.upsert({
          where: { organizationId_name: { organizationId, name: c.name } },
          create: { organizationId, name: c.name, color: c.color },
          update: { color: c.color },
        }),
      ),
    ]);
    const after = await this.listCustomers(organizationId);
    await this.auditLog.write(tenantId, 'BookingCustomer', organizationId, 'set', before, after);
    return after;
  }

  /// 导出训练计划为 Excel, 版式与"训练计划表导入"一致(可原样再导入), 日期/时间按北京时间输出。
  async exportPlan(organizationId: string | undefined, from: string, to: string, resourceId?: string, instructor?: string): Promise<Buffer> {
    const orgId = this.requireOrganizationId(organizationId);
    const bookings = await this.listPlan(orgId, from, to, resourceId, instructor);
    const fstds = await this.prisma.fstd.findMany({ where: { organizationId: orgId } });
    const fstdById = new Map(fstds.map((f) => [f.id, f]));
    const local = (d: Date) => new Date(d.getTime() + 8 * 60 * 60 * 1000);
    const two = (n: number) => String(n).padStart(2, '0');
    const hhmm = (d: Date) => `${two(d.getUTCHours())}${two(d.getUTCMinutes())}`;
    const ymd = (d: Date) => `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}`;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('训练计划');
    sheet.addRow([`模拟机训练计划 ${ymd(local(new Date(from)))} ~ ${ymd(local(new Date(new Date(to).getTime() - 1)))}`]);
    sheet.addRow(['训练地点/模拟机编号', '训练类型', '日期', '时间', '受训人员', '教员', '检查员/公司评估员', '客户']);
    for (const b of bookings) {
      const start = local(b.startAt);
      const end = local(b.endAt);
      const fstd = fstdById.get(b.resourceId);
      const crossesMidnight = ymd(end) > ymd(start);
      const endText = crossesMidnight && end.getUTCHours() === 0 && end.getUTCMinutes() === 0 ? '2400' : hhmm(end);
      const row = sheet.addRow([
        fstd ? `${fstd.deviceCode} ${fstd.representedAircraft}` : b.resourceId,
        b.trainingType ?? '',
        new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())),
        `${hhmm(start)}-${endText}`,
        b.pilotName ?? '',
        b.instructorName ?? '',
        b.examinerName ?? '',
        b.customerName ?? '',
      ]);
      row.getCell(3).numFmt = 'yyyy-mm-dd';
    }
    [24, 34, 12, 12, 26, 12, 18, 16].forEach((width, i) => {
      sheet.getColumn(i + 1).width = width;
    });
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  findByResource(resourceType: BookingResourceType, resourceId: string, tenantId: string) {
    return this.prisma.booking.findMany({
      where: { resourceType, resourceId, status: 'confirmed', organization: { tenantId } },
      orderBy: { startAt: 'asc' },
    });
  }

  async cancel(id: string, tenantId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: { organization: true } });
    if (!booking || booking.organization.tenantId !== tenantId) throw new NotFoundException(`Booking ${id} not found`);
    const updated = await this.prisma.booking.update({ where: { id }, data: { status: 'cancelled' } });
    await this.auditLog.write(tenantId, 'Booking', id, 'status_change:confirmed->cancelled', booking, updated);
    return updated;
  }

  /// 排班 Excel 批量导入(用户反馈现有排班 UI 不好用, 改为按固定模板表格逐行导入)。
  /// 逐行走 create() 的全部校验逻辑(设备状态/科目能力/MMI阻断/学员体检证), 单行失败不影响其他行,
  /// 失败原因逐行回传给前端展示, 便于用户对照 Excel 修正后重新导入。
  async importFromExcel(tenantId: string, organizationId: string, buffer: Buffer) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org || org.tenantId !== tenantId) throw new BadRequestException(`机构 ${organizationId} 不属于该租户`);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    for (const candidate of workbook.worksheets) {
      const planHeader = findTrainingPlanHeader(candidate);
      if (planHeader) return this.importTrainingPlan(tenantId, organizationId, candidate, planHeader);
    }
    const sheet =
      workbook.worksheets.find((ws) => /schedule|排班/i.test(ws.name)) ?? workbook.worksheets[workbook.worksheets.length - 1];
    if (!sheet) throw new BadRequestException('Excel 文件中未找到可识别的工作表');

    const fstds = await this.prisma.fstd.findMany({ where: { organizationId } });
    const fstdByCode = new Map(fstds.map((f) => [f.deviceCode.trim().toLowerCase(), f]));

    const errors: { row: number; message: string }[] = [];
    let createdCount = 0;
    const totalRows = sheet.rowCount;

    for (let rowNumber = 2; rowNumber <= totalRows; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const deviceCodeRaw = cellText(row.getCell(EXCEL_COLUMNS.deviceCode).value);
      const customerName = cellText(row.getCell(EXCEL_COLUMNS.customerName).value);
      const pilotName = cellText(row.getCell(EXCEL_COLUMNS.pilotName).value);
      const notes = cellText(row.getCell(EXCEL_COLUMNS.notes).value);

      // 整行为空(含模板里的示例行提示文字)则跳过, 不计入错误
      if (!deviceCodeRaw && !customerName && !pilotName) continue;
      if (notes && /示例行|sample row/i.test(notes)) continue;

      try {
        if (!deviceCodeRaw) throw new BadRequestException('模拟机/设备编号 为必填');
        const fstd = fstdByCode.get(deviceCodeRaw.trim().toLowerCase());
        if (!fstd) throw new BadRequestException(`找不到设备编号 "${deviceCodeRaw}", 请检查是否与「模拟机」模块中的设备编号一致`);

        const dateVal = parseExcelDate(row.getCell(EXCEL_COLUMNS.date).value);
        const startTime = parseExcelTime(row.getCell(EXCEL_COLUMNS.startTime).value);
        const endTime = parseExcelTime(row.getCell(EXCEL_COLUMNS.endTime).value);
        if (!dateVal) throw new BadRequestException('日期 格式无法识别');
        if (!startTime) throw new BadRequestException('开始时间 格式无法识别 (应为 HH:mm, 如 09:00)');
        if (!endTime) throw new BadRequestException('结束时间 格式无法识别 (应为 HH:mm, 如 11:00)');

        // Excel 里填的日期/时间是训练中心当地时间(中国大陆, UTC+8, 不实行夏令时), 不是UTC,
        // 所以这里要先按UTC+8算出对应的UTC时刻, 否则会出现导入后时间整体偏移8小时的问题。
        const CHINA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
        const startAt = new Date(
          Date.UTC(dateVal.getUTCFullYear(), dateVal.getUTCMonth(), dateVal.getUTCDate(), startTime.hours, startTime.minutes) -
            CHINA_UTC_OFFSET_MS,
        );
        const endAt = new Date(
          Date.UTC(dateVal.getUTCFullYear(), dateVal.getUTCMonth(), dateVal.getUTCDate(), endTime.hours, endTime.minutes) -
            CHINA_UTC_OFFSET_MS,
        );

        await this.create(tenantId, {
          organizationId,
          resourceType: 'FSTD',
          resourceId: fstd.id,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          taskCode: cellText(row.getCell(EXCEL_COLUMNS.taskCode).value),
          customerName,
          pilotName,
          instructorName: cellText(row.getCell(EXCEL_COLUMNS.instructorName).value),
          contactPhone: cellText(row.getCell(EXCEL_COLUMNS.contactPhone).value),
          revenue: cellNumber(row.getCell(EXCEL_COLUMNS.revenue).value),
          notes,
        });
        createdCount++;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        errors.push({ row: rowNumber, message });
      }
    }

    return { createdCount, errorCount: errors.length, errors };
  }

  /// 按"训练计划表"格式导入 (受训人员/教员/检查员/日期/时间/训练地点-模拟机编号 一行一场训练): 每行生成一条模拟机预订,
  /// 复用 create() 的全部校验(设备状态、时间冲突); 单行失败不影响其余行。教员与检查员在系统里是自由文本(不要求关联人员档案),
  /// 因此同一教员/检查员时间重叠只给出警告, 不阻断导入。
  private async importTrainingPlan(tenantId: string, organizationId: string, sheet: ExcelJS.Worksheet, header: TrainingPlanHeader) {
    const fstds = await this.prisma.fstd.findMany({ where: { organizationId } });
    const deviceCodeById = new Map(fstds.map((f) => [f.id, f.deviceCode]));

    // 标题形如 "奥凯航空B737机型2026年9月模拟机训练计划", 前半段作为客户(航司)名称
    const title = cellText(sheet.getRow(1).getCell(1).value);
    const customerName = title?.match(/^(.+?)[A-Z]\d{2,4}[A-Z0-9-]*\s*机型/)?.[1]?.trim();

    const errors: { row: number; message: string }[] = [];
    const warnings: { row: number; message: string }[] = [];
    const missingDevices = new Set<string>();
    let createdCount = 0;
    const CHINA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
    const formatLocal = (d: Date) => d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });

    for (let rowNumber = header.row + 1; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const deviceRaw = cellText(row.getCell(header.device).value);
      const timeText = cellText(row.getCell(header.time).value);
      const dateCell = row.getCell(header.date).value;
      if (!deviceRaw && !timeText && dateCell == null) continue;

      try {
        if (!deviceRaw) throw new BadRequestException('训练地点/模拟机编号 为必填');
        const fstd = resolveFstdByLabel(deviceRaw, fstds);
        if (!fstd) {
          missingDevices.add(deviceRaw);
          throw new BadRequestException(`找不到模拟机 "${deviceRaw}", 请先在「模拟机」模块中添加该设备 (设备编号需与表中写法一致, 如 FFS#1)`);
        }

        // 写成"设备编号 机型"(如 "FFS#2 B777")时, 机型与设备登记的机型对不上多半是写错或选错了设备, 只提醒不阻断
        const compact = (v: string) => v.toLowerCase().replace(/\s+/g, '');
        const labelRest = compact(deviceRaw).startsWith(compact(fstd.deviceCode)) ? compact(deviceRaw).slice(compact(fstd.deviceCode).length) : '';
        const registeredAircraft = compact(fstd.representedAircraft);
        const aircraftMismatch = labelRest !== '' && !labelRest.includes(registeredAircraft) && !registeredAircraft.includes(labelRest);

        const dateVal = parseExcelDate(dateCell);
        const range = parseTimeRange(timeText);
        if (!dateVal) throw new BadRequestException('日期 格式无法识别');
        if (!range) throw new BadRequestException(`时间 "${timeText ?? ''}" 格式无法识别 (应为 HHmm-HHmm, 如 0800-1200)`);

        const dayUtc = Date.UTC(dateVal.getUTCFullYear(), dateVal.getUTCMonth(), dateVal.getUTCDate());
        const startMs = dayUtc + (range.start.hours * 60 + range.start.minutes) * 60000 - CHINA_UTC_OFFSET_MS;
        let endMs = dayUtc + (range.end.hours * 60 + range.end.minutes) * 60000 - CHINA_UTC_OFFSET_MS;
        if (endMs <= startMs) endMs += 24 * 60 * 60 * 1000; // 如 "2010-0010" 跨午夜到次日
        const startAt = new Date(startMs);
        const endAt = new Date(endMs);

        const instructorName = header.instructor ? cellText(row.getCell(header.instructor).value) : undefined;
        const examinerName = header.examiner ? cellText(row.getCell(header.examiner).value) : undefined;

        const booking = await this.create(tenantId, {
          organizationId,
          resourceType: 'FSTD',
          resourceId: fstd.id,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          customerName: (header.customer ? cellText(row.getCell(header.customer).value) : undefined) ?? customerName,
          pilotName: header.trainees ? cellText(row.getCell(header.trainees).value) : undefined,
          instructorName,
          examinerName,
          trainingType: header.trainingType ? cellText(row.getCell(header.trainingType).value) : undefined,
        });
        createdCount++;

        if (aircraftMismatch) {
          warnings.push({
            row: rowNumber,
            message: `表中写的是 "${deviceRaw.trim()}", 但设备 ${fstd.deviceCode} 登记的机型是 "${fstd.representedAircraft}", 请确认设备是否选对`,
          });
        }

        const names = [instructorName, examinerName].filter((n): n is string => !!n);
        if (names.length > 0) {
          const clash = await this.prisma.booking.findFirst({
            where: {
              organizationId,
              status: 'confirmed',
              id: { not: booking.id },
              startAt: { lt: endAt },
              endAt: { gt: startAt },
              OR: [{ instructorName: { in: names } }, { examinerName: { in: names } }],
            },
          });
          if (clash) {
            const clashDevice = deviceCodeById.get(clash.resourceId) ?? clash.resourceType;
            warnings.push({
              row: rowNumber,
              message: `教员/检查员 ${names.join('、')} 与 ${formatLocal(clash.startAt)} 开始的另一场排班(${clashDevice})时间重叠, 请确认`,
            });
          }
        }
      } catch (e) {
        errors.push({ row: rowNumber, message: e instanceof Error ? e.message : String(e) });
      }
    }

    return { createdCount, errorCount: errors.length, errors, warnings, missingDevices: [...missingDevices] };
  }
}
