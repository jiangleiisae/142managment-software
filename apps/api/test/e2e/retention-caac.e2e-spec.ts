import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiCall, apiFor, createTestApp, createFstd, createOrg, registerTenant } from './helpers.js';

/// CAAC机构: 保存策略表标注CCAR-142第142.91条/CCAR-60第60.41条最低期限, 实际执行取与EASA策略中较长者 (CAAC叠加而非替换)。
describe('retention compliance status: CAAC minimums', () => {
  let app: INestApplication;
  let call: ApiCall;

  beforeAll(async () => {
    app = await createTestApp();
    call = apiFor(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('CAAC租户: 带CAAC最低要求标注, 且不缩短现有EASA期限; 故障记录类型出现', async () => {
    const { token } = await registerTenant(call);
    const org = await createOrg(call, token, 'CAAC Org', { regulatoryStandard: 'CAAC' });
    const fstd = await createFstd(call, token, org.id);
    await call('POST', `/fstds/${fstd.id}/discrepancies`, { description: 'retention test fault' }, token);

    const res = await call('GET', '/retention-policies/compliance-status', undefined, token);
    expect(res.status).toBe(200);
    const byType = Object.fromEntries(res.body.map((r: { documentType: string }) => [r.documentType, r]));

    expect(byType.student_training_record.caacMinimum.months).toBe(24);
    expect(byType.student_training_record.caacMinimum.basis).toContain('142.91');
    expect(byType.student_training_record.retentionMonths).toBe(36);
    expect(byType.fstd_fault_record.caacMinimum.months).toBe(24);
    expect(byType.fstd_fault_record.totalCount).toBe(1);
  });

  it('纯EASA租户: 无CAAC标注, 也不出现故障记录类型', async () => {
    const { token } = await registerTenant(call);
    await createOrg(call, token, 'EASA Org');

    const res = await call('GET', '/retention-policies/compliance-status', undefined, token);
    expect(res.status).toBe(200);
    expect(res.body.some((r: { caacMinimum?: unknown }) => r.caacMinimum)).toBe(false);
    expect(res.body.some((r: { documentType: string }) => r.documentType === 'fstd_fault_record')).toBe(false);
  });
});
