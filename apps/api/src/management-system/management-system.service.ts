import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ManagementRoleType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ManagementSystemService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- 3.2.1 组织角色与任命 ----

  assignRole(data: { organizationId: string; personnelId: string; role: ManagementRoleType; startDate: string; appointmentRef?: string }) {
    return this.prisma.personnelRoleAssignment.create({
      data: {
        organizationId: data.organizationId,
        personnelId: data.personnelId,
        role: data.role,
        startDate: new Date(data.startDate),
        appointmentRef: data.appointmentRef,
      },
    });
  }

  listRoleAssignments(organizationId: string) {
    return this.prisma.personnelRoleAssignment.findMany({
      where: { organizationId, endDate: null },
      include: { personnel: true },
    });
  }

  async endRoleAssignment(id: string, tenantId: string) {
    const assignment = await this.prisma.personnelRoleAssignment.findUnique({
      where: { id },
      include: { organization: true },
    });
    if (!assignment || assignment.organization.tenantId !== tenantId) {
      throw new NotFoundException(`Role assignment ${id} not found`);
    }
    return this.prisma.personnelRoleAssignment.update({ where: { id }, data: { endDate: new Date() } });
  }

  // ---- 3.2.2 事件报告 (ORA.GEN.160), 72小时强制上报倒计时 ----

  reportOccurrence(data: {
    organizationId: string;
    discoveredAt: string;
    occurrenceType: string;
    involvedPersonnel?: string;
    involvedAircraft?: string;
    involvedFstdId?: string;
    isMandatory?: boolean;
  }) {
    return this.prisma.occurrenceReport.create({
      data: {
        organizationId: data.organizationId,
        discoveredAt: new Date(data.discoveredAt),
        occurrenceType: data.occurrenceType,
        involvedPersonnel: data.involvedPersonnel,
        involvedAircraft: data.involvedAircraft,
        involvedFstdId: data.involvedFstdId,
        isMandatory: data.isMandatory ?? true,
      },
    });
  }

  /// 找出尚未上报且已临近/超过72小时时限的强制性事件, 限定在当前租户范围内 (此前漏了租户过滤, 已修复)
  async findOverdueOccurrenceReports(tenantId: string) {
    const cutoff72h = new Date(Date.now() - 72 * 60 * 60 * 1000);
    return this.prisma.occurrenceReport.findMany({
      where: {
        isMandatory: true,
        reportedAt: null,
        discoveredAt: { lte: cutoff72h },
        organization: { tenantId },
      },
    });
  }

  async markOccurrenceReported(id: string, tenantId: string, reportedTo: string) {
    const report = await this.prisma.occurrenceReport.findUnique({ where: { id }, include: { organization: true } });
    if (!report || report.organization.tenantId !== tenantId) throw new NotFoundException(`Occurrence report ${id} not found`);
    return this.prisma.occurrenceReport.update({
      where: { id },
      data: { reportedAt: new Date(), reportedTo },
    });
  }

  // ---- 3.2.3 合规监督闭环: audit_schedule -> audit_task -> finding -> corrective_action ----

  createAuditSchedule(data: { organizationId: string; title: string; plannedAt: string; scopeTag?: string }) {
    return this.prisma.auditSchedule.create({
      data: {
        organizationId: data.organizationId,
        title: data.title,
        plannedAt: new Date(data.plannedAt),
        scopeTag: data.scopeTag,
      },
    });
  }

  listAuditSchedules(organizationId: string) {
    return this.prisma.auditSchedule.findMany({
      where: { organizationId },
      include: { tasks: { include: { findings: true } } },
    });
  }

  private async findAuditScheduleOrThrow(auditScheduleId: string, tenantId: string) {
    const schedule = await this.prisma.auditSchedule.findUnique({
      where: { id: auditScheduleId },
      include: { organization: true },
    });
    if (!schedule || schedule.organization.tenantId !== tenantId) {
      throw new NotFoundException(`Audit schedule ${auditScheduleId} not found`);
    }
    return schedule;
  }

  private async findAuditTaskOrThrow(auditTaskId: string, tenantId: string) {
    const task = await this.prisma.auditTask.findUnique({
      where: { id: auditTaskId },
      include: { auditSchedule: { include: { organization: true } } },
    });
    if (!task || task.auditSchedule.organization.tenantId !== tenantId) {
      throw new NotFoundException(`Audit task ${auditTaskId} not found`);
    }
    return task;
  }

  private async findFindingOrThrow(findingId: string, tenantId: string) {
    const finding = await this.prisma.finding.findUnique({
      where: { id: findingId },
      include: { auditTask: { include: { auditSchedule: { include: { organization: true } } } } },
    });
    if (!finding || finding.auditTask.auditSchedule.organization.tenantId !== tenantId) {
      throw new NotFoundException(`Finding ${findingId} not found`);
    }
    return finding;
  }

  async createAuditTask(auditScheduleId: string, tenantId: string, data: { auditorId?: string; scope: string }) {
    await this.findAuditScheduleOrThrow(auditScheduleId, tenantId);
    return this.prisma.auditTask.create({ data: { auditScheduleId, ...data } });
  }

  async completeAuditTask(id: string, tenantId: string) {
    await this.findAuditTaskOrThrow(id, tenantId);
    return this.prisma.auditTask.update({ where: { id }, data: { status: 'completed', performedAt: new Date() } });
  }

  async addFinding(auditTaskId: string, tenantId: string, data: { level: number; description: string; rootCause?: string }) {
    await this.findAuditTaskOrThrow(auditTaskId, tenantId);
    return this.prisma.finding.create({ data: { auditTaskId, ...data } });
  }

  async addCorrectiveAction(
    findingId: string,
    tenantId: string,
    data: { planDescription: string; responsiblePersonnelId?: string; dueDate?: string },
  ) {
    await this.findFindingOrThrow(findingId, tenantId);
    return this.prisma.correctiveAction.create({
      data: {
        findingId,
        planDescription: data.planDescription,
        responsiblePersonnelId: data.responsiblePersonnelId,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });
  }

  async closeCorrectiveAction(id: string, tenantId: string) {
    const action = await this.prisma.correctiveAction.findUnique({
      where: { id },
      include: { finding: { include: { auditTask: { include: { auditSchedule: { include: { organization: true } } } } } } },
    });
    if (!action || action.finding.auditTask.auditSchedule.organization.tenantId !== tenantId) {
      throw new NotFoundException(`CorrectiveAction ${id} not found`);
    }
    return this.prisma.correctiveAction.update({ where: { id }, data: { status: 'closed', closedAt: new Date() } });
  }

  // ---- SMS 风险管理闭环: hazard_register -> risk_assessment -> mitigation_action (ORA.GEN.200(a)(3)) ----

  reportHazard(data: { organizationId: string; source: string; description: string; affectedArea?: string }) {
    return this.prisma.hazardRegisterEntry.create({ data });
  }

  listHazards(organizationId: string) {
    return this.prisma.hazardRegisterEntry.findMany({
      where: { organizationId },
      include: { riskAssessments: { include: { mitigations: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findHazardOrThrow(hazardId: string, tenantId: string) {
    const hazard = await this.prisma.hazardRegisterEntry.findUnique({
      where: { id: hazardId },
      include: { organization: true },
    });
    if (!hazard || hazard.organization.tenantId !== tenantId) throw new NotFoundException(`Hazard ${hazardId} not found`);
    return hazard;
  }

  private async findRiskAssessmentOrThrow(riskAssessmentId: string, tenantId: string) {
    const assessment = await this.prisma.riskAssessment.findUnique({
      where: { id: riskAssessmentId },
      include: { hazard: { include: { organization: true } } },
    });
    if (!assessment || assessment.hazard.organization.tenantId !== tenantId) {
      throw new NotFoundException(`Risk assessment ${riskAssessmentId} not found`);
    }
    return assessment;
  }

  /// 风险矩阵: riskScore = probabilityLevel(1-5) x severityLevel(1-5), 分值越高优先级越高
  async assessRisk(
    hazardId: string,
    tenantId: string,
    data: { probabilityLevel: number; severityLevel: number; existingMitigation?: string; residualRiskLevel?: number },
  ) {
    await this.findHazardOrThrow(hazardId, tenantId);
    if (data.probabilityLevel < 1 || data.probabilityLevel > 5 || data.severityLevel < 1 || data.severityLevel > 5) {
      throw new BadRequestException('probabilityLevel 和 severityLevel 必须在 1-5 之间');
    }
    return this.prisma.riskAssessment.create({
      data: {
        hazardId,
        probabilityLevel: data.probabilityLevel,
        severityLevel: data.severityLevel,
        riskScore: data.probabilityLevel * data.severityLevel,
        existingMitigation: data.existingMitigation,
        residualRiskLevel: data.residualRiskLevel,
      },
    });
  }

  async addMitigationAction(
    riskAssessmentId: string,
    tenantId: string,
    data: { description: string; responsiblePersonnelId?: string; dueDate?: string },
  ) {
    await this.findRiskAssessmentOrThrow(riskAssessmentId, tenantId);
    return this.prisma.mitigationAction.create({
      data: {
        riskAssessmentId,
        description: data.description,
        responsiblePersonnelId: data.responsiblePersonnelId,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });
  }

  async closeMitigationAction(id: string, tenantId: string) {
    const action = await this.prisma.mitigationAction.findUnique({
      where: { id },
      include: { riskAssessment: { include: { hazard: { include: { organization: true } } } } },
    });
    if (!action || action.riskAssessment.hazard.organization.tenantId !== tenantId) {
      throw new NotFoundException(`MitigationAction ${id} not found`);
    }
    return this.prisma.mitigationAction.update({ where: { id }, data: { status: 'closed' } });
  }

  /// 高风险且尚未被完全缓解的项 (含"一条缓解措施都还没有"这种最紧急的情况), 供仪表盘/告警使用。
  /// 注意: 不能写成 mitigations.some(status != closed), 那样会把"零缓解措施"的高风险误判为已处理而漏掉。
  async listOpenHighRisks(tenantId: string, riskScoreThreshold = 12) {
    return this.prisma.riskAssessment.findMany({
      where: {
        riskScore: { gte: riskScoreThreshold },
        hazard: { organization: { tenantId } },
        OR: [{ mitigations: { none: {} } }, { mitigations: { some: { status: { not: 'closed' } } } }],
      },
      include: { hazard: true, mitigations: true },
    });
  }

  // ---- 3.2.2 安全政策 (Safety Policy): 版本化, 须由负责人签署 ----

  async addSafetyPolicy(data: { organizationId: string; version: string; policyText: string; effectiveDate: string }) {
    await this.prisma.safetyPolicy.updateMany({
      where: { organizationId: data.organizationId, supersededAt: null },
      data: { supersededAt: new Date() },
    });
    return this.prisma.safetyPolicy.create({
      data: {
        organizationId: data.organizationId,
        version: data.version,
        policyText: data.policyText,
        effectiveDate: new Date(data.effectiveDate),
      },
    });
  }

  listSafetyPolicies(organizationId: string) {
    return this.prisma.safetyPolicy.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });
  }

  private async findSafetyPolicyOrThrow(id: string, tenantId: string) {
    const policy = await this.prisma.safetyPolicy.findUnique({ where: { id }, include: { organization: true } });
    if (!policy || policy.organization.tenantId !== tenantId) throw new NotFoundException(`Safety policy ${id} not found`);
    return policy;
  }

  /// 安全政策须由现任负责人(Accountable Manager)签署才生效 (ORA.GEN.210(a) 负责人对安全负直接责任)
  async signSafetyPolicy(id: string, tenantId: string, personnelId: string) {
    const policy = await this.findSafetyPolicyOrThrow(id, tenantId);
    const hasRole = await this.prisma.personnelRoleAssignment.findFirst({
      where: { organizationId: policy.organizationId, personnelId, role: 'ACCOUNTABLE_MANAGER', endDate: null },
    });
    if (!hasRole) {
      throw new BadRequestException(
        `Personnel ${personnelId} does not currently hold the ACCOUNTABLE_MANAGER role for this organization`,
      );
    }
    return this.prisma.safetyPolicy.update({ where: { id }, data: { signedById: personnelId, signedAt: new Date() } });
  }

  // ---- 3.2.2 变更管理 MOC: draft -> risk_assessed -> implemented -> verified ----

  createMoc(data: { organizationId: string; changeDescription: string }) {
    return this.prisma.managementOfChange.create({ data });
  }

  listMocs(organizationId: string) {
    return this.prisma.managementOfChange.findMany({
      where: { organizationId },
      include: { riskAssessment: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findMocOrThrow(id: string, tenantId: string) {
    const moc = await this.prisma.managementOfChange.findUnique({ where: { id }, include: { organization: true } });
    if (!moc || moc.organization.tenantId !== tenantId) throw new NotFoundException(`MOC ${id} not found`);
    return moc;
  }

  /// 变更前必须完成风险评估才能进入实施阶段 (ORA.GEN.200(a)(3) 变更管理核心要求)
  async attachRiskAssessmentToMoc(id: string, tenantId: string, riskAssessmentId: string) {
    const moc = await this.findMocOrThrow(id, tenantId);
    if (moc.status !== 'DRAFT') {
      throw new BadRequestException(`Cannot attach risk assessment from status ${moc.status}`);
    }
    await this.findRiskAssessmentOrThrow(riskAssessmentId, tenantId);
    return this.prisma.managementOfChange.update({
      where: { id },
      data: { riskAssessmentId, status: 'RISK_ASSESSED' },
    });
  }

  async implementMoc(id: string, tenantId: string, implementationPlan: string) {
    const moc = await this.findMocOrThrow(id, tenantId);
    if (moc.status !== 'RISK_ASSESSED') {
      throw new BadRequestException(`Cannot implement MOC from status ${moc.status}: risk assessment must be attached first`);
    }
    return this.prisma.managementOfChange.update({
      where: { id },
      data: { implementationPlan, status: 'IMPLEMENTED', implementedAt: new Date() },
    });
  }

  async verifyMoc(id: string, tenantId: string, verificationNotes: string) {
    const moc = await this.findMocOrThrow(id, tenantId);
    if (moc.status !== 'IMPLEMENTED') {
      throw new BadRequestException(`Cannot verify MOC from status ${moc.status}: must be implemented first`);
    }
    return this.prisma.managementOfChange.update({
      where: { id },
      data: { verificationNotes, status: 'VERIFIED', verifiedAt: new Date() },
    });
  }

  // ---- 3.2.2 应急响应计划 ERP: 版本化预案 + 年度演练 ----

  async addErpPlan(data: { organizationId: string; version: string; planText: string; effectiveDate: string }) {
    await this.prisma.emergencyResponsePlan.updateMany({
      where: { organizationId: data.organizationId, supersededAt: null },
      data: { supersededAt: new Date() },
    });
    return this.prisma.emergencyResponsePlan.create({
      data: {
        organizationId: data.organizationId,
        version: data.version,
        planText: data.planText,
        effectiveDate: new Date(data.effectiveDate),
      },
    });
  }

  listErpPlans(organizationId: string) {
    return this.prisma.emergencyResponsePlan.findMany({
      where: { organizationId },
      include: { drills: { orderBy: { drilledAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findErpOrThrow(id: string, tenantId: string) {
    const erp = await this.prisma.emergencyResponsePlan.findUnique({ where: { id }, include: { organization: true } });
    if (!erp || erp.organization.tenantId !== tenantId) throw new NotFoundException(`ERP ${id} not found`);
    return erp;
  }

  async recordErpDrill(erpId: string, tenantId: string, data: { drilledAt: string; scenario: string; outcome?: string }) {
    await this.findErpOrThrow(erpId, tenantId);
    const drilledAt = new Date(data.drilledAt);
    const nextDueDate = new Date(drilledAt);
    nextDueDate.setMonth(nextDueDate.getMonth() + 12);
    return this.prisma.erpDrill.create({
      data: { erpId, drilledAt, scenario: data.scenario, outcome: data.outcome, nextDueDate },
    });
  }

  /// 找出演练即将到期(或已过期, 或从未演练过)的当前有效ERP (仪表盘告警, 镜像3.3.5周期性评估的模式)
  async findErpDrillsDueSoon(tenantId: string, withinDays = 60) {
    const erps = await this.prisma.emergencyResponsePlan.findMany({
      where: { organization: { tenantId }, supersededAt: null },
      include: { organization: true, drills: { orderBy: { drilledAt: 'desc' }, take: 1 } },
    });
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + withinDays);
    return erps
      .filter((e) => {
        const latest = e.drills[0];
        return !latest || latest.nextDueDate <= cutoff;
      })
      .map((e) => ({
        erpId: e.id,
        organizationName: e.organization.name,
        nextDueDate: e.drills[0]?.nextDueDate ?? null,
      }));
  }

  // ---- 3.2.2 安全绩效指标 SPI/SPT ----

  createIndicator(data: {
    organizationId: string;
    name: string;
    description?: string;
    targetValue: number;
    direction?: 'LOWER_IS_BETTER' | 'HIGHER_IS_BETTER';
  }) {
    return this.prisma.safetyPerformanceIndicator.create({
      data: { ...data, direction: data.direction ?? 'LOWER_IS_BETTER' },
    });
  }

  private async findIndicatorOrThrow(id: string, tenantId: string) {
    const indicator = await this.prisma.safetyPerformanceIndicator.findUnique({
      where: { id },
      include: { organization: true },
    });
    if (!indicator || indicator.organization.tenantId !== tenantId) throw new NotFoundException(`SPI ${id} not found`);
    return indicator;
  }

  async recordMeasurement(indicatorId: string, tenantId: string, data: { periodStart: string; periodEnd: string; value: number }) {
    await this.findIndicatorOrThrow(indicatorId, tenantId);
    return this.prisma.safetyPerformanceMeasurement.create({
      data: {
        indicatorId,
        periodStart: new Date(data.periodStart),
        periodEnd: new Date(data.periodEnd),
        value: data.value,
      },
    });
  }

  /// 逐个指标判断最新一期采集值是否达标 (breach = 偏离目标方向错误的一侧, 而非简单的"低于目标值")
  async listIndicatorsWithStatus(organizationId: string) {
    const indicators = await this.prisma.safetyPerformanceIndicator.findMany({
      where: { organizationId },
      include: { measurements: { orderBy: { periodEnd: 'desc' }, take: 1 } },
    });
    return indicators.map((i) => {
      const latest = i.measurements[0];
      let breached = false;
      if (latest) {
        breached = i.direction === 'LOWER_IS_BETTER' ? latest.value > i.targetValue : latest.value < i.targetValue;
      }
      return {
        id: i.id,
        name: i.name,
        description: i.description,
        targetValue: i.targetValue,
        direction: i.direction,
        latestValue: latest?.value ?? null,
        latestPeriodEnd: latest?.periodEnd ?? null,
        breached,
      };
    });
  }

  // ---- 3.2.2 安全评审委员会 (复杂机构) ----

  createSrbMeeting(data: { organizationId: string; meetingDate: string; attendeeRoles: string[]; agenda: string; decisions?: string }) {
    return this.prisma.safetyReviewBoardMeeting.create({
      data: { ...data, meetingDate: new Date(data.meetingDate) },
    });
  }

  listSrbMeetings(organizationId: string) {
    return this.prisma.safetyReviewBoardMeeting.findMany({
      where: { organizationId },
      include: { actions: true },
      orderBy: { meetingDate: 'desc' },
    });
  }

  private async findSrbMeetingOrThrow(id: string, tenantId: string) {
    const meeting = await this.prisma.safetyReviewBoardMeeting.findUnique({ where: { id }, include: { organization: true } });
    if (!meeting || meeting.organization.tenantId !== tenantId) throw new NotFoundException(`SRB meeting ${id} not found`);
    return meeting;
  }

  async addSrbAction(meetingId: string, tenantId: string, data: { description: string; responsiblePersonnelId?: string; dueDate?: string }) {
    await this.findSrbMeetingOrThrow(meetingId, tenantId);
    return this.prisma.safetyReviewBoardAction.create({
      data: {
        meetingId,
        description: data.description,
        responsiblePersonnelId: data.responsiblePersonnelId,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });
  }

  async closeSrbAction(id: string, tenantId: string) {
    const action = await this.prisma.safetyReviewBoardAction.findUnique({
      where: { id },
      include: { meeting: { include: { organization: true } } },
    });
    if (!action || action.meeting.organization.tenantId !== tenantId) throw new NotFoundException(`SRB action ${id} not found`);
    return this.prisma.safetyReviewBoardAction.update({ where: { id }, data: { status: 'closed' } });
  }

  // ---- 3.2.5 承包活动管理 (Contracted Activities, ORA.GEN.205) ----

  createContract(data: { organizationId: string; contractorName: string; scope: string; agreementRef?: string; includedInAudit?: boolean }) {
    return this.prisma.contractRecord.create({ data });
  }

  listContracts(organizationId: string) {
    return this.prisma.contractRecord.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });
  }

  async updateContract(
    id: string,
    tenantId: string,
    data: { contractorName?: string; scope?: string; agreementRef?: string; includedInAudit?: boolean },
  ) {
    const contract = await this.prisma.contractRecord.findUnique({ where: { id }, include: { organization: true } });
    if (!contract || contract.organization.tenantId !== tenantId) throw new NotFoundException(`Contract ${id} not found`);
    return this.prisma.contractRecord.update({ where: { id }, data });
  }
}
