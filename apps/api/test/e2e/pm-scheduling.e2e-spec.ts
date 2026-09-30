import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiCall, apiFor, createTestApp, registerTenant, createOrg, createFstd, createPersonnel } from './helpers.js';

function hasLog(logs: any[], entityType: string, entityId: string, actionSubstr: string) {
  return logs.some((l) => l.entityType === entityType && l.entityId === entityId && l.action.includes(actionSubstr));
}

/// 3.3.10 例行维护保养(PM)排程: 无模板拒绝创建, 模板 upsert, 自审核拒绝, 双人复核, due-soon 仅统计已配置的级别。
describe('PM scheduling (3.3.10)', () => {
  let app: INestApplication;
  let call: ApiCall;
  let token: string;
  let org: { id: string };
  let executor: { id: string };
  let reviewer: { id: string };
  let fstd: { id: string };

  beforeAll(async () => {
    app = await createTestApp();
    call = apiFor(app);
    ({ token } = await registerTenant(call));
    org = await createOrg(call, token);
    executor = await createPersonnel(call, token);
    reviewer = await createPersonnel(call, token);
    fstd = await createFstd(call, token, org.id, { deviceCode: `PMTEST-${Date.now()}` });
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects task creation for a level with no checklist template configured', async () => {
    const res = await call('POST', `/fstds/${fstd.id}/pm-tasks`, {
      level: 'SEMI_ANNUAL',
      taskDate: new Date().toISOString(),
      itemResultsJson: [{ item: 'x', passed: true }],
    }, token);
    expect(res.status).toBe(400);
  });

  it('template create + upsert update', async () => {
    const weeklyTemplate = await call('POST', '/fstds/pm-checklist-templates', {
      organizationId: org.id,
      level: 'WEEKLY',
      itemsJson: [{ item: '检查刹车片磨损' }, { item: '检查液压油位' }],
    }, token);
    expect(weeklyTemplate.status).toBe(201);

    const monthlyTemplate = await call('POST', '/fstds/pm-checklist-templates', {
      organizationId: org.id,
      level: 'MONTHLY',
      itemsJson: [{ item: '检查视景系统投影灯泡寿命' }],
    }, token);
    expect(monthlyTemplate.status).toBe(201);

    const weeklyUpdated = await call('POST', '/fstds/pm-checklist-templates', {
      organizationId: org.id,
      level: 'WEEKLY',
      itemsJson: [{ item: '检查刹车片磨损' }, { item: '检查液压油位' }, { item: '检查座椅安全带' }],
    }, token);
    expect(weeklyUpdated.body.itemsJson.length).toBe(3);

    const templatesList = await call('GET', `/fstds/pm-checklist-templates?organizationId=${org.id}`, null, token);
    expect(templatesList.status).toBe(200);
    expect(templatesList.body.length).toBe(2);

    const allLogs = await call('GET', '/audit-logs', null, token);
    expect(hasLog(allLogs.body, 'PmChecklistTemplate', weeklyTemplate.body.id, 'create')).toBe(true);
    expect(hasLog(allLogs.body, 'PmChecklistTemplate', weeklyTemplate.body.id, 'update')).toBe(true);
  });

  it('task lifecycle: self-review rejected, different-reviewer approval, cannot re-review, reject path', async () => {
    const taskRes = await call('POST', `/fstds/${fstd.id}/pm-tasks`, {
      level: 'WEEKLY',
      taskDate: new Date().toISOString(),
      performedById: executor.id,
      responsibleIds: [reviewer.id],
      itemResultsJson: [
        { item: '检查刹车片磨损', passed: true },
        { item: '检查液压油位', passed: true, notes: '正常' },
        { item: '检查座椅安全带', passed: false, notes: '左侧安全带略有磨损, 已记录待更换' },
      ],
    }, token);
    expect(taskRes.status).toBe(201);
    const task = taskRes.body;
    expect(task.status).toBe('PENDING_REVIEW');

    const tasksList = await call('GET', `/fstds/${fstd.id}/pm-tasks`, null, token);
    expect(tasksList.status).toBe(200);
    expect(tasksList.body.some((t: any) => t.id === task.id)).toBe(true);

    const selfReviewAttempt = await call('POST', `/fstds/pm-tasks/${task.id}/review`, { approve: true, reviewedById: executor.id }, token);
    expect(selfReviewAttempt.status).toBe(400);

    const taskStillPending = (await call('GET', `/fstds/${fstd.id}/pm-tasks`, null, token)).body.find((t: any) => t.id === task.id);
    expect(taskStillPending.status).toBe('PENDING_REVIEW');

    const approveRes = await call('POST', `/fstds/pm-tasks/${task.id}/review`, { approve: true, reviewedById: reviewer.id, reviewNotes: '已核实, 安全带更换计划已单独跟踪' }, token);
    expect(approveRes.status).toBe(201);
    expect(approveRes.body.status).toBe('APPROVED');
    expect(approveRes.body.reviewedById).toBe(reviewer.id);

    const doubleReview = await call('POST', `/fstds/pm-tasks/${task.id}/review`, { approve: true, reviewedById: reviewer.id }, token);
    expect(doubleReview.status).toBe(400);

    const task2Res = await call('POST', `/fstds/${fstd.id}/pm-tasks`, {
      level: 'MONTHLY',
      taskDate: new Date().toISOString(),
      performedById: executor.id,
      itemResultsJson: [{ item: '检查视景系统投影灯泡寿命', passed: false, notes: '灯泡即将到寿, 建议更换' }],
    }, token);
    const task2 = task2Res.body;
    const rejectRes = await call('POST', `/fstds/pm-tasks/${task2.id}/review`, { approve: false, reviewedById: reviewer.id, reviewNotes: '需补充更换计划后重新提交' }, token);
    expect(rejectRes.status).toBe(201);
    expect(rejectRes.body.status).toBe('REJECTED');

    const dueSoonWide = await call('GET', `/fstds/pm-tasks/due-soon?withinDays=9999`, null, token);
    expect(dueSoonWide.status).toBe(200);
    expect(dueSoonWide.body.some((d: any) => d.fstdId === fstd.id && d.level === 'MONTHLY' && d.nextDueDate === null)).toBe(true);

    const dueSoonNarrow = await call('GET', `/fstds/pm-tasks/due-soon?withinDays=1`, null, token);
    expect(dueSoonNarrow.body.some((d: any) => d.fstdId === fstd.id && d.level === 'WEEKLY')).toBe(false);

    expect(dueSoonWide.body.some((d: any) => d.fstdId === fstd.id && (d.level === 'SEMI_ANNUAL' || d.level === 'ANNUAL'))).toBe(false);

    const allLogs = await call('GET', '/audit-logs', null, token);
    expect(hasLog(allLogs.body, 'PmTask', task.id, 'create')).toBe(true);
    expect(hasLog(allLogs.body, 'PmTask', task.id, 'status_change:PENDING_REVIEW->APPROVED')).toBe(true);
    expect(hasLog(allLogs.body, 'PmTask', task2.id, 'status_change:PENDING_REVIEW->REJECTED')).toBe(true);
  });
});
