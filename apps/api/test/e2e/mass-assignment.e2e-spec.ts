import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiCall, apiFor, createTestApp, registerTenant, createOrg, createFstd } from './helpers.js';

/// 证明 mass-assignment 修复确实堵住了漏洞: 请求体里携带与真实 Prisma 列同名的额外字段, 确认它们被忽略。
describe('mass-assignment protection', () => {
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

  it('SparePart: currentQuantity 不能在创建时被设置', async () => {
    const part = await call('POST', '/inventory/spare-parts', {
      organizationId: org.id,
      partNumber: `EXPLOIT-TEST-${Date.now()}`,
      name: 'Mass assignment exploit test',
      currentQuantity: 999999,
    }, token);
    expect(part.status).toBe(201);
    expect(part.body.currentQuantity).toBe(0);
  });

  it('SparePart: currentQuantity/organizationId/partNumber 不能通过更新接口被改写', async () => {
    const part = await call('POST', '/inventory/spare-parts', {
      organizationId: org.id,
      partNumber: `EXPLOIT-UPDATE-${Date.now()}`,
      name: 'Mass assignment update exploit test',
    }, token);
    const otherOrg = await createOrg(call, token);
    const updated = await call('POST', `/inventory/spare-parts/${part.body.id}`, {
      location: 'A区-01货架',
      currentQuantity: 999999,
      organizationId: otherOrg.id,
      partNumber: 'HIJACKED-PART-NUMBER',
    }, token);
    expect(updated.status).toBe(201);
    expect(updated.body.currentQuantity).toBe(0);
    expect(updated.body.organizationId).toBe(org.id);
    expect(updated.body.partNumber).toBe(part.body.partNumber);
    expect(updated.body.location).toBe('A区-01货架');
  });

  it('Course: isApproved/approvedAt 不能在创建时被设置', async () => {
    const course = await call('POST', '/courses', {
      organizationId: org.id,
      name: `Exploit Test Course ${Date.now()}`,
      courseType: 'PPL',
      isApproved: true,
      approvedAt: new Date().toISOString(),
    }, token);
    expect(course.status).toBe(201);
    expect(course.body.isApproved).toBe(false);
    expect(course.body.approvedAt).toBeNull();
  });

  it('ManagementOfChange: status 不能在创建时被设置(必须停留在 DRAFT)', async () => {
    const moc = await call('POST', '/management-system/mocs', {
      organizationId: org.id,
      changeDescription: 'Exploit test change',
      status: 'VERIFIED',
      verifiedAt: new Date().toISOString(),
    }, token);
    expect(moc.status).toBe(201);
    expect(moc.body.status).toBe('DRAFT');
    expect(moc.body.verifiedAt).toBeNull();
  });

  it('CourseRequirement: courseId 覆盖不能把 requirement 挂到另一个 course 上', async () => {
    const course1 = await call('POST', '/courses', { organizationId: org.id, name: `Course A ${Date.now()}`, courseType: 'PPL' }, token);
    const course2 = await call('POST', '/courses', { organizationId: org.id, name: `Course B ${Date.now()}`, courseType: 'PPL' }, token);

    const req = await call('POST', `/courses/${course1.body.id}/requirements`, {
      taskCode: 'X1',
      taskName: 'Exploit test requirement',
      courseId: course2.body.id,
    }, token);
    expect(req.status).toBe(201);

    const reqList1 = await call('GET', `/courses/${course1.body.id}/requirements`, null, token);
    const reqList2 = await call('GET', `/courses/${course2.body.id}/requirements`, null, token);
    expect(reqList1.body.some((r: any) => r.taskCode === 'X1')).toBe(true);
    expect(reqList2.body.some((r: any) => r.taskCode === 'X1')).toBe(false);
  });

  it('FstdQualifiedTask: fstdId 覆盖不能把 task 挂到另一台设备上', async () => {
    const fstdA = await createFstd(call, token, org.id, { deviceCode: `EXPLOIT-A-${Date.now()}` });
    const fstdB = await createFstd(call, token, org.id, { deviceCode: `EXPLOIT-B-${Date.now()}` });

    await call('POST', `/fstds/${fstdA.id}/qualified-tasks`, {
      taskCode: 'HIJACK-TEST',
      taskName: 'Exploit test',
      fstdId: fstdB.id,
    }, token);

    const fstdADetail = await call('GET', `/fstds/${fstdA.id}`, null, token);
    const fstdBDetail = await call('GET', `/fstds/${fstdB.id}`, null, token);
    expect(fstdADetail.body.qualifiedTasks.some((t: any) => t.taskCode === 'HIJACK-TEST')).toBe(true);
    expect(fstdBDetail.body.qualifiedTasks.some((t: any) => t.taskCode === 'HIJACK-TEST')).toBe(false);
  });
});
