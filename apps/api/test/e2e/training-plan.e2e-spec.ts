import { INestApplication } from '@nestjs/common';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiCall, apiFor, createFstd, createOrg, createTestApp, registerTenant } from './helpers.js';

/// 训练计划视图 (R1): 按时间范围/设备/教员查询、客户配色配置、导出 (导出文件应能原样再导入)。
describe('training plan view', () => {
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

  const book = (fstdId: string, startAt: string, endAt: string, extra: Record<string, unknown> = {}) =>
    call('POST', '/bookings', { organizationId: org.id, resourceType: 'FSTD', resourceId: fstdId, startAt, endAt, ...extra }, token);

  it('按时间范围返回重叠预订(含跨午夜), 可按设备和教员/检查员筛选, 且不返回收入和电话', async () => {
    const a = await createFstd(call, token, org.id, { deviceCode: 'FFS#1', representedAircraft: 'B757/767' });
    const b = await createFstd(call, token, org.id, { deviceCode: 'FFS#2', representedAircraft: 'B777' });

    // 北京时间 9/3 20:10 - 9/4 00:10 (UTC 12:10 - 16:10), 跨午夜
    expect((await book(a.id, '2026-09-03T12:10:00.000Z', '2026-09-03T16:10:00.000Z', { trainingType: '夜间复训', instructorName: '张教员', customerName: '甲航', revenue: 9999, contactPhone: '13800000000' })).status).toBe(201);
    // 北京时间 9/4 08:00 - 12:00
    expect((await book(a.id, '2026-09-04T00:00:00.000Z', '2026-09-04T04:00:00.000Z', { trainingType: '熟练检查', examinerName: '赵检查员' })).status).toBe(201);
    expect((await book(b.id, '2026-09-04T00:00:00.000Z', '2026-09-04T04:00:00.000Z', { trainingType: '另一台' })).status).toBe(201);

    // 9/4 北京时间整天 = UTC 9/3 16:00 ~ 9/4 16:00: 夜间复训在 UTC 16:10 结束, 与该日重叠
    const day = await call('GET', `/bookings/plan?organizationId=${org.id}&from=2026-09-03T16:00:00.000Z&to=2026-09-04T16:00:00.000Z`, undefined, token);
    expect(day.status).toBe(200);
    expect(day.body.map((x: { trainingType: string }) => x.trainingType).sort()).toEqual(['夜间复训', '另一台', '熟练检查'].sort());
    expect(day.body[0]).not.toHaveProperty('revenue');
    expect(day.body[0]).not.toHaveProperty('contactPhone');

    const onlyA = await call('GET', `/bookings/plan?organizationId=${org.id}&from=2026-09-03T16:00:00.000Z&to=2026-09-04T16:00:00.000Z&resourceId=${a.id}`, undefined, token);
    expect(onlyA.body).toHaveLength(2);

    const byExaminer = await call('GET', `/bookings/plan?organizationId=${org.id}&from=2026-09-03T00:00:00.000Z&to=2026-09-05T00:00:00.000Z&instructor=${encodeURIComponent('赵')}`, undefined, token);
    expect(byExaminer.body.map((x: { trainingType: string }) => x.trainingType)).toEqual(['熟练检查']);

    const byInstructor = await call('GET', `/bookings/plan?organizationId=${org.id}&from=2026-09-03T00:00:00.000Z&to=2026-09-05T00:00:00.000Z&instructor=${encodeURIComponent('张')}`, undefined, token);
    expect(byInstructor.body.map((x: { trainingType: string }) => x.trainingType)).toEqual(['夜间复训']);
  });

  it('查询范围校验: 缺少机构、时间非法、范围过大都拒绝; 他人机构403', async () => {
    const noOrg = await call('GET', '/bookings/plan?from=2026-09-01T00:00:00.000Z&to=2026-09-02T00:00:00.000Z', undefined, token);
    expect(noOrg.status).toBe(400);
    const badDate = await call('GET', `/bookings/plan?organizationId=${org.id}&from=abc&to=2026-09-02T00:00:00.000Z`, undefined, token);
    expect(badDate.status).toBe(400);
    const reversed = await call('GET', `/bookings/plan?organizationId=${org.id}&from=2026-09-02T00:00:00.000Z&to=2026-09-01T00:00:00.000Z`, undefined, token);
    expect(reversed.status).toBe(400);
    const tooWide = await call('GET', `/bookings/plan?organizationId=${org.id}&from=2026-01-01T00:00:00.000Z&to=2026-12-31T00:00:00.000Z`, undefined, token);
    expect(tooWide.status).toBe(400);

    const other = await registerTenant(call);
    const foreign = await call('GET', `/bookings/plan?organizationId=${org.id}&from=2026-09-01T00:00:00.000Z&to=2026-09-02T00:00:00.000Z`, undefined, other.token);
    expect(foreign.status).toBe(403);
  });

  it('客户配置: 保存、整体替换、重复名称与非法颜色被拒、他人机构403', async () => {
    const save = (customers: unknown[], t = token) => call('POST', '/bookings/customers', { organizationId: org.id, customers }, t);

    const first = await save([{ name: '甲航', color: '#FF0000' }, { name: '乙航', color: '#00ff00' }]);
    expect(first.status).toBe(201);
    expect(first.body.map((c: { name: string; color: string }) => `${c.name}${c.color}`)).toEqual(['乙航#00ff00', '甲航#ff0000'].sort());

    const replaced = await save([{ name: '甲航', color: '#0000ff' }]);
    expect(replaced.body).toHaveLength(1);
    expect(replaced.body[0].color).toBe('#0000ff');
    const listed = await call('GET', `/bookings/customers?organizationId=${org.id}`, undefined, token);
    expect(listed.body).toHaveLength(1);

    expect((await save([{ name: '甲航', color: '#111111' }, { name: ' 甲航 ', color: '#222222' }])).status).toBe(400);
    expect((await save([{ name: '丙航', color: 'red' }])).status).toBe(400);

    const other = await registerTenant(call);
    expect((await save([{ name: '甲航', color: '#111111' }], other.token)).status).toBe(403);
  });

  it('导出的文件按训练计划版式输出北京时间, 且能原样再导入还原全部字段', async () => {
    const { token: t2 } = await registerTenant(call);
    const c2 = apiFor(app);
    const org2 = await createOrg(c2, t2);
    const dev = await createFstd(c2, t2, org2.id, { deviceCode: 'FFS#7', representedAircraft: 'B777' });
    const make = (startAt: string, endAt: string, extra: Record<string, unknown>) =>
      c2('POST', '/bookings', { organizationId: org2.id, resourceType: 'FSTD', resourceId: dev.id, startAt, endAt, ...extra }, t2);
    // 北京时间 9/10 20:00-次日 00:00 (到午夜) 与 9/11 08:00-12:00
    expect((await make('2026-09-10T12:00:00.000Z', '2026-09-10T16:00:00.000Z', { trainingType: '夜间', pilotName: '甲 乙', instructorName: '张教员', customerName: '甲航' })).status).toBe(201);
    expect((await make('2026-09-11T00:00:00.000Z', '2026-09-11T04:00:00.000Z', { trainingType: '熟练检查', pilotName: '丙', examinerName: '赵检查员', customerName: '乙航' })).status).toBe(201);

    const exported = await request(app.getHttpServer())
      .get(`/bookings/plan/export?organizationId=${org2.id}&from=2026-09-09T16:00:00.000Z&to=2026-09-12T16:00:00.000Z`)
      .set('Authorization', `Bearer ${t2}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(exported.status).toBe(200);
    expect(exported.headers['content-type']).toContain('spreadsheetml');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(exported.body as ArrayBuffer);
    const ws = wb.worksheets[0];
    expect(ws.getRow(2).getCell(1).value).toBe('训练地点/模拟机编号');
    expect(ws.getRow(3).getCell(1).value).toBe('FFS#7 B777');
    expect(ws.getRow(3).getCell(4).value).toBe('2000-2400');
    expect(ws.getRow(4).getCell(4).value).toBe('0800-1200');
    expect(ws.getRow(4).getCell(7).value).toBe('赵检查员');

    // 再导入到另一个机构 (同编号同机型设备): 条数、时间与各字段一致
    const { token: t3 } = await registerTenant(call);
    const c3 = apiFor(app);
    const org3 = await createOrg(c3, t3);
    const dev3 = await createFstd(c3, t3, org3.id, { deviceCode: 'FFS#7', representedAircraft: 'B777' });
    const imported = await request(app.getHttpServer())
      .post('/bookings/import-excel')
      .set('Authorization', `Bearer ${t3}`)
      .field('organizationId', org3.id)
      .attach('file', exported.body as Buffer, { filename: 'plan.xlsx' });
    expect(imported.status).toBe(201);
    expect(imported.body.createdCount).toBe(2);
    expect(imported.body.errorCount).toBe(0);

    const back = await c3('GET', `/bookings?resourceType=FSTD&resourceId=${dev3.id}`, undefined, t3);
    const byType = Object.fromEntries(back.body.map((b: { trainingType: string }) => [b.trainingType, b]));
    expect(byType['夜间'].startAt).toBe('2026-09-10T12:00:00.000Z');
    expect(byType['夜间'].endAt).toBe('2026-09-10T16:00:00.000Z');
    expect(byType['夜间'].customerName).toBe('甲航');
    expect(byType['夜间'].pilotName).toBe('甲 乙');
    expect(byType['夜间'].instructorName).toBe('张教员');
    expect(byType['熟练检查'].examinerName).toBe('赵检查员');
    expect(byType['熟练检查'].customerName).toBe('乙航');
  });
});
