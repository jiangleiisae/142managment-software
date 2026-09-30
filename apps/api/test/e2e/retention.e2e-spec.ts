import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiCall, apiFor, createTestApp, registerTenant, createOrg, createFstd, createPersonnel, createStudent, createSparePart } from './helpers.js';

/// MMI 缺陷保留(retention) 对预约的放行/阻止逻辑, 以及备件 relatedDiscrepancyId 关联校验。
describe('discrepancy retention and part-category', () => {
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

  it('part category: explicit ROTABLE persists, default is CONSUMABLE', async () => {
    const partRes = await call('POST', '/inventory/spare-parts', { organizationId: org.id, partNumber: `TEST-ROTABLE-${Date.now()}`, name: 'Test Rotable Part', partCategory: 'ROTABLE' }, token);
    expect(partRes.status).toBe(201);
    expect(partRes.body.partCategory).toBe('ROTABLE');

    const defaultPartRes = await call('POST', '/inventory/spare-parts', { organizationId: org.id, partNumber: `TEST-CONSUMABLE-${Date.now()}`, name: 'Test Consumable Part (default)' }, token);
    expect(defaultPartRes.body.partCategory).toBe('CONSUMABLE');
  });

  it('movement relatedDiscrepancyId: valid link accepted, bogus id rejected 404, reverse lookup works', async () => {
    const part = await createSparePart(call, token, org.id, { partCategory: 'ROTABLE' });
    await call('POST', `/inventory/spare-parts/${part.id}/movements`, { type: 'IN', quantity: 10 }, token);

    const fstd = await createFstd(call, token, org.id, { deviceCode: `TESTDEV-RETENTION-${Date.now()}`, representedAircraft: 'B737' });
    const discRes = await call('POST', `/fstds/${fstd.id}/discrepancies`, { description: 'Test MMI discrepancy for retention verification', isMmi: true }, token);
    expect(discRes.status).toBe(201);
    const discrepancyId = discRes.body.id;

    const movementValid = await call('POST', `/inventory/spare-parts/${part.id}/movements`, { type: 'OUT', quantity: 1, relatedDiscrepancyId: discrepancyId }, token);
    expect(movementValid.status).toBe(201);
    expect(movementValid.body.relatedDiscrepancy?.id).toBe(discrepancyId);

    const movementInvalid = await call('POST', `/inventory/spare-parts/${part.id}/movements`, { type: 'OUT', quantity: 1, relatedDiscrepancyId: 'nonexistent-id-xyz' }, token);
    expect(movementInvalid.status).toBe(404);

    const movementsByDisc = await call('GET', `/inventory/discrepancies/${discrepancyId}/movements`, null, token);
    expect(movementsByDisc.status).toBe(200);
    expect(movementsByDisc.body.length).toBe(1);
    expect(movementsByDisc.body[0].sparePart?.id).toBe(part.id);

    const openDiscs = await call('GET', `/fstds/discrepancies/open?organizationId=${org.id}`, null, token);
    expect(openDiscs.status).toBe(200);
    expect(openDiscs.body.some((d: any) => d.id === discrepancyId)).toBe(true);
  });

  it('retention: unretained MMI blocks booking, active retention allows it, expired retention blocks again, clear removes category', async () => {
    const fstd = await createFstd(call, token, org.id, { deviceCode: `TESTDEV-RETENTION2-${Date.now()}`, representedAircraft: 'B737' });
    const discRes = await call('POST', `/fstds/${fstd.id}/discrepancies`, { description: 'Test MMI discrepancy for retention verification', isMmi: true }, token);
    const discrepancyId = discRes.body.id;

    const student = await createStudent(call, token, org.id);
    const approver = await createPersonnel(call, token);
    const taskCode = 'TEST-TASK-RETENTION';
    await call('POST', `/fstds/${fstd.id}/qualified-tasks`, { taskCode, taskName: 'Retention test task' }, token);

    const startAt = new Date(Date.now() + 3600_000).toISOString();
    const endAt = new Date(Date.now() + 7200_000).toISOString();

    const bookingBlocked = await call('POST', '/bookings', { organizationId: org.id, resourceType: 'FSTD', resourceId: fstd.id, taskCode, studentId: student.id, startAt, endAt }, token);
    expect(bookingBlocked.status).toBe(400);

    const setRetention = await call('POST', `/fstds/discrepancies/${discrepancyId}/retention`, {
      category: 'CATEGORY_II',
      justification: 'Verification test: non-critical MMI item, operations may continue',
      approvedById: approver.id,
    }, token);
    expect([200, 201]).toContain(setRetention.status);
    expect(setRetention.body.retentionCategory).toBe('CATEGORY_II');

    const bookingAllowed = await call('POST', '/bookings', { organizationId: org.id, resourceType: 'FSTD', resourceId: fstd.id, taskCode, studentId: student.id, startAt, endAt }, token);
    expect(bookingAllowed.status).toBe(201);

    const pastDate = new Date(Date.now() - 86400_000).toISOString();
    await call('POST', `/fstds/discrepancies/${discrepancyId}/retention`, {
      category: 'CATEGORY_II',
      justification: 'Verification test: expired retention',
      approvedById: approver.id,
      expiresAt: pastDate,
    }, token);

    const startAt2 = new Date(Date.now() + 10800_000).toISOString();
    const endAt2 = new Date(Date.now() + 14400_000).toISOString();
    const bookingBlockedAgain = await call('POST', '/bookings', { organizationId: org.id, resourceType: 'FSTD', resourceId: fstd.id, taskCode, studentId: student.id, startAt: startAt2, endAt: endAt2 }, token);
    expect(bookingBlockedAgain.status).toBe(400);

    const clearRes = await call('POST', `/fstds/discrepancies/${discrepancyId}/retention/clear`, null, token);
    expect([200, 201]).toContain(clearRes.status);
    expect(clearRes.body.retentionCategory).toBeNull();
  });
});
