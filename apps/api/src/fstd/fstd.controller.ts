import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { FstdDeviceType, LegacyLevel } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { FstdService } from './fstd.service.js';

@Controller('fstds')
export class FstdController {
  constructor(private readonly fstdService: FstdService) {}

  @Post()
  create(
    @Body()
    dto: {
      organizationId: string;
      deviceCode: string;
      representedAircraft: string;
      deviceType: FstdDeviceType;
      serialNumber?: string;
      location?: string;
      legacyLevel?: LegacyLevel;
    },
  ) {
    // organizationId 的租户归属已由全局 TenantGuard 校验
    return this.fstdService.create(dto);
  }

  @Get()
  findAll(@Query('organizationId') organizationId: string) {
    return this.fstdService.findAll(organizationId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.fstdService.findOne(id, user.tenantId);
  }

  @Post(':id/qualified-tasks')
  addQualifiedTask(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: { taskCode: string; taskName: string; requiresSpecialAuth?: boolean },
  ) {
    return this.fstdService.addQualifiedTask(id, user.tenantId, dto);
  }

  @Get(':id/can-perform/:taskCode')
  canPerformTask(@CurrentUser() user: AuthContext, @Param('id') id: string, @Param('taskCode') taskCode: string) {
    return this.fstdService.canPerformTask(id, user.tenantId, taskCode);
  }

  @Post(':id/discrepancies')
  reportDiscrepancy(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: { description: string; isMmi?: boolean; reportedById?: string },
  ) {
    return this.fstdService.reportDiscrepancy(id, user.tenantId, dto);
  }

  @Post('discrepancies/:discrepancyId/correct')
  correctDiscrepancy(
    @CurrentUser() user: AuthContext,
    @Param('discrepancyId') discrepancyId: string,
    @Body() dto: { correctiveAction: string; correctedById?: string },
  ) {
    return this.fstdService.correctDiscrepancy(discrepancyId, user.tenantId, dto);
  }

  // ---- 3.3.5 周期性评估 ----

  @Post(':id/recurrent-evaluations')
  recordRecurrentEvaluation(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: { periodStart: string; periodEnd: string; evaluationType?: string; result?: string },
  ) {
    return this.fstdService.recordRecurrentEvaluation(id, user.tenantId, dto);
  }

  @Get(':id/recurrent-evaluations')
  listRecurrentEvaluations(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.fstdService.listRecurrentEvaluations(id, user.tenantId);
  }

  @Get('evaluations/due-soon')
  findEvaluationsDueSoon(@CurrentUser() user: AuthContext, @Query('withinDays') withinDays: string) {
    return this.fstdService.findEvaluationsDueSoon(user.tenantId, Number(withinDays) || 60);
  }

  // ---- 3.3.6 变更管理: draft -> submitted -> approved / rejected ----

  @Post(':id/change-requests')
  createChangeRequest(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: { changeType: string; description?: string },
  ) {
    return this.fstdService.createChangeRequest(id, user.tenantId, dto);
  }

  @Get(':id/change-requests')
  listChangeRequests(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.fstdService.listChangeRequests(id, user.tenantId);
  }

  @Post('change-requests/:crId/submit')
  submitChangeRequest(@CurrentUser() user: AuthContext, @Param('crId') crId: string) {
    return this.fstdService.submitChangeRequest(crId, user.tenantId);
  }

  @Post('change-requests/:crId/approve')
  approveChangeRequest(@CurrentUser() user: AuthContext, @Param('crId') crId: string) {
    return this.fstdService.approveChangeRequest(crId, user.tenantId);
  }

  @Post('change-requests/:crId/reject')
  rejectChangeRequest(@CurrentUser() user: AuthContext, @Param('crId') crId: string) {
    return this.fstdService.rejectChangeRequest(crId, user.tenantId);
  }
}
