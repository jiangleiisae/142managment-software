import { BadRequestException, Body, Controller, Get, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BookingResourceType, Permission } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { SchedulingService } from './scheduling.service.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { ImportBookingsExcelDto } from './dto/import-bookings-excel.dto.js';
import { scheduleExcelUploadOptions } from './excel-upload.options.js';

@Controller('bookings')
@RequirePermissions(Permission.SCHEDULING)
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Post()
  create(@CurrentUser() user: AuthContext, @Body() dto: CreateBookingDto) {
    return this.schedulingService.create(user.tenantId, dto);
  }

  @Post('import-excel')
  @UseInterceptors(FileInterceptor('file', scheduleExcelUploadOptions))
  importExcel(
    @CurrentUser() user: AuthContext,
    @Body() dto: ImportBookingsExcelDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('缺少上传文件');
    return this.schedulingService.importFromExcel(user.tenantId, dto.organizationId, file.buffer);
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
