import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiCall, apiFor, createFstd, createOrg, createStaff, createTestApp, registerTenant } from './helpers.js';

/// 公开分享(二维码): 训练计划 / 人员班表。公开接口不带任何认证信息。
const cnDate = (offsetDays: number) => new Date(Date.now() + 8 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

describe('public share links', () => {
  let app: INestApplication;
  let call: ApiCall;
  let token: string;
  let org: { id: string };
  let dev: { id: string; deviceCode: string };

  const publicGet = (path: string) => request(app.getHttpServer()).get(path);
  const manage = (action: string, type: string, t = token, organizationId = org.id) => call('POST', `/shares/${action}`, { organizationId, type }, t);

  beforeAll(async () => {
    app = await createTestApp();
    call = apiFor(app);
    ({ token } = await registerTenant(call));
    org = await createOrg(call, token, 'Share Org');
    dev = await createFstd(call, token, org.id);
  });

  afterAll(async () => {
    await app.close();
  });

  it('默认没有分享链接; 启用后生成不可猜测的 token, 重复启用保持不变', async () => {
    const before = await call('GET', `/shares?organizationId=${org.id}`, undefined, token);
    expect(before.body).toEqual([
      { type: 'TRAINING_PLAN', fstdId: null, enabled: false, token: null, createdAt: null, rotatedAt: null },
      { type: 'ROSTER', fstdId: null, enabled: false, token: null, createdAt: null, rotatedAt: null },
    ]);

    const first = await manage('enable', 'TRAINING_PLAN');
    expect(first.status).toBe(201);
    expect(first.body.enabled).toBe(true);
    expect(first.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const again = await manage('enable', 'TRAINING_PLAN');
    expect(again.body.token).toBe(first.body.token); // 二维码不变

    const other = await manage('enable', 'ROSTER');
    expect(other.body.token).not.toBe(first.body.token);
    expect((await manage('enable', 'NOPE')).status).toBe(400);
  });

  it('训练计划: 无需登录即可看到范围内的预订, 不含收入/电话/备注, 不含已取消和范围外的', async () => {
    const tp = (await call('GET', `/shares?organizationId=${org.id}`, undefined, token)).body.find((s: { type: string }) => s.type === 'TRAINING_PLAN');
    const book = (startAt: string, endAt: string, extra: Record<string, unknown> = {}) =>
      call('POST', '/bookings', { organizationId: org.id, resourceType: 'FSTD', resourceId: dev.id, startAt, endAt, ...extra }, token);
    const visible = await book('2031-03-10T01:00:00.000Z', '2031-03-10T03:00:00.000Z', {
      trainingType: '年度复训', customerName: '奥凯航空', pilotName: '赵俊哲', instructorName: '张文国', examinerName: '李检查', revenue: 8888, contactPhone: '13800001111', notes: '内部备注不应公开',
    });
    expect(visible.status).toBe(201);
    const cancelled = await book('2031-03-11T01:00:00.000Z', '2031-03-11T03:00:00.000Z', { customerName: '已取消客户' });
    await call('POST', `/bookings/${cancelled.body.id}/cancel`, undefined, token);
    expect((await book('2031-04-20T01:00:00.000Z', '2031-04-20T03:00:00.000Z', { customerName: '范围外客户' })).status).toBe(201);

    const res = await publicGet(`/public/share/${tp.token}?date=2031-03-10&days=7`); // 不带 Authorization
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('no-store');
    expect(res.headers['x-robots-tag']).toContain('noindex');
    expect(res.body).toMatchObject({ type: 'TRAINING_PLAN', organizationName: expect.stringContaining('Share Org'), from: '2031-03-10', days: 7 });
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ deviceCode: dev.deviceCode, trainingType: '年度复训', customerName: '奥凯航空', pilotName: '赵俊哲', instructorName: '张文国', examinerName: '李检查' });
    const raw = JSON.stringify(res.body);
    for (const secret of ['8888', '13800001111', '内部备注不应公开', '已取消客户', '范围外客户', org.id, 'revenue', 'contactPhone', 'notes']) expect(raw).not.toContain(secret);

    // 北京时间边界: 2031-03-10 01:00Z 是北京 09:00; 从 03-11 开始的窗口看不到它
    expect((await publicGet(`/public/share/${tp.token}?date=2031-03-11&days=1`)).body.items).toHaveLength(0);
    // 默认参数 (今天起 7 天) 也能正常返回
    expect((await publicGet(`/public/share/${tp.token}`)).status).toBe(200);
    expect((await publicGet(`/public/share/${tp.token}?date=2031-02-30`)).status).toBe(400);
    expect((await publicGet(`/public/share/${tp.token}?days=99`)).status).toBe(400);
  });

  it('人员班表: 公开页给出人员×日期的班次代码和班次说明', async () => {
    const roster = (await call('GET', `/shares?organizationId=${org.id}`, undefined, token)).body.find((s: { type: string }) => s.type === 'ROSTER');
    const shifts = Object.fromEntries((await call('GET', `/roster/shift-types?organizationId=${org.id}`, undefined, token)).body.map((s: { code: string; id: string }) => [s.code, s.id]));
    const wang = await createStaff(call, token, org.id, '王明', { phone: '13999990000', employeeNo: 'EMP-SECRET-7', position: '维护工程师', notes: '内部备注' });
    await call('POST', '/roster/entries', { organizationId: org.id, cells: [{ staffId: wang.id, date: '2031-05-02' }], shiftTypeId: shifts.M }, token);
    // 行政综合部门的人和班表不会出现在公开的维护班表里
    const driver = await createStaff(call, token, org.id, '司机老赵', { department: 'ADMIN' });
    const adminShifts = Object.fromEntries((await call('GET', `/roster/shift-types?organizationId=${org.id}&department=ADMIN`, undefined, token)).body.map((s: { code: string; id: string }) => [s.code, s.id]));
    await call('POST', '/roster/entries', { organizationId: org.id, cells: [{ staffId: driver.id, date: '2031-05-02' }], shiftTypeId: adminShifts.Z }, token);

    const res = await publicGet(`/public/share/${roster.token}?month=2031-05`);
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('ROSTER');
    expect(res.body.days).toHaveLength(31);
    expect(res.body.rows).toEqual([{ name: '王明', groupName: null, cells: { '2031-05-02': 'M' } }]);
    expect(res.body.shifts.find((s: { code: string }) => s.code === 'M')).toMatchObject({ name: '白班', startTime: '08:30', endTime: '17:00' });
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('13999990000');
    expect(raw).not.toContain('EMP-SECRET-7');
    expect(raw).not.toContain('内部备注');
    expect(raw).not.toContain('司机老赵');
    expect((await publicGet(`/public/share/${roster.token}?month=2031-13`)).status).toBe(400);
  });

  it('重新生成让旧二维码立即失效; 停用后 404; 坏 token 与不存在的 token 一视同仁', async () => {
    const before = (await call('GET', `/shares?organizationId=${org.id}`, undefined, token)).body.find((s: { type: string }) => s.type === 'TRAINING_PLAN');
    const rotated = await manage('rotate', 'TRAINING_PLAN');
    expect(rotated.body.token).not.toBe(before.token);
    expect(rotated.body.rotatedAt).not.toBeNull();
    expect((await publicGet(`/public/share/${before.token}`)).status).toBe(404);
    expect((await publicGet(`/public/share/${rotated.body.token}`)).status).toBe(200);

    const disabled = await manage('disable', 'TRAINING_PLAN');
    expect(disabled.body).toMatchObject({ enabled: false, token: null });
    expect((await publicGet(`/public/share/${rotated.body.token}`)).status).toBe(404);
    const listed = (await call('GET', `/shares?organizationId=${org.id}`, undefined, token)).body.find((s: { type: string }) => s.type === 'TRAINING_PLAN');
    expect(listed.token).toBeNull();
    expect((await manage('disable', 'TRAINING_PLAN')).body.enabled).toBe(false); // 幂等

    // 重新启用后沿用最后一个 token (没有再变)
    const reEnabled = await manage('enable', 'TRAINING_PLAN');
    expect(reEnabled.body.token).toBe(rotated.body.token);
    expect((await publicGet(`/public/share/${reEnabled.body.token}`)).status).toBe(200);

    expect((await publicGet('/public/share/short')).status).toBe(404);
    expect((await publicGet(`/public/share/${'a'.repeat(43)}`)).status).toBe(404);

    const audit = await call('GET', `/audit-logs?entityType=PublicShare`, undefined, token);
    expect(audit.body.length).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(audit.body)).not.toContain(rotated.body.token); // 审计里不记录 token
  });

  it('设备级二维码: 每台模拟机独立的 token, 只显示该设备的计划和停飞日, 与机构级和其他设备互不影响', async () => {
    const devB = await createFstd(call, token, org.id);
    const manageDev = (action: string, fstdId: string, type = 'TRAINING_PLAN', t = token) => call('POST', `/shares/${action}`, { organizationId: org.id, type, fstdId }, t);

    // 启用前: 一览里所有设备都没有二维码
    const before = await call('GET', `/shares/devices?organizationId=${org.id}`, undefined, token);
    expect(before.body.every((d: { enabled: boolean }) => d.enabled === false)).toBe(true);
    expect(before.body.map((d: { fstdId: string }) => d.fstdId)).toContain(devB.id);

    const a = await manageDev('enable', dev.id);
    const b = await manageDev('enable', devB.id);
    expect(a.status).toBe(201);
    expect(a.body).toMatchObject({ type: 'TRAINING_PLAN', fstdId: dev.id, enabled: true });
    expect(a.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.body.token).not.toBe(b.body.token);
    expect((await manageDev('enable', dev.id)).body.token).toBe(a.body.token); // 重复启用不变: 贴在设备上的标签继续有效
    const orgLevel = (await call('GET', `/shares?organizationId=${org.id}`, undefined, token)).body.find((s2: { type: string }) => s2.type === 'TRAINING_PLAN');
    expect(orgLevel.token).not.toBe(a.body.token); // 机构级是另一个 token

    // 两台设备各有一个未来的预订; 在 devA 上标一个停飞日 (停飞只能标 366 天内, 所以用相对今天的日期)
    const day10 = cnDate(20);
    const day12 = cnDate(22);
    const book = (fstdId: string, startAt: string, endAt: string, customerName: string) =>
      call('POST', '/bookings', { organizationId: org.id, resourceType: 'FSTD', resourceId: fstdId, startAt, endAt, customerName }, token);
    expect((await book(dev.id, `${day10}T01:00:00.000Z`, `${day10}T03:00:00.000Z`, 'A设备客户')).status).toBe(201);
    expect((await book(devB.id, `${day10}T01:00:00.000Z`, `${day10}T03:00:00.000Z`, 'B设备客户')).status).toBe(201);
    expect((await call('POST', '/fstds/groundings', { organizationId: org.id, entries: [{ fstdId: dev.id, date: day12 }] }, token)).status).toBe(201);

    const viewA = await publicGet(`/public/share/${a.body.token}?date=${day10}&days=7`);
    expect(viewA.status).toBe(200);
    expect(viewA.body.device).toEqual({ code: dev.deviceCode, aircraft: 'A320' });
    expect(viewA.body.items.map((i: { customerName: string }) => i.customerName)).toEqual(['A设备客户']); // 看不到 B 的
    expect(viewA.body.devices).toHaveLength(1);
    expect(viewA.body.groundedDates).toEqual([day12]);
    const viewB = await publicGet(`/public/share/${b.body.token}?date=${day10}&days=7`);
    expect(viewB.body.items.map((i: { customerName: string }) => i.customerName)).toEqual(['B设备客户']);
    expect(viewB.body.groundedDates).toEqual([]);
    // 机构级页面看得到两台设备的
    const viewOrg = await publicGet(`/public/share/${orgLevel.token}?date=${day10}&days=7`);
    expect(viewOrg.body.device).toBeNull();
    expect(viewOrg.body.items).toHaveLength(2);

    // 一览
    const list = await call('GET', `/shares/devices?organizationId=${org.id}`, undefined, token);
    expect(list.body.find((d: { fstdId: string }) => d.fstdId === dev.id)).toMatchObject({ enabled: true, token: a.body.token, deviceCode: dev.deviceCode });
    expect((await call('GET', `/shares?organizationId=${org.id}&fstdId=${dev.id}`, undefined, token)).body).toEqual([expect.objectContaining({ type: 'TRAINING_PLAN', fstdId: dev.id, enabled: true, token: a.body.token })]);

    // 重新生成/停用只影响这一台
    const rotated = await manageDev('rotate', dev.id);
    expect(rotated.body.token).not.toBe(a.body.token);
    expect((await publicGet(`/public/share/${a.body.token}`)).status).toBe(404);
    expect((await publicGet(`/public/share/${rotated.body.token}`)).status).toBe(200);
    expect((await publicGet(`/public/share/${b.body.token}`)).status).toBe(200);
    expect((await publicGet(`/public/share/${orgLevel.token}`)).status).toBe(200);
    expect((await manageDev('disable', dev.id)).body).toMatchObject({ enabled: false, token: null });
    expect((await publicGet(`/public/share/${rotated.body.token}`)).status).toBe(404);
    expect((await publicGet(`/public/share/${b.body.token}`)).status).toBe(200);

    // 校验: 班表不支持设备级; 设备必须属于该机构
    expect((await manageDev('enable', dev.id, 'ROSTER')).status).toBe(400);
    const otherOrg = await createOrg(call, token, 'Other Org');
    const foreign = await createFstd(call, token, otherOrg.id);
    expect((await manageDev('enable', foreign.id)).status).toBe(400);
    expect((await call('GET', `/shares?organizationId=${org.id}&fstdId=${foreign.id}`, undefined, token)).status).toBe(400);

    // 权限与租户
    const stranger = await registerTenant(call);
    expect((await call('GET', `/shares/devices?organizationId=${org.id}`, undefined, stranger.token)).status).toBe(403);
    expect((await manageDev('enable', dev.id, 'TRAINING_PLAN', stranger.token)).status).toBe(403);
  });

  it('管理接口需要登录与 SCHEDULING 权限, 且不能跨租户', async () => {
    const email = `staff-${Date.now()}@example.com`;
    expect((await call('POST', '/users', { email, password: 'StaffPass12345', role: 'STAFF', permissions: ['FSTD'] }, token)).status).toBe(201);
    const staffToken = (await call('POST', '/auth/login', { email, password: 'StaffPass12345' })).body.accessToken;
    expect((await call('GET', `/shares?organizationId=${org.id}`, undefined, staffToken)).status).toBe(403);
    expect((await manage('rotate', 'ROSTER', staffToken)).status).toBe(403);
    expect((await call('GET', `/shares?organizationId=${org.id}`)).status).toBe(401);

    const stranger = await registerTenant(call);
    expect((await call('GET', `/shares?organizationId=${org.id}`, undefined, stranger.token)).status).toBe(403);
    expect((await manage('enable', 'ROSTER', stranger.token)).status).toBe(403);
  });
});
