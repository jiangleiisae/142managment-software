import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiCall, apiFor, createOrg, createPersonnel, createTestApp, registerTenant } from './helpers.js';

/// 人员班表 (R2): 默认班次、班组与人员、班表设置与修改历史、工时统计、我的排班、权限。
describe('roster', () => {
  let app: INestApplication;
  let call: ApiCall;
  let token: string;
  let org: { id: string };
  let shifts: Record<string, { id: string; code: string }>;

  const setCells = (cells: { personnelId: string; date: string }[], shiftTypeId: string | null, t = token) =>
    call('POST', '/roster/entries', { organizationId: org.id, cells, shiftTypeId }, t);

  beforeAll(async () => {
    app = await createTestApp();
    call = apiFor(app);
    ({ token } = await registerTenant(call));
    org = await createOrg(call, token);
    const list = await call('GET', `/roster/shift-types?organizationId=${org.id}`, undefined, token);
    shifts = Object.fromEntries(list.body.map((s: { code: string }) => [s.code, s]));
  });

  afterAll(async () => {
    await app.close();
  });

  it('新机构自动得到 M/E/D/B/S/V/Q/A 默认班次; 班次校验与修改', async () => {
    expect(Object.keys(shifts).sort()).toEqual(['A', 'B', 'D', 'E', 'M', 'Q', 'S', 'V']);
    expect(shifts.M).toMatchObject({ category: 'WORK', startTime: '08:30', endTime: '17:00', endsNextDay: false });
    expect(shifts.E).toMatchObject({ startTime: '17:00', endTime: '08:30', endsNextDay: true });
    expect(shifts.D).toMatchObject({ startTime: '08:30', endTime: '08:30', endsNextDay: true });
    expect(shifts.S.category).toBe('SICK_LEAVE');
    expect(shifts.V.category).toBe('COMPENSATORY_LEAVE');

    const post = (body: Record<string, unknown>) => call('POST', '/roster/shift-types', { organizationId: org.id, color: '#112233', ...body }, token);
    expect((await post({ code: 'M', name: '重复', category: 'OTHER' })).status).toBe(400); // 代码重复
    expect((await post({ code: 'W1', name: '缺时间', category: 'WORK' })).status).toBe(400);
    expect((await post({ code: 'W2', name: '倒挂', category: 'WORK', startTime: '17:00', endTime: '08:00' })).status).toBe(400); // 未勾选次日
    expect((await post({ code: 'W3', name: '超24h', category: 'WORK', startTime: '08:00', endTime: '09:00', endsNextDay: true })).status).toBe(400);
    expect((await post({ code: 'W4', name: '休息过长', category: 'WORK', startTime: '08:00', endTime: '09:00', restMinutes: 60 })).status).toBe(400);
    const ok = await post({ code: 'x1', name: '夜间值守', category: 'WORK', startTime: '20:00', endTime: '06:00', endsNextDay: true });
    expect(ok.status).toBe(201);
    expect(ok.body.code).toBe('X1');

    const patched = await call('PATCH', `/roster/shift-types/${shifts.M.id}`, { restMinutes: 60 }, token);
    expect(patched.status).toBe(200);
    expect(patched.body.restMinutes).toBe(60);
    expect((await call('PATCH', `/roster/shift-types/${shifts.M.id}`, { restMinutes: 600 }, token)).status).toBe(400); // 休息 ≥ 班次时长
  });

  it('班组与人员; 班表设置、未变化不记历史、修改历史、非成员/非法日期被拒', async () => {
    const wang = await createPersonnel(call, token, { firstName: '明', lastName: '王' });
    const li = await createPersonnel(call, token, { firstName: '华', lastName: '李' });

    const group = await call('POST', '/roster/groups', { organizationId: org.id, name: '航材组' }, token);
    expect(group.status).toBe(201);
    expect((await call('POST', '/roster/groups', { organizationId: org.id, name: '航材组' }, token)).status).toBe(400);

    const add = await call('POST', '/roster/members', { organizationId: org.id, personnelIds: [wang.id], groupId: group.body.id }, token);
    expect(add.body).toEqual({ requested: 1, added: 1 });
    expect((await call('POST', '/roster/members', { organizationId: org.id, personnelIds: [wang.id] }, token)).body.added).toBe(0); // 幂等
    const members = await call('GET', `/roster/members?organizationId=${org.id}`, undefined, token);
    expect(members.body).toHaveLength(1);
    expect(members.body[0]).toMatchObject({ name: '王明', groupName: '航材组' });

    // 非成员、不存在的人员、非法日期
    expect((await setCells([{ personnelId: li.id, date: '2026-09-01' }], shifts.M.id)).status).toBe(400);
    expect((await call('POST', '/roster/members', { organizationId: org.id, personnelIds: ['nope'] }, token)).status).toBe(400);
    expect((await setCells([{ personnelId: wang.id, date: '2026-02-30' }], shifts.M.id)).status).toBe(400);

    const first = await setCells([{ personnelId: wang.id, date: '2026-09-01' }, { personnelId: wang.id, date: '2026-09-02' }], shifts.M.id);
    expect(first.body).toEqual({ requested: 2, changed: 2, unchanged: 0 });
    expect((await setCells([{ personnelId: wang.id, date: '2026-09-01' }], shifts.M.id)).body.changed).toBe(0); // 未变化
    expect((await setCells([{ personnelId: wang.id, date: '2026-09-01' }], shifts.E.id)).body.changed).toBe(1);
    expect((await setCells([{ personnelId: wang.id, date: '2026-09-02' }], null)).body.changed).toBe(1); // 清除

    const entries = await call('GET', `/roster/entries?organizationId=${org.id}&month=2026-09`, undefined, token);
    expect(entries.body).toEqual([{ personnelId: wang.id, date: '2026-09-01', shiftTypeId: shifts.E.id }]);
    expect((await call('GET', `/roster/entries?organizationId=${org.id}&month=2026-13`, undefined, token)).status).toBe(400);

    const history = await call('GET', `/roster/history?organizationId=${org.id}&personnelId=${wang.id}`, undefined, token);
    expect(history.status).toBe(200);
    const trail = history.body.map((h: { date: string; before: string | null; after: string | null }) => `${h.date}:${h.before ?? '-'}>${h.after ?? '-'}`).sort();
    expect(trail).toEqual(['2026-09-01:->M', '2026-09-01:M>E', '2026-09-02:->M', '2026-09-02:M>-'].sort());
    expect(history.body[0].by).toContain('@');
    expect(history.body[0].name).toBe('王明');

    // 删除班组: 成员保留, groupId 置空
    expect((await call('DELETE', `/roster/groups/${group.body.id}`, undefined, token)).status).toBe(200);
    const after = await call('GET', `/roster/members?organizationId=${org.id}`, undefined, token);
    expect(after.body[0].groupId).toBeNull();
  });

  it('工时统计: 扣休息、跨日拆分(落入周期的部分)、休假天数', async () => {
    const p = await createPersonnel(call, token, { firstName: '强', lastName: '张' });
    await call('POST', '/roster/members', { organizationId: org.id, personnelIds: [p.id] }, token);
    await setCells([{ personnelId: p.id, date: '2026-09-01' }], shifts.M.id); // 8.5h - 1h 休息 = 7.5h
    await setCells([{ personnelId: p.id, date: '2026-09-02' }], shifts.E.id); // 17:00→次日08:30 = 15.5h
    await setCells([{ personnelId: p.id, date: '2026-09-30' }], shifts.D.id); // 9/30 08:30→24:00 在周期内 = 15.5h, 其余落在 10/1
    await setCells([{ personnelId: p.id, date: '2026-08-31' }], shifts.E.id); // 8/31 17:00→9/1 08:30, 落在 9 月的 00:00-08:30 = 8.5h
    await setCells([{ personnelId: p.id, date: '2026-09-05' }], shifts.S.id);

    const res = await call('GET', `/roster/hours?organizationId=${org.id}&from=2026-09-01&to=2026-09-30`, undefined, token);
    expect(res.status).toBe(200);
    const row = res.body.rows.find((r: { personnelId: string }) => r.personnelId === p.id);
    expect(row.totalHours).toBe(47); // 7.5 + 15.5 + 15.5 + 8.5
    expect(row.workDays).toBe(3); // 8/31 的晚班不在周期内, 不算出勤天数
    expect(row.byShift.M).toEqual({ days: 1, hours: 7.5 });
    expect(row.byShift.E).toEqual({ days: 1, hours: 24 }); // 15.5 + 8.5
    expect(row.byShift.D).toEqual({ days: 1, hours: 15.5 });
    expect(row.byShift.S).toEqual({ days: 1, hours: 0 });

    expect((await call('GET', `/roster/hours?organizationId=${org.id}&from=2026-09-30&to=2026-09-01`, undefined, token)).status).toBe(400);
    expect((await call('GET', `/roster/hours?organizationId=${org.id}&from=2025-01-01&to=2026-12-31`, undefined, token)).status).toBe(400);
  });

  it('导出、我的排班、跨租户与权限', async () => {
    const { default: request } = await import('supertest');
    for (const path of [`/roster/export?organizationId=${org.id}&month=2026-09`, `/roster/hours/export?organizationId=${org.id}&from=2026-09-01&to=2026-09-30`]) {
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

    // 我的排班: 关联了人员档案的账号能看到自己今天起的班次
    const me = await createPersonnel(call, token, { firstName: '我', lastName: '本' });
    await call('POST', '/roster/members', { organizationId: org.id, personnelIds: [me.id] }, token);
    const email = `staff-${Date.now()}@example.com`;
    const user = await call('POST', '/users', { email, password: 'StaffPass12345', role: 'STAFF', permissions: [] }, token);
    expect((await call('POST', `/users/${user.body.id}/link-personnel`, { personnelId: me.id }, token)).status).toBe(201);
    const staffToken = (await call('POST', '/auth/login', { email, password: 'StaffPass12345' })).body.accessToken;

    const unlinked = await call('GET', '/roster/my', undefined, token); // OWNER 没有关联人员档案
    expect(unlinked.body).toEqual({ linked: false, days: [] });

    const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 32 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await setCells([{ personnelId: me.id, date: today }, { personnelId: me.id, date: tomorrow }, { personnelId: me.id, date: yesterday }], shifts.M.id);
    const mine = await call('GET', '/roster/my?days=15', undefined, staffToken);
    expect(mine.status).toBe(200);
    expect(mine.body.linked).toBe(true);
    expect(mine.body.days.map((d: { date: string }) => d.date)).toEqual([today, tomorrow]); // 昨天不显示
    expect(mine.body.days[0].shift.code).toBe('M');

    // 没有 SCHEDULING 权限的 STAFF 不能看班表, 但能看自己的排班
    expect((await call('GET', `/roster/shift-types?organizationId=${org.id}`, undefined, staffToken)).status).toBe(403);

    const other = await registerTenant(call);
    expect((await call('GET', `/roster/shift-types?organizationId=${org.id}`, undefined, other.token)).status).toBe(403);
    expect((await call('PATCH', `/roster/shift-types/${shifts.M.id}`, { name: 'x' }, other.token)).status).toBe(404);
  });
});
