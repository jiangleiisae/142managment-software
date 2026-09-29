import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Permission } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { RequirePermissions, SkipPermissionCheck } from '../auth/permissions.decorator.js';
import { OrganizationService } from './organization.service.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { CreateCertificateDto } from './dto/create-certificate.dto.js';
import { CertificateStatusActionDto } from './dto/certificate-status-action.dto.js';

@Controller('organizations')
@RequirePermissions(Permission.ORGANIZATION)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  create(@CurrentUser() user: AuthContext, @Body() dto: CreateOrganizationDto) {
    return this.organizationService.create(user.tenantId, dto);
  }

  @Get()
  @SkipPermissionCheck() // 几乎所有模块的机构选择器都依赖此接口枚举机构列表, 不应受ORGANIZATION模块权限限制
  findAll(@CurrentUser() user: AuthContext) {
    return this.organizationService.findAll(user.tenantId);
  }

  // ---- 3.2.2 非复杂机构简化路径: 年度机构自查 (GM2 ORA.GEN.200(c)), 须在 :id 路由之前注册以避免被误匹配 ----

  @Get('self-review-checklist')
  listSelfReviewChecklist() {
    return this.organizationService.listSelfReviewChecklist();
  }

  @Get('self-reviews/missing-current-year')
  findOrgsMissingCurrentYearSelfReview(@CurrentUser() user: AuthContext) {
    return this.organizationService.findOrgsMissingCurrentYearSelfReview(user.tenantId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.organizationService.findOne(id, user.tenantId);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.organizationService.update(id, user.tenantId, dto);
  }

  // ---- 3.1 证书管理 (EASA Form 143), 状态机: ACTIVE <-> SUSPENDED -> REVOKED / TERMINATED ----

  @Post(':id/certificates')
  addCertificate(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: CreateCertificateDto) {
    return this.organizationService.addCertificate(id, user.tenantId, dto);
  }

  @Get(':id/certificates')
  listCertificates(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.organizationService.listCertificates(id, user.tenantId);
  }

  @Post('certificates/:certId/suspend')
  suspendCertificate(
    @CurrentUser() user: AuthContext,
    @Param('certId') certId: string,
    @Body() dto: CertificateStatusActionDto,
  ) {
    return this.organizationService.suspendCertificate(certId, user.tenantId, dto.reason);
  }

  @Post('certificates/:certId/restore')
  restoreCertificate(
    @CurrentUser() user: AuthContext,
    @Param('certId') certId: string,
    @Body() dto: CertificateStatusActionDto,
  ) {
    return this.organizationService.restoreCertificate(certId, user.tenantId, dto.reason);
  }

  @Post('certificates/:certId/revoke')
  revokeCertificate(
    @CurrentUser() user: AuthContext,
    @Param('certId') certId: string,
    @Body() dto: CertificateStatusActionDto,
  ) {
    return this.organizationService.revokeCertificate(certId, user.tenantId, dto.reason);
  }

  @Post('certificates/:certId/terminate')
  terminateCertificate(
    @CurrentUser() user: AuthContext,
    @Param('certId') certId: string,
    @Body() dto: CertificateStatusActionDto,
  ) {
    return this.organizationService.terminateCertificate(certId, user.tenantId, dto.reason);
  }

  // ---- 3.2.2 非复杂机构简化路径: 年度机构自查登记 (机构范围) ----

  @Post(':id/self-reviews')
  recordSelfReview(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: { year: number; reviewedAt: string; items: { item: string; compliant: boolean; notes?: string }[] },
  ) {
    return this.organizationService.recordSelfReview(id, user.tenantId, dto);
  }

  @Get(':id/self-reviews')
  listSelfReviews(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.organizationService.listSelfReviews(id, user.tenantId);
  }

  @Post('self-reviews/:reviewId/notify')
  notifySelfReview(@CurrentUser() user: AuthContext, @Param('reviewId') reviewId: string) {
    return this.organizationService.notifySelfReview(reviewId, user.tenantId);
  }

  // ---- ORA.ATO.105 申请材料 (首次申请 / 变更申请) ----

  @Post(':id/application-records')
  createApplicationRecord(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body()
    dto: {
      isChangeApplication?: boolean;
      proposedStartDate?: string;
      headOfTrainingInfo?: Record<string, unknown>;
      trainingSitesJson?: unknown;
      aircraftListJson?: unknown;
      fstdListJson?: unknown;
      courseTypesJson?: unknown;
      operationsManualRef?: string;
      trainingManualRef?: string;
    },
  ) {
    return this.organizationService.createApplicationRecord(id, user.tenantId, dto);
  }

  @Get(':id/application-records')
  listApplicationRecords(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.organizationService.listApplicationRecords(id, user.tenantId);
  }
}
