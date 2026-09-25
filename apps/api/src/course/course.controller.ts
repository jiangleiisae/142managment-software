import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CourseType, Prisma } from '@prisma/client';
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
  findOne(@Param('id') id: string) {
    return this.courseService.findOne(id);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string) {
    return this.courseService.approve(id);
  }

  @Post(':id/training-programme')
  setTrainingProgramme(
    @Param('id') id: string,
    @Body() dto: { summary?: string; stagesJson?: Prisma.InputJsonValue; standardTasksJson?: Prisma.InputJsonValue },
  ) {
    return this.courseService.setTrainingProgramme(id, dto);
  }
}
