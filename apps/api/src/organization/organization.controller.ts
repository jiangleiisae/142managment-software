import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { OrganizationService } from './organization.service.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { CreateCertificateDto } from './dto/create-certificate.dto.js';
import { CertificateStatusActionDto } from './dto/certificate-status-action.dto.js';

@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  create(@CurrentUser() user: AuthContext, @Body() dto: CreateOrganizationDto) {
    return this.organizationService.create(user.tenantId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthContext) {
    return this.organizationService.findAll(user.tenantId);
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
}
