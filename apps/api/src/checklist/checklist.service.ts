import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ChecklistType, Prisma } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CN_OFFSET_MS, DAY_MS, shiftWindow } from '../roster/shift-time.js';
import { resolveStaffNames } from '../roster/staff-names.js';
import type { ChecklistItemDto, CreateChecklistRecordDto } from './dto/checklist.dto.js';

const MAX_LIST = 500;
const MAX_BACKFILL_DAYS = 31;
const TYPES: ChecklistType[] = ['PRE_FLIGHT', 'POST_FLIGHT'];

export interface TemplateItem {
  no: string;
  text: string;
  sopUrl?: string;
}

function parseDay(value: string | undefined, label: string): Date {
  if (!value) throw new BadRequestException(`缺少 ${label}`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${label} "${value}" 不是有效的日历日 (YYYY-MM-DD)`);
  }
  return parsed;
}

const cnToday = () => new Date(Date.now() + CN_OFFSET_MS).toISOString().slice(0, 10);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

function validateItems(items: ChecklistItemDto[]): TemplateItem[] {
  const seen = new Set<string>();
  return items.map((i) => {
    const no = i.no.trim();
    const text = i.text.trim();
    if (!no || !text) throw new BadRequestException('检查项的编号和内容不能为空');
    if (seen.has(no)) throw new BadRequestException(`检查项编号 ${no} 重复`);
    seen.add(no);
    return i.sopUrl ? { no, text, sopUrl: i.sopUrl } : { no, text };
  });
}

/// 设备级检查单 (R4b): 航前/航后模板配置 + "今天应做清单" + 执行记录。
/// 应做清单不落库: 由班表(当班有人) + 班次"是否生成维护任务" + 停飞日历 + 模板实时推算, 做完才产生记录。
@Injectable()
export class ChecklistService {
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

  /// 当班人员/执行人现在是排班人员(维护部门); 老数据里存的是人员档案ID, 按人员档案兜底
  private personnelNames(tenantId: string, ids: string[]) {
    return resolveStaffNames(this.prisma, tenantId, ids);
  }

  // ---- 模板 ----

  async listTemplates(organizationId: string | undefined, fstdId?: string) {
    const orgId = this.requireOrganizationId(organizationId);
    const rows = await this.prisma.checklistTemplate.findMany({
      where: { organizationId: orgId, ...(fstdId ? { fstdId } : {}) },
      orderBy: [{ fstdId: 'asc' }, { type: 'asc' }],
    });
    return rows.map((r) => ({ id: r.id, fstdId: r.fstdId, type: r.type, items: r.itemsJson as unknown as TemplateItem[], updatedAt: r.updatedAt }));
  }

  async setTemplate(tenantId: string, dto: { organizationId: string; fstdId: string; type: ChecklistType; items: ChecklistItemDto[] }) {
    await this.findFstdInOrg(dto.fstdId, dto.organizationId);
    const items = validateItems(dto.items);
    const before = await this.prisma.checklistTemplate.findUnique({ where: { fstdId_type: { fstdId: dto.fstdId, type: dto.type } } });
    const saved = await this.prisma.checklistTemplate.upsert({
      where: { fstdId_type: { fstdId: dto.fstdId, type: dto.type } },
      create: { organizationId: dto.organizationId, fstdId: dto.fstdId, type: dto.type, itemsJson: items as unknown as Prisma.InputJsonValue },
      update: { itemsJson: items as unknown as Prisma.InputJsonValue },
    });
    await this.auditLog.write(tenantId, 'ChecklistTemplate', saved.id, before ? 'update' : 'create', before?.itemsJson ?? null, saved.itemsJson);
    return { id: saved.id, fstdId: saved.fstdId, type: saved.type, items };
  }

  /// 把一台设备的模板克隆到其他设备; 目标设备已有同类型模板时默认跳过, overwrite=true 才覆盖
  async cloneTemplates(tenantId: string, dto: { organizationId: string; fromFstdId: string; toFstdIds: string[]; types?: ChecklistType[]; overwrite?: boolean }) {
    await this.findFstdInOrg(dto.fromFstdId, dto.organizationId);
    const targets = [...new Set(dto.toFstdIds)].filter((id) => id !== dto.fromFstdId);
    if (targets.length === 0) throw new BadRequestException('没有可克隆的目标设备');
    const found = await this.prisma.fstd.count({ where: { id: { in: targets }, organizationId: dto.organizationId } });
    if (found !== targets.length) throw new BadRequestException('包含不属于该机构的设备');
    const types = dto.types?.length ? dto.types : TYPES;
    const sources = await this.prisma.checklistTemplate.findMany({ where: { fstdId: dto.fromFstdId, type: { in: types } } });
    if (sources.length === 0) throw new BadRequestException('源设备没有可克隆的模板');

    let created = 0;
    let overwritten = 0;
    let skipped = 0;
    for (const target of targets) {
      for (const src of sources) {
        const existing = await this.prisma.checklistTemplate.findUnique({ where: { fstdId_type: { fstdId: target, type: src.type } } });
        if (existing && !dto.overwrite) {
          skipped += 1;
          continue;
        }
        const saved = await this.prisma.checklistTemplate.upsert({
          where: { fstdId_type: { fstdId: target, type: src.type } },
          create: { organizationId: dto.organizationId, fstdId: target, type: src.type, itemsJson: src.itemsJson as Prisma.InputJsonValue },
          update: { itemsJson: src.itemsJson as Prisma.InputJsonValue },
        });
        await this.auditLog.write(tenantId, 'ChecklistTemplate', saved.id, existing ? 'update' : 'create', existing?.itemsJson ?? null, saved.itemsJson);
        if (existing) overwritten += 1;
        else created += 1;
      }
    }
    return { created, overwritten, skipped };
  }

  // ---- 今天应做清单 ----

  async expected(tenantId: string, organizationId: string | undefined, date: string | undefined, type?: ChecklistType) {
    const orgId = this.requireOrganizationId(organizationId);
    const day = parseDay(date, 'date');
    if (type && !TYPES.includes(type)) throw new BadRequestException('type 只能是 PRE_FLIGHT 或 POST_FLIGHT');
    const types = type ? [type] : TYPES;

    const flaggedShifts = await this.prisma.shiftType.findMany({
      where: { organizationId: orgId, department: 'MAINTENANCE', isActive: true, category: 'WORK', generatesMaintenanceTasks: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
    const entries = flaggedShifts.length
      ? await this.prisma.rosterEntry.findMany({ where: { organizationId: orgId, date: day, shiftTypeId: { in: flaggedShifts.map((s) => s.id) } }, select: { staffId: true, shiftTypeId: true } })
      : [];
    const names = await this.personnelNames(tenantId, entries.map((e) => e.staffId));

    const fstds = await this.prisma.fstd.findMany({ where: { organizationId: orgId, status: 'active' }, orderBy: { deviceCode: 'asc' } });
    const groundings = await this.prisma.fstdGrounding.findMany({ where: { fstdId: { in: fstds.map((f) => f.id) }, date: day }, select: { fstdId: true } });
    const groundedIds = new Set(groundings.map((g) => g.fstdId));
    const templates = await this.prisma.checklistTemplate.findMany({ where: { fstdId: { in: fstds.map((f) => f.id) }, type: { in: types } }, select: { fstdId: true, type: true } });
    const hasTemplate = new Set(templates.map((t) => `${t.fstdId}|${t.type}`));
    const records = await this.prisma.checklistRecord.findMany({ where: { organizationId: orgId, date: day, type: { in: types } } });
    const recordByKey = new Map(records.map((r) => [`${r.fstdId}|${r.type}|${r.shiftTypeId}`, r]));
    const recordNames = await this.personnelNames(tenantId, records.map((r) => r.performedByPersonnelId).filter((x): x is string => !!x));

    const now = Date.now();
    const staffed = flaggedShifts.filter((s) => entries.some((e) => e.shiftTypeId === s.id));
    const items: {
      fstdId: string;
      deviceCode: string;
      representedAircraft: string;
      type: ChecklistType;
      shiftTypeId: string;
      shiftCode: string;
      shiftName: string;
      rostered: string[];
      status: 'DONE' | 'PENDING' | 'UPCOMING' | 'MISSED';
      recordId: string | null;
      performedBy: string | null;
      overallResult: string | null;
    }[] = [];
    const missingTemplates: { fstdId: string; deviceCode: string; type: ChecklistType }[] = [];

    for (const f of fstds) {
      if (groundedIds.has(f.id)) continue;
      for (const tp of types) {
        if (!hasTemplate.has(`${f.id}|${tp}`)) {
          if (staffed.length > 0) missingTemplates.push({ fstdId: f.id, deviceCode: f.deviceCode, type: tp });
          continue;
        }
        for (const s of staffed) {
          const record = recordByKey.get(`${f.id}|${tp}|${s.id}`);
          const w = shiftWindow(day, s);
          let status: 'DONE' | 'PENDING' | 'UPCOMING' | 'MISSED' = 'PENDING';
          if (record) status = 'DONE';
          else if (w && w.end.getTime() <= now) status = 'MISSED';
          else if (w && w.start.getTime() > now) status = 'UPCOMING';
          items.push({
            fstdId: f.id,
            deviceCode: f.deviceCode,
            representedAircraft: f.representedAircraft,
            type: tp,
            shiftTypeId: s.id,
            shiftCode: s.code,
            shiftName: s.name,
            rostered: entries.filter((e) => e.shiftTypeId === s.id).map((e) => names.get(e.staffId) ?? e.staffId),
            status,
            recordId: record?.id ?? null,
            performedBy: record?.performedByPersonnelId ? (recordNames.get(record.performedByPersonnelId) ?? null) : (record?.performedByEmail ?? null),
            overallResult: record?.overallResult ?? null,
          });
        }
      }
    }

    return {
      date: ymd(day),
      items,
      grounded: fstds.filter((f) => groundedIds.has(f.id)).map((f) => ({ fstdId: f.id, deviceCode: f.deviceCode })),
      missingTemplates,
      noFlaggedShift: flaggedShifts.length === 0,
      shiftsWithoutRoster: flaggedShifts.filter((s) => !staffed.includes(s)).map((s) => s.code),
    };
  }

  // ---- 执行记录 ----

  async createRecord(tenantId: string, email: string, dto: CreateChecklistRecordDto) {
    const fstd = await this.findFstdInOrg(dto.fstdId, dto.organizationId);
    const day = parseDay(dto.date, 'date');
    const today = parseDay(cnToday(), 'today');
    if (day > today) throw new BadRequestException('不能登记未来日期的检查单');
    if ((today.getTime() - day.getTime()) / DAY_MS > MAX_BACKFILL_DAYS) throw new BadRequestException(`只能补登最近${MAX_BACKFILL_DAYS}天内的检查单`);

    const shift = await this.prisma.shiftType.findFirst({ where: { id: dto.shiftTypeId, organizationId: dto.organizationId } });
    if (!shift || shift.category !== 'WORK') throw new BadRequestException('班次必须是本机构的工作班次');

    const grounded = await this.prisma.fstdGrounding.findUnique({ where: { fstdId_date: { fstdId: fstd.id, date: day } } });
    if (grounded) throw new BadRequestException(`设备 ${fstd.deviceCode} 在 ${dto.date} 已标记停飞, 不需要登记检查单`);

    const template = await this.prisma.checklistTemplate.findUnique({ where: { fstdId_type: { fstdId: fstd.id, type: dto.type } } });
    if (!template) throw new BadRequestException(`设备 ${fstd.deviceCode} 还没有配置该类型的检查单`);
    const items = template.itemsJson as unknown as TemplateItem[];
    const byNo = new Map(dto.results.map((r) => [r.no, r]));
    if (byNo.size !== dto.results.length) throw new BadRequestException('检查结果里有重复的检查项编号');
    const unknown = dto.results.filter((r) => !items.some((i) => i.no === r.no));
    if (unknown.length) throw new BadRequestException(`模板中没有检查项 ${unknown.map((u) => u.no).join(', ')}`);
    const missing = items.filter((i) => !byNo.has(i.no));
    if (missing.length) throw new BadRequestException(`还有检查项未填写: ${missing.map((m) => m.no).join(', ')}`);

    if (dto.performedByPersonnelId) {
      // 执行人: 该机构的排班人员, 或(老数据/兼容)本租户的人员档案
      const p = (await this.prisma.staffMember.findFirst({ where: { id: dto.performedByPersonnelId, organizationId: dto.organizationId }, select: { id: true } })) ?? (await this.prisma.personnel.findFirst({ where: { id: dto.performedByPersonnelId, tenantId }, select: { id: true } }));
      if (!p) throw new BadRequestException('执行人不属于当前租户');
    }
    const duplicate = await this.prisma.checklistRecord.findUnique({ where: { fstdId_type_date_shiftTypeId: { fstdId: fstd.id, type: dto.type, date: day, shiftTypeId: shift.id } } });
    if (duplicate) throw new BadRequestException(`${dto.date} ${shift.code} 班已登记过该设备的${dto.type === 'PRE_FLIGHT' ? '航前' : '航后'}检查单`);

    const snapshot = items.map((i) => ({ no: i.no, text: i.text, passed: byNo.get(i.no)?.passed === true, notes: byNo.get(i.no)?.notes ?? null }));
    const record = await this.prisma.checklistRecord.create({
      data: {
        organizationId: dto.organizationId,
        fstdId: fstd.id,
        type: dto.type,
        date: day,
        shiftTypeId: shift.id,
        performedByPersonnelId: dto.performedByPersonnelId ?? null,
        performedByEmail: email,
        itemsJson: snapshot as unknown as Prisma.InputJsonValue,
        overallResult: snapshot.every((s) => s.passed) ? 'pass' : 'issues_found',
        note: dto.note,
      },
    });
    return { id: record.id, overallResult: record.overallResult };
  }

  async listRecords(tenantId: string, organizationId: string | undefined, f: { type?: string; fstdId?: string; from?: string; to?: string }) {
    const orgId = this.requireOrganizationId(organizationId);
    if (f.type && !TYPES.includes(f.type as ChecklistType)) throw new BadRequestException('type 只能是 PRE_FLIGHT 或 POST_FLIGHT');
    const where: Prisma.ChecklistRecordWhereInput = { organizationId: orgId };
    if (f.type) where.type = f.type as ChecklistType;
    if (f.fstdId) where.fstdId = f.fstdId;
    if (f.from || f.to) where.date = { ...(f.from ? { gte: parseDay(f.from, 'from') } : {}), ...(f.to ? { lte: parseDay(f.to, 'to') } : {}) };
    const rows = await this.prisma.checklistRecord.findMany({
      where,
      include: { fstd: { select: { deviceCode: true } }, shiftType: { select: { code: true, name: true } } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: MAX_LIST,
    });
    const names = await this.personnelNames(tenantId, rows.map((r) => r.performedByPersonnelId).filter((x): x is string => !!x));
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      date: ymd(r.date),
      deviceCode: r.fstd.deviceCode,
      shiftCode: r.shiftType.code,
      performedBy: r.performedByPersonnelId ? (names.get(r.performedByPersonnelId) ?? null) : (r.performedByEmail ?? null),
      overallResult: r.overallResult,
      note: r.note,
      items: r.itemsJson as unknown as { no: string; text: string; passed: boolean; notes: string | null }[],
    }));
  }

  async getRecord(tenantId: string, id: string) {
    const r = await this.prisma.checklistRecord.findFirst({ where: { id, organization: { tenantId } } });
    if (!r) throw new NotFoundException('检查单记录不存在');
    return r;
  }
}
