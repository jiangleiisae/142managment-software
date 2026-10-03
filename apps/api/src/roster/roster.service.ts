import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ShiftCategory, StaffDepartment } from '@prisma/client';
import ExcelJS from 'exceljs';
import { AuditLogService } from '../audit-log/audit-log.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateShiftTypeDto, CreateStaffDto, UpdateShiftTypeDto, UpdateStaffDto } from './dto/roster.dto.js';
import { resolveStaffNames } from './staff-names.js';
import { CN_OFFSET_MS, DAY_MS, shiftGrossMinutes, toMinutes } from './shift-time.js';

const HOUR_MS = 60 * 60 * 1000;
const MAX_STAT_DAYS = 366;

type DefaultShift = Omit<Prisma.ShiftTypeCreateManyInput, 'organizationId' | 'department'>;

/// 新机构第一次打开某个部门的班表时自动建立的默认班次 (休息时长默认 0, 可在班次配置里改)
const DEFAULT_SHIFTS: Record<StaffDepartment, DefaultShift[]> = {
  MAINTENANCE: [
    { code: 'M', name: '白班', category: 'WORK', startTime: '08:30', endTime: '17:00', endsNextDay: false, color: '#1677ff', sortOrder: 1 },
    { code: 'E', name: '晚班', category: 'WORK', startTime: '17:00', endTime: '08:30', endsNextDay: true, color: '#722ed1', sortOrder: 2 },
    { code: 'D', name: '24小时班次', category: 'WORK', startTime: '08:30', endTime: '08:30', endsNextDay: true, color: '#fa8c16', sortOrder: 3 },
    { code: 'B', name: '出差', category: 'BUSINESS_TRIP', color: '#13c2c2', sortOrder: 4 },
    { code: 'S', name: '病假', category: 'SICK_LEAVE', color: '#f5222d', sortOrder: 5 },
    { code: 'V', name: '倒休', category: 'COMPENSATORY_LEAVE', color: '#52c41a', sortOrder: 6 },
    { code: 'Q', name: '其他', category: 'OTHER', color: '#8c8c8c', sortOrder: 7 },
    { code: 'A', name: '年假', category: 'ANNUAL_LEAVE', color: '#eb2f96', sortOrder: 8 },
  ],
  // 行政综合只给一个最常用的正常班和假别, 早班/晚班/待命等按各岗位实际情况在"班次配置"里自己加
  ADMIN: [
    { code: 'Z', name: '正常班', category: 'WORK', startTime: '09:00', endTime: '18:00', endsNextDay: false, restMinutes: 60, color: '#1677ff', sortOrder: 1 },
    { code: 'B', name: '出差', category: 'BUSINESS_TRIP', color: '#13c2c2', sortOrder: 2 },
    { code: 'S', name: '病假', category: 'SICK_LEAVE', color: '#f5222d', sortOrder: 3 },
    { code: 'V', name: '倒休', category: 'COMPENSATORY_LEAVE', color: '#52c41a', sortOrder: 4 },
    { code: 'Q', name: '事假/其他', category: 'OTHER', color: '#8c8c8c', sortOrder: 5 },
    { code: 'A', name: '年假', category: 'ANNUAL_LEAVE', color: '#eb2f96', sortOrder: 6 },
  ],
};

const cnToday = () => new Date(Date.now() + CN_OFFSET_MS).toISOString().slice(0, 10);
const two = (n: number) => String(n).padStart(2, '0');

/// 查询参数里的部门: 不传默认维护; 传了必须合法
export function parseDepartment(value: string | undefined | null): StaffDepartment {
  if (value === undefined || value === null || value === '') return 'MAINTENANCE';
  if (value === 'MAINTENANCE' || value === 'ADMIN') return value;
  throw new BadRequestException('department 只能是 MAINTENANCE 或 ADMIN');
}

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

