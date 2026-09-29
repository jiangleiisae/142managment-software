import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ManagementRoleType, Permission } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { ManagementSystemService } from './management-system.service.js';

@Controller('management-system')
@RequirePermissions(Permission.MANAGEMENT_SYSTEM)
export class ManagementSystemController {
  constructor(private readonly service: ManagementSystemService) {}

  // ---- 3.2.1 人员角色任命 ----

  @Post('role-assignments')
  assignRole(
    @Body()
    dto: { organizationId: string; personnelId: string; role: ManagementRoleType; startDate: string; appointmentRef?: string },
  ) {
    return this.service.assignRole(dto);
  }

  @Get('role-assignments')
  listRoleAssignments(@Query('organizationId') organizationId: string) {
    return this.service.listRoleAssignments(organizationId);
  }

  @Post('role-assignments/:id/end')
  endRoleAssignment(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.service.endRoleAssignment(id, user.tenantId);
  }

  // ---- 3.2.2 事件报告 ----

  @Post('occurrence-reports')
  reportOccurrence(
    @Body()
    dto: {
      organizationId: string;
      discoveredAt: string;
      occurrenceType: string;
      involvedPersonnel?: string;
      involvedAircraft?: string;
      involvedFstdId?: string;
      isMandatory?: boolean;
    },
  ) {
    return this.service.reportOccurrence(dto);
  }

  @Get('occurrence-reports/overdue')
  findOverdueOccurrenceReports(@CurrentUser() user: AuthContext) {
    return this.service.findOverdueOccurrenceReports(user.tenantId);
  }

  @Post('occurrence-reports/:id/mark-reported')
  markOccurrenceReported(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: { reportedTo: string }) {
    return this.service.markOccurrenceReported(id, user.tenantId, dto.reportedTo);
  }

  // ---- 3.2.3 合规监督闭环 ----

  @Post('audit-schedules')
  createAuditSchedule(@Body() dto: { organizationId: string; title: string; plannedAt: string; scopeTag?: string }) {
    return this.service.createAuditSchedule(dto);
  }

  @Get('audit-schedules')
  listAuditSchedules(@Query('organizationId') organizationId: string) {
    return this.service.listAuditSchedules(organizationId);
  }

  @Post('audit-schedules/:id/tasks')
  createAuditTask(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: { auditorId?: string; scope: string }) {
    return this.service.createAuditTask(id, user.tenantId, dto);
  }

  @Post('audit-tasks/:id/complete')
  completeAuditTask(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.service.completeAuditTask(id, user.tenantId);
  }

  @Post('audit-tasks/:id/findings')
  addFinding(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: { level: number; description: string; rootCause?: string }) {
    return this.service.addFinding(id, user.tenantId, dto);
  }

  @Post('findings/:id/corrective-actions')
  addCorrectiveAction(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: { planDescription: string; responsiblePersonnelId?: string; dueDate?: string },
  ) {
    return this.service.addCorrectiveAction(id, user.tenantId, dto);
  }

  @Post('corrective-actions/:id/close')
  closeCorrectiveAction(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.service.closeCorrectiveAction(id, user.tenantId);
  }

  // ---- SMS 风险管理闭环: 危险源 -> 风险评估 -> 缓解措施 ----

  @Post('hazards')
  reportHazard(@Body() dto: { organizationId: string; source: string; description: string; affectedArea?: string }) {
    return this.service.reportHazard(dto);
  }

  @Get('hazards')
  listHazards(@Query('organizationId') organizationId: string) {
    return this.service.listHazards(organizationId);
  }

  @Post('hazards/:id/risk-assessments')
  assessRisk(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: { probabilityLevel: number; severityLevel: number; existingMitigation?: string; residualRiskLevel?: number },
  ) {
    return this.service.assessRisk(id, user.tenantId, dto);
  }

  @Post('risk-assessments/:id/mitigation-actions')
  addMitigationAction(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: { description: string; responsiblePersonnelId?: string; dueDate?: string },
  ) {
    return this.service.addMitigationAction(id, user.tenantId, dto);
  }

  @Post('mitigation-actions/:id/close')
  closeMitigationAction(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.service.closeMitigationAction(id, user.tenantId);
  }

  @Get('risks/open-high')
  listOpenHighRisks(@CurrentUser() user: AuthContext) {
    return this.service.listOpenHighRisks(user.tenantId);
  }

  // ---- 3.2.2 安全政策 (Safety Policy) ----

  @Post('safety-policies')
  addSafetyPolicy(
    @CurrentUser() user: AuthContext,
    @Body() dto: { organizationId: string; version: string; policyText: string; effectiveDate: string },
  ) {
    return this.service.addSafetyPolicy(user.tenantId, dto);
  }

