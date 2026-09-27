import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CourseType, Prisma } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { CourseService } from './course.service.js';

@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Post()
  create(@Body() dto: { organizationId: string; name: string; courseType: CourseType }) {
    return this.courseService.create(dto);
  }

  @Get()
  findAll(@Query('organizationId') organizationId: string) {
    return this.courseService.findAll(organizationId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.courseService.findOne(id, user.tenantId);
  }

  @Post(':id/approve')
  approve(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.courseService.approve(id, user.tenantId);
  }

  @Post(':id/training-programme')
  setTrainingProgramme(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: { summary?: string; stagesJson?: Prisma.InputJsonValue; standardTasksJson?: Prisma.InputJsonValue },
  ) {
    return this.courseService.setTrainingProgramme(id, user.tenantId, dto);
  }

  @Post(':id/requirements')
  addRequirement(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: { taskCode: string; taskName: string; minHours?: number },
  ) {
    return this.courseService.addRequirement(id, user.tenantId, dto);
  }

  @Get(':id/requirements')
  listRequirements(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.courseService.listRequirements(id, user.tenantId);
  }

  @Get(':id/fstd-compatibility/:fstdId')
  checkFstdCompatibility(@CurrentUser() user: AuthContext, @Param('id') id: string, @Param('fstdId') fstdId: string) {
    return this.courseService.checkFstdCompatibility(id, fstdId, user.tenantId);
  }
}
