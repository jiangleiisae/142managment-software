import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { OrganizationService } from './organization.service.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { CreateCertificateDto } from './dto/create-certificate.dto.js';
import { CertificateStatusActionDto } from './dto/certificate-status-action.dto.js';

@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizationService.create(dto);
  }

  @Get()
  findAll(@Query('tenantId') tenantId: string) {
    return this.organizationService.findAll(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.organizationService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.organizationService.update(id, dto);
  }

  // ---- 3.1 证书管理 (EASA Form 143), 状态机: ACTIVE <-> SUSPENDED -> REVOKED / TERMINATED ----

  @Post(':id/certificates')
  addCertificate(@Param('id') id: string, @Body() dto: CreateCertificateDto) {
    return this.organizationService.addCertificate(id, dto);
  }

  @Get(':id/certificates')
  listCertificates(@Param('id') id: string) {
    return this.organizationService.listCertificates(id);
  }

  @Post('certificates/:certId/suspend')
  suspendCertificate(@Param('certId') certId: string, @Body() dto: CertificateStatusActionDto) {
    return this.organizationService.suspendCertificate(certId, dto.reason);
  }

  @Post('certificates/:certId/restore')
  restoreCertificate(@Param('certId') certId: string, @Body() dto: CertificateStatusActionDto) {
    return this.organizationService.restoreCertificate(certId, dto.reason);
  }

  @Post('certificates/:certId/revoke')
  revokeCertificate(@Param('certId') certId: string, @Body() dto: CertificateStatusActionDto) {
    return this.organizationService.revokeCertificate(certId, dto.reason);
  }

  @Post('certificates/:certId/terminate')
  terminateCertificate(@Param('certId') certId: string, @Body() dto: CertificateStatusActionDto) {
    return this.organizationService.terminateCertificate(certId, dto.reason);
  }
}
