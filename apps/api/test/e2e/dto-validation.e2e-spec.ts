import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiCall, apiFor, createTestApp, registerTenant, createOrg } from './helpers.js';

/// 证明新的 DTO 类确实拒绝了非法输入(修复前这些请求会一路走到 Prisma 调用深处才 500, 甚至悄悄写入脏数据)。
describe('DTO validation', () => {
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

  it('缺少必填字段被拒绝 (400)', async () => {
    const res = await call('POST', '/fstds', { organizationId: org.id, deviceType: 'FFS' }, token);
    expect(res.status).toBe(400);
  });

  it('非法枚举值被拒绝 (400)', async () => {
    const res = await call('POST', '/fstds', {
      organizationId: org.id,
      deviceCode: `DTOTEST-${Date.now()}`,
      representedAircraft: 'A320',
      deviceType: 'NOT_A_REAL_DEVICE_TYPE',
    }, token);
    expect(res.status).toBe(400);
  });

  it('类型错误 (month 应为数字, 传字符串) 被拒绝 (400)', async () => {
    const fstd = await call('POST', '/fstds', { organizationId: org.id, deviceCode: `DTOTEST-${Date.now()}`, representedAircraft: 'A320', deviceType: 'FFS' }, token);
    const res = await call('POST', `/fstds/${fstd.body.id}/performance-metrics`, {
      year: 2026,
      month: 'not-a-number',
      plannedAvailableHours: 100,
      scheduledTrainingHours: 50,
      supportHours: 10,
      fstdFailureHours: 5,
      externalFailureHours: 2,
      lostTrainingHours: 1,
      discrepancyCount: 0,
      interruptionCount: 0,
    }, token);
    expect(res.status).toBe(400);
  });

  it('未声明的多余字段被静默剥离(whitelist), 请求本身仍然成功', async () => {
    const res = await call('POST', '/fstds', {
      organizationId: org.id,
      deviceCode: `DTOTEST-${Date.now()}`,
      representedAircraft: 'A320',
      deviceType: 'FFS',
      someRandomHackerField: 'should be stripped',
    }, token);
    expect(res.status).toBe(201);
    expect('someRandomHackerField' in res.body).toBe(false);
  });

  it('超出范围的数值 (severityRating 必须 1-5) 被拒绝 (400)', async () => {
    const fstd = await call('POST', '/fstds', { organizationId: org.id, deviceCode: `DTOTEST-${Date.now()}`, representedAircraft: 'A320', deviceType: 'FFS' }, token);
    const res = await call('POST', `/fstds/${fstd.body.id}/discrepancies`, {
      description: 'test',
      severityRating: 99,
    }, token);
    expect(res.status).toBe(400);
  });
});
