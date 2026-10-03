import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DutyEntryKind, DutyLogStatus, Prisma, ShiftType } from '@prisma/client';
import ExcelJS from 'exceljs';
import { AuditLogService } from '../audit-log/audit-log.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { nextShiftSlot, shiftWindow } from '../roster/shift-time.js';
import { resolveStaffNames } from '../roster/staff-names.js';
import type { CreateDutyHandoverDto, UpdateDutyHandoverDto } from './dto/duty.dto.js';

const MAX_LIST = 500;

export interface DrRecord {
  discrepancyId: string;
  fstdId: string;
  deviceCode: string;
  action: 'REPORTED' | 'CORRECTED';
  at: string;
  description: string;
  correctiveAction: string | null;
  isMmi: boolean;
}

function parseDay(value: string | undefined, label: string): Date {
  if (!value) throw new BadRequestException(`缺少 ${label}`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${label} "${value}" 不是有效的日历日 (YYYY-MM-DD)`);
  }
  return parsed;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/// 值班日志与交接班 (R4a)。班次/班组来自 R2 的班表模块; "DR 操作记录"来自故障(DiscrepancyLog)。
@Injectable()
export class DutyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private requireOrganizationId(organizationId: string | undefined): string {
    if (!organizationId) throw new BadRequestException('缺少 organizationId');
    return organizationId;
  }

  private async findLogOrThrow(id: string, tenantId: string) {
    const log = await this.prisma.dutyLog.findFirst({ where: { id, organization: { tenantId } }, include: { shiftType: true, group: true } });
    if (!log) throw new NotFoundException('值班日志不存在');
    return log;
  }

  private assertDraft(status: DutyLogStatus) {
    if (status !== 'DRAFT') throw new BadRequestException('值班日志已提交, 请先撤回再修改');
  }

  private async assertFstdInOrg(fstdId: string | undefined, organizationId: string) {
    if (!fstdId) return;
    const fstd = await this.prisma.fstd.findFirst({ where: { id: fstdId, organizationId } });
    if (!fstd) throw new BadRequestException('设备不属于该机构');
  }

  /// 值班工程师现在是排班人员(维护部门); 老数据里存的是人员档案ID, 按人员档案兜底
  private staffNames(tenantId: string, ids: string[]) {
    return resolveStaffNames(this.prisma, tenantId, ids);
  }

  private activeWorkShifts(organizationId: string) {
    return this.prisma.shiftType.findMany({ where: { organizationId, department: 'MAINTENANCE', isActive: true, category: 'WORK' }, orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] });
  }

  // ---- 值班日志 ----

  async create(tenantId: string, email: string, dto: { organizationId: string; date: string; shiftTypeId: string; groupId?: string }) {
    const date = parseDay(dto.date, 'date');
    const shift = await this.prisma.shiftType.findFirst({ where: { id: dto.shiftTypeId, organizationId: dto.organizationId } });
    if (!shift) throw new BadRequestException('班次不属于该机构');
    if (shift.category !== 'WORK' || !shift.isActive || shift.department !== 'MAINTENANCE') throw new BadRequestException('只能为启用中的维护部门工作班次建立值班日志');
    if (dto.groupId) {
      const group = await this.prisma.rosterGroup.findFirst({ where: { id: dto.groupId, organizationId: dto.organizationId } });
      if (!group) throw new BadRequestException('班组不属于该机构');
    }
    const groupKey = dto.groupId ?? '';
    const exists = await this.prisma.dutyLog.findUnique({ where: { organizationId_date_shiftTypeId_groupKey: { organizationId: dto.organizationId, date, shiftTypeId: shift.id, groupKey } } });
    if (exists) throw new BadRequestException(`${dto.date} ${shift.code} 班${dto.groupId ? '(该班组)' : ''}已有值班日志`);

    // 值班工程师默认取班表里当天排了这个班次的人 (指定班组时只取该班组成员)
    const rostered = await this.prisma.rosterEntry.findMany({ where: { organizationId: dto.organizationId, date, shiftTypeId: shift.id, staff: { isActive: true } }, select: { staffId: true } });
    let engineerIds = rostered.map((r) => r.staffId);
    if (dto.groupId && engineerIds.length > 0) {
      const members = await this.prisma.staffMember.findMany({ where: { organizationId: dto.organizationId, groupId: dto.groupId, id: { in: engineerIds } }, select: { id: true } });
      engineerIds = members.map((m) => m.id);
    }

    return this.prisma.dutyLog.create({
      data: { organizationId: dto.organizationId, date, shiftTypeId: shift.id, groupId: dto.groupId ?? null, groupKey, engineerIds, createdByEmail: email },
    });
  }

  async update(tenantId: string, id: string, data: { engineerIds?: string[] }) {
    const log = await this.findLogOrThrow(id, tenantId);
    this.assertDraft(log.status);
    if (data.engineerIds) {
      const unique = [...new Set(data.engineerIds)];
      const found = await this.prisma.staffMember.count({ where: { organizationId: log.organizationId, department: 'MAINTENANCE', id: { in: unique } } });
      if (found !== unique.length) throw new BadRequestException('包含不属于该机构维护部门的人员');
      return this.prisma.dutyLog.update({ where: { id }, data: { engineerIds: unique } });
    }
    return log;
  }

  async remove(tenantId: string, id: string) {
    const log = await this.findLogOrThrow(id, tenantId);
    this.assertDraft(log.status);
    await this.prisma.dutyLog.delete({ where: { id } });
    return { deleted: true };
  }

  async submit(tenantId: string, email: string, id: string) {
    const log = await this.findLogOrThrow(id, tenantId);
    this.assertDraft(log.status);
    if (log.engineerIds.length === 0) throw new BadRequestException('请先填写值班工程师');
    const dr = await this.computeDr(log.organizationId, log.date, log.shiftType);
    const updated = await this.prisma.dutyLog.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date(), drSnapshotJson: dr as unknown as Prisma.InputJsonValue },
    });
    await this.auditLog.write(tenantId, 'DutyLog', id, 'status_change', { status: 'DRAFT' }, { status: 'SUBMITTED', by: email });
    return updated;
  }

  /// 撤回为草稿; 如果它交出去的事项已经有人处理过, 不允许撤回 (否则会改写别人已处理的依据)
  async reopen(tenantId: string, email: string, id: string) {
    const log = await this.findLogOrThrow(id, tenantId);
    if (log.status !== 'SUBMITTED') throw new BadRequestException('只有已提交的值班日志才能撤回');
    const handled = await this.prisma.dutyHandover.count({ where: { logId: id, completedAt: { not: null } } });
    if (handled > 0) throw new BadRequestException('该日志交出的事项已有被处理的记录, 不能撤回');
    const updated = await this.prisma.dutyLog.update({ where: { id }, data: { status: 'DRAFT', submittedAt: null, drSnapshotJson: Prisma.DbNull } });
    await this.auditLog.write(tenantId, 'DutyLog', id, 'status_change', { status: 'SUBMITTED' }, { status: 'DRAFT', by: email });
    return updated;
  }

  /// 本班时段内的故障(DR)操作: 时段内报告的、时段内关闭的
  private async computeDr(organizationId: string, date: Date, shift: ShiftType): Promise<DrRecord[]> {
    const window = shiftWindow(date, shift);
    if (!window) return [];
    const fstds = await this.prisma.fstd.findMany({ where: { organizationId }, select: { id: true, deviceCode: true } });
    const code = new Map(fstds.map((f) => [f.id, f.deviceCode]));
    const range = { gte: window.start, lt: window.end };
    const items = await this.prisma.discrepancyLog.findMany({
      where: { fstdId: { in: fstds.map((f) => f.id) }, OR: [{ reportedAt: range }, { correctedAt: range }] },
    });
    const rows: DrRecord[] = [];
    for (const d of items) {
      const base = { discrepancyId: d.id, fstdId: d.fstdId, deviceCode: code.get(d.fstdId) ?? d.fstdId, description: d.description, correctiveAction: d.correctiveAction, isMmi: d.isMmi };
      if (d.reportedAt >= window.start && d.reportedAt < window.end) rows.push({ ...base, action: 'REPORTED', at: d.reportedAt.toISOString() });
      if (d.correctedAt && d.correctedAt >= window.start && d.correctedAt < window.end) rows.push({ ...base, action: 'CORRECTED', at: d.correctedAt.toISOString() });
    }
    return rows.sort((a, b) => a.at.localeCompare(b.at));
  }

  async getDetail(tenantId: string, id: string) {
    const log = await this.findLogOrThrow(id, tenantId);
    const orgId = log.organizationId;
    const [entries, outgoing, shifts, fstds] = await Promise.all([
      this.prisma.dutyEntry.findMany({ where: { logId: id }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.dutyHandover.findMany({ where: { logId: id }, include: { toShift: true }, orderBy: { createdAt: 'asc' } }),
      this.activeWorkShifts(orgId),
      this.prisma.fstd.findMany({ where: { organizationId: orgId }, select: { id: true, deviceCode: true } }),
    ]);
    const code = new Map(fstds.map((f) => [f.id, f.deviceCode]));
    const window = shiftWindow(log.date, log.shiftType);

    // 来自上一班: 已提交日志交出的、目标班次不晚于本班的未完成事项, 加上在本日志里被处理掉的
    const incomingRows = window
      ? await this.prisma.dutyHandover.findMany({
          where: {
            log: { organizationId: orgId, status: 'SUBMITTED', id: { not: id } },
            OR: [{ completedAt: null, toStartAt: { lte: window.start } }, { completedInLogId: id }],
          },
          include: { log: { include: { shiftType: true, group: true } } },
          orderBy: { toStartAt: 'asc' },
        })
      : [];

    const dr = log.drSnapshotJson ? (log.drSnapshotJson as unknown as DrRecord[]) : await this.computeDr(orgId, log.date, log.shiftType);
    const names = await this.staffNames(tenantId, log.engineerIds);
    const next = nextShiftSlot(shifts, log.date, log.shiftType);

    return {
      id: log.id,
      organizationId: orgId,
      date: ymd(log.date),
      status: log.status,
      submittedAt: log.submittedAt,
      createdByEmail: log.createdByEmail,
      shift: { id: log.shiftType.id, code: log.shiftType.code, name: log.shiftType.name, startTime: log.shiftType.startTime, endTime: log.shiftType.endTime, endsNextDay: log.shiftType.endsNextDay },
      group: log.group ? { id: log.group.id, name: log.group.name } : null,
      engineers: log.engineerIds.map((pid) => ({ staffId: pid, name: names.get(pid) ?? pid })),
      entries: entries.map((e) => ({ ...e, deviceCode: e.fstdId ? (code.get(e.fstdId) ?? null) : null })),
      outgoing: outgoing.map((h) => ({
        id: h.id,
        content: h.content,
        fstdId: h.fstdId,
        deviceCode: h.fstdId ? (code.get(h.fstdId) ?? null) : null,
        toDate: ymd(h.toDate),
        toShiftTypeId: h.toShiftTypeId,
        toShiftCode: h.toShift.code,
        completedAt: h.completedAt,
      })),
      incoming: incomingRows.map((h) => ({
        id: h.id,
        content: h.content,
        deviceCode: h.fstdId ? (code.get(h.fstdId) ?? null) : null,
        fromDate: ymd(h.log.date),
        fromShiftCode: h.log.shiftType.code,
        fromGroupName: h.log.group?.name ?? null,
        toDate: ymd(h.toDate),
        completedAt: h.completedAt,
        completedInThisLog: h.completedInLogId === id,
      })),
      drRecords: dr.map((r) => ({ ...r })),
      drIsSnapshot: !!log.drSnapshotJson,
      nextSuggestion: next ? { date: ymd(next.date), shiftTypeId: next.shift.id, shiftCode: next.shift.code } : null,
    };
  }

  // ---- 列表 / 导出 ----

  private listWhere(organizationId: string, f: { from?: string; to?: string; status?: string; groupId?: string; engineerId?: string; fstdId?: string; keyword?: string }): Prisma.DutyLogWhereInput {
    const where: Prisma.DutyLogWhereInput = { organizationId };
    if (f.from || f.to) where.date = { ...(f.from ? { gte: parseDay(f.from, 'from') } : {}), ...(f.to ? { lte: parseDay(f.to, 'to') } : {}) };
    if (f.status === 'DRAFT' || f.status === 'SUBMITTED') where.status = f.status;
    else if (f.status) throw new BadRequestException('status 只能是 DRAFT 或 SUBMITTED');
    if (f.groupId) where.groupId = f.groupId;
    if (f.engineerId) where.engineerIds = { has: f.engineerId };
    const and: Prisma.DutyLogWhereInput[] = [];
    if (f.fstdId) and.push({ OR: [{ entries: { some: { fstdId: f.fstdId } } }, { handovers: { some: { fstdId: f.fstdId } } }] });
    const kw = f.keyword?.trim();
    if (kw) and.push({ OR: [{ entries: { some: { content: { contains: kw, mode: 'insensitive' } } } }, { handovers: { some: { content: { contains: kw, mode: 'insensitive' } } } }] });
    if (and.length) where.AND = and;
    return where;
  }

  async list(tenantId: string, organizationId: string | undefined, filters: Parameters<DutyService['listWhere']>[1]) {
    const orgId = this.requireOrganizationId(organizationId);
    const logs = await this.prisma.dutyLog.findMany({
      where: this.listWhere(orgId, filters),
      include: { shiftType: true, group: true, entries: { select: { kind: true } }, handovers: { select: { completedAt: true } } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: MAX_LIST,
    });
    const names = await this.staffNames(tenantId, logs.flatMap((l) => l.engineerIds));
    return logs.map((l) => ({
      id: l.id,
      date: ymd(l.date),
      status: l.status,
      shiftCode: l.shiftType.code,
      shiftName: l.shiftType.name,
      groupName: l.group?.name ?? null,
      engineers: l.engineerIds.map((p) => names.get(p) ?? p),
      entryCount: l.entries.length,
      nonRoutineCount: l.entries.filter((e) => e.kind === 'NON_ROUTINE').length,
      handoverCount: l.handovers.length,
      openHandoverCount: l.handovers.filter((h) => !h.completedAt).length,
    }));
  }

  async exportLogs(tenantId: string, organizationId: string | undefined, filters: Parameters<DutyService['listWhere']>[1]): Promise<Buffer> {
    const orgId = this.requireOrganizationId(organizationId);
    const logs = await this.prisma.dutyLog.findMany({
      where: this.listWhere(orgId, filters),
      include: { shiftType: true, group: true, entries: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }, handovers: { include: { toShift: true } } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      take: MAX_LIST,
    });
    const names = await this.staffNames(tenantId, logs.flatMap((l) => l.engineerIds));
    const fstds = await this.prisma.fstd.findMany({ where: { organizationId: orgId }, select: { id: true, deviceCode: true } });
    const code = new Map(fstds.map((f) => [f.id, f.deviceCode]));

    const workbook = new ExcelJS.Workbook();
    const summary = workbook.addWorksheet('值班日志');
    summary.addRow(['日期', '班次', '班组', '状态', '值班工程师', '值班内容条数', '非常规任务数', '交接事项数', '未完成交接数']).font = { bold: true };
    const detail = workbook.addWorksheet('明细');
    detail.addRow(['日期', '班次', '班组', '类别', '设备', '内容', '去向/状态']).font = { bold: true };
    for (const l of logs) {
      const group = l.group?.name ?? '';
      summary.addRow([ymd(l.date), l.shiftType.code, group, l.status === 'SUBMITTED' ? '已提交' : '草稿', l.engineerIds.map((p) => names.get(p) ?? p).join('、'), l.entries.length, l.entries.filter((e) => e.kind === 'NON_ROUTINE').length, l.handovers.length, l.handovers.filter((h) => !h.completedAt).length]);
      for (const e of l.entries) detail.addRow([ymd(l.date), l.shiftType.code, group, e.kind === 'NON_ROUTINE' ? '非常规任务' : '常规任务', e.fstdId ? (code.get(e.fstdId) ?? '') : '', e.content, '']);
      for (const h of l.handovers) detail.addRow([ymd(l.date), l.shiftType.code, group, '交接事项', h.fstdId ? (code.get(h.fstdId) ?? '') : '', h.content, `${h.completedAt ? '已处理' : '未完成'} → ${ymd(h.toDate)} ${h.toShift.code}`]);
    }
    [12, 8, 14, 10, 26, 14, 14, 12, 14].forEach((w, i) => {
      summary.getColumn(i + 1).width = w;
    });
    [12, 8, 14, 12, 14, 60, 24].forEach((w, i) => {
      detail.getColumn(i + 1).width = w;
    });
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  // ---- 值班内容 ----

  async addEntry(tenantId: string, logId: string, data: { kind: DutyEntryKind; content: string; fstdId?: string }) {
    const log = await this.findLogOrThrow(logId, tenantId);
    this.assertDraft(log.status);
    await this.assertFstdInOrg(data.fstdId, log.organizationId);
    const max = await this.prisma.dutyEntry.aggregate({ where: { logId }, _max: { sortOrder: true } });
    return this.prisma.dutyEntry.create({ data: { logId, kind: data.kind, content: data.content.trim(), fstdId: data.fstdId || null, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
  }

  private async findEntryOrThrow(id: string, tenantId: string) {
    const entry = await this.prisma.dutyEntry.findFirst({ where: { id, log: { organization: { tenantId } } }, include: { log: true } });
    if (!entry) throw new NotFoundException('值班内容不存在');
    this.assertDraft(entry.log.status);
    return entry;
  }

  async updateEntry(tenantId: string, id: string, data: { kind?: DutyEntryKind; content?: string; fstdId?: string }) {
    const entry = await this.findEntryOrThrow(id, tenantId);
    await this.assertFstdInOrg(data.fstdId, entry.log.organizationId);
    return this.prisma.dutyEntry.update({ where: { id }, data: { kind: data.kind, content: data.content?.trim(), fstdId: data.fstdId === undefined ? undefined : data.fstdId || null } });
  }

  async removeEntry(tenantId: string, id: string) {
    await this.findEntryOrThrow(id, tenantId);
    await this.prisma.dutyEntry.delete({ where: { id } });
    return { deleted: true };
  }

  // ---- 交接事项 ----

  /// 解析交接目标: 不传则取下一个工作班次; 传了则必须是本机构启用的工作班次, 且开始时刻不早于本班结束
  private async resolveTarget(log: { organizationId: string; date: Date; shiftType: ShiftType }, toDate?: string, toShiftTypeId?: string) {
    const own = shiftWindow(log.date, log.shiftType);
    if (!own) throw new BadRequestException('当前班次不是工作班次');
    if (toDate || toShiftTypeId) {
      if (!toDate || !toShiftTypeId) throw new BadRequestException('指定交接班次时必须同时提供 toDate 和 toShiftTypeId');
      const date = parseDay(toDate, 'toDate');
      const shift = await this.prisma.shiftType.findFirst({ where: { id: toShiftTypeId, organizationId: log.organizationId } });
      if (!shift || shift.category !== 'WORK' || !shift.isActive) throw new BadRequestException('交接班次必须是本机构启用中的工作班次');
      const w = shiftWindow(date, shift);
      if (!w || w.start.getTime() < own.end.getTime()) throw new BadRequestException('交接班次必须在本班结束之后开始');
      return { date, shiftTypeId: shift.id, startAt: w.start };
    }
    const next = nextShiftSlot(await this.activeWorkShifts(log.organizationId), log.date, log.shiftType);
    if (!next) throw new BadRequestException('找不到下一个工作班次, 请指定交接班次');
    return { date: next.date, shiftTypeId: next.shift.id, startAt: next.startAt };
  }

  async addHandover(tenantId: string, logId: string, dto: CreateDutyHandoverDto) {
    const log = await this.findLogOrThrow(logId, tenantId);
    this.assertDraft(log.status);
    await this.assertFstdInOrg(dto.fstdId, log.organizationId);
    const target = await this.resolveTarget(log, dto.toDate, dto.toShiftTypeId);
    return this.prisma.dutyHandover.create({
      data: { logId, content: dto.content.trim(), fstdId: dto.fstdId || null, toDate: target.date, toShiftTypeId: target.shiftTypeId, toStartAt: target.startAt },
    });
  }

  private async findHandoverOrThrow(id: string, tenantId: string) {
    const h = await this.prisma.dutyHandover.findFirst({ where: { id, log: { organization: { tenantId } } }, include: { log: { include: { shiftType: true } } } });
    if (!h) throw new NotFoundException('交接事项不存在');
    return h;
  }

  async updateHandover(tenantId: string, id: string, dto: UpdateDutyHandoverDto) {
    const h = await this.findHandoverOrThrow(id, tenantId);
    this.assertDraft(h.log.status);
    await this.assertFstdInOrg(dto.fstdId, h.log.organizationId);
    const data: Prisma.DutyHandoverUpdateInput = { content: dto.content?.trim() };
    if (dto.fstdId !== undefined) data.fstdId = dto.fstdId || null;
    if (dto.toDate || dto.toShiftTypeId) {
      const target = await this.resolveTarget(h.log, dto.toDate, dto.toShiftTypeId);
      data.toDate = target.date;
      data.toShift = { connect: { id: target.shiftTypeId } };
      data.toStartAt = target.startAt;
    }
    return this.prisma.dutyHandover.update({ where: { id }, data });
  }

  async removeHandover(tenantId: string, id: string) {
    const h = await this.findHandoverOrThrow(id, tenantId);
    this.assertDraft(h.log.status);
    await this.prisma.dutyHandover.delete({ where: { id } });
    return { deleted: true };
  }

  /// 标记已处理 (只有已提交日志交出的事项才会出现在别的班次里, 所以只允许对已提交日志的事项操作)
  async completeHandover(tenantId: string, email: string, id: string, completedInLogId?: string) {
    const h = await this.findHandoverOrThrow(id, tenantId);
    if (h.log.status !== 'SUBMITTED') throw new BadRequestException('该事项所在的值班日志尚未提交');
    if (completedInLogId) {
      const log = await this.prisma.dutyLog.findFirst({ where: { id: completedInLogId, organizationId: h.log.organizationId } });
      if (!log) throw new BadRequestException('completedInLogId 不属于该机构');
    }
    return this.prisma.dutyHandover.update({ where: { id }, data: { completedAt: new Date(), completedInLogId: completedInLogId ?? null, completedByEmail: email } });
  }

  async reopenHandover(tenantId: string, id: string) {
    await this.findHandoverOrThrow(id, tenantId);
    return this.prisma.dutyHandover.update({ where: { id }, data: { completedAt: null, completedInLogId: null, completedByEmail: null } });
  }

  /// 交接班查询: 按日志日期范围/完成状态/关键词查所有交接事项 (仅已提交日志)
  async listHandovers(organizationId: string | undefined, f: { from?: string; to?: string; status?: string; keyword?: string }) {
    const orgId = this.requireOrganizationId(organizationId);
    const where: Prisma.DutyHandoverWhereInput = { log: { organizationId: orgId, status: 'SUBMITTED' } };
    if (f.from || f.to) where.log = { ...(where.log as object), date: { ...(f.from ? { gte: parseDay(f.from, 'from') } : {}), ...(f.to ? { lte: parseDay(f.to, 'to') } : {}) } };
    if (f.status === 'open') where.completedAt = null;
    else if (f.status === 'completed') where.completedAt = { not: null };
    else if (f.status) throw new BadRequestException('status 只能是 open 或 completed');
    const kw = f.keyword?.trim();
    if (kw) where.content = { contains: kw, mode: 'insensitive' };
    const rows = await this.prisma.dutyHandover.findMany({
      where,
      include: { log: { include: { shiftType: true, group: true } }, toShift: true },
      orderBy: [{ toStartAt: 'desc' }, { createdAt: 'desc' }],
      take: MAX_LIST,
    });
    const fstds = await this.prisma.fstd.findMany({ where: { organizationId: orgId }, select: { id: true, deviceCode: true } });
    const code = new Map(fstds.map((x) => [x.id, x.deviceCode]));
    return rows.map((h) => ({
      id: h.id,
      logId: h.logId,
      content: h.content,
      deviceCode: h.fstdId ? (code.get(h.fstdId) ?? null) : null,
      fromDate: ymd(h.log.date),
      fromShiftCode: h.log.shiftType.code,
      fromGroupName: h.log.group?.name ?? null,
      toDate: ymd(h.toDate),
      toShiftCode: h.toShift.code,
      completedAt: h.completedAt,
      completedByEmail: h.completedByEmail,
    }));
  }
}

