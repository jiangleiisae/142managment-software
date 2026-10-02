import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Permission } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { PersonnelService } from './personnel.service.js';
import { AddQualificationDto } from './dto/add-qualification.dto.js';
import { CreatePersonnelDto } from './dto/create-personnel.dto.js';
import { SetInstructorProfileDto } from './dto/set-instructor-profile.dto.js';
import { UpsertInitialTrainingDto } from './dto/upsert-initial-training.dto.js';

@Controller('personnel')
@RequirePermissions(Permission.PERSONNEL)
export class PersonnelController {
  constructor(private readonly personnelService: PersonnelService) {}

  @Post()
  create(@CurrentUser() user: AuthContext, @Body() dto: CreatePersonnelDto) {
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

  // ---- CCAR-142第142.61条(c)款: 教员初始培训 (须在 :id 路由之前注册) ----

  @Get('initial-training/checklist')
  listInitialTrainingItems() {
    return this.personnelService.listInitialTrainingItems();
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.personnelService.findOne(id, user.tenantId);
  }

  @Post(':id/qualifications')
  addQualification(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: AddQualificationDto) {
    return this.personnelService.addQualification(id, user.tenantId, dto);
  }

  @Post(':id/instructor-profile')
  setInstructorProfile(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: SetInstructorProfileDto) {
    return this.personnelService.setInstructorProfile(id, user.tenantId, dto.instructorType);
  }

  @Get(':id/initial-training')
  getInitialTraining(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.personnelService.getInitialTraining(id, user.tenantId);
  }

  @Post(':id/initial-training')
  upsertInitialTraining(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: UpsertInitialTrainingDto) {
    return this.personnelService.upsertInitialTraining(id, user.tenantId, dto);
  }
}
