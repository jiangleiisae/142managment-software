import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { ApiCall, apiFor, createTestApp, registerTenant, createOrg, createPersonnel } from './helpers.js';

/// 推送通知机制的第一个落地场景: 强制事件报告超72小时未上报 (ORA.GEN.160) -> 通知该机构 SAFETY_MANAGER。
/// 覆盖: 站内通知创建/去重/已读, 短信发送尝试的审计留痕, 手动触发端点的权限校验。
describe('notifications: overdue occurrence report alert', () => {
  let app: INestApplication;
  let call: ApiCall;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  let org: { id: string };

  beforeAll(async () => {
    app = await createTestApp();
    call = apiFor(app);
    prisma = app.get(PrismaService);
    ({ token, userId } = await registerTenant(call));
    org = await createOrg(call, token);
  });

  afterAll(async () => {
    await app.close();
  });

  it('notifies the SAFETY_MANAGER once for an overdue mandatory report, ignores a fresh one, dedups on re-trigger', async () => {
    const personnel = await createPersonnel(call, token, { phone: '13800000000' });
    // 系统目前没有公开API把 User 登录账户关联到 Personnel (User.personnelId 是已有字段但无端点可写,
    // 这是既有系统的缺口, 与本次改动无关) - 直接走 Prisma 建立关联, 仅用于让这条通知链路可测。
    await prisma.user.update({ where: { id: userId }, data: { personnelId: personnel.id } });

    const roleAssign = await call('POST', '/management-system/role-assignments', {
      organizationId: org.id,
      personnelId: personnel.id,
      role: 'SAFETY_MANAGER',
      startDate: '2026-01-01',
    }, token);
    expect(roleAssign.status).toBe(201);

    const overdueOcc = await call('POST', '/management-system/occurrence-reports', {
      organizationId: org.id,
      discoveredAt: new Date(Date.now() - 80 * 3600_000).toISOString(),
      occurrenceType: 'GROUND_INCIDENT',
      isMandatory: true,
    }, token);
    expect(overdueOcc.status).toBe(201);

    // 对照组: 未超时的不应触发
    const freshOcc = await call('POST', '/management-system/occurrence-reports', {
      organizationId: org.id,
      discoveredAt: new Date().toISOString(),
      occurrenceType: 'GROUND_INCIDENT',
      isMandatory: true,
    }, token);
    expect(freshOcc.status).toBe(201);

    const unreadBefore = await call('GET', '/notifications/unread-count', null, token);
    expect(unreadBefore.body.count).toBe(0);

    const trigger = await call('POST', '/notifications/check-overdue-occurrence-reports', null, token);
    expect(trigger.status).toBe(201);
    // notifiedCount 是全租户扫描结果(设计如此, 定时任务本来就该扫全部租户), 在共享的 tcms_test 库里
    // 不能断言精确值(其他测试文件的遗留数据也可能贡献计数) - 用下面按 recipientUserId 限定的 list 来做精确断言。
    expect(trigger.body.notifiedCount).toBeGreaterThanOrEqual(1);

    const list = await call('GET', '/notifications', null, token);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    const notification = list.body[0];
    expect(notification.entityType).toBe('OccurrenceReport');
    expect(notification.entityId).toBe(overdueOcc.body.id);
    expect(notification.readAt).toBeNull();

    const unreadAfter = await call('GET', '/notifications/unread-count', null, token);
    expect(unreadAfter.body.count).toBe(1);

    const markRead = await call('POST', `/notifications/${notification.id}/read`, null, token);
    expect(markRead.status).toBe(201);
    expect(markRead.body.readAt).not.toBeNull();

    const unreadAfterRead = await call('GET', '/notifications/unread-count', null, token);
    expect(unreadAfterRead.body.count).toBe(0);

    // 去重: 再次触发不应对同一份报告重复通知
    const trigger2 = await call('POST', '/notifications/check-overdue-occurrence-reports', null, token);
    expect(trigger2.body.notifiedCount).toBe(0);
    const listAfterDedup = await call('GET', '/notifications', null, token);
    expect(listAfterDedup.body).toHaveLength(1);

    // 短信发送尝试应留痕在审计日志里 (默认 LogSmsSender 不真实发送, 但仍走 AuditLog)
    const auditLogs = await call('GET', '/audit-logs?entityType=Notification', null, token);
    expect(auditLogs.body.some((l: any) => l.action === 'sms_sent')).toBe(true);
  });

  it('restricts the manual trigger endpoint to OWNER/ADMIN and notifications to their own recipient', async () => {
    const notifList = await call('GET', '/notifications', null, token);
    const someNotificationId = notifList.body[0]?.id;

    const staffEmail = `staff-${Date.now()}@example.com`;
    const newUser = await call('POST', '/users', { email: staffEmail, password: 'StaffPass12345', role: 'STAFF', permissions: [] }, token);
    expect(newUser.status).toBe(201);
    const staffLogin = await call('POST', '/auth/login', { email: staffEmail, password: 'StaffPass12345' });
    const staffToken = staffLogin.body.accessToken;

    const staffTrigger = await call('POST', '/notifications/check-overdue-occurrence-reports', null, staffToken);
    expect(staffTrigger.status).toBe(403);

    if (someNotificationId) {
      const staffMarkRead = await call('POST', `/notifications/${someNotificationId}/read`, null, staffToken);
      expect(staffMarkRead.status).toBe(404);
    }
  });
});
