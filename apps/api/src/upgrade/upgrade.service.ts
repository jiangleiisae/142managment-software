import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UpgradeCategory } from '@prisma/client';
import ExcelJS from 'exceljs';
import { AuditLogService } from '../audit-log/audit-log.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CN_OFFSET_MS } from '../roster/shift-time.js';
import type { CreateUpgradeRecordDto, UpdateUpgradeRecordDto } from './dto/upgrade.dto.js';

const MAX_LIST = 1000;
const CATEGORY_TEXT: Record<UpgradeCategory, string> = {
  MODEL_UPGRADE: '模拟机升级',
  SUBSYSTEM_UPGRADE: '子系统升级',
  INSTRUMENT_CALIBRATION: '仪表校准',
  DATABASE_UPDATE: '数据库更新',
};

const cnToday = () => new Date(Date.now() + CN_OFFSET_MS).toISOString().slice(0, 10);
const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

function parseDay(value: string, label: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${label} "${value}" 不是有效的日历日 (YYYY-MM-DD)`);
  }
  return parsed;
}

/// 每个季度允许的计划时段范围 (月份)
const QUARTER_MONTHS: Record<number, [number, number]> = { 1: [1, 3], 2: [4, 6], 3: [7, 9], 4: [10, 12] };
/// 未配置时段时默认整个日历季度
const QUARTER_DEFAULT_WINDOW: Record<number, [string, string]> = { 1: ['01-01', '03-31'], 2: ['04-01', '06-30'], 3: ['07-01', '09-30'], 4: ['10-01', '12-31'] };

/// 设备升级/改装/校准记录 (R7) 与 QTG 执行计划 (时段 + 责任人)
@Injectable()
export class UpgradeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private requireOrganizationId(organizationId: string | undefined): string {
    if (!organizationId) throw new BadRequestException('缺少 organizationId');
    return organizationId;
  }

  private async findFstdInOrg(fstdId: string, organizationId: string) {
    const fstd = await this.prisma.fstd.findFirst({ where: { id: fstdId, organizationId } });
    if (!fstd) throw new BadRequestException('设备不属于该机构');
    return fstd;
  }

  private async personnelNames(tenantId: string, ids: string[]) {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map<string, string>();
    const people = await this.prisma.personnel.findMany({ where: { tenantId, id: { in: unique } } });
    return new Map(people.map((p) => [p.id, `${p.lastName}${p.firstName}`.trim()]));
  }

  private async assertPersonnel(tenantId: string, id: string | undefined) {
    if (!id) return;
    const p = await this.prisma.personnel.findFirst({ where: { id, tenantId } });
    if (!p) throw new BadRequestException('执行人不属于当前租户');
  }

  // ---- 升级/改装/校准记录 ----

  private validateFields(category: UpgradeCategory, v: { performedOn: string; subsystem?: string; nextDueDate?: string }) {
    const performedOn = parseDay(v.performedOn, 'performedOn');
    if (performedOn > parseDay(cnToday(), 'today')) throw new BadRequestException('不能登记未来日期的记录');
    if (category === 'SUBSYSTEM_UPGRADE' && !v.subsystem?.trim()) throw new BadRequestException('子系统升级必须填写子系统名称');
    if (v.nextDueDate && parseDay(v.nextDueDate, 'nextDueDate') < performedOn) throw new BadRequestException('下次到期日不能早于执行日期');
  }

  async create(tenantId: string, email: string, dto: CreateUpgradeRecordDto) {
    const fstd = await this.findFstdInOrg(dto.fstdId, dto.organizationId);
    this.validateFields(dto.category, dto);
    await this.assertPersonnel(tenantId, dto.performedByPersonnelId);
    const record = await this.prisma.fstdUpgradeRecord.create({
      data: {
        fstdId: fstd.id,
        category: dto.category,
        performedOn: parseDay(dto.performedOn, 'performedOn'),
        title: dto.title.trim(),
        description: dto.description,
        subsystem: dto.subsystem?.trim() || null,
        versionFrom: dto.versionFrom,
        versionTo: dto.versionTo,
        performedByPersonnelId: dto.performedByPersonnelId,
        performedByName: dto.performedByName,
        result: dto.result ?? 'pass',
        nextDueDate: dto.nextDueDate ? parseDay(dto.nextDueDate, 'nextDueDate') : null,
        isModification: dto.isModification ?? false,
        caacReportRef: dto.caacReportRef,
        caacReportedOn: dto.caacReportedOn ? parseDay(dto.caacReportedOn, 'caacReportedOn') : null,
        notes: dto.notes,
        createdByEmail: email,
      },
    });
    await this.auditLog.write(tenantId, 'FstdUpgradeRecord', record.id, 'create', null, record);
    return record;
  }

  async update(tenantId: string, id: string, dto: UpdateUpgradeRecordDto) {
    const before = await this.prisma.fstdUpgradeRecord.findFirst({ where: { id, fstd: { organization: { tenantId } } } });
    if (!before) throw new NotFoundException('记录不存在');
    this.validateFields(before.category, {
      performedOn: dto.performedOn ?? ymd(before.performedOn)!,
      subsystem: dto.subsystem ?? before.subsystem ?? undefined,
      nextDueDate: dto.nextDueDate ?? ymd(before.nextDueDate) ?? undefined,
    });
    await this.assertPersonnel(tenantId, dto.performedByPersonnelId);
    const updated = await this.prisma.fstdUpgradeRecord.update({
      where: { id },
      data: {
        performedOn: dto.performedOn ? parseDay(dto.performedOn, 'performedOn') : undefined,
        title: dto.title?.trim(),
        description: dto.description,
        subsystem: dto.subsystem?.trim(),
        versionFrom: dto.versionFrom,
        versionTo: dto.versionTo,
        performedByPersonnelId: dto.performedByPersonnelId,
        performedByName: dto.performedByName,
        result: dto.result,
        nextDueDate: dto.nextDueDate ? parseDay(dto.nextDueDate, 'nextDueDate') : undefined,
        isModification: dto.isModification,
        caacReportRef: dto.caacReportRef,
        caacReportedOn: dto.caacReportedOn ? parseDay(dto.caacReportedOn, 'caacReportedOn') : undefined,
        notes: dto.notes,
      },
    });
    await this.auditLog.write(tenantId, 'FstdUpgradeRecord', id, 'update', before, updated);
    return updated;
  }

  private listWhere(organizationId: string, f: { category?: string; fstdId?: string; from?: string; to?: string }): Prisma.FstdUpgradeRecordWhereInput {
    const where: Prisma.FstdUpgradeRecordWhereInput = { fstd: { organizationId } };
    if (f.category) {
      if (!(f.category in CATEGORY_TEXT)) throw new BadRequestException('category 无效');
      where.category = f.category as UpgradeCategory;
    }
    if (f.fstdId) where.fstdId = f.fstdId;
    if (f.from || f.to) where.performedOn = { ...(f.from ? { gte: parseDay(f.from, 'from') } : {}), ...(f.to ? { lte: parseDay(f.to, 'to') } : {}) };
    return where;
  }

  async list(tenantId: string, organizationId: string | undefined, f: { category?: string; fstdId?: string; from?: string; to?: string }) {
    const orgId = this.requireOrganizationId(organizationId);
    const rows = await this.prisma.fstdUpgradeRecord.findMany({
      where: this.listWhere(orgId, f),
      include: { fstd: { select: { deviceCode: true, representedAircraft: true } } },
      orderBy: [{ performedOn: 'desc' }, { createdAt: 'desc' }],
      take: MAX_LIST,
    });
    const names = await this.personnelNames(tenantId, rows.map((r) => r.performedByPersonnelId).filter((x): x is string => !!x));
    const today = parseDay(cnToday(), 'today');
    return rows.map((r) => ({
      id: r.id,
      fstdId: r.fstdId,
      deviceCode: r.fstd.deviceCode,
      representedAircraft: r.fstd.representedAircraft,
      category: r.category,
      performedOn: ymd(r.performedOn),
      title: r.title,
      description: r.description,
      subsystem: r.subsystem,
      versionFrom: r.versionFrom,
      versionTo: r.versionTo,
      performedByPersonnelId: r.performedByPersonnelId,
      performedBy: r.performedByPersonnelId ? (names.get(r.performedByPersonnelId) ?? null) : null,
      performedByName: r.performedByName,
      result: r.result,
      nextDueDate: ymd(r.nextDueDate),
      overdue: !!r.nextDueDate && r.nextDueDate < today,
      isModification: r.isModification,
      caacReportRef: r.caacReportRef,
      caacReportedOn: ymd(r.caacReportedOn),
      /// 构成改装但还没记录向民航局提交的报告 (CCAR-60 第60.45(c)条)
      needsCaacReport: r.isModification && !r.caacReportRef,
      notes: r.notes,
    }));
  }

  async exportRecords(tenantId: string, organizationId: string | undefined, f: { category?: string; fstdId?: string; from?: string; to?: string }): Promise<Buffer> {
    const rows = await this.list(tenantId, organizationId, f);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('升级校准记录');
    sheet.addRow(['设备', '类别', '执行日期', '标题', '子系统', '版本(从)', '版本(到)', '执行人', '结果', '下次到期', '是否改装', '改装报告文号', '报告日期', '说明', '备注']).font = { bold: true };
    for (const r of rows) {
      sheet.addRow([r.deviceCode, CATEGORY_TEXT[r.category], r.performedOn, r.title, r.subsystem ?? '', r.versionFrom ?? '', r.versionTo ?? '', r.performedBy ?? r.performedByName ?? '', r.result === 'pass' ? '合格' : '不合格', r.nextDueDate ?? '', r.isModification ? '是' : '', r.caacReportRef ?? '', r.caacReportedOn ?? '', r.description ?? '', r.notes ?? '']);
    }
    [14, 14, 12, 30, 14, 12, 12, 14, 8, 12, 8, 18, 12, 40, 30].forEach((w, i) => {
      sheet.getColumn(i + 1).width = w;
    });
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  // ---- QTG 执行计划 (时段 + 责任人) ----

  async setQtgPlan(tenantId: string, dto: { organizationId: string; fstdId: string; quarter: number; windowStart: string; windowEnd: string; responsibleIds: string[] }) {
    await this.findFstdInOrg(dto.fstdId, dto.organizationId);
    const [firstMonth, lastMonth] = QUARTER_MONTHS[dto.quarter];
    const month = (s: string) => Number(s.slice(0, 2));
    for (const [label, v] of [['windowStart', dto.windowStart], ['windowEnd', dto.windowEnd]] as const) {
      // 2000 是闰年, 允许 02-29
      const d = new Date(`2000-${v}T00:00:00.000Z`);
      if (Number.isNaN(d.getTime()) || d.toISOString().slice(5, 10) !== v) throw new BadRequestException(`${label} ${v} 不是有效日期`);
      if (month(v) < firstMonth || month(v) > lastMonth) throw new BadRequestException(`${label} 必须在第${dto.quarter}季度(${firstMonth}-${lastMonth}月)内`);
    }
    if (dto.windowStart > dto.windowEnd) throw new BadRequestException('时段开始不能晚于结束');
    const ids = [...new Set(dto.responsibleIds)];
    if (ids.length) {
      const found = await this.prisma.personnel.count({ where: { tenantId, id: { in: ids } } });
      if (found !== ids.length) throw new BadRequestException('包含不属于当前租户的责任人');
    }
    const before = await this.prisma.fstdQtgPlan.findUnique({ where: { fstdId_quarter: { fstdId: dto.fstdId, quarter: dto.quarter } } });
    const saved = await this.prisma.fstdQtgPlan.upsert({
      where: { fstdId_quarter: { fstdId: dto.fstdId, quarter: dto.quarter } },
      create: { fstdId: dto.fstdId, quarter: dto.quarter, windowStart: dto.windowStart, windowEnd: dto.windowEnd, responsibleIds: ids },
      update: { windowStart: dto.windowStart, windowEnd: dto.windowEnd, responsibleIds: ids },
    });
    await this.auditLog.write(tenantId, 'FstdQtgPlan', saved.id, before ? 'update' : 'create', before, saved);
    return saved;
  }

  async clearQtgPlan(tenantId: string, organizationId: string | undefined, fstdId: string | undefined, quarter: number) {
    const orgId = this.requireOrganizationId(organizationId);
    if (!fstdId) throw new BadRequestException('缺少 fstdId');
    await this.findFstdInOrg(fstdId, orgId);
    const before = await this.prisma.fstdQtgPlan.findUnique({ where: { fstdId_quarter: { fstdId, quarter } } });
    if (!before) return { deleted: false };
    await this.prisma.fstdQtgPlan.delete({ where: { id: before.id } });
    await this.auditLog.write(tenantId, 'FstdQtgPlan', before.id, 'delete', before, null);
    return { deleted: true };
  }

  /// 某年各设备各季度的 QTG 计划与执行情况。时段没配置时默认整个日历季度;
  /// 状态: DONE(时段内完成) / DONE_OUTSIDE(完成但不在时段内) / UPCOMING(未到时段) / PENDING(时段内未完成) / OVERDUE(时段已过未完成)
  async qtgSchedule(tenantId: string, organizationId: string | undefined, year: number) {
    const orgId = this.requireOrganizationId(organizationId);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new BadRequestException('year 无效');
    const fstds = await this.prisma.fstd.findMany({
      where: { organizationId: orgId, status: 'active' },
      include: { qtgPlans: true, qtgQuarterlyRuns: { where: { year } } },
      orderBy: { deviceCode: 'asc' },
    });
    const names = await this.personnelNames(tenantId, fstds.flatMap((f) => f.qtgPlans.flatMap((p) => p.responsibleIds)));
    const today = cnToday();

    return fstds.map((f) => ({
      fstdId: f.id,
      deviceCode: f.deviceCode,
      representedAircraft: f.representedAircraft,
      quarters: [1, 2, 3, 4].map((q) => {
        const plan = f.qtgPlans.find((p) => p.quarter === q);
        const windowStart = plan?.windowStart ?? QUARTER_DEFAULT_WINDOW[q][0];
        const windowEnd = plan?.windowEnd ?? QUARTER_DEFAULT_WINDOW[q][1];
        const start = `${year}-${windowStart}`;
        const end = `${year}-${windowEnd}`;
        const run = f.qtgQuarterlyRuns.find((r) => r.quarter === q);
        const completedOn = run?.completedAt ? new Date(run.completedAt.getTime() + CN_OFFSET_MS).toISOString().slice(0, 10) : null;
        let status: 'DONE' | 'DONE_OUTSIDE' | 'UPCOMING' | 'PENDING' | 'OVERDUE';
        if (completedOn) status = completedOn >= start && completedOn <= end ? 'DONE' : 'DONE_OUTSIDE';
        else if (today < start) status = 'UPCOMING';
        else if (today <= end) status = 'PENDING';
        else status = 'OVERDUE';
        return {
          quarter: q,
          configured: !!plan,
          windowStart,
          windowEnd,
          responsibleIds: plan?.responsibleIds ?? [],
          responsible: (plan?.responsibleIds ?? []).map((id) => names.get(id) ?? id),
          completedOn,
          result: run?.result ?? null,
          status,
        };
      }),
    }));
  }
}

