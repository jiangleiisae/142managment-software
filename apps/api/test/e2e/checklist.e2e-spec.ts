import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiCall, apiFor, createFstd, createOrg, createStaff, createTestApp, registerTenant } from './helpers.js';

/// 设备级检查单 (R4b): 模板、"今天应做"推算(班表+开关+停飞+模板)、执行记录。日期都相对北京时间的今天。
const DAY = 24 * 60 * 60 * 1000;
const cnDate = (offsetDays: number) => new Date(Date.now() + 8 * 60 * 60 * 1000 + offsetDays * DAY).toISOString().slice(0, 10);

describe('device checklists', () => {
  let app: INestApplication;
  let call: ApiCall;
  let token: string;
  let org: { id: string };
  let shifts: Record<string, { id: string }>;
  let wang: { id: string };
  let devA: { id: string; deviceCode: string };
  let devB: { id: string; deviceCode: string };
  let devC: { id: string; deviceCode: string };

  const items = [
    { no: '1', text: '外观检查' },
    { no: '2', text: '通电检查', sopUrl: 'https://example.com/sop/2' },
  ];
  const putTemplate = (fstdId: string, type: string, body: unknown = items, t = token) =>
    call('PUT', '/checklists/templates', { organizationId: org.id, fstdId, type, items: body }, t);
  const expected = async (date: string, type?: string) => (await call('GET', `/checklists/expected?organizationId=${org.id}&date=${date}${type ? `&type=${type}` : ''}`, undefined, token)).body;
  const record = (extra: Record<string, unknown>) =>
    call('POST', '/checklists/records', { organizationId: org.id, fstdId: devA.id, type: 'PRE_FLIGHT', date: cnDate(-3), shiftTypeId: shifts.M.id, results: [{ no: '1', passed: true }, { no: '2', passed: true }], ...extra }, token);
  const roster = (date: string, code: string) =>
    call('POST', '/roster/entries', { organizationId: org.id, cells: [{ staffId: wang.id, date }], shiftTypeId: shifts[code].id }, token);

  beforeAll(async () => {
    app = await createTestApp();
    call = apiFor(app);
    ({ token } = await registerTenant(call));
    org = await createOrg(call, token);
    const list = await call('GET', `/roster/shift-types?organizationId=${org.id}`, undefined, token);
    shifts = Object.fromEntries(list.body.map((s: { code: string; id: string }) => [s.code, s]));
    wang = await createStaff(call, token, org.id, '王明');
    devA = await createFstd(call, token, org.id);
    devB = await createFstd(call, token, org.id);
    devC = await createFstd(call, token, org.id);
  });

  afterAll(async () => {
    await app.close();
  });

  it('模板: 校验、保存、列表、克隆(默认跳过已有, overwrite 才覆盖)', async () => {
    expect((await putTemplate(devA.id, 'PRE_FLIGHT', [{ no: '1', text: 'a' }, { no: '1', text: 'b' }])).status).toBe(400); // 编号重复
    expect((await putTemplate(devA.id, 'PRE_FLIGHT', [{ no: '1', text: '  ' }])).status).toBe(400);
    expect((await putTemplate(devA.id, 'PRE_FLIGHT', [{ no: '1', text: 'a', sopUrl: 'javascript:alert(1)' }])).status).toBe(400);
    expect((await putTemplate(devA.id, 'PRE_FLIGHT', [])).status).toBe(400);
    expect((await putTemplate(devA.id, 'PATROL')).status).toBe(400);

    expect((await putTemplate(devA.id, 'PRE_FLIGHT')).status).toBe(200);
    expect((await putTemplate(devA.id, 'POST_FLIGHT', [{ no: '1', text: '断电' }])).status).toBe(200);
    const list = await call('GET', `/checklists/templates?organizationId=${org.id}&fstdId=${devA.id}`, undefined, token);
    expect(list.body.map((t: { type: string }) => t.type).sort()).toEqual(['POST_FLIGHT', 'PRE_FLIGHT']);
    expect(list.body.find((t: { type: string }) => t.type === 'PRE_FLIGHT').items[1].sopUrl).toBe('https://example.com/sop/2');

    const clone = await call('POST', '/checklists/templates/clone', { organizationId: org.id, fromFstdId: devA.id, toFstdIds: [devC.id] }, token);
    expect(clone.body).toEqual({ created: 2, overwritten: 0, skipped: 0 });
    await putTemplate(devA.id, 'POST_FLIGHT', [{ no: '1', text: '断电' }, { no: '2', text: '锁门' }]);
    const again = await call('POST', '/checklists/templates/clone', { organizationId: org.id, fromFstdId: devA.id, toFstdIds: [devC.id] }, token);
    expect(again.body).toEqual({ created: 0, overwritten: 0, skipped: 2 });
    const over = await call('POST', '/checklists/templates/clone', { organizationId: org.id, fromFstdId: devA.id, toFstdIds: [devC.id], types: ['POST_FLIGHT'], overwrite: true }, token);
    expect(over.body).toEqual({ created: 0, overwritten: 1, skipped: 0 });
    const cList = await call('GET', `/checklists/templates?organizationId=${org.id}&fstdId=${devC.id}`, undefined, token);
    expect(cList.body.find((t: { type: string }) => t.type === 'POST_FLIGHT').items).toHaveLength(2);

    expect((await call('POST', '/checklists/templates/clone', { organizationId: org.id, fromFstdId: devB.id, toFstdIds: [devC.id] }, token)).status).toBe(400); // 源没有模板
    expect((await call('POST', '/checklists/templates/clone', { organizationId: org.id, fromFstdId: devA.id, toFstdIds: ['nope'] }, token)).status).toBe(400);
  });

  it('应做清单: 没有开关班次 → 空并说明; 开了开关且当班有人才出; 停飞/无模板/无人当班分别说明', async () => {
    const past = cnDate(-3);
    const future = cnDate(3);
    await roster(past, 'M');
    await roster(future, 'M');

    const none = await expected(past);
    expect(none.noFlaggedShift).toBe(true);
    expect(none.items).toEqual([]);

    // 打开 M 和 E 的开关; 只有 M 有人当班
    await call('PATCH', `/roster/shift-types/${shifts.M.id}`, { generatesMaintenanceTasks: true }, token);
    await call('PATCH', `/roster/shift-types/${shifts.E.id}`, { generatesMaintenanceTasks: true }, token);

    const pastList = await expected(past);
    expect(pastList.noFlaggedShift).toBe(false);
    expect(pastList.shiftsWithoutRoster).toEqual(['E']);
    // devA、devC 有模板(两种类型) × M 班 = 4 项; devB 没有模板, 在 missingTemplates 里
    expect(pastList.items).toHaveLength(4);
    expect(pastList.items.every((i: { shiftCode: string; status: string }) => i.shiftCode === 'M' && i.status === 'MISSED')).toBe(true); // 过去的班次没做 → 漏做
    expect(pastList.items[0].rostered).toEqual(['王明']);
    expect(pastList.missingTemplates.map((m: { deviceCode: string }) => m.deviceCode)).toEqual([devB.deviceCode, devB.deviceCode]);
    expect((await expected(past, 'PRE_FLIGHT')).items).toHaveLength(2);
    expect((await call('GET', `/checklists/expected?organizationId=${org.id}&date=${past}&type=PATROL`, undefined, token)).status).toBe(400);

    // 未来的班次是 UPCOMING; 把 devC 在那天标停飞 → 不出单, 出现在 grounded
    expect((await call('POST', '/fstds/groundings', { organizationId: org.id, entries: [{ fstdId: devC.id, date: future }] }, token)).status).toBe(201);
    const futureList = await expected(future);
    expect(futureList.items).toHaveLength(2);
    expect(futureList.items.every((i: { status: string; fstdId: string }) => i.status === 'UPCOMING' && i.fstdId === devA.id)).toBe(true);
    expect(futureList.grounded).toEqual([{ fstdId: devC.id, deviceCode: devC.deviceCode }]);

    // 没人当班的日子: 没有清单, 也不提示缺模板
    const empty = await expected(cnDate(10));
    expect(empty.items).toEqual([]);
    expect(empty.missingTemplates).toEqual([]);
    expect(empty.shiftsWithoutRoster.sort()).toEqual(['E', 'M']);
  });

  it('登记记录: 逐项校验、日期范围、停飞日拒绝、重复拒绝; 登记后应做清单变为已完成', async () => {
    expect((await record({ results: [{ no: '1', passed: true }] })).status).toBe(400); // 缺第 2 项
    expect((await record({ results: [{ no: '1', passed: true }, { no: '2', passed: true }, { no: '9', passed: true }] })).status).toBe(400); // 多余项
    expect((await record({ results: [{ no: '1', passed: true }, { no: '1', passed: false }] })).status).toBe(400);
    expect((await record({ date: cnDate(1) })).status).toBe(400); // 未来
    expect((await record({ date: cnDate(-40) })).status).toBe(400); // 超过补登范围
    expect((await record({ shiftTypeId: shifts.S.id })).status).toBe(400); // 非工作班次
    expect((await record({ fstdId: devB.id })).status).toBe(400); // 没有模板
    expect((await record({ performedByPersonnelId: 'nope' })).status).toBe(400);

    const ok = await record({ performedByPersonnelId: wang.id, results: [{ no: '1', passed: true }, { no: '2', passed: false, notes: '风扇异响' }] });
    expect(ok.status).toBe(201);
    expect(ok.body.overallResult).toBe('issues_found');
    expect((await record({})).status).toBe(400); // 同一设备/类型/日期/班次已登记

    const past = cnDate(-3);
    const after = await expected(past, 'PRE_FLIGHT');
    const done = after.items.find((i: { fstdId: string }) => i.fstdId === devA.id);
    expect(done).toMatchObject({ status: 'DONE', performedBy: '王明', overallResult: 'issues_found' });
    expect(after.items.find((i: { fstdId: string }) => i.fstdId === devC.id).status).toBe('MISSED');

    // 停飞日不接受登记 (停飞只能标当天及以后, 用今天验证)
    expect((await call('POST', '/fstds/groundings', { organizationId: org.id, entries: [{ fstdId: devA.id, date: cnDate(0) }] }, token)).status).toBe(201);
    const grounded = await record({ date: cnDate(0), type: 'POST_FLIGHT', results: [{ no: '1', passed: true }, { no: '2', passed: true }] });
    expect(grounded.status).toBe(400);
    expect(grounded.body.message).toContain('停飞');

    // 记录是模板快照: 之后改模板不影响历史
    await putTemplate(devA.id, 'PRE_FLIGHT', [{ no: '1', text: '全新的检查项' }]);
    const records = await call('GET', `/checklists/records?organizationId=${org.id}&type=PRE_FLIGHT&fstdId=${devA.id}`, undefined, token);
    expect(records.body).toHaveLength(1);
    expect(records.body[0].items.map((i: { text: string }) => i.text)).toEqual(['外观检查', '通电检查']);
    expect(records.body[0]).toMatchObject({ deviceCode: devA.deviceCode, shiftCode: 'M', performedBy: '王明' });
    expect((await call('GET', `/checklists/records?organizationId=${org.id}&type=BAD`, undefined, token)).status).toBe(400);
    const range = await call('GET', `/checklists/records?organizationId=${org.id}&from=${cnDate(-2)}&to=${cnDate(0)}`, undefined, token);
    expect(range.body).toHaveLength(0);
    const one = await call('GET', `/checklists/records/${ok.body.id}`, undefined, token);
    expect(one.status).toBe(200);
  });

  it('权限与租户隔离', async () => {
    const email = `staff-${Date.now()}@example.com`;
    expect((await call('POST', '/users', { email, password: 'StaffPass12345', role: 'STAFF', permissions: ['SCHEDULING'] }, token)).status).toBe(201);
    const staffToken = (await call('POST', '/auth/login', { email, password: 'StaffPass12345' })).body.accessToken;
    expect((await call('GET', `/checklists/templates?organizationId=${org.id}`, undefined, staffToken)).status).toBe(403);
    const other = await registerTenant(call);
    expect((await call('GET', `/checklists/templates?organizationId=${org.id}`, undefined, other.token)).status).toBe(403);
    expect((await putTemplate(devA.id, 'PRE_FLIGHT', items, other.token)).status).toBe(403);
  });
});
