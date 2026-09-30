import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Permission } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { AddCorrectiveActionDto } from './dto/add-corrective-action.dto.js';
import { AddErpPlanDto } from './dto/add-erp-plan.dto.js';
import { AddFindingDto } from './dto/add-finding.dto.js';
import { AddMitigationActionDto } from './dto/add-mitigation-action.dto.js';
import { AddSafetyPolicyDto } from './dto/add-safety-policy.dto.js';
import { AddSrbActionDto } from './dto/add-srb-action.dto.js';
import { AssessHazardRiskDto } from './dto/assess-hazard-risk.dto.js';
import { AssignRoleDto } from './dto/assign-role.dto.js';
import { AttachRiskAssessmentToMocDto } from './dto/attach-risk-assessment-to-moc.dto.js';
import { CreateAuditScheduleDto } from './dto/create-audit-schedule.dto.js';
import { CreateAuditTaskDto } from './dto/create-audit-task.dto.js';
import { CreateContractDto } from './dto/create-contract.dto.js';
import { CreateMocDto } from './dto/create-moc.dto.js';
import { CreateSafetyIndicatorDto } from './dto/create-safety-indicator.dto.js';
import { CreateSrbMeetingDto } from './dto/create-srb-meeting.dto.js';
import { ImplementMocDto } from './dto/implement-moc.dto.js';
import { MarkOccurrenceReportedDto } from './dto/mark-occurrence-reported.dto.js';
import { RecordErpDrillDto } from './dto/record-erp-drill.dto.js';
import { RecordSafetyMeasurementDto } from './dto/record-safety-measurement.dto.js';
import { ReportHazardDto } from './dto/report-hazard.dto.js';
import { ReportOccurrenceDto } from './dto/report-occurrence.dto.js';
import { SignSafetyPolicyDto } from './dto/sign-safety-policy.dto.js';
import { UpdateContractDto } from './dto/update-contract.dto.js';
import { VerifyMocDto } from './dto/verify-moc.dto.js';
import { ManagementSystemService } from './management-system.service.js';

@Controller('management-system')
@RequirePermissions(Permission.MANAGEMENT_SYSTEM)
export class ManagementSystemController {
  constructor(private readonly service: ManagementSystemService) {}

  // ---- 3.2.1 人员角色任命 ----

