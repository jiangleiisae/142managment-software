import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiCall, apiFor, createFstd, createOrg, createPersonnel, createTestApp, registerTenant } from './helpers.js';

/// 升级校准记录 + QTG 执行计划 (R7)。QTG 状态用固定的过去年份/未来年份, 与运行日期无关。
const DAY = 24 * 60 * 60 * 1000;
const cnDate = (offsetDays: number) => new Date(Date.now() + 8 * 60 * 60 * 1000 + offsetDays * DAY).toISOString().slice(0, 10);

describe('upgrade records and QTG plans', () => {
  let app: INestApplication;
  let call: ApiCall;
  let token: string;
  let org: { id: string };
  let dev: { id: string; deviceCode: string };
  let other: { id: string };

  const create = (body: Record<string, unknown>, t = token) =>
    call('POST', '/upgrades', { organizationId: org.id, fstdId: dev.id, category: 'MODEL_UPGRADE', performedOn: cnDate(-5), title: '视景系统整体升级', ...body }, t);

  beforeAll(async () => {
    app = await createTestApp();
    call = apiFor(app);
    ({ token } = await registerTenant(call));
    org = await createOrg(call, token, 'CAAC Org', { regulatoryStandard: 'CAAC' });
    dev = await createFstd(call, token, org.id);
    const otherOrg = await createOrg(call, token, 'Second Org');
    other = await createFstd(call, token, otherOrg.id);
  });

  afterAll(async () => {
    await app.close();
  });

  it('登记: 各类别、校验、改装报告跟踪、修正、列表筛选', async () => {
    expect((await create({ category: 'WEIRD' })).status).toBe(400);
    expect((await create({ performedOn: cnDate(2) })).status).toBe(400); // 未来
    expect((await create({ performedOn: '2026-02-30' })).status).toBe(400);
    expect((await create({ category: 'SUBSYSTEM_UPGRADE' })).status).toBe(400); // 子系统必填
    expect((await create({ category: 'INSTRUMENT_CALIBRATION', nextDueDate: cnDate(-10) })).status).toBe(400); // 下次到期早于执行日
    expect((await create({ fstdId: other.id })).status).toBe(400); // 设备不属于该机构
    expect((await create({ performedByPersonnelId: 'nope' })).status).toBe(400);

    const person = await createPersonnel(call, token, { firstName: '强', lastName: '张' });
    const modification = await create({ isModification: true, versionFrom: 'v1.0', versionTo: 'v2.0', performedByPersonnelId: person.id });
    expect(modification.status).toBe(201);
    expect((await create({ category: 'SUBSYSTEM_UPGRADE', subsystem: '运动系统', title: '作动筒更换', performedOn: cnDate(-20) })).status).toBe(201);
    expect((await create({ category: 'INSTRUMENT_CALIBRATION', title: '空速表校准', performedOn: cnDate(-400), nextDueDate: cnDate(-35) })).status).toBe(201);
    expect((await create({ category: 'DATABASE_UPDATE', title: '导航数据库 AIRAC 更新', performedOn: cnDate(-1), result: 'fail' })).status).toBe(201);

    const all = await call('GET', `/upgrades?organizationId=${org.id}`, undefined, token);
    expect(all.status).toBe(200);
    expect(all.body).toHaveLength(4);
    const dates = all.body.map((r: { performedOn: string }) => r.performedOn) as string[];
    expect(dates).toEqual([...dates].sort().reverse()); // 日期倒序

    const mod = all.body.find((r: { isModification: boolean }) => r.isModification);
    expect(mod).toMatchObject({ deviceCode: dev.deviceCode, performedBy: '张强', needsCaacReport: true, versionTo: 'v2.0' });
    const calib = all.body.find((r: { category: string }) => r.category === 'INSTRUMENT_CALIBRATION');
    expect(calib.overdue).toBe(true);

    const subsystem = await call('GET', `/upgrades?organizationId=${org.id}&category=SUBSYSTEM_UPGRADE`, undefined, token);
    expect(subsystem.body).toHaveLength(1);
    expect((await call('GET', `/upgrades?organizationId=${org.id}&category=BAD`, undefined, token)).status).toBe(400);
    const recent = await call('GET', `/upgrades?organizationId=${org.id}&from=${cnDate(-30)}&to=${cnDate(0)}`, undefined, token);
    expect(recent.body).toHaveLength(3);
    expect((await call('GET', `/upgrades?organizationId=${org.id}&fstdId=${other.id}`, undefined, token)).body).toHaveLength(0);

    // 记录向民航局提交的改装报告后, 不再提示
    const patched = await call('PATCH', `/upgrades/${mod.id}`, { caacReportRef: 'CAAC-2026-088', caacReportedOn: cnDate(-6) }, token);
    expect(patched.status).toBe(200);
    const after = await call('GET', `/upgrades?organizationId=${org.id}`, undefined, token);
    expect(after.body.find((r: { id: string }) => r.id === mod.id)).toMatchObject({ needsCaacReport: false, caacReportRef: 'CAAC-2026-088' });
    expect((await call('PATCH', `/upgrades/${mod.id}`, { performedOn: cnDate(3) }, token)).status).toBe(400);

    const audit = await call('GET', `/audit-logs?entityType=FstdUpgradeRecord&entityId=${mod.id}`, undefined, token);
    expect(audit.body.map((a: { action: string }) => a.action).sort()).toEqual(['create', 'update']);
  });

  it('QTG 计划: 时段校验、责任人、各状态、清除后回到默认整季度', async () => {
    const person = await createPersonnel(call, token, { firstName: '华', lastName: '李' });
    const put = (body: Record<string, unknown>) => call('PUT', '/qtg-plans', { organizationId: org.id, fstdId: dev.id, quarter: 1, windowStart: '01-15', windowEnd: '02-28', responsibleIds: [person.id], ...body }, token);

    expect((await put({ windowStart: '04-01', windowEnd: '04-30' })).status).toBe(400); // 不在第1季度
    expect((await put({ windowStart: '02-20', windowEnd: '02-10' })).status).toBe(400); // 开始晚于结束
    expect((await put({ windowStart: '02-30', windowEnd: '03-01' })).status).toBe(400); // 非法日期
    expect((await put({ quarter: 5 })).status).toBe(400);
    expect((await put({ responsibleIds: ['nope'] })).status).toBe(400);
    expect((await put({ fstdId: other.id })).status).toBe(400);
    expect((await put({})).status).toBe(200);
    expect((await put({ quarter: 2, windowStart: '05-01', windowEnd: '05-31', responsibleIds: [] })).status).toBe(200);

    // 2020 年: Q1 窗口内完成; Q2 窗口外(4 月)完成; Q3/Q4 没做 → 逾期
    expect((await call('POST', `/fstds/${dev.id}/qtg-quarterly-runs`, { year: 2020, quarter: 1, completedAt: '2020-02-01T03:00:00.000Z', result: 'pass' }, token)).status).toBe(201);
    expect((await call('POST', `/fstds/${dev.id}/qtg-quarterly-runs`, { year: 2020, quarter: 2, completedAt: '2020-04-10T03:00:00.000Z', result: 'pass' }, token)).status).toBe(201);
    const s2020 = await call('GET', `/qtg-plans/schedule?organizationId=${org.id}&year=2020`, undefined, token);
    expect(s2020.status).toBe(200);
    const row = s2020.body.find((r: { fstdId: string }) => r.fstdId === dev.id);
    const q = (n: number) => row.quarters.find((x: { quarter: number }) => x.quarter === n);
    expect(q(1)).toMatchObject({ configured: true, windowStart: '01-15', windowEnd: '02-28', responsible: ['李华'], completedOn: '2020-02-01', status: 'DONE' });
    expect(q(2)).toMatchObject({ completedOn: '2020-04-10', status: 'DONE_OUTSIDE' });
    expect(q(3)).toMatchObject({ configured: false, windowStart: '07-01', windowEnd: '09-30', responsible: [], status: 'OVERDUE' });
    expect(q(4)).toMatchObject({ windowStart: '10-01', windowEnd: '12-31', status: 'OVERDUE' });

    const future = await call('GET', `/qtg-plans/schedule?organizationId=${org.id}&year=2099`, undefined, token);
    expect(future.body.find((r: { fstdId: string }) => r.fstdId === dev.id).quarters.every((x: { status: string }) => x.status === 'UPCOMING')).toBe(true);
    expect((await call('GET', `/qtg-plans/schedule?organizationId=${org.id}&year=abc`, undefined, token)).status).toBe(400);

    expect((await call('DELETE', `/qtg-plans?organizationId=${org.id}&fstdId=${dev.id}&quarter=1`, undefined, token)).body).toEqual({ deleted: true });
    expect((await call('DELETE', `/qtg-plans?organizationId=${org.id}&fstdId=${dev.id}&quarter=1`, undefined, token)).body).toEqual({ deleted: false });
    const cleared = await call('GET', `/qtg-plans/schedule?organizationId=${org.id}&year=2020`, undefined, token);
    expect(cleared.body.find((r: { fstdId: string }) => r.fstdId === dev.id).quarters[0]).toMatchObject({ configured: false, windowStart: '01-01', windowEnd: '03-31' });
  });

  it('导出(升级校准记录、年度运行报告底稿)、范围校验、权限与租户隔离', async () => {
    const { default: request } = await import('supertest');
    for (const path of [`/upgrades/export?organizationId=${org.id}`, `/reports/annual-operations/export?organizationId=${org.id}&from=${cnDate(-300)}&to=${cnDate(0)}`]) {
      const res = await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${token}`)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      expect(String(res.headers['content-type'])).toContain('spreadsheetml');
      expect((res.body as Buffer).length).toBeGreaterThan(1000);
    }
    expect((await call('GET', `/reports/annual-operations/export?organizationId=${org.id}&from=2025-01-01&to=2026-12-31`, undefined, token)).status).toBe(400);

    const email = `staff-${Date.now()}@example.com`;
    expect((await call('POST', '/users', { email, password: 'StaffPass12345', role: 'STAFF', permissions: ['SCHEDULING'] }, token)).status).toBe(201);
    const staffToken = (await call('POST', '/auth/login', { email, password: 'StaffPass12345' })).body.accessToken;
    expect((await call('GET', `/upgrades?organizationId=${org.id}`, undefined, staffToken)).status).toBe(403);
    expect((await call('GET', `/qtg-plans/schedule?organizationId=${org.id}&year=2026`, undefined, staffToken)).status).toBe(403);
    const stranger = await registerTenant(call);
    expect((await call('GET', `/upgrades?organizationId=${org.id}`, undefined, stranger.token)).status).toBe(403);
    expect((await call('PATCH', `/upgrades/nonexistent`, { title: 'x' }, stranger.token)).status).toBe(404);
  });
});
