import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PersonnelService } from './personnel.service.js';

@Controller('personnel')
export class PersonnelController {
  constructor(private readonly personnelService: PersonnelService) {}

  @Post()
  create(
    @Body() dto: { tenantId: string; firstName: string; lastName: string; email?: string; phone?: string },
  ) {
    return this.personnelService.create(dto);
  }

  @Get()
  findAll(@Query('tenantId') tenantId: string) {
    return this.personnelService.findAll(tenantId);
  }

  @Get('expiring-qualifications')
  findExpiringSoon(@Query('withinDays') withinDays: string) {
    return this.personnelService.findExpiringSoon(Number(withinDays) || 30);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.personnelService.findOne(id);
  }

  @Post(':id/qualifications')
  addQualification(
    @Param('id') id: string,
    @Body()
    dto: {
      qualificationType: string;
      certificateNo?: string;
      issuingAuthority?: string;
      validFrom?: string;
      validUntil?: string;
    },
  ) {
    return this.personnelService.addQualification(id, dto);
  }
}