  @Post('role-assignments')
  assignRole(@Body() dto: AssignRoleDto) {
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
  reportOccurrence(@Body() dto: ReportOccurrenceDto) {
    return this.service.reportOccurrence(dto);
  }

  @Get('occurrence-reports/overdue')
  findOverdueOccurrenceReports(@CurrentUser() user: AuthContext) {
    return this.service.findOverdueOccurrenceReports(user.tenantId);
  }

  @Post('occurrence-reports/:id/mark-reported')
  markOccurrenceReported(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: MarkOccurrenceReportedDto) {
    return this.service.markOccurrenceReported(id, user.tenantId, dto.reportedTo);
  }

  // ---- 3.2.3 合规监督闭环 ----

  @Post('audit-schedules')
  createAuditSchedule(@Body() dto: CreateAuditScheduleDto) {
    return this.service.createAuditSchedule(dto);
  }

  @Get('audit-schedules')
  listAuditSchedules(@Query('organizationId') organizationId: string) {
    return this.service.listAuditSchedules(organizationId);
  }

  @Post('audit-schedules/:id/tasks')
  createAuditTask(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: CreateAuditTaskDto) {
    return this.service.createAuditTask(id, user.tenantId, dto);
  }

  @Post('audit-tasks/:id/complete')
  completeAuditTask(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.service.completeAuditTask(id, user.tenantId);
  }

  @Post('audit-tasks/:id/findings')
  addFinding(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: AddFindingDto) {
    return this.service.addFinding(id, user.tenantId, dto);
  }

  @Post('findings/:id/corrective-actions')
  addCorrectiveAction(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: AddCorrectiveActionDto) {
    return this.service.addCorrectiveAction(id, user.tenantId, dto);
  }

  @Post('corrective-actions/:id/close')
  closeCorrectiveAction(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.service.closeCorrectiveAction(id, user.tenantId);
  }

  // ---- SMS 风险管理闭环: 危险源 -> 风险评估 -> 缓解措施 ----

  @Post('hazards')
  reportHazard(@Body() dto: ReportHazardDto) {
    return this.service.reportHazard(dto);
  }

  @Get('hazards')
  listHazards(@Query('organizationId') organizationId: string) {
    return this.service.listHazards(organizationId);
  }

  @Post('hazards/:id/risk-assessments')
  assessRisk(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: AssessHazardRiskDto) {
    return this.service.assessRisk(id, user.tenantId, dto);
  }

  @Post('risk-assessments/:id/mitigation-actions')
  addMitigationAction(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: AddMitigationActionDto) {
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
  addSafetyPolicy(@CurrentUser() user: AuthContext, @Body() dto: AddSafetyPolicyDto) {
    return this.service.addSafetyPolicy(user.tenantId, dto);
  }

  @Get('safety-policies')
  listSafetyPolicies(@Query('organizationId') organizationId: string) {
    return this.service.listSafetyPolicies(organizationId);
  }

  @Post('safety-policies/:id/sign')
  signSafetyPolicy(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: SignSafetyPolicyDto) {
    return this.service.signSafetyPolicy(id, user.tenantId, dto.personnelId);
  }

  // ---- 3.2.2 变更管理 MOC ----

  @Post('mocs')
  createMoc(@CurrentUser() user: AuthContext, @Body() dto: CreateMocDto) {
    return this.service.createMoc(user.tenantId, dto);
  }

  @Get('mocs')
  listMocs(@Query('organizationId') organizationId: string) {
    return this.service.listMocs(organizationId);
  }

  @Post('mocs/:id/risk-assessment')
  attachRiskAssessmentToMoc(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: AttachRiskAssessmentToMocDto) {
    return this.service.attachRiskAssessmentToMoc(id, user.tenantId, dto.riskAssessmentId);
  }

  @Post('mocs/:id/implement')
  implementMoc(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: ImplementMocDto) {
    return this.service.implementMoc(id, user.tenantId, dto.implementationPlan);
  }

  @Post('mocs/:id/verify')
  verifyMoc(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: VerifyMocDto) {
    return this.service.verifyMoc(id, user.tenantId, dto.verificationNotes);
  }

  // ---- 3.2.2 应急响应计划 ERP ----

  @Post('erp-plans')
  addErpPlan(@CurrentUser() user: AuthContext, @Body() dto: AddErpPlanDto) {
    return this.service.addErpPlan(user.tenantId, dto);
  }

  @Get('erp-plans')
  listErpPlans(@Query('organizationId') organizationId: string) {
    return this.service.listErpPlans(organizationId);
  }

  @Post('erp-plans/:id/drills')
  recordErpDrill(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: RecordErpDrillDto) {
    return this.service.recordErpDrill(id, user.tenantId, dto);
  }

  @Get('erp-plans/drills/due-soon')
  findErpDrillsDueSoon(@CurrentUser() user: AuthContext, @Query('withinDays') withinDays: string) {
    return this.service.findErpDrillsDueSoon(user.tenantId, Number(withinDays) || 60);
  }

  // ---- 3.2.2 安全绩效指标 SPI/SPT ----

  @Post('safety-indicators')
  createIndicator(@Body() dto: CreateSafetyIndicatorDto) {
    return this.service.createIndicator(dto);
  }

  @Get('safety-indicators')
  listIndicatorsWithStatus(@Query('organizationId') organizationId: string) {
    return this.service.listIndicatorsWithStatus(organizationId);
  }

  @Post('safety-indicators/:id/measurements')
  recordMeasurement(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: RecordSafetyMeasurementDto) {
    return this.service.recordMeasurement(id, user.tenantId, dto);
  }

  // ---- 3.2.2 安全评审委员会 (复杂机构) ----

  @Post('srb-meetings')
  createSrbMeeting(@Body() dto: CreateSrbMeetingDto) {
    return this.service.createSrbMeeting(dto);
  }

  @Get('srb-meetings')
  listSrbMeetings(@Query('organizationId') organizationId: string) {
    return this.service.listSrbMeetings(organizationId);
  }

  @Post('srb-meetings/:id/actions')
  addSrbAction(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: AddSrbActionDto) {
    return this.service.addSrbAction(id, user.tenantId, dto);
  }

  @Post('srb-actions/:id/close')
  closeSrbAction(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.service.closeSrbAction(id, user.tenantId);
  }

  // ---- 3.2.5 承包活动管理 (Contracted Activities, ORA.GEN.205) ----

  @Post('contracts')
  createContract(@CurrentUser() user: AuthContext, @Body() dto: CreateContractDto) {
    // organizationId 的租户归属已由全局 TenantGuard 校验
    return this.service.createContract(user.tenantId, dto);
  }

  @Get('contracts')
  listContracts(@Query('organizationId') organizationId: string) {
    return this.service.listContracts(organizationId);
  }

  @Post('contracts/:id')
  updateContract(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: UpdateContractDto) {
    return this.service.updateContract(id, user.tenantId, dto);
  }
}
