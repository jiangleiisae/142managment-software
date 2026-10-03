import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiCall, apiFor, createOrg, createStaff, createTestApp, registerTenant } from './helpers.js';

/// 人员班表: 维护 / 行政综合两个部门各自的班次、班组、排班人员、班表、工时统计、修改历史, 以及我的排班和权限。
describe('roster', () => {
  let app: INestApplication;
  let call: ApiCall;
  let token: string;
  let org: { id: string };
  let shifts: Record<string, { id: string; code: string; category?: string }>;
  let adminShifts: Record<string, { id: string; code: string }>;

  const setCells = (cells: { staffId: string; date: string }[], shiftTypeId: string | null, t = token) =>
    call('POST', '/roster/entries', { organizationId: org.id, cells, shiftTypeId }, t);
  const shiftList = async (department?: string) => (await call('GET', `/roster/shift-types?organizationId=${org.id}${department ? `&department=${department}` : ''}`, undefined, token)).body;

  beforeAll(async () => {
    app = await createTestApp();
    call = apiFor(app);
    ({ token } = await registerTenant(call));
    org = await createOrg(call, token);
    shifts = Object.fromEntries((await shiftList()).map((s: { code: string }) => [s.code, s]));
    adminShifts = Object.fromEntries((await shiftList('ADMIN')).map((s: { code: string }) => [s.code, s]));
  });

  afterAll(async () => {
    await app.close();
  });

  it('两个部门各有一套默认班次: 维护 M/E/D/B/S/V/Q/A, 行政综合 Z/B/S/V/Q/A; 同一代码可以在两个部门各存在一次', async () => {
    expect(Object.keys(shifts).sort()).toEqual(['A', 'B', 'D', 'E', 'M', 'Q', 'S', 'V']);
    expect(shifts.M).toMatchObject({ category: 'WORK', startTime: '08:30', endTime: '17:00', endsNextDay: false });
    expect(shifts.E).toMatchObject({ startTime: '17:00', endTime: '08:30', endsNextDay: true });
    expect(shifts.D).toMatchObject({ startTime: '08:30', endTime: '08:30', endsNextDay: true });
    expect(Object.keys(adminShifts).sort()).toEqual(['A', 'B', 'Q', 'S', 'V', 'Z']);
    expect((await shiftList('ADMIN')).find((s: { code: string }) => s.code === 'Z')).toMatchObject({ department: 'ADMIN', startTime: '09:00', endTime: '18:00', restMinutes: 60 });
    expect(shifts.B.id).not.toBe(adminShifts.B.id);
    expect((await call('GET', `/roster/shift-types?organizationId=${org.id}&department=NOPE`, undefined, token)).status).toBe(400);

    const post = (body: Record<string, unknown>) => call('POST', '/roster/shift-types', { organizationId: org.id, color: '#112233', ...body }, token);
    expect((await post({ code: 'M', name: '重复', category: 'OTHER' })).status).toBe(400); // 维护里 M 已存在
    expect((await post({ code: 'M', name: '行政也能用 M', category: 'OTHER', department: 'ADMIN' })).status).toBe(201); // 行政里没有
    expect((await post({ code: 'Z', name: '重复', category: 'OTHER', department: 'ADMIN' })).status).toBe(400);
    expect((await post({ code: 'W1', name: '缺时间', category: 'WORK' })).status).toBe(400);
    expect((await post({ code: 'W2', name: '倒挂', category: 'WORK', startTime: '17:00', endTime: '08:00' })).status).toBe(400);
    expect((await post({ code: 'W3', name: '超24h', category: 'WORK', startTime: '08:00', endTime: '09:00', endsNextDay: true })).status).toBe(400);
    expect((await post({ code: 'W4', name: '休息过长', category: 'WORK', startTime: '08:00', endTime: '09:00', restMinutes: 60 })).status).toBe(400);
    const early = await post({ code: 'x1', name: '早班', category: 'WORK', startTime: '07:00', endTime: '15:00', department: 'ADMIN' });
    expect(early.status).toBe(201);
    expect(early.body.code).toBe('X1');
    expect((await shiftList()).some((s: { code: string }) => s.code === 'X1')).toBe(false); // 不会混进维护部门

    const patched = await call('PATCH', `/roster/shift-types/${shifts.M.id}`, { restMinutes: 60 }, token);
    expect(patched.body.restMinutes).toBe(60);
    expect((await call('PATCH', `/roster/shift-types/${shifts.M.id}`, { restMinutes: 600 }, token)).status).toBe(400);
  });

  it('排班人员: 录入信息、班组按部门隔离、停用/删除规则、登录账号关联', async () => {
    const group = await call('POST', '/roster/groups', { organizationId: org.id, name: '航材组' }, token);
    expect(group.status).toBe(201);
    expect((await call('POST', '/roster/groups', { organizationId: org.id, name: '航材组' }, token)).status).toBe(400);
    // 同名班组可以在另一个部门存在
    const adminGroup = await call('POST', '/roster/groups', { organizationId: org.id, department: 'ADMIN', name: '航材组' }, token);
    expect(adminGroup.status).toBe(201);
    expect((await call('GET', `/roster/groups?organizationId=${org.id}`, undefined, token)).body).toHaveLength(1);
    expect((await call('GET', `/roster/groups?organizationId=${org.id}&department=ADMIN`, undefined, token)).body).toHaveLength(1);

    const wang = await call(
      'POST',
      '/roster/staff',
      { organizationId: org.id, department: 'MAINTENANCE', name: '王明', employeeNo: 'M001', position: '维护工程师', phone: '13800001111', notes: '持证', groupId: group.body.id },
      token,
    );
    expect(wang.status).toBe(201);
    const driver = await createStaff(call, token, org.id, '司机老赵', { department: 'ADMIN', position: '司机', groupId: adminGroup.body.id });

    // 校验
    expect((await call('POST', '/roster/staff', { organizationId: org.id, department: 'MAINTENANCE', name: '   ' }, token)).status).toBe(400);
    expect((await call('POST', '/roster/staff', { organizationId: org.id, name: '缺部门' }, token)).status).toBe(400);
    expect((await call('POST', '/roster/staff', { organizationId: org.id, department: 'MAINTENANCE', name: '错班组', groupId: adminGroup.body.id }, token)).status).toBe(400); // 班组是行政部门的
    expect((await call('POST', '/roster/staff', { organizationId: org.id, department: 'MAINTENANCE', name: '错账号', userId: 'nope' }, token)).status).toBe(400);

    const mine = await call('GET', `/roster/staff?organizationId=${org.id}`, undefined, token);
    expect(mine.body).toEqual([expect.objectContaining({ id: wang.body.id, name: '王明', employeeNo: 'M001', position: '维护工程师', phone: '13800001111', groupName: '航材组', department: 'MAINTENANCE', isActive: true })]);
    const admin = await call('GET', `/roster/staff?organizationId=${org.id}&department=ADMIN`, undefined, token);
    expect(admin.body.map((s: { name: string }) => s.name)).toEqual(['司机老赵']);

    // 登录账号关联: 同一个账号只能关联一位, 取消后可再关联
    const email = `staff-${Date.now()}@example.com`;
    const user = await call('POST', '/users', { email, password: 'StaffPass12345', role: 'STAFF', permissions: [] }, token);
    expect(user.status).toBe(201);
    expect((await call('GET', '/roster/staff/user-options', undefined, token)).body.some((u: { id: string }) => u.id === user.body.id)).toBe(true);
    expect((await call('PATCH', `/roster/staff/${wang.body.id}`, { userId: user.body.id }, token)).status).toBe(200);
    expect((await call('PATCH', `/roster/staff/${driver.id}`, { userId: user.body.id }, token)).status).toBe(400); // 已关联别人
    expect((await call('GET', '/roster/staff/user-options', undefined, token)).body.some((u: { id: string }) => u.id === user.body.id)).toBe(false);
    expect((await call('GET', `/roster/staff?organizationId=${org.id}`, undefined, token)).body[0].userEmail).toBe(email);
    expect((await call('PATCH', `/roster/staff/${wang.body.id}`, { userId: null }, token)).status).toBe(200);

    // 修改、停用、删除
    expect((await call('PATCH', `/roster/staff/${driver.id}`, { position: '专职司机', phone: '13900002222', groupId: null }, token)).body).toMatchObject({ position: '专职司机', groupId: null });
    expect((await call('PATCH', `/roster/staff/${driver.id}`, { name: '' }, token)).status).toBe(400);
    const temp = await createStaff(call, token, org.id, '临时工', { department: 'ADMIN' });
    expect((await call('DELETE', `/roster/staff/${temp.id}`, undefined, token)).status).toBe(200); // 没有历史班次, 可删除
    await setCells([{ staffId: driver.id, date: '2026-09-01' }], adminShifts.Z.id);
    expect((await call('DELETE', `/roster/staff/${driver.id}`, undefined, token)).status).toBe(400); // 有历史班次, 只能停用
    expect((await call('PATCH', `/roster/staff/${driver.id}`, { isActive: false }, token)).status).toBe(200);
    expect((await call('GET', `/roster/staff?organizationId=${org.id}&department=ADMIN`, undefined, token)).body).toHaveLength(0); // 默认不含停用
    expect((await call('GET', `/roster/staff?organizationId=${org.id}&department=ADMIN&includeInactive=true`, undefined, token)).body).toHaveLength(1);
    expect((await setCells([{ staffId: driver.id, date: '2026-09-03' }], adminShifts.Z.id)).status).toBe(400); // 停用后不能再排班
    expect((await setCells([{ staffId: driver.id, date: '2026-09-01' }], null)).status).toBe(201); // 但可以清除历史

    // 删除班组: 人员保留, groupId 置空
    expect((await call('DELETE', `/roster/groups/${group.body.id}`, undefined, token)).status).toBe(200);
    expect((await call('GET', `/roster/staff?organizationId=${org.id}`, undefined, token)).body[0].groupId).toBeNull();

    const audit = await call('GET', `/audit-logs?entityType=StaffMember&entityId=${wang.body.id}`, undefined, token);
    expect(audit.body.map((a: { action: string }) => a.action).sort()).toEqual(['create', 'update', 'update']); // 创建 + 关联账号 + 取消关联 (删除班组只是把分组置空, 不写这个人的审计)
  });

  it('班表: 设置/清除、未变化不记历史、部门不能混排、修改历史按部门', async () => {
    const wang = await createStaff(call, token, org.id, '周工');
    const lisa = await createStaff(call, token, org.id, '前台小李', { department: 'ADMIN' });

    // 班次必须和人员同一个部门
    expect((await setCells([{ staffId: wang.id, date: '2026-10-01' }], adminShifts.Z.id)).status).toBe(400);
    expect((await setCells([{ staffId: lisa.id, date: '2026-10-01' }], shifts.M.id)).status).toBe(400);
    expect((await setCells([{ staffId: 'nope', date: '2026-10-01' }], shifts.M.id)).status).toBe(400);
    expect((await setCells([{ staffId: wang.id, date: '2026-02-30' }], shifts.M.id)).status).toBe(400);
    const otherOrg = await createOrg(call, token, 'Other Org');
    const foreigner = await createStaff(call, token, otherOrg.id, '外机构的人');
    expect((await setCells([{ staffId: foreigner.id, date: '2026-10-01' }], shifts.M.id)).status).toBe(400);

    const first = await setCells([{ staffId: wang.id, date: '2026-10-01' }, { staffId: wang.id, date: '2026-10-02' }], shifts.M.id);
    expect(first.body).toEqual({ requested: 2, changed: 2, unchanged: 0 });
    expect((await setCells([{ staffId: wang.id, date: '2026-10-01' }], shifts.M.id)).body.changed).toBe(0);
    expect((await setCells([{ staffId: wang.id, date: '2026-10-01' }], shifts.E.id)).body.changed).toBe(1);
    expect((await setCells([{ staffId: wang.id, date: '2026-10-02' }], null)).body.changed).toBe(1);
    expect((await setCells([{ staffId: lisa.id, date: '2026-10-05' }], adminShifts.Z.id)).body.changed).toBe(1);

    // 班表按部门
    const maintenance = await call('GET', `/roster/entries?organizationId=${org.id}&month=2026-10`, undefined, token);
    expect(maintenance.body).toEqual([{ staffId: wang.id, date: '2026-10-01', shiftTypeId: shifts.E.id }]);
    const admin = await call('GET', `/roster/entries?organizationId=${org.id}&month=2026-10&department=ADMIN`, undefined, token);
    expect(admin.body).toEqual([{ staffId: lisa.id, date: '2026-10-05', shiftTypeId: adminShifts.Z.id }]);
    expect((await call('GET', `/roster/entries?organizationId=${org.id}&month=2026-13`, undefined, token)).status).toBe(400);

    // 修改历史按部门
    const history = await call('GET', `/roster/history?organizationId=${org.id}&staffId=${wang.id}`, undefined, token);
    const trail = history.body.map((h: { date: string; before: string | null; after: string | null }) => `${h.date}:${h.before ?? '-'}>${h.after ?? '-'}`).sort();
    expect(trail).toEqual(['2026-10-01:->M', '2026-10-01:M>E', '2026-10-02:->M', '2026-10-02:M>-'].sort());
    expect(history.body[0].by).toContain('@');
    expect(history.body[0].name).toBe('周工');
    const adminHistory = await call('GET', `/roster/history?organizationId=${org.id}&department=ADMIN`, undefined, token);
    expect(adminHistory.body.some((h: { name: string }) => h.name === '前台小李')).toBe(true);
    expect(adminHistory.body.some((h: { name: string }) => h.name === '周工')).toBe(false);
  });

  it('工时统计: 扣休息、跨日拆分(落入周期的部分)、休假天数; 行政综合同样按自己的班次统计', async () => {
    const p = await createStaff(call, token, org.id, '张强');
    await setCells([{ staffId: p.id, date: '2026-09-01' }], shifts.M.id); // 8.5h - 1h 休息 = 7.5h (上面把 M 的休息改成了 60 分钟)
    await setCells([{ staffId: p.id, date: '2026-09-02' }], shifts.E.id); // 17:00→次日08:30 = 15.5h
    await setCells([{ staffId: p.id, date: '2026-09-30' }], shifts.D.id); // 9/30 08:30→24:00 在周期内 = 15.5h, 其余落在 10/1
    await setCells([{ staffId: p.id, date: '2026-08-31' }], shifts.E.id); // 8/31 17:00→9/1 08:30, 落在 9 月的 00:00-08:30 = 8.5h
    await setCells([{ staffId: p.id, date: '2026-09-05' }], shifts.S.id);

    const res = await call('GET', `/roster/hours?organizationId=${org.id}&from=2026-09-01&to=2026-09-30`, undefined, token);
    expect(res.status).toBe(200);
    const row = res.body.rows.find((r: { staffId: string }) => r.staffId === p.id);
    expect(row.totalHours).toBe(47); // 7.5 + 15.5 + 15.5 + 8.5
    expect(row.workDays).toBe(3); // 8/31 的晚班不在周期内, 不算出勤天数
    expect(row.byShift.M).toEqual({ days: 1, hours: 7.5 });
    expect(row.byShift.E).toEqual({ days: 1, hours: 24 }); // 15.5 + 8.5
    expect(row.byShift.D).toEqual({ days: 1, hours: 15.5 });
    expect(row.byShift.S).toEqual({ days: 1, hours: 0 });

    // 行政综合: 正常班 09:00-18:00 扣 60 分钟 = 8h
    const clerk = await createStaff(call, token, org.id, '行政小王', { department: 'ADMIN', position: '行政' });
    await setCells([{ staffId: clerk.id, date: '2026-09-07' }, { staffId: clerk.id, date: '2026-09-08' }], adminShifts.Z.id);
    const adminHours = await call('GET', `/roster/hours?organizationId=${org.id}&department=ADMIN&from=2026-09-01&to=2026-09-30`, undefined, token);
    const clerkRow = adminHours.body.rows.find((r: { staffId: string }) => r.staffId === clerk.id);
    expect(clerkRow).toMatchObject({ totalHours: 16, workDays: 2, position: '行政' });
    expect(clerkRow.byShift.Z).toEqual({ days: 2, hours: 16 });
    expect(adminHours.body.rows.some((r: { staffId: string }) => r.staffId === p.id)).toBe(false);

    // 停用的人员只要周期内有历史班次就仍然统计
    await call('PATCH', `/roster/staff/${clerk.id}`, { isActive: false }, token);
    const after = await call('GET', `/roster/hours?organizationId=${org.id}&department=ADMIN&from=2026-09-01&to=2026-09-30`, undefined, token);
    expect(after.body.rows.find((r: { staffId: string }) => r.staffId === clerk.id)).toMatchObject({ isActive: false, totalHours: 16 });

    expect((await call('GET', `/roster/hours?organizationId=${org.id}&from=2026-09-30&to=2026-09-01`, undefined, token)).status).toBe(400);
    expect((await call('GET', `/roster/hours?organizationId=${org.id}&from=2025-01-01&to=2026-12-31`, undefined, token)).status).toBe(400);
  });

  it('导出、我的排班、跨租户与权限', async () => {
    const { default: request } = await import('supertest');
    for (const path of [
      `/roster/export?organizationId=${org.id}&month=2026-09`,
      `/roster/export?organizationId=${org.id}&month=2026-09&department=ADMIN`,
      `/roster/hours/export?organizationId=${org.id}&from=2026-09-01&to=2026-09-30`,
    ]) {
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

    // 我的排班: 登录账号关联了排班人员就能看到自己今天起的班次 (行政综合的人也一样)
    const email = `staff-${Date.now()}@example.com`;
    const user = await call('POST', '/users', { email, password: 'StaffPass12345', role: 'STAFF', permissions: [] }, token);
    const me = await createStaff(call, token, org.id, '本人', { department: 'ADMIN', userId: user.body.id });
    const staffToken = (await call('POST', '/auth/login', { email, password: 'StaffPass12345' })).body.accessToken;

    expect((await call('GET', '/roster/my', undefined, token)).body).toEqual({ linked: false, days: [] }); // OWNER 没有关联排班人员
    const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 32 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await setCells([{ staffId: me.id, date: today }, { staffId: me.id, date: tomorrow }, { staffId: me.id, date: yesterday }], adminShifts.Z.id);
    const mine = await call('GET', '/roster/my?days=15', undefined, staffToken);
    expect(mine.status).toBe(200);
    expect(mine.body.linked).toBe(true);
    expect(mine.body.days.map((d: { date: string }) => d.date)).toEqual([today, tomorrow]); // 昨天不显示
    expect(mine.body.days[0].shift.code).toBe('Z');

    // 没有 SCHEDULING 权限的 STAFF 不能看班表, 但能看自己的排班
    expect((await call('GET', `/roster/shift-types?organizationId=${org.id}`, undefined, staffToken)).status).toBe(403);
    expect((await call('GET', `/roster/staff?organizationId=${org.id}`, undefined, staffToken)).status).toBe(403);

    const other = await registerTenant(call);
    expect((await call('GET', `/roster/shift-types?organizationId=${org.id}`, undefined, other.token)).status).toBe(403);
    expect((await call('GET', `/roster/staff?organizationId=${org.id}`, undefined, other.token)).status).toBe(403);
    expect((await call('PATCH', `/roster/shift-types/${shifts.M.id}`, { name: 'x' }, other.token)).status).toBe(404);
    expect((await call('PATCH', `/roster/staff/${me.id}`, { name: 'x' }, other.token)).status).toBe(404);
    expect((await call('POST', '/roster/staff', { organizationId: org.id, department: 'ADMIN', name: '越权' }, other.token)).status).toBe(403);
  });
});
