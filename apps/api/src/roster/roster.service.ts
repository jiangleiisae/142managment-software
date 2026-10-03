import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ShiftCategory } from '@prisma/client';
import ExcelJS from 'exceljs';
import { AuditLogService } from '../audit-log/audit-log.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CN_OFFSET_MS, DAY_MS, shiftGrossMinutes, toMinutes } from './shift-time.js';
import type { CreateShiftTypeDto, UpdateShiftTypeDto } from './dto/roster.dto.js';

const HOUR_MS = 60 * 60 * 1000;
const MAX_STAT_DAYS = 366;

/// 新机构第一次打开班表时自动建立的默认班次 (休息时长默认 0, 可在班次配置里改)
const DEFAULT_SHIFTS: Omit<Prisma.ShiftTypeCreateManyInput, 'organizationId'>[] = [
  { code: 'M', name: '白班', category: 'WORK', startTime: '08:30', endTime: '17:00', endsNextDay: false, color: '#1677ff', sortOrder: 1 },
  { code: 'E', name: '晚班', category: 'WORK', startTime: '17:00', endTime: '08:30', endsNextDay: true, color: '#722ed1', sortOrder: 2 },
  { code: 'D', name: '24小时班次', category: 'WORK', startTime: '08:30', endTime: '08:30', endsNextDay: true, color: '#fa8c16', sortOrder: 3 },
  { code: 'B', name: '出差', category: 'BUSINESS_TRIP', color: '#13c2c2', sortOrder: 4 },
  { code: 'S', name: '病假', category: 'SICK_LEAVE', color: '#f5222d', sortOrder: 5 },
  { code: 'V', name: '倒休', category: 'COMPENSATORY_LEAVE', color: '#52c41a', sortOrder: 6 },
  { code: 'Q', name: '其他', category: 'OTHER', color: '#8c8c8c', sortOrder: 7 },
  { code: 'A', name: '年假', category: 'ANNUAL_LEAVE', color: '#eb2f96', sortOrder: 8 },
];

const cnToday = () => new Date(Date.now() + CN_OFFSET_MS).toISOString().slice(0, 10);
const two = (n: number) => String(n).padStart(2, '0');

