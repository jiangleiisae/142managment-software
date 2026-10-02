import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiCall, apiFor, createTestApp, registerTenant, createOrg, createPersonnel } from './helpers.js';

/// CCAR-142第142.61条(c)款(≥8小时初始培训+笔试)与第142.69条(b)款(连续24小时教学时间不得超过8小时)在CAAC机构下
/// 作为排课准入条件生效, EASA机构不受影响 (这两项要求是CAAC在EASA基础上叠加的额外要求, 而非替换)。
describe('instructor compliance (CCAR-142 142.61(c) / 142.69(b))', () => {
  let app: INestApplication;
  let call: ApiCall;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    call = apiFor(app);
    ({ token } = await registerTenant(call));
  });

  afterAll(async () => {
    await app.close();
  });

  it('CAAC机构: 未完成初始培训的教员不能被排课', async () => {
    const org = await createOrg(call, token, 'CAAC Org', { regulatoryStandard: 'CAAC' });
    const person = await createPersonnel(call, token);
    await call('POST', `/personnel/${person.id}/instructor-profile`, { instructorType: 'FI' }, token);

    const res = await call(
      'POST',
      '/bookings',
      { organizationId: org.id, resourceType: 'INSTRUCTOR', resourceId: person.id, startAt: '2026-05-01T01:00:00.000Z', endAt: '2026-05-01T03:00:00.000Z' },
      token,
    );
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('142.61');
  });

  it('CAAC机构: 完成初始培训后可排课; 但连续24小时内教学时长超过8小时则拒绝', async () => {
    const org = await createOrg(call, token, 'CAAC Org', { regulatoryStandard: 'CAAC' });
    const person = await createPersonnel(call, token);
    await call('POST', `/personnel/${person.id}/instructor-profile`, { instructorType: 'FI' }, token);

    const checklist: string[] = (await call('GET', '/personnel/initial-training/checklist', undefined, token)).body;
    const trainingRes = await call(
      'POST',
      `/personnel/${person.id}/initial-training`,
      {
        completedAt: '2026-01-01',
        totalHours: 8,
        writtenExamPassed: true,
        items: checklist.map((item) => ({ item, completed: true })),
      },
      token,
    );
    expect(trainingRes.status).toBe(201);
    expect(trainingRes.body.isComplete).toBe(true);

    // 第一段: 01:00-07:00 UTC (6小时), 应当成功
    const first = await call(
      'POST',
      '/bookings',
      { organizationId: org.id, resourceType: 'INSTRUCTOR', resourceId: person.id, startAt: '2026-05-02T01:00:00.000Z', endAt: '2026-05-02T07:00:00.000Z' },
      token,
    );
    expect(first.status).toBe(201);

    // 第二段: 紧接着07:00-10:00 UTC (再3小时), 与第一段同属连续24小时窗口, 合计9小时, 应当被拒绝
    const second = await call(
      'POST',
      '/bookings',
      { organizationId: org.id, resourceType: 'INSTRUCTOR', resourceId: person.id, startAt: '2026-05-02T07:00:00.000Z', endAt: '2026-05-02T10:00:00.000Z' },
      token,
    );
    expect(second.status).toBe(400);
    expect(second.body.message).toContain('142.69');
    expect(second.body.message).toContain('8');
  });

  it('EASA机构: 不受初始培训与24小时疲劳限制约束', async () => {
    const org = await createOrg(call, token, 'EASA Org');
    const person = await createPersonnel(call, token);
    await call('POST', `/personnel/${person.id}/instructor-profile`, { instructorType: 'FI' }, token);

    const res = await call(
      'POST',
      '/bookings',
      { organizationId: org.id, resourceType: 'INSTRUCTOR', resourceId: person.id, startAt: '2026-05-03T01:00:00.000Z', endAt: '2026-05-03T09:00:00.000Z' },
      token,
    );
    expect(res.status).toBe(201);
  });
});
