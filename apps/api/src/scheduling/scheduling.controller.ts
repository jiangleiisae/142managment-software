import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { BookingResourceType } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { SchedulingService } from './scheduling.service.js';

@Controller('bookings')
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Post()
  create(
    @Body()
    dto: {
      organizationId: string;
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
    @CurrentUser() user: AuthContext,
    @Query('resourceType') resourceType: BookingResourceType,
    @Query('resourceId') resourceId: string,
  ) {
    return this.schedulingService.findByResource(resourceType, resourceId, user.tenantId);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.schedulingService.cancel(id, user.tenantId);
  }
}
