import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Permission } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { CourseService } from './course.service.js';
import { AddCourseRequirementDto } from './dto/add-course-requirement.dto.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { SetTrainingProgrammeDto } from './dto/set-training-programme.dto.js';

@Controller('courses')
@RequirePermissions(Permission.COURSES)
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Post()
  create(@CurrentUser() user: AuthContext, @Body() dto: CreateCourseDto) {
    return this.courseService.create(user.tenantId, dto);
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
  setTrainingProgramme(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: SetTrainingProgrammeDto) {
    return this.courseService.setTrainingProgramme(id, user.tenantId, dto);
  }

  @Post(':id/requirements')
  addRequirement(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: AddCourseRequirementDto) {
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
