import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { BookingResourceType, Permission } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { SchedulingService } from './scheduling.service.js';

@Controller('bookings')
@RequirePermissions(Permission.SCHEDULING)
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
      taskCode?: string;
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