function parseDay(value: string | undefined, label: string): Date {
  if (!value) throw new BadRequestException(`缺少 ${label}`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${label} "${value}" 不是有效的日历日 (YYYY-MM-DD)`);
  }
  return parsed;
}

function monthBounds(month: string | undefined): { first: Date; last: Date; days: string[] } {
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestException('month 必须是 YYYY-MM');
  const first = new Date(`${month}-01T00:00:00.000Z`);
  const next = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1));
  const count = Math.round((next.getTime() - first.getTime()) / DAY_MS);
  const days = Array.from({ length: count }, (_, i) => `${month}-${two(i + 1)}`);
  return { first, last: new Date(next.getTime() - DAY_MS), days };
}

function validateShift(v: { category: ShiftCategory; startTime?: string | null; endTime?: string | null; endsNextDay?: boolean; restMinutes?: number }) {
  if (v.category !== 'WORK') return;
  if (!v.startTime || !v.endTime) throw new BadRequestException('工作班次必须填写开始和结束时间');
  const gross = shiftGrossMinutes({ startTime: v.startTime, endTime: v.endTime, endsNextDay: v.endsNextDay ?? false });
  if (gross <= 0) throw new BadRequestException('结束时间必须晚于开始时间(跨午夜请勾选"次日结束")');
  if (gross > 1440) throw new BadRequestException('单个班次不能超过24小时');
  if ((v.restMinutes ?? 0) >= gross) throw new BadRequestException('休息时长必须小于班次时长');
}

@Injectable()
export class RosterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private requireOrganizationId(organizationId: string | undefined): string {
    if (!organizationId) throw new BadRequestException('缺少 organizationId');
    return organizationId;
  }

  // ---- 班次配置 ----

  async listShiftTypes(organizationId: string | undefined) {
    const orgId = this.requireOrganizationId(organizationId);
    const count = await this.prisma.shiftType.count({ where: { organizationId: orgId } });
    if (count === 0) {
      await this.prisma.shiftType.createMany({ data: DEFAULT_SHIFTS.map((s) => ({ ...s, organizationId: orgId })), skipDuplicates: true });
    }
    return this.prisma.shiftType.findMany({ where: { organizationId: orgId }, orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] });
  }

  async createShiftType(tenantId: string, dto: CreateShiftTypeDto) {
    validateShift(dto);
    const code = dto.code.toUpperCase();
    const exists = await this.prisma.shiftType.findUnique({ where: { organizationId_code: { organizationId: dto.organizationId, code } } });
    if (exists) throw new BadRequestException(`班次代码 ${code} 已存在`);
    const isWork = dto.category === 'WORK';
    const created = await this.prisma.shiftType.create({
      data: {
        organizationId: dto.organizationId,
        code,
        name: dto.name.trim(),
        category: dto.category,
        startTime: isWork ? dto.startTime : null,
        endTime: isWork ? dto.endTime : null,
        endsNextDay: isWork ? (dto.endsNextDay ?? false) : false,
        restMinutes: isWork ? (dto.restMinutes ?? 0) : 0,
        color: dto.color.toLowerCase(),
        generatesMaintenanceTasks: dto.generatesMaintenanceTasks ?? false,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 100,
      },
    });
    await this.auditLog.write(tenantId, 'ShiftType', created.id, 'create', null, created);
    return created;
  }

  async updateShiftType(tenantId: string, id: string, dto: UpdateShiftTypeDto) {
    const before = await this.prisma.shiftType.findFirst({ where: { id, organization: { tenantId } } });
    if (!before) throw new NotFoundException('班次不存在');
    const merged = {
      category: dto.category ?? before.category,
      startTime: dto.startTime ?? before.startTime,
      endTime: dto.endTime ?? before.endTime,
      endsNextDay: dto.endsNextDay ?? before.endsNextDay,
      restMinutes: dto.restMinutes ?? before.restMinutes,
    };
    validateShift(merged);
    const isWork = merged.category === 'WORK';
    const updated = await this.prisma.shiftType.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        category: merged.category,
        startTime: isWork ? merged.startTime : null,
        endTime: isWork ? merged.endTime : null,
        endsNextDay: isWork ? merged.endsNextDay : false,
        restMinutes: isWork ? merged.restMinutes : 0,
        color: dto.color?.toLowerCase(),
        generatesMaintenanceTasks: dto.generatesMaintenanceTasks,
        description: dto.description,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });
    await this.auditLog.write(tenantId, 'ShiftType', id, 'update', before, updated);
    return updated;
  }

  // ---- 班组 ----

  listGroups(organizationId: string | undefined) {
    return this.prisma.rosterGroup.findMany({ where: { organizationId: this.requireOrganizationId(organizationId) }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  async createGroup(organizationId: string, name: string) {
    const trimmed = name.trim();
    const exists = await this.prisma.rosterGroup.findUnique({ where: { organizationId_name: { organizationId, name: trimmed } } });
    if (exists) throw new BadRequestException(`班组 ${trimmed} 已存在`);
    const max = await this.prisma.rosterGroup.aggregate({ where: { organizationId }, _max: { sortOrder: true } });
    return this.prisma.rosterGroup.create({ data: { organizationId, name: trimmed, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
  }

  private async findGroupOrThrow(id: string, tenantId: string) {
    const group = await this.prisma.rosterGroup.findFirst({ where: { id, organization: { tenantId } } });
    if (!group) throw new NotFoundException('班组不存在');
    return group;
  }

  async updateGroup(tenantId: string, id: string, data: { name?: string; sortOrder?: number }) {
    const group = await this.findGroupOrThrow(id, tenantId);
    const name = data.name?.trim();
    if (name && name !== group.name) {
      const dup = await this.prisma.rosterGroup.findUnique({ where: { organizationId_name: { organizationId: group.organizationId, name } } });
      if (dup) throw new BadRequestException(`班组 ${name} 已存在`);
    }
    return this.prisma.rosterGroup.update({ where: { id }, data: { name, sortOrder: data.sortOrder } });
  }

  async deleteGroup(tenantId: string, id: string) {
    await this.findGroupOrThrow(id, tenantId);
    await this.prisma.rosterGroup.delete({ where: { id } }); // 成员的 groupId 自动置空
    return { deleted: true };
  }

  // ---- 班表人员 ----

  listMembers(organizationId: string | undefined) {
    return this.prisma.rosterMember
      .findMany({
        where: { organizationId: this.requireOrganizationId(organizationId) },
        include: { personnel: { select: { id: true, firstName: true, lastName: true } }, group: { select: { id: true, name: true, sortOrder: true } } },
      })
      .then((rows) =>
        rows
          .map((m) => ({
            id: m.id,
            personnelId: m.personnelId,
            name: `${m.personnel.lastName}${m.personnel.firstName}`.trim(),
            groupId: m.groupId,
            groupName: m.group?.name ?? null,
            groupSort: m.group?.sortOrder ?? Number.MAX_SAFE_INTEGER,
            sortOrder: m.sortOrder,
          }))
          .sort((a, b) => a.groupSort - b.groupSort || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh')),
      );
  }

  private async assertGroupInOrg(groupId: string | undefined | null, organizationId: string) {
    if (!groupId) return;
    const group = await this.prisma.rosterGroup.findFirst({ where: { id: groupId, organizationId } });
    if (!group) throw new BadRequestException('班组不属于该机构');
  }

  async addMembers(tenantId: string, organizationId: string, personnelIds: string[], groupId?: string) {
    await this.assertGroupInOrg(groupId, organizationId);
    const unique = [...new Set(personnelIds)];
    const people = await this.prisma.personnel.findMany({ where: { tenantId, id: { in: unique } }, select: { id: true } });
    if (people.length !== unique.length) throw new BadRequestException('包含不属于当前租户的人员');
    const max = await this.prisma.rosterMember.aggregate({ where: { organizationId }, _max: { sortOrder: true } });
    let next = (max._max.sortOrder ?? 0) + 1;
    const res = await this.prisma.rosterMember.createMany({
      data: unique.map((personnelId) => ({ organizationId, personnelId, groupId: groupId ?? null, sortOrder: next++ })),
      skipDuplicates: true,
    });
    return { requested: unique.length, added: res.count };
  }

  /// 可加入班表的人员: 本租户里还不在该机构班表中的人员档案。
  /// 班表模块自己提供这个列表, 这样只有"排班预订"权限的账号也能添加人员, 不必同时拥有"人员资质"权限。
  async personnelOptions(tenantId: string, organizationId: string | undefined) {
    const orgId = this.requireOrganizationId(organizationId);
    const [people, members] = await Promise.all([
      this.prisma.personnel.findMany({ where: { tenantId }, select: { id: true, firstName: true, lastName: true }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] }),
      this.prisma.rosterMember.findMany({ where: { organizationId: orgId }, select: { personnelId: true } }),
    ]);
    const taken = new Set(members.map((m) => m.personnelId));
    return people.filter((p) => !taken.has(p.id)).map((p) => ({ id: p.id, name: `${p.lastName}${p.firstName}`.trim() }));
  }

  /// 新建人员(只有姓名)并直接加入班表; 同名不阻止(可能真的重名), 创建写审计轨迹
  async createMember(tenantId: string, email: string, organizationId: string, data: { lastName: string; firstName: string; groupId?: string }) {
    await this.assertGroupInOrg(data.groupId, organizationId);
    const lastName = data.lastName.trim();
    const firstName = data.firstName.trim();
    if (!lastName || !firstName) throw new BadRequestException('姓和名都不能为空');
    const personnel = await this.prisma.personnel.create({ data: { tenantId, lastName, firstName } });
    await this.auditLog.write(tenantId, 'Personnel', personnel.id, 'create', null, { ...personnel, via: 'roster', by: email });
    const max = await this.prisma.rosterMember.aggregate({ where: { organizationId }, _max: { sortOrder: true } });
    const member = await this.prisma.rosterMember.create({ data: { organizationId, personnelId: personnel.id, groupId: data.groupId ?? null, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
    return { id: member.id, personnelId: personnel.id, name: `${lastName}${firstName}` };
  }

  async updateMember(tenantId: string, id: string, data: { groupId?: string | null; sortOrder?: number }) {
    const member = await this.prisma.rosterMember.findFirst({ where: { id, organization: { tenantId } } });
    if (!member) throw new NotFoundException('班表人员不存在');
    await this.assertGroupInOrg(data.groupId, member.organizationId);
    return this.prisma.rosterMember.update({ where: { id }, data: { groupId: data.groupId, sortOrder: data.sortOrder } });
  }

  /// 移出班表只删除成员关系, 已排的历史班次保留 (工时统计与修改历史仍可追溯)
  async removeMember(tenantId: string, id: string) {
    const member = await this.prisma.rosterMember.findFirst({ where: { id, organization: { tenantId } } });
    if (!member) throw new NotFoundException('班表人员不存在');
    await this.prisma.rosterMember.delete({ where: { id } });
    return { deleted: true };
  }

  // ---- 班表 ----

  async listEntries(organizationId: string | undefined, month: string | undefined) {
    const orgId = this.requireOrganizationId(organizationId);
    const { first, last } = monthBounds(month);
    const entries = await this.prisma.rosterEntry.findMany({
      where: { organizationId: orgId, date: { gte: first, lte: last } },
      select: { personnelId: true, date: true, shiftTypeId: true },
    });
    return entries.map((e) => ({ personnelId: e.personnelId, date: e.date.toISOString().slice(0, 10), shiftTypeId: e.shiftTypeId }));
  }

  /// 批量设置/清除班次; 过去的日期也可修改 (补录/更正), 每个变化的格子都写入修改历史
  async setEntries(
    tenantId: string,
    actorEmail: string,
    organizationId: string,
    cells: { personnelId: string; date: string }[],
    shiftTypeId: string | null | undefined,
  ) {
    const shift = shiftTypeId ? await this.prisma.shiftType.findFirst({ where: { id: shiftTypeId, organizationId } }) : null;
    if (shiftTypeId && !shift) throw new BadRequestException('班次不属于该机构');
    if (shift && !shift.isActive) throw new BadRequestException(`班次 ${shift.code} 已停用`);

    const unique = new Map<string, { personnelId: string; date: string; dateObj: Date }>();
    for (const c of cells) unique.set(`${c.personnelId}|${c.date}`, { ...c, dateObj: parseDay(c.date, 'date') });
    const list = [...unique.values()];

    const personnelIds = [...new Set(list.map((c) => c.personnelId))];
    const members = await this.prisma.rosterMember.findMany({ where: { organizationId, personnelId: { in: personnelIds } }, select: { personnelId: true } });
    if (members.length !== personnelIds.length) throw new BadRequestException('包含不在该机构班表中的人员');

    const existing = await this.prisma.rosterEntry.findMany({
      where: { organizationId, OR: list.map((c) => ({ personnelId: c.personnelId, date: c.dateObj })) },
      include: { shiftType: { select: { code: true } } },
    });
    const existingByKey = new Map(existing.map((e) => [`${e.personnelId}|${e.date.toISOString().slice(0, 10)}`, e]));

    let changed = 0;
    for (const c of list) {
      const before = existingByKey.get(`${c.personnelId}|${c.date}`);
      const beforeCode = before?.shiftType.code ?? null;
      const afterCode = shift?.code ?? null;
      if (beforeCode === afterCode) continue;
      if (shift) {
        await this.prisma.rosterEntry.upsert({
          where: { organizationId_personnelId_date: { organizationId, personnelId: c.personnelId, date: c.dateObj } },
          create: { organizationId, personnelId: c.personnelId, date: c.dateObj, shiftTypeId: shift.id },
          update: { shiftTypeId: shift.id },
        });
      } else if (before) {
        await this.prisma.rosterEntry.delete({ where: { id: before.id } });
      }
      changed += 1;
      await this.auditLog.write(tenantId, 'RosterEntry', `${organizationId}:${c.personnelId}:${c.date}`, beforeCode ? (afterCode ? 'update' : 'delete') : 'create', { shift: beforeCode }, { shift: afterCode, by: actorEmail });
    }
    return { requested: list.length, changed, unchanged: list.length - changed };
  }

  /// 修改历史: 谁在何时把哪个人哪一天的班次从什么改成什么 (来自审计轨迹)
  async history(tenantId: string, organizationId: string | undefined, personnelId?: string, from?: string, to?: string) {
    const orgId = this.requireOrganizationId(organizationId);
    const logs = await this.prisma.auditLog.findMany({
      where: { tenantId, entityType: 'RosterEntry', entityId: { startsWith: personnelId ? `${orgId}:${personnelId}:` : `${orgId}:` } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const rows = logs
      .map((l) => {
        const [, pid, date] = l.entityId.split(':');
        const before = l.beforeJson as { shift?: string | null } | null;
        const after = l.afterJson as { shift?: string | null; by?: string } | null;
        return { at: l.createdAt, personnelId: pid, date, before: before?.shift ?? null, after: after?.shift ?? null, by: after?.by ?? null };
      })
      .filter((r) => (!from || r.date >= from) && (!to || r.date <= to));
    const names = await this.personnelNames(tenantId, rows.map((r) => r.personnelId));
    return rows.map((r) => ({ ...r, name: names.get(r.personnelId) ?? r.personnelId }));
  }

  private async personnelNames(tenantId: string, ids: string[]) {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map<string, string>();
    const people = await this.prisma.personnel.findMany({ where: { tenantId, id: { in: unique } } });
    return new Map(people.map((p) => [p.id, `${p.lastName}${p.firstName}`.trim()]));
  }

  /// 我的排班: 当前登录账号关联的人员, 未来 days 天(含今天)在本租户各机构的班次
  async myRoster(tenantId: string, userId: string, days: number) {
    const count = Math.min(Math.max(Math.trunc(days) || 15, 1), 62);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.personnelId) return { linked: false, days: [] };
    const start = parseDay(cnToday(), 'today');
    const end = new Date(start.getTime() + (count - 1) * DAY_MS);
    const entries = await this.prisma.rosterEntry.findMany({
      where: { personnelId: user.personnelId, date: { gte: start, lte: end }, organization: { tenantId } },
      include: { shiftType: true, organization: { select: { id: true, name: true } } },
      orderBy: { date: 'asc' },
    });
    return {
      linked: true,
      days: entries.map((e) => ({
        date: e.date.toISOString().slice(0, 10),
        organizationId: e.organization.id,
        organizationName: e.organization.name,
        shift: { code: e.shiftType.code, name: e.shiftType.name, category: e.shiftType.category, color: e.shiftType.color, startTime: e.shiftType.startTime, endTime: e.shiftType.endTime, endsNextDay: e.shiftType.endsNextDay },
      })),
    };
  }

  // ---- 工时统计 ----

  /// 统计周期 [from, to] (北京时间含首含尾) 内逐人汇总: 各班次天数/小时、总工时、休假天数。
  /// 工时 = 班次起止时长 − 休息时长; 跨日班次(E/D)按午夜拆分, 只计落入统计周期内的部分
  /// (休息时长按该班次总时长比例摊到各段)。
  async hours(organizationId: string | undefined, from: string | undefined, to: string | undefined, groupId?: string) {
    const orgId = this.requireOrganizationId(organizationId);
    const fromDay = parseDay(from, 'from');
    const toDay = parseDay(to, 'to');
    if (fromDay > toDay) throw new BadRequestException('from 不能晚于 to');
    if ((toDay.getTime() - fromDay.getTime()) / DAY_MS + 1 > MAX_STAT_DAYS) throw new BadRequestException(`统计范围不能超过${MAX_STAT_DAYS}天`);
    const periodStart = fromDay.getTime() - CN_OFFSET_MS;
    const periodEnd = toDay.getTime() + DAY_MS - CN_OFFSET_MS;

    const shifts = await this.listShiftTypes(orgId);
    const members = await this.listMembers(orgId);
    const entries = await this.prisma.rosterEntry.findMany({
      // 前一天开始的跨日班次会落进周期内, 多取一天
      where: { organizationId: orgId, date: { gte: new Date(fromDay.getTime() - DAY_MS), lte: toDay } },
      include: { shiftType: true },
    });

    const byPerson = new Map<string, typeof entries>();
    for (const e of entries) byPerson.set(e.personnelId, [...(byPerson.get(e.personnelId) ?? []), e]);

    const memberIds = new Set(members.map((m) => m.personnelId));
    const extraIds = [...byPerson.keys()].filter((id) => !memberIds.has(id));
    const tenantOrg = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { tenantId: true } });
    const extraNames = await this.personnelNames(tenantOrg?.tenantId ?? '', extraIds);

    const rows = [
      ...members.map((m) => ({ personnelId: m.personnelId, name: m.name, groupId: m.groupId, groupName: m.groupName })),
      ...extraIds.map((id) => ({ personnelId: id, name: extraNames.get(id) ?? id, groupId: null as string | null, groupName: null as string | null })),
    ]
      .filter((r) => !groupId || r.groupId === groupId)
      .map((r) => {
        const mine = byPerson.get(r.personnelId) ?? [];
        const byShift: Record<string, { days: number; hours: number }> = {};
        let totalHours = 0;
        let workDays = 0;
        for (const e of mine) {
          const dayStart = e.date.getTime() - CN_OFFSET_MS;
          const inPeriodDay = dayStart >= periodStart && dayStart < periodEnd;
          const s = e.shiftType;
          if (s.category === 'WORK' && s.startTime && s.endTime) {
            const gross = shiftGrossMinutes(s) * 60_000;
            if (gross <= 0) continue;
            const start = dayStart + toMinutes(s.startTime) * 60_000;
            const clipped = Math.max(0, Math.min(start + gross, periodEnd) - Math.max(start, periodStart));
            const hours = (clipped / HOUR_MS) * ((gross - s.restMinutes * 60_000) / gross);
            if (clipped > 0) {
              byShift[s.code] = { days: (byShift[s.code]?.days ?? 0) + (inPeriodDay ? 1 : 0), hours: (byShift[s.code]?.hours ?? 0) + hours };
              totalHours += hours;
              if (inPeriodDay) workDays += 1;
            }
          } else if (inPeriodDay) {
            byShift[s.code] = { days: (byShift[s.code]?.days ?? 0) + 1, hours: 0 };
          }
        }
        for (const v of Object.values(byShift)) v.hours = Math.round(v.hours * 100) / 100;
        return { ...r, workDays, totalHours: Math.round(totalHours * 100) / 100, byShift };
      });
    return { from: from as string, to: to as string, shiftTypes: shifts.map((s) => ({ id: s.id, code: s.code, name: s.name, category: s.category })), rows };
  }

  // ---- 导出 ----

  async exportMonth(organizationId: string | undefined, month: string | undefined): Promise<Buffer> {
    const orgId = this.requireOrganizationId(organizationId);
    const { days } = monthBounds(month);
    const [members, entries, shifts] = await Promise.all([this.listMembers(orgId), this.listEntries(orgId, month), this.listShiftTypes(orgId)]);
    const codeById = new Map(shifts.map((s) => [s.id, s.code]));
    const cell = new Map(entries.map((e) => [`${e.personnelId}|${e.date}`, codeById.get(e.shiftTypeId) ?? '']));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('班表');
    sheet.addRow([`人员班表 ${month}`]);
    sheet.addRow(['班组', '姓名', ...days.map((d) => d.slice(8))]).font = { bold: true };
    for (const m of members) sheet.addRow([m.groupName ?? '', m.name, ...days.map((d) => cell.get(`${m.personnelId}|${d}`) ?? '')]);
    sheet.getColumn(1).width = 14;
    sheet.getColumn(2).width = 14;
    days.forEach((_, i) => {
      sheet.getColumn(i + 3).width = 4;
    });

    const legend = workbook.addWorksheet('班次说明');
    legend.addRow(['代码', '名称', '类型', '开始', '结束', '次日结束', '休息(分钟)']).font = { bold: true };
    for (const s of shifts) legend.addRow([s.code, s.name, s.category, s.startTime ?? '', s.endTime ?? '', s.endsNextDay ? '是' : '', s.restMinutes]);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async exportHours(organizationId: string | undefined, from: string | undefined, to: string | undefined, groupId?: string): Promise<Buffer> {
    const r = await this.hours(organizationId, from, to, groupId);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('工时统计');
    sheet.addRow([`工时统计 ${r.from} ~ ${r.to}`]);
    sheet.addRow(['班组', '姓名', '出勤天数', '总工时(h)', ...r.shiftTypes.flatMap((s) => (s.category === 'WORK' ? [`${s.code} 天数`, `${s.code} 工时(h)`] : [`${s.code} 天数`]))]).font = { bold: true };
    for (const row of r.rows) {
      sheet.addRow([
        row.groupName ?? '',
        row.name,
        row.workDays,
        row.totalHours,
        ...r.shiftTypes.flatMap((s) => (s.category === 'WORK' ? [row.byShift[s.code]?.days ?? 0, row.byShift[s.code]?.hours ?? 0] : [row.byShift[s.code]?.days ?? 0])),
      ]);
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
