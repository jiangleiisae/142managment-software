import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { InfoAssetCriticality, Permission } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { IsmsService } from './isms.service.js';

@Controller('isms')
@RequirePermissions(Permission.ISMS)
export class IsmsController {
  constructor(private readonly ismsService: IsmsService) {}

  // ---- 信息资产清单 ----

  @Post('assets')
  createAsset(
    @Body()
    dto: {
      organizationId: string;
      name: string;
      category: string;
      criticality?: InfoAssetCriticality;
      ownerPersonnelId?: string;
      description?: string;
    },
  ) {
    return this.ismsService.createAsset(dto);
  }

  @Get('assets')
  listAssets(@Query('organizationId') organizationId: string) {
    return this.ismsService.listAssets(organizationId);
  }

  // ---- 信息安全风险评估 ----

  @Post('assets/:id/risk-assessments')
  assessRisk(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: { likelihoodLevel: number; impactLevel: number; existingControls?: string; residualRiskLevel?: number },
  ) {
    return this.ismsService.assessRisk(id, user.tenantId, dto);
  }

  @Post('risk-assessments/:id/mitigation-actions')
  addMitigationAction(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: { description: string; responsiblePersonnelId?: string; dueDate?: string },
  ) {
    return this.ismsService.addMitigationAction(id, user.tenantId, dto);
  }

  @Post('mitigation-actions/:id/close')
  closeMitigationAction(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.ismsService.closeMitigationAction(id, user.tenantId);
  }

  @Get('risks/open-high')
  listOpenHighRisks(@CurrentUser() user: AuthContext) {
    return this.ismsService.listOpenHighRisks(user.tenantId);
  }

  // ---- 信息安全事件响应 ----

  @Post('incidents')
  reportIncident(
    @Body()
    dto: {
      organizationId: string;
      discoveredAt: string;
      incidentType: string;
      description: string;
      affectedAssetId?: string;
      severity: number;
    },
  ) {
    return this.ismsService.reportIncident(dto);
  }

  @Get('incidents')
  listIncidents(@Query('organizationId') organizationId: string) {
    return this.ismsService.listIncidents(organizationId);
  }

  @Get('incidents/open')
  listOpenIncidents(@CurrentUser() user: AuthContext) {
    return this.ismsService.listOpenIncidents(user.tenantId);
  }

  @Post('incidents/:id/contain')
  containIncident(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: { responseActions: string }) {
    return this.ismsService.containIncident(id, user.tenantId, dto.responseActions);
  }

  @Post('incidents/:id/resolve')
  resolveIncident(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.ismsService.resolveIncident(id, user.tenantId);
  }
}
