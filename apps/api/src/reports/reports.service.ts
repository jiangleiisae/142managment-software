import { BadRequestException, Injectable } from '@nestjs/common';
import { PmCheckLevel, PmTaskStatus } from '@prisma/client';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service.js';

const CN_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 366;
const MAX_DETAIL_ROWS = 2000;

export interface ReportRange {
  from: string;
  to: string;
  /// [start, end) UTC 时刻, 对应北京时间 from 当日 00:00 至 to 次日 00:00
  start: Date;
  end: Date;
}

export interface ExportSheet {
  name: string;
  headers: string[];
  rows: (string | number | null)[][];
}

const round = (n: number, digits = 2) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};
const pct = (num: number, den: number) => (den > 0 ? round((num / den) * 100) : null);

function parseDay(value: string | undefined, label: string): Date {
  if (!value) throw new BadRequestException(`缺少 ${label}`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${label} "${value}" 不是有效的日历日 (YYYY-MM-DD)`);
  }
  return parsed;
}

/// 统计报表一律按北京时间日历日划分, from/to 为含首含尾的日期
export function parseReportRange(from: string | undefined, to: string | undefined): ReportRange {
  const fromDay = parseDay(from, 'from');
  const toDay = parseDay(to, 'to');
  if (fromDay > toDay) throw new BadRequestException('from 不能晚于 to');
  if ((toDay.getTime() - fromDay.getTime()) / DAY_MS + 1 > MAX_RANGE_DAYS) throw new BadRequestException(`统计范围不能超过${MAX_RANGE_DAYS}天`);
  return {
    from: from as string,
    to: to as string,
    start: new Date(fromDay.getTime() - CN_OFFSET_MS),
    end: new Date(toDay.getTime() + DAY_MS - CN_OFFSET_MS),
  };
}

const localDate = (d: Date) => new Date(d.getTime() + CN_OFFSET_MS).toISOString().slice(0, 10);

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private requireOrganizationId(organizationId: string | undefined): string {
    if (!organizationId) throw new BadRequestException('缺少 organizationId');
    return organizationId;
  }

  private async personnelNames(tenantId: string, ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const people = await this.prisma.personnel.findMany({ where: { tenantId, id: { in: unique } } });
    return new Map(people.map((p) => [p.id, `${p.lastName}${p.firstName}`.trim() || p.id]));
  }

  // ---- 运行效率统计 ----

  /// 每台设备: 检修总时长(supportHours)、中断总时长(设备故障+外部原因停机)、中断次数、
  /// 故障中断率(中断次数/故障次数)、故障按期关闭率、未关闭故障数、运行效率(可靠率)、设备可用率。
  /// 小时类数据来自按月登记的 FstdPerformanceMetric (逐月数据, 因此统计范围按自然月取整);
  /// 故障类数据来自 DiscrepancyLog (按北京时间日期精确截取)。
  async operationalEfficiency(organizationId: string | undefined, from: string | undefined, to: string | undefined) {
    const orgId = this.requireOrganizationId(organizationId);
    const range = parseReportRange(from, to);
    const fstds = await this.prisma.fstd.findMany({ where: { organizationId: orgId }, orderBy: { deviceCode: 'asc' } });
    const ids = fstds.map((f) => f.id);

    const months = monthsBetween(range.from, range.to);
    const metrics = await this.prisma.fstdPerformanceMetric.findMany({
      where: { fstdId: { in: ids }, OR: months.map((m) => ({ year: m.year, month: m.month })) },
    });
    const discrepancies = await this.prisma.discrepancyLog.findMany({
      where: { fstdId: { in: ids }, reportedAt: { gte: range.start, lt: range.end } },
    });
    const openNow = await this.prisma.discrepancyLog.groupBy({
      by: ['fstdId'],
      where: { fstdId: { in: ids }, status: 'open', reportedAt: { lt: range.end } },
      _count: { _all: true },
    });
    const openByFstd = new Map(openNow.map((o) => [o.fstdId, o._count._all]));
    const now = new Date();

    const rows = fstds.map((f) => {
      const ms = metrics.filter((m) => m.fstdId === f.id);
      const sum = (k: 'plannedAvailableHours' | 'scheduledTrainingHours' | 'supportHours' | 'fstdFailureHours' | 'externalFailureHours' | 'lostTrainingHours' | 'discrepancyCount' | 'interruptionCount') =>
        ms.reduce((acc, m) => acc + m[k], 0);
      const planned = sum('plannedAvailableHours');
      const failure = sum('fstdFailureHours');
      const external = sum('externalFailureHours');
      const downtime = failure + external;
      const discrepancyCount = sum('discrepancyCount');
      const interruptionCount = sum('interruptionCount');

      const mine = discrepancies.filter((d) => d.fstdId === f.id);
      // 应关闭 = 已关闭 + 已过截止期仍未关闭; 其中按期关闭 = 关闭时间不晚于截止日(无截止日视为按期)
      const closed = mine.filter((d) => d.status === 'corrected');
      const overdueOpen = mine.filter((d) => d.status === 'open' && d.dueDate != null && d.dueDate < now);
      const onTime = closed.filter((d) => d.dueDate == null || (d.correctedAt != null && d.correctedAt <= d.dueDate));

      return {
        fstdId: f.id,
        deviceCode: f.deviceCode,
        representedAircraft: f.representedAircraft,
        monthsWithData: ms.length,
        monthsExpected: months.length,
        plannedAvailableHours: round(planned),
        scheduledTrainingHours: round(sum('scheduledTrainingHours')),
        supportHours: round(sum('supportHours')),
        interruptionHours: round(downtime),
        fstdFailureHours: round(failure),
        externalFailureHours: round(external),
        lostTrainingHours: round(sum('lostTrainingHours')),
        interruptionCount,
        discrepancyCount,
        interruptionRatePercent: pct(interruptionCount, discrepancyCount),
        onTimeClosureRatePercent: pct(onTime.length, closed.length + overdueOpen.length),
        openDiscrepancyCount: openByFstd.get(f.id) ?? 0,
        operatingEfficiencyPercent: planned > 0 ? round(((planned - failure) / planned) * 100) : null,
        availabilityPercent: planned > 0 ? round(((planned - downtime) / planned) * 100) : null,
      };
    });
    return { from: range.from, to: range.to, months: months.length, rows };
  }

  // ---- 故障统计 ----

  async faultStatistics(tenantId: string, organizationId: string | undefined, from: string | undefined, to: string | undefined) {
    const orgId = this.requireOrganizationId(organizationId);
    const range = parseReportRange(from, to);
    const fstds = await this.prisma.fstd.findMany({ where: { organizationId: orgId }, orderBy: { deviceCode: 'asc' } });
    const fstdById = new Map(fstds.map((f) => [f.id, f]));
    const items = await this.prisma.discrepancyLog.findMany({
      where: { fstdId: { in: fstds.map((f) => f.id) }, reportedAt: { gte: range.start, lt: range.end } },
      orderBy: { reportedAt: 'asc' },
    });
    const names = await this.personnelNames(tenantId, items.map((i) => i.correctedById).filter((x): x is string => !!x));
    const now = new Date();

    const rows = fstds.map((f) => {
      const mine = items.filter((d) => d.fstdId === f.id);
      const closed = mine.filter((d) => d.status === 'corrected');
      const open = mine.filter((d) => d.status === 'open');
      const overdueOpen = open.filter((d) => d.dueDate != null && d.dueDate < now);
      const onTime = closed.filter((d) => d.dueDate == null || (d.correctedAt != null && d.correctedAt <= d.dueDate));
      const durationsDays = closed.filter((d) => d.correctedAt).map((d) => ((d.correctedAt as Date).getTime() - d.reportedAt.getTime()) / DAY_MS);
      const rated = mine.filter((d) => d.severityRating != null);
      return {
        fstdId: f.id,
        deviceCode: f.deviceCode,
        representedAircraft: f.representedAircraft,
        total: mine.length,
        corrected: closed.length,
        open: open.length,
        overdueOpen: overdueOpen.length,
        mmi: mine.filter((d) => d.isMmi).length,
        deferred: mine.filter((d) => d.retentionCategory != null).length,
        trainingTimeLostMinutes: mine.reduce((acc, d) => acc + (d.trainingTimeLostMinutes ?? 0), 0),
        averageSeverity: rated.length > 0 ? round(rated.reduce((acc, d) => acc + (d.severityRating as number), 0) / rated.length) : null,
        averageRepairDays: durationsDays.length > 0 ? round(durationsDays.reduce((a, b) => a + b, 0) / durationsDays.length) : null,
        onTimeClosureRatePercent: pct(onTime.length, closed.length + overdueOpen.length),
      };
    });

    const byPerson = new Map<string, number>();
    for (const d of items) if (d.correctedById) byPerson.set(d.correctedById, (byPerson.get(d.correctedById) ?? 0) + 1);
    const people = [...byPerson.entries()]
      .map(([personnelId, corrected]) => ({ personnelId, name: names.get(personnelId) ?? personnelId, corrected }))
      .sort((a, b) => b.corrected - a.corrected);

    const details = items.slice(0, MAX_DETAIL_ROWS).map((d) => ({
      id: d.id,
      deviceCode: fstdById.get(d.fstdId)?.deviceCode ?? d.fstdId,
      reportedAt: d.reportedAt,
      description: d.description,
      isMmi: d.isMmi,
      status: d.status,
      correctedAt: d.correctedAt,
      correctedBy: d.correctedById ? (names.get(d.correctedById) ?? d.correctedById) : null,
      dueDate: d.dueDate,
      trainingTimeLostMinutes: d.trainingTimeLostMinutes,
      severityRating: d.severityRating,
    }));
    return { from: range.from, to: range.to, rows, people, details, detailsTruncated: items.length > MAX_DETAIL_ROWS };
  }

  // ---- PM 统计 ----

  /// 范围内按设备 × 层级统计 PM 任务 (按任务日期, 北京时间); 并按执行人汇总。
  /// 只统计已登记的任务, 不推算"应完成数" (PM 周期目前不是按日历排期生成任务)。
  async pmStatistics(tenantId: string, organizationId: string | undefined, from: string | undefined, to: string | undefined) {
    const orgId = this.requireOrganizationId(organizationId);
    const range = parseReportRange(from, to);
    const fstds = await this.prisma.fstd.findMany({ where: { organizationId: orgId }, orderBy: { deviceCode: 'asc' } });
    const tasks = await this.prisma.pmTask.findMany({
      where: { fstdId: { in: fstds.map((f) => f.id) }, taskDate: { gte: range.start, lt: range.end } },
    });
    const levels: PmCheckLevel[] = ['WEEKLY', 'MONTHLY', 'SEMI_ANNUAL', 'ANNUAL'];
    const rows = fstds.map((f) => {
      const mine = tasks.filter((t) => t.fstdId === f.id);
      const byLevel = Object.fromEntries(
        levels.map((l) => {
          const ts = mine.filter((t) => t.level === l);
          const count = (s: PmTaskStatus) => ts.filter((t) => t.status === s).length;
          return [l, { total: ts.length, approved: count('APPROVED'), pendingReview: count('PENDING_REVIEW'), rejected: count('REJECTED') }];
        }),
      );
      return { fstdId: f.id, deviceCode: f.deviceCode, representedAircraft: f.representedAircraft, total: mine.length, byLevel };
    });

    const performed = new Map<string, number>();
    for (const t of tasks) if (t.performedById) performed.set(t.performedById, (performed.get(t.performedById) ?? 0) + 1);
    const names = await this.personnelNames(tenantId, [...performed.keys()]);
    const people = [...performed.entries()]
      .map(([personnelId, count]) => ({ personnelId, name: names.get(personnelId) ?? personnelId, count }))
      .sort((a, b) => b.count - a.count);
    return { from: range.from, to: range.to, rows, people };
  }

  // ---- 备件统计 ----

  /// 范围内按备件汇总: 领用(不含借出)、入库(不含归还)、盘点调整、借出/归还、未归还借用、故障件。
  async partStatistics(organizationId: string | undefined, from: string | undefined, to: string | undefined) {
    const orgId = this.requireOrganizationId(organizationId);
    const range = parseReportRange(from, to);
    const parts = await this.prisma.sparePart.findMany({ where: { organizationId: orgId }, orderBy: { partNumber: 'asc' } });
    const partIds = parts.map((p) => p.id);
    const inRange = { gte: range.start, lt: range.end };

    const movements = await this.prisma.partMovement.findMany({
      where: { sparePartId: { in: partIds }, performedAt: inRange },
      include: { loanFor: { select: { id: true } }, returnFor: { select: { id: true } } },
    });
    const loans = await this.prisma.partLoan.findMany({ where: { sparePartId: { in: partIds }, loanedAt: inRange } });
    const outstanding = await this.prisma.partLoan.findMany({ where: { sparePartId: { in: partIds }, returnedAt: null, loanedAt: { lt: range.end } } });
    const faulty = await this.prisma.faultyPartRecord.findMany({ where: { sparePartId: { in: partIds }, createdAt: inRange } });
    const now = new Date();

    const rows = parts.map((p) => {
      const ms = movements.filter((m) => m.sparePartId === p.id);
      const used = ms.filter((m) => m.type === 'OUT' && !m.loanFor).reduce((a, m) => a + m.quantity, 0);
      const received = ms.filter((m) => m.type === 'IN' && !m.returnFor).reduce((a, m) => a + m.quantity, 0);
      const adjustment = ms.filter((m) => m.type === 'ADJUSTMENT').reduce((a, m) => a + m.quantity, 0);
      const myLoans = loans.filter((l) => l.sparePartId === p.id);
      const myOutstanding = outstanding.filter((l) => l.sparePartId === p.id);
      const myFaulty = faulty.filter((f) => f.sparePartId === p.id);
      return {
        sparePartId: p.id,
        partNumber: p.partNumber,
        name: p.name,
        unit: p.unit,
        currentQuantity: p.currentQuantity,
        minQuantity: p.minQuantity,
        belowMinimum: p.currentQuantity < p.minQuantity,
        received,
        used,
        adjustment,
        loanedOutQuantity: myLoans.reduce((a, l) => a + l.quantity, 0),
        returnedQuantity: myLoans.filter((l) => l.returnedAt).reduce((a, l) => a + l.quantity, 0),
        outstandingLoanQuantity: myOutstanding.reduce((a, l) => a + l.quantity, 0),
        overdueLoanCount: myOutstanding.filter((l) => l.dueDate != null && l.dueDate < now).length,
        faultyRecordCount: myFaulty.length,
        faultyQuantity: myFaulty.reduce((a, f) => a + f.quantity, 0),
      };
    });
    const totals = {
      partKinds: rows.length,
      usedQuantity: rows.reduce((a, r) => a + r.used, 0),
      receivedQuantity: rows.reduce((a, r) => a + r.received, 0),
      loanedOutQuantity: rows.reduce((a, r) => a + r.loanedOutQuantity, 0),
      outstandingLoanQuantity: rows.reduce((a, r) => a + r.outstandingLoanQuantity, 0),
      faultyQuantity: rows.reduce((a, r) => a + r.faultyQuantity, 0),
      belowMinimumCount: rows.filter((r) => r.belowMinimum).length,
    };
    return { from: range.from, to: range.to, totals, rows };
  }

  // ---- 导出 ----

  async toWorkbook(title: string, sheets: ExportSheet[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    for (const s of sheets) {
      const sheet = workbook.addWorksheet(s.name);
      sheet.addRow([title]);
      sheet.addRow(s.headers).font = { bold: true };
      for (const r of s.rows) sheet.addRow(r);
      s.headers.forEach((_, i) => {
        sheet.getColumn(i + 1).width = 16;
      });
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async exportOperationalEfficiency(organizationId: string | undefined, from: string | undefined, to: string | undefined) {
    const r = await this.operationalEfficiency(organizationId, from, to);
    return this.toWorkbook(`运行效率统计 ${r.from} ~ ${r.to}`, [
      {
        name: '运行效率统计',
        headers: ['训练设备', '机型', '登记月数/应登记月数', '计划可用时间(h)', '检修总时长(h)', '中断总时长(h)', '设备故障时长(h)', '外部原因时长(h)', '中断次数', '故障次数', '故障中断率(%)', '故障按期关闭率(%)', '未关闭故障数', '运行效率(%)', '设备可用率(%)'],
        rows: r.rows.map((x) => [
          x.deviceCode,
          x.representedAircraft,
          `${x.monthsWithData}/${x.monthsExpected}`,
          x.plannedAvailableHours,
          x.supportHours,
          x.interruptionHours,
          x.fstdFailureHours,
          x.externalFailureHours,
          x.interruptionCount,
          x.discrepancyCount,
          x.interruptionRatePercent,
          x.onTimeClosureRatePercent,
          x.openDiscrepancyCount,
          x.operatingEfficiencyPercent,
          x.availabilityPercent,
        ]),
      },
    ]);
  }

  async exportFaultStatistics(tenantId: string, organizationId: string | undefined, from: string | undefined, to: string | undefined) {
    const r = await this.faultStatistics(tenantId, organizationId, from, to);
    return this.toWorkbook(`故障统计 ${r.from} ~ ${r.to}`, [
      {
        name: '按设备汇总',
        headers: ['训练设备', '机型', '故障次数', '已关闭', '未关闭', '逾期未关闭', 'MMI次数', '保留(延期)数', '培训损失(分钟)', '平均严重度', '平均修复天数', '按期关闭率(%)'],
        rows: r.rows.map((x) => [x.deviceCode, x.representedAircraft, x.total, x.corrected, x.open, x.overdueOpen, x.mmi, x.deferred, x.trainingTimeLostMinutes, x.averageSeverity, x.averageRepairDays, x.onTimeClosureRatePercent]),
      },
      { name: '维修人员', headers: ['人员', '关闭故障数'], rows: r.people.map((p) => [p.name, p.corrected]) },
      {
        name: '故障明细',
        headers: ['设备', '报告时间', '描述', 'MMI', '状态', '关闭时间', '关闭人', '截止日期', '培训损失(分钟)', '严重度'],
        rows: r.details.map((d) => [d.deviceCode, localStamp(d.reportedAt), d.description, d.isMmi ? '是' : '否', d.status === 'corrected' ? '已关闭' : '未关闭', d.correctedAt ? localStamp(d.correctedAt) : null, d.correctedBy, d.dueDate ? localDate(d.dueDate) : null, d.trainingTimeLostMinutes, d.severityRating]),
      },
    ]);
  }

  async exportPmStatistics(tenantId: string, organizationId: string | undefined, from: string | undefined, to: string | undefined) {
    const r = await this.pmStatistics(tenantId, organizationId, from, to);
    const levelNames: Record<string, string> = { WEEKLY: '周检', MONTHLY: '月检', SEMI_ANNUAL: '半年检', ANNUAL: '年检' };
    return this.toWorkbook(`PM统计 ${r.from} ~ ${r.to}`, [
      {
        name: '按设备',
        headers: ['训练设备', '机型', '层级', '任务数', '已审核通过', '待审核', '已驳回'],
        rows: r.rows.flatMap((x) => Object.entries(x.byLevel).map(([level, v]) => [x.deviceCode, x.representedAircraft, levelNames[level] ?? level, v.total, v.approved, v.pendingReview, v.rejected])),
      },
      { name: '按执行人', headers: ['人员', '执行任务数'], rows: r.people.map((p) => [p.name, p.count]) },
    ]);
  }

  async exportPartStatistics(organizationId: string | undefined, from: string | undefined, to: string | undefined) {
    const r = await this.partStatistics(organizationId, from, to);
    return this.toWorkbook(`备件统计 ${r.from} ~ ${r.to}`, [
      {
        name: '备件统计',
        headers: ['备件号', '名称', '单位', '当前库存', '最低库存', '低于最低库存', '入库', '领用', '盘点调整', '借出', '已归还', '未归还', '逾期未还(笔)', '故障件(条)', '故障件数量'],
        rows: r.rows.map((x) => [x.partNumber, x.name, x.unit, x.currentQuantity, x.minQuantity, x.belowMinimum ? '是' : '否', x.received, x.used, x.adjustment, x.loanedOutQuantity, x.returnedQuantity, x.outstandingLoanQuantity, x.overdueLoanCount, x.faultyRecordCount, x.faultyQuantity]),
      },
    ]);
  }
}

function localStamp(d: Date): string {
  return new Date(d.getTime() + CN_OFFSET_MS).toISOString().slice(0, 16).replace('T', ' ');
}

/// from..to (YYYY-MM-DD) 覆盖到的自然月列表
function monthsBetween(from: string, to: string): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const endY = Number(to.slice(0, 4));
  const endM = Number(to.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    out.push({ year: y, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}
