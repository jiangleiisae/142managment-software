import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Permission } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { IsmsService } from './isms.service.js';
import { AddMitigationActionDto } from './dto/add-mitigation-action.dto.js';
import { AssessInfoSecurityRiskDto } from './dto/assess-info-security-risk.dto.js';
import { ContainIncidentDto } from './dto/contain-incident.dto.js';
import { CreateInfoAssetDto } from './dto/create-info-asset.dto.js';
import { ReportIncidentDto } from './dto/report-incident.dto.js';

@Controller('isms')
@RequirePermissions(Permission.ISMS)
export class IsmsController {
  constructor(private readonly ismsService: IsmsService) {}

  // ---- 信息资产清单 ----

  @Post('assets')
  createAsset(@Body() dto: CreateInfoAssetDto) {
    return this.ismsService.createAsset(dto);
  }

  @Get('assets')
  listAssets(@Query('organizationId') organizationId: string) {
    return this.ismsService.listAssets(organizationId);
  }

  // ---- 信息安全风险评估 ----

  @Post('assets/:id/risk-assessments')
  assessRisk(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: AssessInfoSecurityRiskDto) {
    return this.ismsService.assessRisk(id, user.tenantId, dto);
  }

  @Post('risk-assessments/:id/mitigation-actions')
  addMitigationAction(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: AddMitigationActionDto) {
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
  reportIncident(@CurrentUser() user: AuthContext, @Body() dto: ReportIncidentDto) {
    return this.ismsService.reportIncident(user.tenantId, dto);
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
  containIncident(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: ContainIncidentDto) {
    return this.ismsService.containIncident(id, user.tenantId, dto.responseActions);
  }

  @Post('incidents/:id/resolve')
  resolveIncident(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.ismsService.resolveIncident(id, user.tenantId);
  }
}
