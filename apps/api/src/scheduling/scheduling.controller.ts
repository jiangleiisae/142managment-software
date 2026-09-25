import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { BookingResourceType } from '@prisma/client';
import { SchedulingService } from './scheduling.service.js';

@Controller('bookings')
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Post()
  create(
    @Body()
    dto: {
      resourceType: BookingResourceType;
      resourceId: string;
      startAt: string;
      endAt: string;
      courseId?: string;
      studentId?: string;
    },
  ) {
    return this.schedulingService.create(dto);
  }

  @Get()
  findByResource(
    @Query('resourceType') resourceType: BookingResourceType,
    @Query('resourceId') resourceId: string,
  ) {
    return this.schedulingService.findByResource(resourceType, resourceId);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.schedulingService.cancel(id);
  }
}
