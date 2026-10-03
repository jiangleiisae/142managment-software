import { randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PublicShare, ShareType } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CN_OFFSET_MS, DAY_MS } from '../roster/shift-time.js';

const MAX_ITEMS = 1000;
const MAX_DAYS = 14;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/; // 32 字节 base64url

const cnToday = () => new Date(Date.now() + CN_OFFSET_MS).toISOString().slice(0, 10);
const newToken = () => randomBytes(32).toString('base64url');

function parseDay(value: string, label: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${label} 无效`);
  }
  return parsed;
}

/// 训练计划 / 人员班表的公开只读分享 (二维码)。
/// 管理接口(需登录): 查看/启用/重新生成/停用; 公开接口(无需登录): 凭 token 读取最新计划。
@Injectable()
export class ShareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // ---- 管理 ----

  async list(organizationId: string | undefined) {
    if (!organizationId) throw new BadRequestException('缺少 organizationId');
    const rows = await this.prisma.publicShare.findMany({ where: { organizationId } });
    const types: ShareType[] = ['TRAINING_PLAN', 'ROSTER'];
    return types.map((type) => {
      const r = rows.find((x) => x.type === type);
      return { type, enabled: !!r?.enabled, token: r?.enabled ? r.token : null, createdAt: r?.createdAt ?? null, rotatedAt: r?.rotatedAt ?? null };
    });
  }

  private view(r: PublicShare) {
    return { type: r.type, enabled: r.enabled, token: r.enabled ? r.token : null, createdAt: r.createdAt, rotatedAt: r.rotatedAt };
  }

  /// 启用: 已有则保持原来的 token(二维码不变), 没有才新建
  async enable(tenantId: string, email: string, organizationId: string, type: ShareType) {
    const existing = await this.prisma.publicShare.findUnique({ where: { organizationId_type: { organizationId, type } } });
    if (existing?.enabled) return this.view(existing);
    const saved = existing
      ? await this.prisma.publicShare.update({ where: { id: existing.id }, data: { enabled: true } })
      : await this.prisma.publicShare.create({ data: { organizationId, type, token: newToken(), createdByEmail: email } });
    await this.auditLog.write(tenantId, 'PublicShare', saved.id, existing ? 'update' : 'create', { enabled: existing?.enabled ?? false }, { enabled: true, type, by: email });
    return this.view(saved);
  }

  /// 重新生成: 换新 token, 旧二维码立即失效
  async rotate(tenantId: string, email: string, organizationId: string, type: ShareType) {
    const existing = await this.prisma.publicShare.findUnique({ where: { organizationId_type: { organizationId, type } } });
    const saved = existing
      ? await this.prisma.publicShare.update({ where: { id: existing.id }, data: { token: newToken(), enabled: true, rotatedAt: new Date() } })
      : await this.prisma.publicShare.create({ data: { organizationId, type, token: newToken(), createdByEmail: email } });
    await this.auditLog.write(tenantId, 'PublicShare', saved.id, 'update', { enabled: existing?.enabled ?? false }, { enabled: true, type, rotated: true, by: email });
    return this.view(saved);
  }

  async disable(tenantId: string, email: string, organizationId: string, type: ShareType) {
    const existing = await this.prisma.publicShare.findUnique({ where: { organizationId_type: { organizationId, type } } });
    if (!existing || !existing.enabled) return { type, enabled: false, token: null, createdAt: existing?.createdAt ?? null, rotatedAt: existing?.rotatedAt ?? null };
    const saved = await this.prisma.publicShare.update({ where: { id: existing.id }, data: { enabled: false } });
    await this.auditLog.write(tenantId, 'PublicShare', saved.id, 'update', { enabled: true }, { enabled: false, type, by: email });
    return this.view(saved);
  }

  // ---- 公开读取 (无需登录) ----

  /// 找不到/已停用/格式不对一律 404 同一个提示, 不泄露 token 是否存在过
  private async resolve(token: string) {
    if (!TOKEN_PATTERN.test(token)) throw new NotFoundException('链接无效或已失效');
    const share = await this.prisma.publicShare.findUnique({ where: { token }, include: { organization: { select: { name: true } } } });
    if (!share || !share.enabled) throw new NotFoundException('链接无效或已失效');
    return share;
  }

  async publicView(token: string, q: { date?: string; days?: string; month?: string }) {
    const share = await this.resolve(token);
    const base = { type: share.type, organizationName: share.organization.name, generatedAt: new Date().toISOString(), today: cnToday() };
    if (share.type === 'TRAINING_PLAN') return { ...base, ...(await this.trainingPlan(share.organizationId, q.date, q.days)) };
    return { ...base, ...(await this.roster(share.organizationId, q.month)) };
  }

  /// 训练计划: 从 date(默认今天, 北京时间)起 days 天(默认7, 最多14)内有重叠的模拟机预订; 只返回计划本身的字段
  private async trainingPlan(organizationId: string, date?: string, daysText?: string) {
    const from = date ? date : cnToday();
    const fromDay = parseDay(from, 'date');
    const days = daysText ? Number(daysText) : 7;
    if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) throw new BadRequestException(`days 必须是 1-${MAX_DAYS}`);
    const start = new Date(fromDay.getTime() - CN_OFFSET_MS);
    const end = new Date(start.getTime() + days * DAY_MS);
    const fstds = await this.prisma.fstd.findMany({ where: { organizationId }, select: { id: true, deviceCode: true, representedAircraft: true }, orderBy: { deviceCode: 'asc' } });
    const byId = new Map(fstds.map((f) => [f.id, f]));
    const bookings = await this.prisma.booking.findMany({
      where: { organizationId, resourceType: 'FSTD', status: 'confirmed', startAt: { lt: end }, endAt: { gt: start } },
      select: { resourceId: true, startAt: true, endAt: true, trainingType: true, customerName: true, pilotName: true, instructorName: true, examinerName: true },
      orderBy: { startAt: 'asc' },
      take: MAX_ITEMS,
    });
    return {
      from,
      days,
      devices: fstds.map((f) => ({ code: f.deviceCode, aircraft: f.representedAircraft })),
      items: bookings.map((b) => ({
        deviceCode: byId.get(b.resourceId)?.deviceCode ?? '-',
        aircraft: byId.get(b.resourceId)?.representedAircraft ?? '',
        startAt: b.startAt.toISOString(),
        endAt: b.endAt.toISOString(),
        trainingType: b.trainingType,
        customerName: b.customerName,
        pilotName: b.pilotName,
        instructorName: b.instructorName,
        examinerName: b.examinerName,
      })),
    };
  }

  /// 人员班表: 某个月(默认本月)的 人员 × 日期 班次代码; 只返回姓名、班组、班次代码和班次说明
  private async roster(organizationId: string, monthText?: string) {
    const month = monthText ?? cnToday().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestException('month 必须是 YYYY-MM');
    const first = new Date(`${month}-01T00:00:00.000Z`);
    const next = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1));
    const dayCount = Math.round((next.getTime() - first.getTime()) / DAY_MS);
    const days = Array.from({ length: dayCount }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);

    const [members, shifts, entries] = await Promise.all([
      this.prisma.rosterMember.findMany({ where: { organizationId }, include: { personnel: { select: { firstName: true, lastName: true } }, group: { select: { name: true, sortOrder: true } } } }),
      this.prisma.shiftType.findMany({ where: { organizationId }, orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] }),
      this.prisma.rosterEntry.findMany({ where: { organizationId, date: { gte: first, lt: next } }, select: { personnelId: true, date: true, shiftTypeId: true } }),
    ]);
    const codeById = new Map(shifts.map((s) => [s.id, s.code]));
    const cellsByPerson = new Map<string, Record<string, string>>();
    for (const e of entries) {
      const cells = cellsByPerson.get(e.personnelId) ?? {};
      cells[e.date.toISOString().slice(0, 10)] = codeById.get(e.shiftTypeId) ?? '';
      cellsByPerson.set(e.personnelId, cells);
    }
    const rows = members
      .map((m) => ({
        name: `${m.personnel.lastName}${m.personnel.firstName}`.trim(),
        groupName: m.group?.name ?? null,
        groupSort: m.group?.sortOrder ?? Number.MAX_SAFE_INTEGER,
        sortOrder: m.sortOrder,
        cells: cellsByPerson.get(m.personnelId) ?? {},
      }))
      .sort((a, b) => a.groupSort - b.groupSort || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh'))
      .map(({ name, groupName, cells }) => ({ name, groupName, cells }));
    return {
      month,
      days,
      shifts: shifts.filter((s) => s.isActive).map((s) => ({ code: s.code, name: s.name, category: s.category, color: s.color, startTime: s.startTime, endTime: s.endTime, endsNextDay: s.endsNextDay })),
      rows,
    };
  }
}
