import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ManagementRoleType } from '@prisma/client';
import { ManagementSystemService } from './management-system.service.js';

@Controller('management-system')
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
  endRoleAssignment(@Param('id') id: string) {
    return this.service.endRoleAssignment(id);
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
  findOverdueOccurrenceReports() {
    return this.service.findOverdueOccurrenceReports();
  }

  @Post('occurrence-reports/:id/mark-reported')
  markOccurrenceReported(@Param('id') id: string, @Body() dto: { reportedTo: string }) {
    return this.service.markOccurrenceReported(id, dto.reportedTo);
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
  createAuditTask(@Param('id') id: string, @Body() dto: { auditorId?: string; scope: string }) {
    return this.service.createAuditTask(id, dto);
  }

  @Post('audit-tasks/:id/complete')
  completeAuditTask(@Param('id') id: string) {
    return this.service.completeAuditTask(id);
  }

  @Post('audit-tasks/:id/findings')
  addFinding(@Param('id') id: string, @Body() dto: { level: number; description: string; rootCause?: string }) {
    return this.service.addFinding(id, dto);
  }

  @Post('findings/:id/corrective-actions')
  addCorrectiveAction(
    @Param('id') id: string,
    @Body() dto: { planDescription: string; responsiblePersonnelId?: string; dueDate?: string },
  ) {
    return this.service.addCorrectiveAction(id, dto);
  }

  @Post('corrective-actions/:id/close')
  closeCorrectiveAction(@Param('id') id: string) {
    return this.service.closeCorrectiveAction(id);
  }
}
