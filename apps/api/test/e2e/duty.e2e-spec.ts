import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { ApiCall, apiFor, createFstd, createOrg, createStaff, createTestApp, registerTenant } from './helpers.js';

/// 值班日志与交接班 (R4a): 用 2026-09 的固定日期, 与运行日期无关。北京时间 = UTC+8。
describe('duty logs and handovers', () => {
  let app: INestApplication;
  let call: ApiCall;
  let prisma: PrismaService;
  let token: string;
  let org: { id: string };
  let shifts: Record<string, { id: string }>;
  let wang: { id: string };
  let fstd: { id: string; deviceCode: string };

  const createLog = (date: string, code: string, extra: Record<string, unknown> = {}, t = token) =>
    call('POST', '/duty-logs', { organizationId: org.id, date, shiftTypeId: shifts[code].id, ...extra }, t);
  const addEntry = (id: string, body: Record<string, unknown>) => call('POST', `/duty-logs/${id}/entries`, body, token);
  const addHandover = (id: string, body: Record<string, unknown>) => call('POST', `/duty-logs/${id}/handovers`, body, token);
  const detail = async (id: string) => (await call('GET', `/duty-logs/${id}`, undefined, token)).body;
  /// 北京时间 date hh:mm 对应的 Date
  const cn = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+08:00`);

  beforeAll(async () => {
    app = await createTestApp();
    call = apiFor(app);
    prisma = app.get(PrismaService);
    ({ token } = await registerTenant(call));
    org = await createOrg(call, token);
    const list = await call('GET', `/roster/shift-types?organizationId=${org.id}`, undefined, token);
    shifts = Object.fromEntries(list.body.map((s: { code: string; id: string }) => [s.code, s]));
    wang = await createStaff(call, token, org.id, '王明');
    await call('POST', '/roster/entries', { organizationId: org.id, cells: [{ staffId: wang.id, date: '2026-09-10' }], shiftTypeId: shifts.M.id }, token);
    fstd = await createFstd(call, token, org.id);
  });

  afterAll(async () => {
    await app.close();
  });

  it('创建: 工程师按班表预填; 重复、非工作班次、非法班次被拒', async () => {
    const m = await createLog('2026-09-10', 'M');
    expect(m.status).toBe(201);
    expect(m.body.engineerIds).toEqual([wang.id]);
    expect((await createLog('2026-09-10', 'M')).status).toBe(400); // 同日同班次
    expect((await createLog('2026-09-10', 'S')).status).toBe(400); // 病假不是工作班次
    expect((await createLog('2026-09-10', 'M', { groupId: 'nope' })).status).toBe(400);
    const e = await createLog('2026-09-10', 'E');
    expect(e.status).toBe(201);
    expect(e.body.engineerIds).toEqual([]); // 班表里没人排 E
    expect((await createLog('2026-02-30', 'M')).status).toBe(400);

    const other = await registerTenant(call);
    expect((await call('GET', `/duty-logs/${m.body.id}`, undefined, other.token)).status).toBe(404);
  });

  it('本班内容、DR 记录(提交时固化)、提交后锁定与撤回', async () => {
    const log = (await createLog('2026-09-11', 'M')).body;
    await call('PATCH', `/duty-logs/${log.id}`, { engineerIds: [wang.id] }, token);

    // 本班 08:30-17:00 (北京时间): 9:00 报告, 15:00 关闭 → 两条 DR 操作; 18:00 的报告在班外
    const inShift = await prisma.discrepancyLog.create({ data: { fstdId: fstd.id, description: '视景闪烁', reportedAt: cn('2026-09-11', '09:00'), correctedAt: cn('2026-09-11', '15:00'), correctiveAction: '更换视景卡', status: 'corrected' } });
    await prisma.discrepancyLog.create({ data: { fstdId: fstd.id, description: '班外故障', reportedAt: cn('2026-09-11', '18:00') } });

    const bad = await addEntry(log.id, { kind: 'ROUTINE', content: 'x', fstdId: 'not-mine' });
    expect(bad.status).toBe(400);
    expect((await addEntry(log.id, { kind: 'ROUTINE', content: '日常巡检', fstdId: fstd.id })).status).toBe(201);
    const nonRoutine = await addEntry(log.id, { kind: 'NON_ROUTINE', content: '配合监管检查' });
    expect(nonRoutine.status).toBe(201);
    expect((await call('PATCH', `/duty-entries/${nonRoutine.body.id}`, { content: '配合局方检查' }, token)).body.content).toBe('配合局方检查');

    const before = await detail(log.id);
    expect(before.drIsSnapshot).toBe(false);
    expect(before.drRecords.map((r: { action: string }) => r.action)).toEqual(['REPORTED', 'CORRECTED']);
    expect(before.drRecords[0]).toMatchObject({ discrepancyId: inShift.id, deviceCode: fstd.deviceCode });

    expect((await call('POST', `/duty-logs/${log.id}/submit`, undefined, token)).status).toBe(201);
    // 提交后新增的班内故障不改变已固化的记录
    await prisma.discrepancyLog.create({ data: { fstdId: fstd.id, description: '提交后补报', reportedAt: cn('2026-09-11', '10:00') } });
    const after = await detail(log.id);
    expect(after.drIsSnapshot).toBe(true);
    expect(after.drRecords).toHaveLength(2);

    // 锁定
    expect((await addEntry(log.id, { kind: 'ROUTINE', content: '晚了' })).status).toBe(400);
    expect((await call('PATCH', `/duty-entries/${nonRoutine.body.id}`, { content: '改' }, token)).status).toBe(400);
    expect((await call('DELETE', `/duty-logs/${log.id}`, undefined, token)).status).toBe(400);
    expect((await call('PATCH', `/duty-logs/${log.id}`, { engineerIds: [] }, token)).status).toBe(400);

    // 撤回后可改, 且快照清除、重新实时计算(现在含提交后补报)
    expect((await call('POST', `/duty-logs/${log.id}/reopen`, undefined, token)).status).toBe(201);
    const reopened = await detail(log.id);
    expect(reopened.status).toBe('DRAFT');
    expect(reopened.drRecords).toHaveLength(3);
    expect((await addEntry(log.id, { kind: 'ROUTINE', content: '补记' })).status).toBe(201);
  });

  it('提交要求有值班工程师; 删除草稿', async () => {
    const log = (await createLog('2026-09-12', 'M')).body; // 班表里没排人
    expect((await call('POST', `/duty-logs/${log.id}/submit`, undefined, token)).status).toBe(400);
    expect((await call('DELETE', `/duty-logs/${log.id}`, undefined, token)).status).toBe(200);
    expect((await call('GET', `/duty-logs/${log.id}`, undefined, token)).status).toBe(404);
  });

  it('交接: 默认转下一班次, 未完成事项逐班结转, 处理后不再出现, 草稿不外泄', async () => {
    const eng = { engineerIds: [wang.id] };
    const m = (await createLog('2026-09-20', 'M')).body;
    await call('PATCH', `/duty-logs/${m.id}`, eng, token);
    const h1 = await addHandover(m.id, { content: '视景待观察', fstdId: fstd.id });
    const h2 = await addHandover(m.id, { content: '备件待到货' });
    expect(h1.status).toBe(201);
    const mDetail = await detail(m.id);
    expect(mDetail.nextSuggestion).toMatchObject({ date: '2026-09-20', shiftCode: 'E' });
    expect(mDetail.outgoing.map((h: { toDate: string; toShiftCode: string }) => `${h.toDate} ${h.toShiftCode}`)).toEqual(['2026-09-20 E', '2026-09-20 E']);

    // 目标校验: 不能早于本班结束; 要么都给要么都不给; 非工作班次不行
    expect((await addHandover(m.id, { content: 'x', toDate: '2026-09-20', toShiftTypeId: shifts.M.id })).status).toBe(400);
    expect((await addHandover(m.id, { content: 'x', toDate: '2026-09-20' })).status).toBe(400);
    expect((await addHandover(m.id, { content: 'x', toDate: '2026-09-21', toShiftTypeId: shifts.S.id })).status).toBe(400);

    const e = (await createLog('2026-09-20', 'E')).body;
    await call('PATCH', `/duty-logs/${e.id}`, eng, token);
    // M 还是草稿: E 看不到
    expect((await detail(e.id)).incoming).toHaveLength(0);

    expect((await call('POST', `/duty-logs/${m.id}/submit`, undefined, token)).status).toBe(201);
    const eIn = (await detail(e.id)).incoming;
    expect(eIn.map((h: { content: string }) => h.content).sort()).toEqual(['备件待到货', '视景待观察']);
    expect(eIn[0]).toMatchObject({ fromDate: '2026-09-20', fromShiftCode: 'M' });

    // E 处理掉一条, 并给下一班(次日 M)留一条
    expect((await call('POST', `/duty-handovers/${h1.body.id}/complete`, { completedInLogId: e.id }, token)).status).toBe(201);
    const eh = await addHandover(e.id, { content: '夜间新增遗留' });
    expect(eh.status).toBe(201);
    expect((await detail(e.id)).nextSuggestion).toMatchObject({ date: '2026-09-21', shiftCode: 'M' });
    expect((await call('POST', `/duty-logs/${e.id}/submit`, undefined, token)).status).toBe(201);

    // E 本班里仍能看到被自己处理的那条(标记为本班处理), 还有没处理的
    const eAfter = (await detail(e.id)).incoming;
    expect(eAfter.find((h: { id: string }) => h.id === h1.body.id)).toMatchObject({ completedInThisLog: true });

    // 次日 M: 看到 E 交来的 + 之前没人处理的备件事项(结转), 看不到已处理的视景事项
    const m2 = (await createLog('2026-09-21', 'M')).body;
    await call('PATCH', `/duty-logs/${m2.id}`, eng, token);
    const m2In = (await detail(m2.id)).incoming.map((h: { content: string }) => h.content).sort();
    expect(m2In).toEqual(['备件待到货', '夜间新增遗留']);

    // 已有被处理事项的日志不能撤回
    expect((await call('POST', `/duty-logs/${m.id}/reopen`, undefined, token)).status).toBe(400);
    // 取消处理后恢复结转
    expect((await call('POST', `/duty-handovers/${h1.body.id}/reopen`, undefined, token)).status).toBe(201);
    expect((await detail(m2.id)).incoming).toHaveLength(3);

    // 交接班查询
    const open = await call('GET', `/duty-handovers?organizationId=${org.id}&status=open&from=2026-09-20&to=2026-09-20`, undefined, token);
    expect(open.body.map((h: { content: string }) => h.content).sort()).toEqual(['备件待到货', '夜间新增遗留', '视景待观察']); // 9/20 两份日志交出的未完成事项
    const done = await call('GET', `/duty-handovers?organizationId=${org.id}&status=completed`, undefined, token);
    expect(done.body).toHaveLength(0);
    const kw = await call('GET', `/duty-handovers?organizationId=${org.id}&keyword=${encodeURIComponent('夜间')}`, undefined, token);
    expect(kw.body).toHaveLength(1);
    expect((await call('GET', `/duty-handovers?organizationId=${org.id}&status=weird`, undefined, token)).status).toBe(400);
    expect(h2.status).toBe(201);
  });

  it('列表筛选、导出、权限', async () => {
    const all = await call('GET', `/duty-logs?organizationId=${org.id}`, undefined, token);
    expect(all.status).toBe(200);
    expect(all.body.length).toBeGreaterThanOrEqual(5);
    expect(all.body[0].date >= all.body[all.body.length - 1].date).toBe(true); // 日期倒序

    const sep20 = await call('GET', `/duty-logs?organizationId=${org.id}&from=2026-09-20&to=2026-09-20`, undefined, token);
    expect(sep20.body.map((l: { shiftCode: string }) => l.shiftCode).sort()).toEqual(['E', 'M']);
    const submitted = await call('GET', `/duty-logs?organizationId=${org.id}&status=SUBMITTED&from=2026-09-20&to=2026-09-21`, undefined, token);
    expect(submitted.body.every((l: { status: string }) => l.status === 'SUBMITTED')).toBe(true);
    expect((await call('GET', `/duty-logs?organizationId=${org.id}&status=bad`, undefined, token)).status).toBe(400);

    const byEngineer = await call('GET', `/duty-logs?organizationId=${org.id}&engineerId=${wang.id}&from=2026-09-20&to=2026-09-20`, undefined, token);
    expect(byEngineer.body).toHaveLength(2);
    const byFstd = await call('GET', `/duty-logs?organizationId=${org.id}&fstdId=${fstd.id}`, undefined, token);
    expect(byFstd.body.map((l: { date: string }) => l.date).sort()).toEqual(['2026-09-11', '2026-09-20']); // 日常巡检(9/11) + 视景待观察交接(9/20)
    const byKeyword = await call('GET', `/duty-logs?organizationId=${org.id}&keyword=${encodeURIComponent('局方')}`, undefined, token);
    expect(byKeyword.body).toHaveLength(1);

    const { default: request } = await import('supertest');
    const res = await request(app.getHttpServer())
      .get(`/duty-logs/export?organizationId=${org.id}&from=2026-09-01&to=2026-09-30`)
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

    const email = `staff-${Date.now()}@example.com`;
    expect((await call('POST', '/users', { email, password: 'StaffPass12345', role: 'STAFF', permissions: ['FSTD'] }, token)).status).toBe(201);
    const staffToken = (await call('POST', '/auth/login', { email, password: 'StaffPass12345' })).body.accessToken;
    expect((await call('GET', `/duty-logs?organizationId=${org.id}`, undefined, staffToken)).status).toBe(403);
    const other = await registerTenant(call);
    expect((await call('GET', `/duty-logs?organizationId=${org.id}`, undefined, other.token)).status).toBe(403);
  });
});