  @Get('safety-policies')
  listSafetyPolicies(@Query('organizationId') organizationId: string) {
    return this.service.listSafetyPolicies(organizationId);
  }

  @Post('safety-policies/:id/sign')
  signSafetyPolicy(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: { personnelId: string }) {
    return this.service.signSafetyPolicy(id, user.tenantId, dto.personnelId);
  }

  // ---- 3.2.2 变更管理 MOC ----

  @Post('mocs')
  createMoc(@CurrentUser() user: AuthContext, @Body() dto: { organizationId: string; changeDescription: string }) {
    return this.service.createMoc(user.tenantId, dto);
  }

  @Get('mocs')
  listMocs(@Query('organizationId') organizationId: string) {
    return this.service.listMocs(organizationId);
  }

  @Post('mocs/:id/risk-assessment')
  attachRiskAssessmentToMoc(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: { riskAssessmentId: string }) {
    return this.service.attachRiskAssessmentToMoc(id, user.tenantId, dto.riskAssessmentId);
  }

  @Post('mocs/:id/implement')
  implementMoc(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: { implementationPlan: string }) {
    return this.service.implementMoc(id, user.tenantId, dto.implementationPlan);
  }

  @Post('mocs/:id/verify')
  verifyMoc(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: { verificationNotes: string }) {
    return this.service.verifyMoc(id, user.tenantId, dto.verificationNotes);
  }

  // ---- 3.2.2 应急响应计划 ERP ----

  @Post('erp-plans')
  addErpPlan(
    @CurrentUser() user: AuthContext,
    @Body() dto: { organizationId: string; version: string; planText: string; effectiveDate: string },
  ) {
    return this.service.addErpPlan(user.tenantId, dto);
  }

  @Get('erp-plans')
  listErpPlans(@Query('organizationId') organizationId: string) {
    return this.service.listErpPlans(organizationId);
  }

  @Post('erp-plans/:id/drills')
  recordErpDrill(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: { drilledAt: string; scenario: string; outcome?: string },
  ) {
    return this.service.recordErpDrill(id, user.tenantId, dto);
  }

  @Get('erp-plans/drills/due-soon')
  findErpDrillsDueSoon(@CurrentUser() user: AuthContext, @Query('withinDays') withinDays: string) {
    return this.service.findErpDrillsDueSoon(user.tenantId, Number(withinDays) || 60);
  }

  // ---- 3.2.2 安全绩效指标 SPI/SPT ----

  @Post('safety-indicators')
  createIndicator(
    @Body()
    dto: {
      organizationId: string;
      name: string;
      description?: string;
      targetValue: number;
      direction?: 'LOWER_IS_BETTER' | 'HIGHER_IS_BETTER';
    },
  ) {
    return this.service.createIndicator(dto);
  }

  @Get('safety-indicators')
  listIndicatorsWithStatus(@Query('organizationId') organizationId: string) {
    return this.service.listIndicatorsWithStatus(organizationId);
  }

  @Post('safety-indicators/:id/measurements')
  recordMeasurement(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: { periodStart: string; periodEnd: string; value: number },
  ) {
    return this.service.recordMeasurement(id, user.tenantId, dto);
  }

  // ---- 3.2.2 安全评审委员会 (复杂机构) ----

  @Post('srb-meetings')
  createSrbMeeting(
    @Body() dto: { organizationId: string; meetingDate: string; attendeeRoles: string[]; agenda: string; decisions?: string },
  ) {
    return this.service.createSrbMeeting(dto);
  }

  @Get('srb-meetings')
  listSrbMeetings(@Query('organizationId') organizationId: string) {
    return this.service.listSrbMeetings(organizationId);
  }

  @Post('srb-meetings/:id/actions')
  addSrbAction(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: { description: string; responsiblePersonnelId?: string; dueDate?: string },
  ) {
    return this.service.addSrbAction(id, user.tenantId, dto);
  }

  @Post('srb-actions/:id/close')
  closeSrbAction(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.service.closeSrbAction(id, user.tenantId);
  }

  // ---- 3.2.5 承包活动管理 (Contracted Activities, ORA.GEN.205) ----

  @Post('contracts')
  createContract(
    @CurrentUser() user: AuthContext,
    @Body() dto: { organizationId: string; contractorName: string; scope: string; agreementRef?: string; includedInAudit?: boolean },
  ) {
    // organizationId 的租户归属已由全局 TenantGuard 校验
    return this.service.createContract(user.tenantId, dto);
  }

  @Get('contracts')
  listContracts(@Query('organizationId') organizationId: string) {
    return this.service.listContracts(organizationId);
  }

  @Post('contracts/:id')
  updateContract(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: { contractorName?: string; scope?: string; agreementRef?: string; includedInAudit?: boolean },
  ) {
    return this.service.updateContract(id, user.tenantId, dto);
  }
}
