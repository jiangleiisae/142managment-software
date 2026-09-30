import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiCall, apiFor, createTestApp, registerTenant, createPersonnel } from './helpers.js';

/// User<->Personnel 关联: 填补"登录账户无法关联到人员档案, 导致站内通知收不到"这个缺口 (见 notifications
/// 提交的说明)。覆盖: 关联/换绑/解绑, 已被占用的人员档案冲突, 不存在的人员档案, 权限校验, OWNER账户例外。
describe('user <-> personnel linking', () => {
  let app: INestApplication;
  let call: ApiCall;
  let token: string;
  let ownerUserId: string;

  beforeAll(async () => {
    app = await createTestApp();
    call = apiFor(app);
    ({ token, userId: ownerUserId } = await registerTenant(call));
  });

  afterAll(async () => {
    await app.close();
  });

  it('links, re-links, unlinks, and rejects a conflicting or missing personnel', async () => {
    const personnel1 = await createPersonnel(call, token);
    const personnel2 = await createPersonnel(call, token);

    const staffEmail = `staff-${Date.now()}@example.com`;
    const staffUser = await call('POST', '/users', { email: staffEmail, password: 'StaffPass12345', role: 'STAFF', permissions: [] }, token);
    expect(staffUser.status).toBe(201);
    const staffUserId = staffUser.body.id;
    expect(staffUser.body.personnelId ?? null).toBeNull();

    const link1 = await call('POST', `/users/${staffUserId}/link-personnel`, { personnelId: personnel1.id }, token);
    expect(link1.status).toBe(201);
    expect(link1.body.personnelId).toBe(personnel1.id);

    const p1Detail = await call('GET', `/personnel/${personnel1.id}`, null, token);
    expect(p1Detail.body.user?.id).toBe(staffUserId);
    expect(p1Detail.body.user?.email).toBe(staffEmail);

    const staff2Email = `staff2-${Date.now()}@example.com`;
    const staffUser2 = await call('POST', '/users', { email: staff2Email, password: 'StaffPass12345', role: 'STAFF', permissions: [] }, token);
    const conflictLink = await call('POST', `/users/${staffUser2.body.id}/link-personnel`, { personnelId: personnel1.id }, token);
    expect(conflictLink.status).toBe(409);

    const relink = await call('POST', `/users/${staffUserId}/link-personnel`, { personnelId: personnel2.id }, token);
    expect(relink.status).toBe(201);
    expect(relink.body.personnelId).toBe(personnel2.id);

    const p1AfterRelink = await call('GET', `/personnel/${personnel1.id}`, null, token);
    expect(p1AfterRelink.body.user).toBeNull();

    const unlink = await call('POST', `/users/${staffUserId}/unlink-personnel`, null, token);
    expect(unlink.status).toBe(201);
    expect(unlink.body.personnelId).toBeNull();

    const badLink = await call('POST', `/users/${staffUserId}/link-personnel`, { personnelId: 'nonexistent-id-xyz' }, token);
    expect(badLink.status).toBe(404);

    const staffLogin = await call('POST', '/auth/login', { email: staffEmail, password: 'StaffPass12345' });
    const staffAttempt = await call('POST', `/users/${staffUserId}/link-personnel`, { personnelId: personnel2.id }, staffLogin.body.accessToken);
    expect(staffAttempt.status).toBe(403);

    // OWNER账户本身可以被关联 (不同于 update()/resetPassword() 对OWNER目标的限制)
    const ownerLink = await call('POST', `/users/${ownerUserId}/link-personnel`, { personnelId: personnel1.id }, token);
    expect(ownerLink.status).toBe(201);

    const auditLogs = await call('GET', `/audit-logs?entityType=User&entityId=${staffUserId}`, null, token);
    expect(auditLogs.body.some((l: any) => l.action === 'link_personnel')).toBe(true);
    expect(auditLogs.body.some((l: any) => l.action === 'unlink_personnel')).toBe(true);
  });
});
