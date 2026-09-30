import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiCall, apiFor, createTestApp, registerTenant, createOrg, createFstd, createPersonnel, createStudent, createSparePart, createSupplier } from './helpers.js';

function findLog(logs: any[], entityType: string, entityId: string, actionSubstr: string) {
  return logs.find((l) => l.entityType === entityType && l.entityId === entityId && l.action.includes(actionSubstr));
}

describe('audit log', () => {
  let app: INestApplication;
  let call: ApiCall;
  let token: string;
  let org: { id: string; name: string };

  beforeAll(async () => {
    app = await createTestApp();
    call = apiFor(app);
    ({ token } = await registerTenant(call));
    org = await createOrg(call, token);
  });

  afterAll(async () => {
    await app.close();
  });

  it('records create/update/status_change across modules, redacts passwords, filters by entity, and denies STAFF read access', async () => {
    // ---- Organization module ----
    const orgUpdate = await call('PATCH', `/organizations/${org.id}`, { name: org.name }, token);
    expect(orgUpdate.status).toBe(200);

    // ---- FSTD: create + setDiscrepancyRetention ----
    const fstd = await createFstd(call, token, org.id, { deviceCode: `AUDITTEST-${Date.now()}` });
    const discRes = await call('POST', `/fstds/${fstd.id}/discrepancies`, { description: 'Audit test discrepancy', isMmi: true }, token);
    const discrepancyId = discRes.body.id;
    const approver = await createPersonnel(call, token);
    await call('POST', `/fstds/discrepancies/${discrepancyId}/retention`, {
      category: 'CATEGORY_II',
      justification: 'audit trail test',
      approvedById: approver.id,
    }, token);

    // ---- Inventory: purchase order status transitions ----
    const supplier = await createSupplier(call, token, org.id);
    const part = await createSparePart(call, token, org.id);
    const poRes = await call('POST', '/inventory/purchase-orders', {
      organizationId: org.id,
      supplierId: supplier.id,
      items: [{ sparePartId: part.id, quantity: 1 }],
    }, token);
    const po = poRes.body;
    await call('POST', `/inventory/purchase-orders/${po.id}/submit`, null, token);

    // ---- User module: create + update (never leaks passwordHash) ----
    const newUserRes = await call('POST', '/users', {
      email: `audittest-${Date.now()}@example.com`,
      password: 'TestPass12345',
      role: 'STAFF',
      permissions: ['FSTD'],
    }, token);
    expect(newUserRes.status).toBe(201);
    const newUser = newUserRes.body;
    await call('PATCH', `/users/${newUser.id}`, { permissions: ['FSTD', 'INVENTORY'] }, token);
    await call('POST', `/users/${newUser.id}/reset-password`, { newPassword: 'NewPass67890' }, token);

    // ---- Scheduling: booking create + cancel ----
    const student = await createStudent(call, token, org.id);
    const bookingRes = await call('POST', '/bookings', {
      organizationId: org.id,
      resourceType: 'FSTD',
      resourceId: fstd.id,
      studentId: student.id,
      startAt: new Date(Date.now() + 3600_000).toISOString(),
      endAt: new Date(Date.now() + 7200_000).toISOString(),
    }, token);
    expect(bookingRes.status).toBe(201);
    const booking = bookingRes.body;
    await call('POST', `/bookings/${booking.id}/cancel`, null, token);

    // ---- Now query the audit trail and verify everything landed ----
    const allLogs = await call('GET', '/audit-logs', null, token);
    expect(allLogs.status).toBe(200);
    const logs = allLogs.body;

    expect(findLog(logs, 'Organization', org.id, 'update')).toBeTruthy();
    expect(findLog(logs, 'Fstd', fstd.id, 'create')).toBeTruthy();
    expect(findLog(logs, 'DiscrepancyLog', discrepancyId, 'set_retention')).toBeTruthy();
    expect(findLog(logs, 'PurchaseOrder', po.id, 'status_change')).toBeTruthy();
    expect(findLog(logs, 'Booking', booking.id, 'create')).toBeTruthy();
    expect(findLog(logs, 'Booking', booking.id, 'status_change')).toBeTruthy();

    const userCreateLog = findLog(logs, 'User', newUser.id, 'create');
    expect(userCreateLog).toBeTruthy();
    const userCreateStr = JSON.stringify(userCreateLog);
    expect(userCreateStr.includes('passwordHash')).toBe(false);
    expect(userCreateStr.includes('TestPass12345')).toBe(false);

    expect(findLog(logs, 'User', newUser.id, 'update')).toBeTruthy();

    const resetPwLog = findLog(logs, 'User', newUser.id, 'reset_password');
    expect(resetPwLog).toBeTruthy();
    const resetPwStr = JSON.stringify(resetPwLog);
    expect(resetPwStr.includes('NewPass67890')).toBe(false);
    expect(resetPwStr.includes('passwordHash')).toBe(false);

    // ---- Filter by entityType/entityId ----
    const filtered = await call('GET', `/audit-logs?entityType=Fstd&entityId=${fstd.id}`, null, token);
    expect(filtered.status).toBe(200);
    expect(filtered.body.every((l: any) => l.entityType === 'Fstd' && l.entityId === fstd.id)).toBe(true);

    const entityTypes = await call('GET', '/audit-logs/entity-types', null, token);
    expect(entityTypes.status).toBe(200);
    expect(entityTypes.body.includes('Fstd')).toBe(true);

    // ---- Access control: non-admin STAFF cannot view audit logs ----
    const staffLogin = await call('POST', '/auth/login', { email: newUser.email, password: 'NewPass67890' });
    const staffToken = staffLogin.body.accessToken;
    expect(staffToken).toBeTruthy();
    const staffAttempt = await call('GET', '/audit-logs', null, staffToken);
    expect(staffAttempt.status).toBe(403);
  });
});
