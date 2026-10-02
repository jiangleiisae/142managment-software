import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiCall, apiFor, createFstd, createOrg, createTestApp, registerTenant } from './helpers.js';

/// 停飞日历 (R3): 只能标记当天及以后(北京时间), 停飞日不接受预订, 停飞期间不再提醒飞行前功能检查超期。
const DAY = 24 * 60 * 60 * 1000;
const cnDate = (offsetDays: number) => new Date(Date.now() + 8 * 60 * 60 * 1000 + offsetDays * DAY).toISOString().slice(0, 10);
/// 北京时间 date 日 hour:minute 对应的 UTC ISO 字符串
const cnIso = (date: string, hour: number, minute = 0, plusDays = 0) =>
  new Date(Date.parse(`${date}T00:00:00.000Z`) + plusDays * DAY + (hour * 60 + minute) * 60000 - 8 * 60 * 60 * 1000).toISOString();

describe('fstd grounding calendar', () => {
  let app: INestApplication;
  let call: ApiCall;
  let token: string;
  let org: { id: string };

  beforeAll(async () => {
    app = await createTestApp();
    call = apiFor(app);
    ({ token } = await registerTenant(call));
    org = await createOrg(call, token);
  });

  afterAll(async () => {
    await app.close();
  });

  const mark = (entries: { fstdId: string; date: string }[], note?: string, t = token, organizationId = org.id) =>
    call('POST', '/fstds/groundings', { organizationId, entries, note }, t);
  const cancel = (entries: { fstdId: string; date: string }[], t = token) =>
    call('POST', '/fstds/groundings/cancel', { organizationId: org.id, entries }, t);
  const book = (fstdId: string, startAt: string, endAt: string) =>
    call('POST', '/bookings', { organizationId: org.id, resourceType: 'FSTD', resourceId: fstdId, startAt, endAt }, token);

  it('标记停飞幂等, 按月查询; 过去日期、非法日期、过远日期、他人设备与他人租户都被拒', async () => {
    const dev = await createFstd(call, token, org.id);
    const d1 = cnDate(1);
    const d2 = cnDate(2);

    const first = await mark([{ fstdId: dev.id, date: d1 }, { fstdId: dev.id, date: d2 }], '年度维护');
    expect(first.status).toBe(201);
    expect(first.body.created).toBe(2);
    const again = await mark([{ fstdId: dev.id, date: d1 }]);
    expect(again.body.created).toBe(0);

    const listed = await call('GET', `/fstds/groundings?organizationId=${org.id}&month=${d1.slice(0, 7)}`, undefined, token);
    expect(listed.status).toBe(200);
    const mine = listed.body.filter((g: { fstdId: string }) => g.fstdId === dev.id).map((g: { date: string }) => g.date);
    expect(mine).toContain(d1);
    expect(mine).toContain(d2);
    expect(listed.body[0].note).toBe('年度维护');

    expect((await mark([{ fstdId: dev.id, date: cnDate(-1) }])).status).toBe(400);
    expect((await mark([{ fstdId: dev.id, date: '2027-02-30' }])).status).toBe(400);
    expect((await mark([{ fstdId: dev.id, date: cnDate(400) }])).status).toBe(400);
    expect((await call('GET', `/fstds/groundings?organizationId=${org.id}&month=2026-13`, undefined, token)).status).toBe(400);

    const other = await registerTenant(call);
    const otherOrg = await createOrg(call, other.token);
    expect((await mark([{ fstdId: dev.id, date: d1 }], undefined, other.token, otherOrg.id)).status).toBe(400); // 设备不属于该机构
    expect((await mark([{ fstdId: dev.id, date: d1 }], undefined, other.token)).status).toBe(403); // 机构不属于该租户
  });

  it('停飞日不能预订(含跨午夜进入停飞日的预订), 取消停飞后恢复', async () => {
    const dev = await createFstd(call, token, org.id);
    const d = cnDate(5);
    expect((await mark([{ fstdId: dev.id, date: d }])).status).toBe(201);

    const onDay = await book(dev.id, cnIso(d, 8), cnIso(d, 10));
    expect(onDay.status).toBe(400);
    expect(onDay.body.message).toContain('停飞');
    expect(onDay.body.message).toContain(d);

    // 前一天 23:00 到停飞日 01:00, 跨进停飞日
    const intoGrounded = await book(dev.id, cnIso(cnDate(4), 23), cnIso(cnDate(4), 25));
    expect(intoGrounded.status).toBe(400);

    // 前一天 20:00-24:00 恰好在午夜结束, 不触及停飞日
    const beforeGrounded = await book(dev.id, cnIso(cnDate(4), 20), cnIso(cnDate(4), 24));
    expect(beforeGrounded.status).toBe(201);

    expect((await cancel([{ fstdId: dev.id, date: d }])).body.removed).toBe(1);
    expect((await book(dev.id, cnIso(d, 8), cnIso(d, 10))).status).toBe(201);
  });

  it('标记停飞时已有的预订只提示冲突, 不会被取消', async () => {
    const dev = await createFstd(call, token, org.id);
    const d = cnDate(8);
    const booked = await book(dev.id, cnIso(d, 9), cnIso(d, 11));
    expect(booked.status).toBe(201);

    const res = await mark([{ fstdId: dev.id, date: d }]);
    expect(res.status).toBe(201);
    expect(res.body.conflictingBookings).toHaveLength(1);
    expect(res.body.conflictingBookings[0].bookingId).toBe(booked.body.id);
    expect(res.body.conflictingBookings[0].date).toBe(d);

    const still = await call('GET', `/bookings?resourceType=FSTD&resourceId=${dev.id}`, undefined, token);
    expect(still.body).toHaveLength(1);
    expect(still.body[0].status).toBe('confirmed');
  });

  it('今天处于停飞日历内的设备不再触发飞行前功能检查超期告警, 取消后恢复', async () => {
    const dev = await createFstd(call, token, org.id);
    const dueIds = async () => (await call('GET', '/fstds/pre-flight-checks/due-soon', undefined, token)).body.map((x: { fstdId: string }) => x.fstdId);

    expect(await dueIds()).toContain(dev.id); // 从未做过飞行前检查
    expect((await mark([{ fstdId: dev.id, date: cnDate(0) }])).status).toBe(201);
    expect(await dueIds()).not.toContain(dev.id);
    expect((await cancel([{ fstdId: dev.id, date: cnDate(0) }])).status).toBe(201);
    expect(await dueIds()).toContain(dev.id);
  });
});
