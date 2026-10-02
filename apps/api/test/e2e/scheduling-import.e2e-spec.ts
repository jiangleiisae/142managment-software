import { INestApplication } from '@nestjs/common';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiCall, apiFor, createTestApp, registerTenant, createOrg, createFstd } from './helpers.js';

/// 排班 Excel 导入(用户反馈现有排班UI不好用, 改为按固定模板逐行导入): 证明合法行能创建 Booking 且回填商业字段,
/// 非法行(找不到设备)不中断整批导入, 而是单独记录错误原因回传给前端。
async function buildScheduleWorkbook(rows: Record<string, unknown>[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('排班登记 Schedule');
  ws.addRow(['日期', '开始时间', '结束时间', '设备编号', '训练科目', '客户', '飞行员', '教员', '电话', '收入', '备注']);
  for (const r of rows) {
    ws.addRow([
      r.date, r.startTime, r.endTime, r.deviceCode, r.taskCode,
      r.customerName, r.pilotName, r.instructorName, r.contactPhone, r.revenue, r.notes,
    ]);
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

describe('bookings Excel import', () => {
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

  it('导入一行合法数据和一行设备不存在的数据: 合法行创建成功, 非法行单独报错不影响合法行', async () => {
    const fstd = await createFstd(call, token, org.id);

    const buffer = await buildScheduleWorkbook([
      {
        date: '2026-05-01',
        startTime: '09:00',
        endTime: '11:00',
        deviceCode: fstd.deviceCode,
        taskCode: '',
        customerName: 'Example Airlines',
        pilotName: 'Zhang Wei',
        instructorName: 'Li Na',
        contactPhone: '13800000000',
        revenue: 8000,
        notes: '',
      },
      {
        date: '2026-05-02',
        startTime: '09:00',
        endTime: '11:00',
        deviceCode: 'NO-SUCH-DEVICE',
        taskCode: '',
        customerName: 'Another Customer',
        pilotName: 'Wang Fang',
        instructorName: '',
        contactPhone: '',
        revenue: 5000,
        notes: '',
      },
    ]);

    const res = await request(app.getHttpServer())
      .post('/bookings/import-excel')
      .set('Authorization', `Bearer ${token}`)
      .field('organizationId', org.id)
      .attach('file', buffer, { filename: 'schedule.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    expect(res.status).toBe(201);
    expect(res.body.createdCount).toBe(1);
    expect(res.body.errorCount).toBe(1);
    expect(res.body.errors[0].row).toBe(3);
    expect(res.body.errors[0].message).toContain('NO-SUCH-DEVICE');

    const bookings = await call('GET', `/bookings?resourceType=FSTD&resourceId=${fstd.id}`, undefined, token);
    expect(bookings.status).toBe(200);
    expect(bookings.body).toHaveLength(1);
    expect(bookings.body[0].customerName).toBe('Example Airlines');
    expect(bookings.body[0].pilotName).toBe('Zhang Wei');
    expect(bookings.body[0].revenue).toBe('8000');
  });

  it('拒绝非 .xlsx/.xls 扩展名的文件', async () => {
    const res = await request(app.getHttpServer())
      .post('/bookings/import-excel')
      .set('Authorization', `Bearer ${token}`)
      .field('organizationId', org.id)
      .attach('file', Buffer.from('not an excel file'), { filename: 'schedule.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
  });
});

/// 训练计划表格式 (一行一场: 训练地点/模拟机编号、训练类型、日期、时间HHmm-HHmm、受训人员、教员、检查员), 按列名识别, 无需使用本系统提供的模板
async function buildTrainingPlanWorkbook(rows: unknown[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('2026年9月计划');
  // 真实计划表的标题单元格是富文本(多段文字拼成), 这里同样用富文本构造
  ws.addRow([{ richText: [{ text: '  某某航空B737' }, { text: '机型2026年9月模拟机训练计划    制表人：测试' }] }]);
  ws.addRow(['训练地点/模拟机编号', '训练类型', '日期', '时间', '受训人员', '教员', '检查员/公司评估员']);
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('bookings import: training plan format', () => {
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

  it('按列名映射, 跨午夜/24点结束正确换算, 缺失设备汇总提示, 教员重叠只警告不阻断', async () => {
    const fstdA = await createFstd(call, token, org.id, { deviceCode: 'FSD-901' });
    const fstdB = await createFstd(call, token, org.id, { deviceCode: 'FSD-902' });
    const d = (day: number) => new Date(Date.UTC(2026, 8, day));

    const buffer = await buildTrainingPlanWorkbook([
      ['某地/FSD-901', '复训1/定期飞行模拟机复训（CRM）', d(3), '0800-1200', '甲 乙（9月）', '张教员', ''],
      ['某地/FSD-901', '复训2/定期飞行模拟机复训（第二）', d(3), '2010-0010', '丙 丁', '李教员', ''],
      ['某地/FSD-901', '复训3/定期飞行模拟机复训（CRM）', d(4), '2000-2400', '戊 己', '王教员', ''],
      ['某地/FSD-901', '熟练检查', d(5), '1200-1600', '甲 乙', '', '赵检查员'],
      // 与第一行同一教员、同一时段、另一台设备: 导入成功但应出现警告
      ['某地/FSD-902', '复训9/定期飞行模拟机复训（CRM）', d(3), '0900-1100', '庚 辛', '张教员', ''],
      ['某地/NO-SUCH', '复训', d(6), '0800-1200', '壬', '钱教员', ''],
      ['某地/FSD-901', '复训', d(7), '8点到12点', '癸', '孙教员', ''],
    ]);

    const res = await request(app.getHttpServer())
      .post('/bookings/import-excel')
      .set('Authorization', `Bearer ${token}`)
      .field('organizationId', org.id)
      .attach('file', buffer, { filename: 'plan.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    expect(res.status).toBe(201);
    expect(res.body.createdCount).toBe(5);
    expect(res.body.errorCount).toBe(2);
    expect(res.body.missingDevices).toEqual(['NO-SUCH']);
    expect(res.body.errors.map((e: { row: number }) => e.row)).toEqual([8, 9]);
    expect(res.body.errors[1].message).toContain('时间');
    expect(res.body.warnings).toHaveLength(1);
    expect(res.body.warnings[0].row).toBe(7);
    expect(res.body.warnings[0].message).toContain('张教员');

    const list = await call('GET', `/bookings?resourceType=FSTD&resourceId=${fstdA.id}`, undefined, token);
    const byType = Object.fromEntries(list.body.map((b: { trainingType: string }) => [b.trainingType, b]));
    // 第一行 0800-1200 北京时间 = 00:00-04:00 UTC
    const first = byType['复训1/定期飞行模拟机复训（CRM）'];
    expect(first.startAt).toBe('2026-09-03T00:00:00.000Z');
    expect(first.endAt).toBe('2026-09-03T04:00:00.000Z');
    expect(first.customerName).toBe('某某航空');
    expect(first.pilotName).toBe('甲 乙（9月）');
    expect(first.instructorName).toBe('张教员');
    // 2010-0010 跨午夜: 结束在次日 00:10 北京时间
    const overnight = byType['复训2/定期飞行模拟机复训（第二）'];
    expect(overnight.endAt).toBe('2026-09-03T16:10:00.000Z');
    // 2000-2400: 结束在次日 00:00 北京时间
    const toMidnight = byType['复训3/定期飞行模拟机复训（CRM）'];
    expect(toMidnight.endAt).toBe('2026-09-04T16:00:00.000Z');
    expect(byType['熟练检查'].examinerName).toBe('赵检查员');
    expect(fstdB.id).toBeTruthy();
  });
});