const DEPARTMENT_TEXT: Record<StaffDepartment, string> = { MAINTENANCE: '维护', ADMIN: '行政综合' };

/// 人员班表 (R2 + 行政综合): 班次、班组、人员、班表、工时统计。维护和行政综合两个部门各有自己的人员/班组/班次/班表。
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

  async listShiftTypes(organizationId: string | undefined, department: StaffDepartment = 'MAINTENANCE') {
    const orgId = this.requireOrganizationId(organizationId);
    const count = await this.prisma.shiftType.count({ where: { organizationId: orgId, department } });
    if (count === 0) {
      await this.prisma.shiftType.createMany({ data: DEFAULT_SHIFTS[department].map((s) => ({ ...s, organizationId: orgId, department })), skipDuplicates: true });
    }
    return this.prisma.shiftType.findMany({ where: { organizationId: orgId, department }, orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] });
  }

  async createShiftType(tenantId: string, dto: CreateShiftTypeDto) {
    validateShift(dto);
    const department = dto.department ?? 'MAINTENANCE';
    const code = dto.code.toUpperCase();
    const exists = await this.prisma.shiftType.findUnique({ where: { organizationId_department_code: { organizationId: dto.organizationId, department, code } } });
    if (exists) throw new BadRequestException(`班次代码 ${code} 已存在`);
    const isWork = dto.category === 'WORK';
    const created = await this.prisma.shiftType.create({
      data: {
        organizationId: dto.organizationId,
        department,
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

  listGroups(organizationId: string | undefined, department: StaffDepartment = 'MAINTENANCE') {
    return this.prisma.rosterGroup.findMany({ where: { organizationId: this.requireOrganizationId(organizationId), department }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  async createGroup(organizationId: string, department: StaffDepartment, name: string) {
    const trimmed = name.trim();
    const exists = await this.prisma.rosterGroup.findUnique({ where: { organizationId_department_name: { organizationId, department, name: trimmed } } });
    if (exists) throw new BadRequestException(`班组 ${trimmed} 已存在`);
    const max = await this.prisma.rosterGroup.aggregate({ where: { organizationId, department }, _max: { sortOrder: true } });
    return this.prisma.rosterGroup.create({ data: { organizationId, department, name: trimmed, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
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
      const dup = await this.prisma.rosterGroup.findUnique({ where: { organizationId_department_name: { organizationId: group.organizationId, department: group.department, name } } });
      if (dup) throw new BadRequestException(`班组 ${name} 已存在`);
    }
    return this.prisma.rosterGroup.update({ where: { id }, data: { name, sortOrder: data.sortOrder } });
  }

  async deleteGroup(tenantId: string, id: string) {
    await this.findGroupOrThrow(id, tenantId);
    await this.prisma.rosterGroup.delete({ where: { id } }); // 人员的 groupId 自动置空
    return { deleted: true };
  }

  // ---- 排班人员 (维护人员 / 行政综合人员) ----

  private staffView(s: { id: string; name: string; employeeNo: string | null; position: string | null; phone: string | null; notes: string | null; groupId: string | null; userId: string | null; sortOrder: number; isActive: boolean; department: StaffDepartment; group: { name: string; sortOrder: number } | null; user: { email: string } | null }) {
    return {
      id: s.id,
      department: s.department,
      name: s.name,
      employeeNo: s.employeeNo,
      position: s.position,
      phone: s.phone,
      notes: s.notes,
      groupId: s.groupId,
      groupName: s.group?.name ?? null,
      userId: s.userId,
      userEmail: s.user?.email ?? null,
      sortOrder: s.sortOrder,
      isActive: s.isActive,
    };
  }

  /// 按 在岗优先 → 班组顺序 → 排序号 → 姓名 排列; includeInactive=false 时不含已停用的人员 (班表里只显示在岗人员)
  async listStaff(organizationId: string | undefined, department: StaffDepartment, includeInactive = false) {
    const orgId = this.requireOrganizationId(organizationId);
    const rows = await this.prisma.staffMember.findMany({
      where: { organizationId: orgId, department, ...(includeInactive ? {} : { isActive: true }) },
      include: { group: { select: { name: true, sortOrder: true } }, user: { select: { email: true } } },
    });
    return rows
      .map((r) => ({ view: this.staffView(r), groupSort: r.group?.sortOrder ?? Number.MAX_SAFE_INTEGER }))
      .sort((a, b) => Number(b.view.isActive) - Number(a.view.isActive) || a.groupSort - b.groupSort || a.view.sortOrder - b.view.sortOrder || a.view.name.localeCompare(b.view.name, 'zh'))
      .map((x) => x.view);
  }

  private async assertGroup(groupId: string | undefined | null, organizationId: string, department: StaffDepartment) {
    if (!groupId) return;
    const group = await this.prisma.rosterGroup.findFirst({ where: { id: groupId, organizationId, department } });
    if (!group) throw new BadRequestException('班组不属于该机构的这个部门');
  }

  /// 关联的登录账号必须属于本租户、启用中、且还没关联别的排班人员
  private async assertUserLinkable(tenantId: string, userId: string | undefined | null, exceptStaffId?: string) {
    if (!userId) return;
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId, isActive: true }, select: { id: true } });
    if (!user) throw new BadRequestException('登录账号不属于当前租户或已停用');
    const taken = await this.prisma.staffMember.findUnique({ where: { userId }, select: { id: true } });
    if (taken && taken.id !== exceptStaffId) throw new BadRequestException('该登录账号已经关联了另一位排班人员');
  }

  async createStaff(tenantId: string, email: string, dto: CreateStaffDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('姓名不能为空');
    await this.assertGroup(dto.groupId, dto.organizationId, dto.department);
    await this.assertUserLinkable(tenantId, dto.userId);
    const max = await this.prisma.staffMember.aggregate({ where: { organizationId: dto.organizationId, department: dto.department }, _max: { sortOrder: true } });
    const created = await this.prisma.staffMember.create({
      data: {
        organizationId: dto.organizationId,
        department: dto.department,
        name,
        employeeNo: dto.employeeNo?.trim() || null,
        position: dto.position?.trim() || null,
        phone: dto.phone?.trim() || null,
        notes: dto.notes?.trim() || null,
        groupId: dto.groupId ?? null,
        userId: dto.userId ?? null,
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
    });
    await this.auditLog.write(tenantId, 'StaffMember', created.id, 'create', null, { ...created, by: email });
    return created;
  }

  private async findStaffOrThrow(id: string, tenantId: string) {
    const staff = await this.prisma.staffMember.findFirst({ where: { id, organization: { tenantId } } });
    if (!staff) throw new NotFoundException('人员不存在');
    return staff;
  }

  async updateStaff(tenantId: string, email: string, id: string, dto: UpdateStaffDto) {
    const before = await this.findStaffOrThrow(id, tenantId);
    if (dto.name !== undefined && !dto.name.trim()) throw new BadRequestException('姓名不能为空');
    await this.assertGroup(dto.groupId, before.organizationId, before.department);
    await this.assertUserLinkable(tenantId, dto.userId, id);
    const clean = (v: string | undefined) => (v === undefined ? undefined : v.trim() || null);
    const updated = await this.prisma.staffMember.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        employeeNo: clean(dto.employeeNo),
        position: clean(dto.position),
        phone: clean(dto.phone),
        notes: clean(dto.notes),
        groupId: dto.groupId,
        userId: dto.userId,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });
    await this.auditLog.write(tenantId, 'StaffMember', id, 'update', before, { ...updated, by: email });
    return updated;
  }

  /// 没有任何历史班次时才能删除; 否则请停用 (停用后不再出现在班表里, 历史班次、工时统计和修改历史都保留)
  async deleteStaff(tenantId: string, email: string, id: string) {
    const staff = await this.findStaffOrThrow(id, tenantId);
    const entries = await this.prisma.rosterEntry.count({ where: { staffId: id } });
    if (entries > 0) throw new BadRequestException('该人员已有历史班次, 不能删除, 请改为停用');
    await this.prisma.staffMember.delete({ where: { id } });
    await this.auditLog.write(tenantId, 'StaffMember', id, 'delete', staff, { by: email });
    return { deleted: true };
  }

  /// 可关联到排班人员的登录账号: 本租户启用中、还没关联排班人员的账号
  userOptions(tenantId: string) {
    return this.prisma.user.findMany({ where: { tenantId, isActive: true, staffMember: null }, select: { id: true, email: true }, orderBy: { email: 'asc' } });
  }

  // ---- 班表 ----

  async listEntries(organizationId: string | undefined, department: StaffDepartment, month: string | undefined) {
    const orgId = this.requireOrganizationId(organizationId);
    const { first, last } = monthBounds(month);
    const entries = await this.prisma.rosterEntry.findMany({
      where: { organizationId: orgId, staff: { department }, date: { gte: first, lte: last } },
      select: { staffId: true, date: true, shiftTypeId: true },
    });
    return entries.map((e) => ({ staffId: e.staffId, date: e.date.toISOString().slice(0, 10), shiftTypeId: e.shiftTypeId }));
  }

  /// 批量设置/清除班次; 过去的日期也可修改 (补录/更正), 每个变化的格子都写入修改历史。
  /// 人员必须是该机构在岗的排班人员, 班次必须和这些人员属于同一个部门。
  async setEntries(tenantId: string, actorEmail: string, organizationId: string, cells: { staffId: string; date: string }[], shiftTypeId: string | null | undefined) {
    const shift = shiftTypeId ? await this.prisma.shiftType.findFirst({ where: { id: shiftTypeId, organizationId } }) : null;
    if (shiftTypeId && !shift) throw new BadRequestException('班次不属于该机构');
    if (shift && !shift.isActive) throw new BadRequestException(`班次 ${shift.code} 已停用`);

    const unique = new Map<string, { staffId: string; date: string; dateObj: Date }>();
    for (const c of cells) unique.set(`${c.staffId}|${c.date}`, { ...c, dateObj: parseDay(c.date, 'date') });
    const list = [...unique.values()];

    const staffIds = [...new Set(list.map((c) => c.staffId))];
    const staff = await this.prisma.staffMember.findMany({ where: { organizationId, id: { in: staffIds } }, select: { id: true, department: true, isActive: true, name: true } });
    if (staff.length !== staffIds.length) throw new BadRequestException('包含不属于该机构的人员');
    const inactive = staff.find((s) => !s.isActive);
    if (inactive && shift) throw new BadRequestException(`${inactive.name} 已停用, 不能排班`);
    if (shift) {
      const wrong = staff.find((s) => s.department !== shift.department);
      if (wrong) throw new BadRequestException(`班次 ${shift.code} 属于${DEPARTMENT_TEXT[shift.department]}部门, 不能给${DEPARTMENT_TEXT[wrong.department]}部门的 ${wrong.name} 排`);
    }

    const existing = await this.prisma.rosterEntry.findMany({
      where: { organizationId, OR: list.map((c) => ({ staffId: c.staffId, date: c.dateObj })) },
      include: { shiftType: { select: { code: true } } },
    });
    const existingByKey = new Map(existing.map((e) => [`${e.staffId}|${e.date.toISOString().slice(0, 10)}`, e]));

    let changed = 0;
    for (const c of list) {
      const before = existingByKey.get(`${c.staffId}|${c.date}`);
      const beforeCode = before?.shiftType.code ?? null;
      const afterCode = shift?.code ?? null;
      if (beforeCode === afterCode) continue;
      if (shift) {
        await this.prisma.rosterEntry.upsert({
          where: { organizationId_staffId_date: { organizationId, staffId: c.staffId, date: c.dateObj } },
          create: { organizationId, staffId: c.staffId, date: c.dateObj, shiftTypeId: shift.id },
          update: { shiftTypeId: shift.id },
        });
      } else if (before) {
        await this.prisma.rosterEntry.delete({ where: { id: before.id } });
      }
      changed += 1;
      await this.auditLog.write(tenantId, 'RosterEntry', `${organizationId}:${c.staffId}:${c.date}`, beforeCode ? (afterCode ? 'update' : 'delete') : 'create', { shift: beforeCode }, { shift: afterCode, by: actorEmail });
    }
    return { requested: list.length, changed, unchanged: list.length - changed };
  }

  /// 修改历史: 谁在何时把哪个人哪一天的班次从什么改成什么 (来自审计轨迹); 按部门过滤
  async history(tenantId: string, organizationId: string | undefined, department: StaffDepartment, staffId?: string, from?: string, to?: string) {
    const orgId = this.requireOrganizationId(organizationId);
    const logs = await this.prisma.auditLog.findMany({
      where: { tenantId, entityType: 'RosterEntry', entityId: { startsWith: staffId ? `${orgId}:${staffId}:` : `${orgId}:` } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const rows = logs
      .map((l) => {
        const [, sid, date] = l.entityId.split(':');
        const before = l.beforeJson as { shift?: string | null } | null;
        const after = l.afterJson as { shift?: string | null; by?: string } | null;
        return { at: l.createdAt, staffId: sid, date, before: before?.shift ?? null, after: after?.shift ?? null, by: after?.by ?? null };
      })
      .filter((r) => (!from || r.date >= from) && (!to || r.date <= to));
    const people = await this.prisma.staffMember.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.staffId))] }, organizationId: orgId }, select: { id: true, name: true, department: true } });
    const byId = new Map(people.map((p) => [p.id, p]));
    return rows.filter((r) => byId.get(r.staffId)?.department === department).map((r) => ({ ...r, name: byId.get(r.staffId)?.name ?? r.staffId }));
  }

  /// 我的排班: 当前登录账号关联的排班人员, 未来 days 天(含今天)的班次
  async myRoster(tenantId: string, userId: string, days: number) {
    const count = Math.min(Math.max(Math.trunc(days) || 15, 1), 62);
    const staff = await this.prisma.staffMember.findFirst({ where: { userId, isActive: true, organization: { tenantId } } });
    if (!staff) return { linked: false, days: [] };
    const start = parseDay(cnToday(), 'today');
    const end = new Date(start.getTime() + (count - 1) * DAY_MS);
    const entries = await this.prisma.rosterEntry.findMany({
      where: { staffId: staff.id, date: { gte: start, lte: end } },
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
  async hours(organizationId: string | undefined, department: StaffDepartment, from: string | undefined, to: string | undefined, groupId?: string) {
    const orgId = this.requireOrganizationId(organizationId);
    const fromDay = parseDay(from, 'from');
    const toDay = parseDay(to, 'to');
    if (fromDay > toDay) throw new BadRequestException('from 不能晚于 to');
    if ((toDay.getTime() - fromDay.getTime()) / DAY_MS + 1 > MAX_STAT_DAYS) throw new BadRequestException(`统计范围不能超过${MAX_STAT_DAYS}天`);
    const periodStart = fromDay.getTime() - CN_OFFSET_MS;
    const periodEnd = toDay.getTime() + DAY_MS - CN_OFFSET_MS;

    const shifts = await this.listShiftTypes(orgId, department);
    // 含已停用的人员: 他们在周期内的历史班次也要计入
    const staff = await this.listStaff(orgId, department, true);
    const entries = await this.prisma.rosterEntry.findMany({
      // 前一天开始的跨日班次会落进周期内, 多取一天
      where: { organizationId: orgId, staff: { department }, date: { gte: new Date(fromDay.getTime() - DAY_MS), lte: toDay } },
      include: { shiftType: true },
    });

    const byPerson = new Map<string, typeof entries>();
    for (const e of entries) byPerson.set(e.staffId, [...(byPerson.get(e.staffId) ?? []), e]);

    const rows = staff
      .filter((r) => (!groupId || r.groupId === groupId) && (r.isActive || (byPerson.get(r.id) ?? []).length > 0))
      .map((r) => {
        const mine = byPerson.get(r.id) ?? [];
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
        return { staffId: r.id, name: r.name, position: r.position, groupId: r.groupId, groupName: r.groupName, isActive: r.isActive, workDays, totalHours: Math.round(totalHours * 100) / 100, byShift };
      });
    return { from: from as string, to: to as string, shiftTypes: shifts.map((s) => ({ id: s.id, code: s.code, name: s.name, category: s.category })), rows };
  }

  // ---- 导出 ----

  async exportMonth(organizationId: string | undefined, department: StaffDepartment, month: string | undefined): Promise<Buffer> {
    const orgId = this.requireOrganizationId(organizationId);
    const { days } = monthBounds(month);
    const [staff, entries, shifts] = await Promise.all([this.listStaff(orgId, department), this.listEntries(orgId, department, month), this.listShiftTypes(orgId, department)]);
    const codeById = new Map(shifts.map((s) => [s.id, s.code]));
    const cell = new Map(entries.map((e) => [`${e.staffId}|${e.date}`, codeById.get(e.shiftTypeId) ?? '']));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('班表');
    sheet.addRow([`${DEPARTMENT_TEXT[department]}人员班表 ${month}`]);
    sheet.addRow(['班组', '姓名', '岗位', ...days.map((d) => d.slice(8))]).font = { bold: true };
    for (const m of staff) sheet.addRow([m.groupName ?? '', m.name, m.position ?? '', ...days.map((d) => cell.get(`${m.id}|${d}`) ?? '')]);
    sheet.getColumn(1).width = 14;
    sheet.getColumn(2).width = 14;
    sheet.getColumn(3).width = 14;
    days.forEach((_, i) => {
      sheet.getColumn(i + 4).width = 4;
    });

    const legend = workbook.addWorksheet('班次说明');
    legend.addRow(['代码', '名称', '类型', '开始', '结束', '次日结束', '休息(分钟)']).font = { bold: true };
    for (const s of shifts) legend.addRow([s.code, s.name, s.category, s.startTime ?? '', s.endTime ?? '', s.endsNextDay ? '是' : '', s.restMinutes]);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async exportHours(organizationId: string | undefined, department: StaffDepartment, from: string | undefined, to: string | undefined, groupId?: string): Promise<Buffer> {
    const r = await this.hours(organizationId, department, from, to, groupId);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('工时统计');
    sheet.addRow([`${DEPARTMENT_TEXT[department]}工时统计 ${r.from} ~ ${r.to}`]);
    sheet.addRow(['班组', '姓名', '岗位', '出勤天数', '总工时(h)', ...r.shiftTypes.flatMap((s) => (s.category === 'WORK' ? [`${s.code} 天数`, `${s.code} 工时(h)`] : [`${s.code} 天数`]))]).font = { bold: true };
    for (const row of r.rows) {
      sheet.addRow([
        row.groupName ?? '',
        row.name,
        row.position ?? '',
        row.workDays,
        row.totalHours,
        ...r.shiftTypes.flatMap((s) => (s.category === 'WORK' ? [row.byShift[s.code]?.days ?? 0, row.byShift[s.code]?.hours ?? 0] : [row.byShift[s.code]?.days ?? 0])),
      ]);
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /// 供其他模块(值班日志、检查单)按 ID 取姓名
  names(tenantId: string, ids: string[]) {
    return resolveStaffNames(this.prisma, tenantId, ids);
  }
}
