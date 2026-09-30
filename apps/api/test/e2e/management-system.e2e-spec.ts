import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiCall, apiFor, createTestApp, registerTenant, createOrg, createPersonnel } from './helpers.js';

/// 覆盖 management-system 模块全部24个端点的闭环: 角色任命, 事件报告, 审计闭环, SMS 风险闭环,
/// 安全政策, MOC 变更管理, ERP 演练, SPI/SPT 指标, SRB 会议, 承包活动合同。
describe('management-system module', () => {
  let app: INestApplication;
  let call: ApiCall;
  let token: string;
  let org: { id: string };
  let personnel: { id: string };

  beforeAll(async () => {
    app = await createTestApp();
    call = apiFor(app);
    ({ token } = await registerTenant(call));
    org = await createOrg(call, token);
    personnel = await createPersonnel(call, token);
  });

  afterAll(async () => {
    await app.close();
  });

  it('role assignment: create + reject invalid enum role', async () => {
    const role = await call('POST', '/management-system/role-assignments', {
      organizationId: org.id,
      personnelId: personnel.id,
      role: 'SAFETY_MANAGER',
      startDate: '2026-01-01',
      appointmentRef: `REF-${Date.now()}`,
    }, token);
    expect(role.status).toBe(201);

    const badRole = await call('POST', '/management-system/role-assignments', {
      organizationId: org.id,
      personnelId: personnel.id,
      role: 'NOT_A_REAL_ROLE',
      startDate: '2026-01-01',
    }, token);
    expect(badRole.status).toBe(400);
  });

  it('occurrence report: create + mark-reported + missing required field rejected', async () => {
    const occ = await call('POST', '/management-system/occurrence-reports', {
      organizationId: org.id,
      discoveredAt: new Date().toISOString(),
      occurrenceType: 'GROUND_INCIDENT',
      isMandatory: true,
    }, token);
    expect(occ.status).toBe(201);

    const markReported = await call('POST', `/management-system/occurrence-reports/${occ.body.id}/mark-reported`, { reportedTo: 'CAAC' }, token);
    expect(markReported.status).toBe(201);

    const missingField = await call('POST', '/management-system/occurrence-reports', {
      organizationId: org.id,
      discoveredAt: new Date().toISOString(),
    }, token);
    expect(missingField.status).toBe(400);
  });

  it('audit schedule -> task -> finding -> corrective action closed loop', async () => {
    const schedule = await call('POST', '/management-system/audit-schedules', {
      organizationId: org.id,
      title: `Annual Audit ${Date.now()}`,
      plannedAt: '2026-06-01',
    }, token);
    expect(schedule.status).toBe(201);

    const task = await call('POST', `/management-system/audit-schedules/${schedule.body.id}/tasks`, { scope: 'Full ATO scope' }, token);
    expect(task.status).toBe(201);

    const finding = await call('POST', `/management-system/audit-tasks/${task.body.id}/findings`, {
      level: 2,
      description: 'Missing signature on training record',
    }, token);
    expect(finding.status).toBe(201);

    const badFinding = await call('POST', `/management-system/audit-tasks/${task.body.id}/findings`, { level: 'high', description: 'bad level type' }, token);
    expect(badFinding.status).toBe(400);

    const corrective = await call('POST', `/management-system/findings/${finding.body.id}/corrective-actions`, { planDescription: 'Retrain and re-sign records' }, token);
    expect(corrective.status).toBe(201);

    const closeCorrective = await call('POST', `/management-system/corrective-actions/${corrective.body.id}/close`, null, token);
    expect(closeCorrective.status).toBe(201);
  });

  it('SMS: hazard -> risk assessment -> mitigation closed loop', async () => {
    const hazard = await call('POST', '/management-system/hazards', {
      organizationId: org.id,
      source: 'Ramp inspection',
      description: 'Loose GPU cable across taxiway',
    }, token);
    expect(hazard.status).toBe(201);

    const risk = await call('POST', `/management-system/hazards/${hazard.body.id}/risk-assessments`, { probabilityLevel: 3, severityLevel: 4 }, token);
    expect(risk.status).toBe(201);
    expect(risk.body.riskScore).toBe(12);

    const badRisk = await call('POST', `/management-system/hazards/${hazard.body.id}/risk-assessments`, { probabilityLevel: 9, severityLevel: 4 }, token);
    expect(badRisk.status).toBe(400);

    const mitigation = await call('POST', `/management-system/risk-assessments/${risk.body.id}/mitigation-actions`, {
      description: 'Reroute GPU cable and install cable ramp',
    }, token);
    expect(mitigation.status).toBe(201);

    const closeMitigation = await call('POST', `/management-system/mitigation-actions/${mitigation.body.id}/close`, null, token);
    expect(closeMitigation.status).toBe(201);
  });

  it('safety policy: create', async () => {
    const policy = await call('POST', '/management-system/safety-policies', {
      organizationId: org.id,
      version: `v${Date.now()}`,
      policyText: 'We commit to safety above all.',
      effectiveDate: '2026-01-01',
    }, token);
    expect(policy.status).toBe(201);
  });

  it('MOC: create -> risk-assessment -> implement -> verify', async () => {
    const moc = await call('POST', '/management-system/mocs', { organizationId: org.id, changeDescription: 'Switch to new fuel supplier' }, token);
    expect(moc.status).toBe(201);

    const mocHazard = await call('POST', '/management-system/hazards', { organizationId: org.id, source: 'MOC review', description: 'Fuel quality variance risk' }, token);
    const mocRisk = await call('POST', `/management-system/hazards/${mocHazard.body.id}/risk-assessments`, { probabilityLevel: 2, severityLevel: 2 }, token);

    const attach = await call('POST', `/management-system/mocs/${moc.body.id}/risk-assessment`, { riskAssessmentId: mocRisk.body.id }, token);
    expect(attach.status).toBe(201);

    const implement = await call('POST', `/management-system/mocs/${moc.body.id}/implement`, { implementationPlan: 'Phase in new supplier over 30 days' }, token);
    expect(implement.status).toBe(201);

    const verify = await call('POST', `/management-system/mocs/${moc.body.id}/verify`, { verificationNotes: 'Fuel quality within spec after transition' }, token);
    expect(verify.status).toBe(201);
  });

  it('ERP: plan -> drill', async () => {
    const erp = await call('POST', '/management-system/erp-plans', {
      organizationId: org.id,
      version: `erp-v${Date.now()}`,
      planText: 'Emergency response procedures...',
      effectiveDate: '2026-01-01',
    }, token);
    expect(erp.status).toBe(201);

    const drill = await call('POST', `/management-system/erp-plans/${erp.body.id}/drills`, {
      drilledAt: new Date().toISOString(),
      scenario: 'Cabin fire evacuation',
      outcome: 'Successful, 4 min evacuation',
    }, token);
    expect(drill.status).toBe(201);
  });

  it('SPI/SPT: indicator + measurement, invalid direction rejected', async () => {
    const indicator = await call('POST', '/management-system/safety-indicators', {
      organizationId: org.id,
      name: `Go-around rate ${Date.now()}`,
      targetValue: 5,
      direction: 'LOWER_IS_BETTER',
    }, token);
    expect(indicator.status).toBe(201);

    const badIndicator = await call('POST', '/management-system/safety-indicators', {
      organizationId: org.id,
      name: 'Bad direction indicator',
      targetValue: 5,
      direction: 'SIDEWAYS',
    }, token);
    expect(badIndicator.status).toBe(400);

    const measurement = await call('POST', `/management-system/safety-indicators/${indicator.body.id}/measurements`, {
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      value: 3,
    }, token);
    expect(measurement.status).toBe(201);
  });

  it('SRB: meeting + action, empty attendeeRoles rejected', async () => {
    const srb = await call('POST', '/management-system/srb-meetings', {
      organizationId: org.id,
      meetingDate: '2026-02-01',
      attendeeRoles: ['ACCOUNTABLE_MANAGER', 'SAFETY_MANAGER'],
      agenda: 'Quarterly safety review',
    }, token);
    expect(srb.status).toBe(201);

    const badSrb = await call('POST', '/management-system/srb-meetings', {
      organizationId: org.id,
      meetingDate: '2026-02-01',
      attendeeRoles: [],
      agenda: 'Quarterly safety review',
    }, token);
    expect(badSrb.status).toBe(400);

    const srbAction = await call('POST', `/management-system/srb-meetings/${srb.body.id}/actions`, { description: 'Update ERP based on drill feedback' }, token);
    expect(srbAction.status).toBe(201);

    const closeAction = await call('POST', `/management-system/srb-actions/${srbAction.body.id}/close`, null, token);
    expect(closeAction.status).toBe(201);
  });

  it('contracts: create + update without clobbering untouched fields + missing required field rejected', async () => {
    const contract = await call('POST', '/management-system/contracts', {
      organizationId: org.id,
      contractorName: `Acme MRO ${Date.now()}`,
      scope: 'Line maintenance',
      includedInAudit: true,
    }, token);
    expect(contract.status).toBe(201);

    const update = await call('POST', `/management-system/contracts/${contract.body.id}`, { scope: 'Line maintenance and base maintenance' }, token);
    expect(update.status).toBe(201);
    expect(update.body.scope).toBe('Line maintenance and base maintenance');
    expect(update.body.contractorName).toBe(contract.body.contractorName);

    const missingField = await call('POST', '/management-system/contracts', { organizationId: org.id, contractorName: 'Missing scope contractor' }, token);
    expect(missingField.status).toBe(400);
  });
});
