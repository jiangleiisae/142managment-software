import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { InstructorType, Permission } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { PersonnelService } from './personnel.service.js';

@Controller('personnel')
@RequirePermissions(Permission.PERSONNEL)
export class PersonnelController {
  constructor(private readonly personnelService: PersonnelService) {}

  @Post()
  create(
    @CurrentUser() user: AuthContext,
    @Body() dto: { firstName: string; lastName: string; email?: string; phone?: string },
  ) {
    return this.personnelService.create(user.tenantId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthContext) {
    return this.personnelService.findAll(user.tenantId);
  }

  @Get('expiring-qualifications')
  findExpiringSoon(@CurrentUser() user: AuthContext, @Query('withinDays') withinDays: string) {
    return this.personnelService.findExpiringSoon(user.tenantId, Number(withinDays) || 30);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.personnelService.findOne(id, user.tenantId);
  }

  @Post(':id/qualifications')
  addQualification(
    @CurrentUser() user: AuthContext,
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
    return this.personnelService.addQualification(id, user.tenantId, dto);
  }

  @Post(':id/instructor-profile')
  setInstructorProfile(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: { instructorType: InstructorType },
  ) {
    return this.personnelService.setInstructorProfile(id, user.tenantId, dto.instructorType);
  }
}
