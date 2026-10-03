import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiCall, apiFor, createOrg, createPersonnel, createTestApp, registerTenant } from './helpers.js';

/// 质量管理 (R6): 会议记录、培训管理、其他检查、问卷。
describe('quality management', () => {
  let app: INestApplication;
  let call: ApiCall;
  let token: string;
  let org: { id: string };

  const staffLogin = async (permissions: string[]) => {
    const email = `staff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
    expect((await call('POST', '/users', { email, password: 'StaffPass12345', role: 'STAFF', permissions }, token)).status).toBe(201);
    return { email, token: (await call('POST', '/auth/login', { email, password: 'StaffPass12345' })).body.accessToken as string };
  };

  beforeAll(async () => {
    app = await createTestApp();
    call = apiFor(app);
    ({ token } = await registerTenant(call));
    org = await createOrg(call, token);
  });

  afterAll(async () => {
    await app.close();
  });

  it('会议记录: 固定栏目、校验、筛选、修改、删除、租户隔离', async () => {
    const host = await createPersonnel(call, token, { firstName: '明', lastName: '王' });
    const recorder = await createPersonnel(call, token, { firstName: '华', lastName: '李' });
    const body = {
      organizationId: org.id,
      subject: '周例会',
      startAt: '2026-09-07T01:00:00.000Z',
      endAt: '2026-09-07T02:00:00.000Z',
      method: 'ONLINE',
      department: '维护部',
      hostPersonnelId: host.id,
      recorderPersonnelId: recorder.id,
      attendeeIds: [host.id, recorder.id],
      topics: '视景故障分析',
      lastWeekReport: '完成 PM 周检',
      thisWeekTasks: [{ category: 'DAILY', content: '日常巡检' }, { category: 'QTG', content: '季度 QTG' }],
      faultAnalysis: '视景卡故障',
      suggestions: '增加备件',
    };
    expect((await call('POST', '/quality/meetings', { ...body, endAt: body.startAt }, token)).status).toBe(400);
    expect((await call('POST', '/quality/meetings', { ...body, thisWeekTasks: [{ category: 'BAD', content: 'x' }] }, token)).status).toBe(400);
    expect((await call('POST', '/quality/meetings', { ...body, method: 'TELEPATHY' }, token)).status).toBe(400);
    expect((await call('POST', '/quality/meetings', { ...body, attendeeIds: ['nope'] }, token)).status).toBe(400);

    const created = await call('POST', '/quality/meetings', body, token);
    expect(created.status).toBe(201);
    await call('POST', '/quality/meetings', { ...body, subject: '月度质量会', startAt: '2026-10-05T01:00:00.000Z', endAt: '2026-10-05T02:00:00.000Z', topics: '质量目标' }, token);

    const all = await call('GET', `/quality/meetings?organizationId=${org.id}`, undefined, token);
    expect(all.body.map((m: { subject: string }) => m.subject)).toEqual(['月度质量会', '周例会']); // 时间倒序
    const first = all.body.find((m: { subject: string }) => m.subject === '周例会');
    expect(first).toMatchObject({ host: '王明', recorder: '李华', attendees: ['王明', '李华'] });
    expect(first.thisWeekTasksJson).toHaveLength(2);

    const sept = await call('GET', `/quality/meetings?organizationId=${org.id}&from=2026-09-01&to=2026-09-30`, undefined, token);
    expect(sept.body).toHaveLength(1);
    expect((await call('GET', `/quality/meetings?organizationId=${org.id}&keyword=${encodeURIComponent('视景')}`, undefined, token)).body).toHaveLength(1);

    const patched = await call('PATCH', `/quality/meetings/${created.body.id}`, { suggestions: '补充备件清单' }, token);
    expect(patched.body.suggestions).toBe('补充备件清单');
    expect((await call('PATCH', `/quality/meetings/${created.body.id}`, { endAt: '2026-09-07T00:00:00.000Z' }, token)).status).toBe(400); // 早于开始

    const stranger = await registerTenant(call);
    expect((await call('PATCH', `/quality/meetings/${created.body.id}`, { subject: 'x' }, stranger.token)).status).toBe(404);
    expect((await call('GET', `/quality/meetings?organizationId=${org.id}`, undefined, stranger.token)).status).toBe(403);

    expect((await call('DELETE', `/quality/meetings/${created.body.id}`, undefined, token)).status).toBe(200);
    expect((await call('GET', `/quality/meetings?organizationId=${org.id}`, undefined, token)).body).toHaveLength(1);
    const audit = await call('GET', `/audit-logs?entityType=QualityMeeting&entityId=${created.body.id}`, undefined, token);
    expect(audit.body.map((a: { action: string }) => a.action).sort()).toEqual(['create', 'delete', 'update']);
  });

  it('培训管理: 创建、校验、筛选、修改、删除', async () => {
    const p = await createPersonnel(call, token, { firstName: '强', lastName: '张' });
    const body = { organizationId: org.id, subject: '新设备操作培训', startAt: '2026-09-10T01:00:00.000Z', endAt: '2026-09-10T03:00:00.000Z', location: '培训室', trainerName: '厂商工程师', content: 'IOS 使用', attendeeIds: [p.id] };
    expect((await call('POST', '/quality/trainings', { ...body, endAt: '2026-09-10T00:00:00.000Z' }, token)).status).toBe(400);
    expect((await call('POST', '/quality/trainings', { ...body, attendeeIds: ['nope'] }, token)).status).toBe(400);
    const created = await call('POST', '/quality/trainings', body, token);
    expect(created.status).toBe(201);
    const list = await call('GET', `/quality/trainings?organizationId=${org.id}&keyword=IOS`, undefined, token);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].attendees).toEqual(['张强']);
    expect((await call('PATCH', `/quality/trainings/${created.body.id}`, { location: '会议室' }, token)).body.location).toBe('会议室');
    expect((await call('GET', `/quality/trainings?organizationId=${org.id}&from=2026-10-01&to=2026-10-31`, undefined, token)).body).toHaveLength(0);
    expect((await call('DELETE', `/quality/trainings/${created.body.id}`, undefined, token)).status).toBe(200);
  });

  it('其他检查: 检查项整体替换(停用而不删除)、校验、结果快照', async () => {
    const set = (names: string[]) => call('PUT', '/quality/inspection-items', { organizationId: org.id, names }, token);
    const first = await set(['机房温度', '消防器材', '机房温度', '  ']);
    expect(first.body.map((i: { name: string }) => i.name)).toEqual(['机房温度', '消防器材']); // 去重去空, 按顺序

    const record = (results: unknown, extra: Record<string, unknown> = {}) => call('POST', '/quality/inspections', { organizationId: org.id, inspectedOn: '2026-09-15', title: '专项检查', results, ...extra }, token);
    expect((await record([{ name: '不存在的项', passed: true }])).status).toBe(400);
    expect((await record([{ name: '机房温度', passed: true }, { name: '机房温度', passed: false }])).status).toBe(400);
    expect((await record([{ name: '机房温度', passed: true }], { inspectedOn: '2026-02-30' })).status).toBe(400);
    expect((await record([{ name: '机房温度', passed: true }], { performedByPersonnelId: 'nope' })).status).toBe(400);

    const ok = await record([{ name: '机房温度', passed: true }, { name: '消防器材', passed: false, notes: '灭火器过期' }]);
    expect(ok.status).toBe(201);
    expect(ok.body.overallResult).toBe('issues_found');

    // 替换: 去掉 消防器材、新增 门禁 → 消防器材停用, 历史记录里的名称保留
    const second = await set(['门禁', '机房温度']);
    const names = second.body.filter((i: { isActive: boolean }) => i.isActive).map((i: { name: string }) => i.name);
    expect(names).toEqual(['门禁', '机房温度']);
    expect(second.body.find((i: { name: string }) => i.name === '消防器材').isActive).toBe(false);
    expect((await record([{ name: '消防器材', passed: true }])).status).toBe(400); // 已停用

    const list = await call('GET', `/quality/inspections?organizationId=${org.id}`, undefined, token);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].items.map((i: { name: string }) => i.name)).toEqual(['机房温度', '消防器材']);
    expect((await call('GET', `/quality/inspections?organizationId=${org.id}&result=pass`, undefined, token)).body).toHaveLength(0);
    expect((await call('GET', `/quality/inspections?organizationId=${org.id}&result=weird`, undefined, token)).status).toBe(400);
    expect((await set(['x'.repeat(201)])).status).toBe(400);
  });

  it('问卷: 题目校验、发布通知、任意登录用户填写一次、统计占比/平均分、匿名、关闭', async () => {
    const q = (extra: Record<string, unknown>) => ({ organizationId: org.id, title: '满意度调查', questions: [{ type: 'RATING', text: '总体满意度', required: true }], ...extra });
    expect((await call('POST', '/quality/surveys', q({ questions: [] }), token)).status).toBe(400);
    expect((await call('POST', '/quality/surveys', q({ questions: [{ type: 'SINGLE', text: '只有一个选项', options: ['A'] }] }), token)).status).toBe(400);
    expect((await call('POST', '/quality/surveys', q({ questions: [{ type: 'SINGLE', text: '重复选项', options: ['A', 'A '] }] }), token)).status).toBe(400);
    expect((await call('POST', '/quality/surveys', q({ questions: [{ type: 'NOPE', text: 'x' }] }), token)).status).toBe(400);

    const survey = await call(
      'POST',
      '/quality/surveys',
      q({
        questions: [
          { type: 'RATING', text: '总体满意度', required: true },
          { type: 'SINGLE', text: '设备状态', options: ['好', '一般', '差'], required: true },
          { type: 'MULTI', text: '需要改进', options: ['培训', '备件', '流程'] },
          { type: 'TEXT', text: '其他建议' },
        ],
      }),
      token,
    );
    expect(survey.status).toBe(201);
    const id = survey.body.id as string;
    expect(survey.body.questionsJson.map((x: { id: string }) => x.id)).toEqual(['q1', 'q2', 'q3', 'q4']);

    const alice = await staffLogin([]); // 没有任何模块权限也能填问卷
    const bob = await staffLogin([]);
    expect((await call('POST', `/quality/surveys/${id}/respond`, { answers: { q1: 5, q2: '好' } }, alice.token)).status).toBe(400); // 未发布

    // 草稿可改, 发布后不可改/不可删
    expect((await call('PATCH', `/quality/surveys/${id}`, { description: '请如实填写' }, token)).status).toBe(200);
    expect((await call('POST', `/quality/surveys/${id}/publish`, undefined, token)).status).toBe(201);
    expect((await call('PATCH', `/quality/surveys/${id}`, { title: '改名' }, token)).status).toBe(400);
    expect((await call('DELETE', `/quality/surveys/${id}`, undefined, token)).status).toBe(400);
    expect((await call('POST', `/quality/surveys/${id}/publish`, undefined, token)).status).toBe(400);

    // 发布时每个启用账号收到站内通知
    const notes = await call('GET', '/notifications', undefined, alice.token);
    expect(notes.body.some((n: { entityId: string; title: string }) => n.entityId === id && n.title === '新问卷')).toBe(true);

    // 填写: 校验
    const respond = (t: string, answers: Record<string, unknown>) => call('POST', `/quality/surveys/${id}/respond`, { answers }, t);
    expect((await respond(alice.token, { q2: '好' })).status).toBe(400); // 缺必填 q1
    expect((await respond(alice.token, { q1: 6, q2: '好' })).status).toBe(400);
    expect((await respond(alice.token, { q1: 5, q2: '不存在' })).status).toBe(400);
    expect((await respond(alice.token, { q1: 5, q2: '好', q3: ['培训', '未知'] })).status).toBe(400);
    expect((await respond(alice.token, { q1: 5, q2: '好', q9: 'x' })).status).toBe(400);
    expect((await respond(alice.token, { q1: 5, q2: '好', q3: ['培训', '备件'], q4: '多做培训' })).status).toBe(201);
    expect((await respond(alice.token, { q1: 5, q2: '好' })).status).toBe(400); // 每人一次
    expect((await respond(bob.token, { q1: 3, q2: '差', q3: ['备件'] })).status).toBe(201);

    // 我的问卷
    const mine = await call('GET', '/quality/my-surveys', undefined, alice.token);
    expect(mine.body.find((s: { id: string }) => s.id === id)).toMatchObject({ answered: true });
    expect((await call('GET', '/quality/my-surveys', undefined, bob.token)).body[0].questions).toHaveLength(4);

    // 统计 (需要 MANAGEMENT_SYSTEM)
    expect((await call('GET', `/quality/surveys/${id}/stats`, undefined, alice.token)).status).toBe(403);
    const stats = await call('GET', `/quality/surveys/${id}/stats`, undefined, token);
    expect(stats.status).toBe(200);
    expect(stats.body.totalResponses).toBe(2);
    const byId = Object.fromEntries(stats.body.stats.map((s: { id: string }) => [s.id, s]));
    expect(byId.q1.average).toBe(4);
    expect(byId.q1.distribution.find((d: { score: number }) => d.score === 5).count).toBe(1);
    expect(byId.q2.options).toEqual([{ option: '好', count: 1, percent: 50 }, { option: '一般', count: 0, percent: 0 }, { option: '差', count: 1, percent: 50 }]);
    expect(byId.q3.answered).toBe(2);
    expect(byId.q3.options.find((o: { option: string }) => o.option === '备件')).toMatchObject({ count: 2, percent: 100 });
    expect(byId.q4.texts).toEqual(['多做培训']);
    expect(stats.body.records.map((r: { respondent: string }) => r.respondent).sort()).toEqual([alice.email, bob.email].sort());

    // 关闭后不再接收
    expect((await call('POST', `/quality/surveys/${id}/close`, undefined, token)).status).toBe(201);
    const carol = await staffLogin([]);
    expect((await respond(carol.token, { q1: 4, q2: '好' })).status).toBe(400);
    expect((await call('POST', `/quality/surveys/${id}/close`, undefined, token)).status).toBe(400);

    // 别的租户看不到也填不了
    const stranger = await registerTenant(call);
    expect((await call('GET', '/quality/my-surveys', undefined, stranger.token)).body).toEqual([]);
    expect((await call('POST', `/quality/surveys/${id}/respond`, { answers: { q1: 5, q2: '好' } }, stranger.token)).status).toBe(404);
  });

  it('匿名问卷: 统计和填写记录不显示姓名, 仍然防重复提交', async () => {
    const survey = await call('POST', '/quality/surveys', { organizationId: org.id, title: '匿名意见', anonymous: true, questions: [{ type: 'TEXT', text: '意见' }] }, token);
    const id = survey.body.id as string;
    await call('POST', `/quality/surveys/${id}/publish`, undefined, token);
    const dave = await staffLogin([]);
    expect((await call('POST', `/quality/surveys/${id}/respond`, { answers: { q1: '希望增加培训' } }, dave.token)).status).toBe(201);
    expect((await call('POST', `/quality/surveys/${id}/respond`, { answers: { q1: '再来一次' } }, dave.token)).status).toBe(400);
    const stats = await call('GET', `/quality/surveys/${id}/stats`, undefined, token);
    expect(stats.body.records).toHaveLength(1);
    expect(stats.body.records[0].respondent).toBeNull();
    expect(JSON.stringify(stats.body)).not.toContain(dave.email);
  });
});
