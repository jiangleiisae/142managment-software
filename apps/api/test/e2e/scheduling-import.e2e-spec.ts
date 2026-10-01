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
