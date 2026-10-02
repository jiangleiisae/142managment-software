import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { ApiCall, apiFor, createFstd, createOrg, createPersonnel, createTestApp, registerTenant } from './helpers.js';

/// 统计报表 (R5-a/b): 运行效率、故障、PM、备件。固定用 2026-09 (北京时间) 的数据, 与运行日期无关。
describe('statistics reports', () => {
  let app: INestApplication;
  let call: ApiCall;
  let prisma: PrismaService;
  let token: string;
  let tenantId: string;
  let org: { id: string };
  let fstd: { id: string; deviceCode: string };
  const q = (extra = '') => `organizationId=${org.id}&from=2026-09-01&to=2026-09-30${extra}`;

  beforeAll(async () => {
    app = await createTestApp();
    call = apiFor(app);
    prisma = app.get(PrismaService);
    ({ token, tenantId } = await registerTenant(call));
    org = await createOrg(call, token);
    fstd = await createFstd(call, token, org.id);
  });

  afterAll(async () => {
    await app.close();
  });

  it('运行效率: 小时指标取自月度登记, 故障指标按北京时间日期截取, 按期关闭率与未关闭数', async () => {
    await prisma.fstdPerformanceMetric.create({
      data: { fstdId: fstd.id, year: 2026, month: 9, plannedAvailableHours: 100, scheduledTrainingHours: 80, supportHours: 5, fstdFailureHours: 2, externalFailureHours: 1, lostTrainingHours: 1.5, discrepancyCount: 4, interruptionCount: 2 },
    });
    const fixed = { fstdId: fstd.id, description: 'x' };
    await prisma.discrepancyLog.createMany({
      data: [
        // 北京时间 9/1 01:00 (UTC 8/31 17:00): 在范围内; 按期关闭
        { ...fixed, reportedAt: new Date('2026-08-31T17:00:00Z'), dueDate: new Date('2026-09-10T00:00:00Z'), status: 'corrected', correctedAt: new Date('2026-09-05T00:00:00Z') },
        // 逾期关闭
        { ...fixed, reportedAt: new Date('2026-09-02T00:00:00Z'), dueDate: new Date('2026-09-10T00:00:00Z'), status: 'corrected', correctedAt: new Date('2026-09-20T00:00:00Z') },
        // 已过截止期仍未关闭
        { ...fixed, reportedAt: new Date('2026-09-03T00:00:00Z'), dueDate: new Date('2026-09-12T00:00:00Z'), status: 'open' },
        // 北京时间 10/1 01:00: 不在范围内
        { ...fixed, reportedAt: new Date('2026-09-30T17:00:00Z'), dueDate: new Date('2026-10-30T00:00:00Z'), status: 'open' },
      ],
    });

    const res = await call('GET', `/reports/operational-efficiency?${q()}`, undefined, token);
    expect(res.status).toBe(200);
    const row = res.body.rows.find((r: { fstdId: string }) => r.fstdId === fstd.id);
    expect(row.monthsWithData).toBe(1);
    expect(row.supportHours).toBe(5);
    expect(row.interruptionHours).toBe(3);
    expect(row.interruptionCount).toBe(2);
    expect(row.interruptionRatePercent).toBe(50);
    expect(row.operatingEfficiencyPercent).toBe(98);
    expect(row.availabilityPercent).toBe(97);
    expect(row.onTimeClosureRatePercent).toBe(33.33); // 1 按期 / (2 已关闭 + 1 逾期未关闭)
    expect(row.openDiscrepancyCount).toBe(1); // 10/1 的故障在统计截止日之后, 不算

    const noData = await call('GET', `/reports/operational-efficiency?organizationId=${org.id}&from=2026-07-01&to=2026-07-31`, undefined, token);
    const emptyRow = noData.body.rows.find((r: { fstdId: string }) => r.fstdId === fstd.id);
    expect(emptyRow.monthsWithData).toBe(0);
    expect(emptyRow.availabilityPercent).toBeNull();
  });

  it('故障统计: 汇总、维修人员、明细', async () => {
    const person = await createPersonnel(call, token, { firstName: '明', lastName: '王' });
    await prisma.discrepancyLog.updateMany({
      where: { fstdId: fstd.id, status: 'corrected' },
      data: { correctedById: person.id, isMmi: true, trainingTimeLostMinutes: 30, severityRating: 4 },
    });
    const res = await call('GET', `/reports/faults?${q()}`, undefined, token);
    expect(res.status).toBe(200);
    const row = res.body.rows.find((r: { fstdId: string }) => r.fstdId === fstd.id);
    expect(row).toMatchObject({ total: 3, corrected: 2, open: 1, overdueOpen: 1, mmi: 2, trainingTimeLostMinutes: 60, averageSeverity: 4 });
    expect(row.averageRepairDays).toBeGreaterThan(0);
    expect(res.body.people).toEqual([{ personnelId: person.id, name: '王明', corrected: 2 }]);
    expect(res.body.details).toHaveLength(3);
  });

  it('PM统计: 按设备×层级和执行人', async () => {
    const person = await createPersonnel(call, token, { firstName: '华', lastName: '李' });
    const tpl = await prisma.pmChecklistTemplate.create({ data: { organizationId: org.id, level: 'MONTHLY', itemsJson: [{ item: 'a' }] } });
    const base = { fstdId: fstd.id, checklistTemplateId: tpl.id, level: 'MONTHLY' as const, performedById: person.id, responsibleIds: [], itemResultsJson: [] };
    await prisma.pmTask.createMany({
      data: [
        { ...base, taskDate: new Date('2026-09-10T00:00:00Z'), status: 'APPROVED' },
        { ...base, taskDate: new Date('2026-09-11T00:00:00Z'), status: 'PENDING_REVIEW' },
        { ...base, taskDate: new Date('2026-10-02T00:00:00Z'), status: 'APPROVED' }, // 范围外
      ],
    });
    const res = await call('GET', `/reports/pm?${q()}`, undefined, token);
    expect(res.status).toBe(200);
    const row = res.body.rows.find((r: { fstdId: string }) => r.fstdId === fstd.id);
    expect(row.total).toBe(2);
    expect(row.byLevel.MONTHLY).toEqual({ total: 2, approved: 1, pendingReview: 1, rejected: 0 });
    expect(row.byLevel.WEEKLY.total).toBe(0);
    expect(res.body.people).toEqual([{ personnelId: person.id, name: '李华', count: 2 }]);
  });

  it('备件统计: 领用不含借出, 入库不含归还, 未归还借用, 故障件', async () => {
    const part = await prisma.sparePart.create({ data: { organizationId: org.id, partNumber: `P-${Date.now()}`, name: '显卡', currentQuantity: 2, minQuantity: 5 } });
    const at = new Date('2026-09-15T00:00:00Z');
    const mv = (type: 'IN' | 'OUT' | 'ADJUSTMENT', quantity: number) => prisma.partMovement.create({ data: { sparePartId: part.id, type, quantity, performedAt: at } });
    await mv('IN', 10);
    await mv('OUT', 3); // 领用
    await mv('ADJUSTMENT', -1);
    const loanOut = await mv('OUT', 2);
    const returnIn = await mv('IN', 1);
    await prisma.partLoan.create({ data: { sparePartId: part.id, quantity: 2, borrowerInfo: 'X', loanedAt: at, dueDate: new Date('2026-09-20T00:00:00Z'), loanMovementId: loanOut.id } });
    await prisma.partLoan.create({ data: { sparePartId: part.id, quantity: 1, borrowerInfo: 'Y', loanedAt: at, returnedAt: at, loanMovementId: (await mv('OUT', 1)).id, returnMovementId: returnIn.id } });
    await prisma.faultyPartRecord.create({ data: { sparePartId: part.id, faultDescription: 'bad', quantity: 2, createdAt: at } });

    const res = await call('GET', `/reports/parts?${q()}`, undefined, token);
    expect(res.status).toBe(200);
    const row = res.body.rows.find((r: { sparePartId: string }) => r.sparePartId === part.id);
    expect(row).toMatchObject({ received: 10, used: 3, adjustment: -1, loanedOutQuantity: 3, returnedQuantity: 1, outstandingLoanQuantity: 2, overdueLoanCount: 1, faultyRecordCount: 1, faultyQuantity: 2, belowMinimum: true });
    expect(res.body.totals.belowMinimumCount).toBeGreaterThanOrEqual(1);
  });

  it('导出 xlsx、范围校验、跨租户与权限', async () => {
    for (const name of ['operational-efficiency', 'faults', 'pm', 'parts']) {
      const raw = await fetchBinary(app, `/reports/${name}/export?${q()}`, token);
      expect(raw.status).toBe(200);
      expect(raw.type).toContain('spreadsheetml');
      expect(raw.length).toBeGreaterThan(1000);
    }

    expect((await call('GET', `/reports/pm?organizationId=${org.id}&from=2026-09-30&to=2026-09-01`, undefined, token)).status).toBe(400);
    expect((await call('GET', `/reports/pm?organizationId=${org.id}&from=2026-02-30&to=2026-03-01`, undefined, token)).status).toBe(400);
    expect((await call('GET', `/reports/pm?organizationId=${org.id}&from=2025-01-01&to=2026-12-31`, undefined, token)).status).toBe(400);
    expect((await call('GET', `/reports/pm?from=2026-09-01&to=2026-09-30`, undefined, token)).status).toBe(400);

    const other = await registerTenant(call);
    expect((await call('GET', `/reports/pm?${q()}`, undefined, other.token)).status).toBe(403);

    // STAFF 只有 FSTD 权限: 可看运行效率, 不能看备件统计
    const email = `staff-${Date.now()}@example.com`;
    expect((await call('POST', '/users', { email, password: 'StaffPass12345', role: 'STAFF', permissions: ['FSTD'] }, token)).status).toBe(201);
    const staffToken = (await call('POST', '/auth/login', { email, password: 'StaffPass12345' })).body.accessToken;
    expect((await call('GET', `/reports/operational-efficiency?${q()}`, undefined, staffToken)).status).toBe(200);
    expect((await call('GET', `/reports/parts?${q()}`, undefined, staffToken)).status).toBe(403);
    expect(tenantId).toBeTruthy();
  });
});

async function fetchBinary(app: INestApplication, path: string, token: string) {
  const { default: request } = await import('supertest');
  const res = await request(app.getHttpServer())
    .get(path)
    .set('Authorization', `Bearer ${token}`)
    .buffer(true)
    .parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
  return { status: res.status, type: String(res.headers['content-type']), length: (res.body as Buffer).length };
}
