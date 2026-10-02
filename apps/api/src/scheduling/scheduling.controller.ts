import { BadRequestException, Body, Controller, Get, Param, Post, Query, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BookingResourceType, Permission } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { SchedulingService } from './scheduling.service.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { ImportBookingsExcelDto } from './dto/import-bookings-excel.dto.js';
import { SetBookingCustomersDto } from './dto/set-booking-customers.dto.js';
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

  // ---- 训练计划视图 (日网格/设备月视图/客户配色/导出) ----

  @Get('plan')
  listPlan(
    @Query('organizationId') organizationId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('resourceId') resourceId?: string,
    @Query('instructor') instructor?: string,
  ) {
    return this.schedulingService.listPlan(organizationId, from, to, resourceId, instructor);
  }

  @Get('plan/export')
  async exportPlan(
    @Res({ passthrough: true }) res: Response,
    @Query('organizationId') organizationId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('resourceId') resourceId?: string,
    @Query('instructor') instructor?: string,
  ) {
    const buffer = await this.schedulingService.exportPlan(organizationId, from, to, resourceId, instructor);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('训练计划.xlsx')}`,
    });
    return new StreamableFile(buffer);
  }

  @Get('customers')
  listCustomers(@Query('organizationId') organizationId: string) {
    return this.schedulingService.listCustomers(organizationId);
  }

  @Post('customers')
  setCustomers(@CurrentUser() user: AuthContext, @Body() dto: SetBookingCustomersDto) {
    return this.schedulingService.setCustomers(user.tenantId, dto.organizationId, dto.customers);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.schedulingService.cancel(id, user.tenantId);
  }
}
