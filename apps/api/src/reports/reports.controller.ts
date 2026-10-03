import { Controller, Get, Query, Res, StreamableFile } from '@nestjs/common';
import { Permission } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { ReportsService } from './reports.service.js';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/// 统计报表 (只读汇总, 不改数据): 运行效率/故障/PM 归 FSTD 模块权限, 备件归 INVENTORY 模块权限。
/// from/to 为含首含尾的北京时间日历日 (YYYY-MM-DD), 单次范围不超过366天。
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  private file(res: Response, buffer: Buffer, name: string) {
    res.set({ 'Content-Type': XLSX, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}` });
    return new StreamableFile(buffer);
  }

  @Get('operational-efficiency')
  @RequirePermissions(Permission.FSTD)
  operationalEfficiency(@Query('organizationId') organizationId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.reportsService.operationalEfficiency(organizationId, from, to);
  }

  @Get('operational-efficiency/export')
  @RequirePermissions(Permission.FSTD)
  async exportOperationalEfficiency(@Res({ passthrough: true }) res: Response, @Query('organizationId') organizationId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.file(res, await this.reportsService.exportOperationalEfficiency(organizationId, from, to), '运行效率统计.xlsx');
  }

  @Get('faults')
  @RequirePermissions(Permission.FSTD)
  faults(@CurrentUser() user: AuthContext, @Query('organizationId') organizationId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.reportsService.faultStatistics(user.tenantId, organizationId, from, to);
  }

  @Get('faults/export')
  @RequirePermissions(Permission.FSTD)
  async exportFaults(@CurrentUser() user: AuthContext, @Res({ passthrough: true }) res: Response, @Query('organizationId') organizationId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.file(res, await this.reportsService.exportFaultStatistics(user.tenantId, organizationId, from, to), '故障统计.xlsx');
  }

  @Get('pm')
  @RequirePermissions(Permission.FSTD)
  pm(@CurrentUser() user: AuthContext, @Query('organizationId') organizationId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.reportsService.pmStatistics(user.tenantId, organizationId, from, to);
  }

  @Get('pm/export')
  @RequirePermissions(Permission.FSTD)
  async exportPm(@CurrentUser() user: AuthContext, @Res({ passthrough: true }) res: Response, @Query('organizationId') organizationId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.file(res, await this.reportsService.exportPmStatistics(user.tenantId, organizationId, from, to), 'PM统计.xlsx');
  }

  @Get('annual-operations/export')
  @RequirePermissions(Permission.FSTD)
  async exportAnnualOperations(@CurrentUser() user: AuthContext, @Res({ passthrough: true }) res: Response, @Query('organizationId') organizationId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.file(res, await this.reportsService.exportAnnualOperations(user.tenantId, organizationId, from, to), '设备运行报告底稿.xlsx');
  }

  @Get('parts')
  @RequirePermissions(Permission.INVENTORY)
  parts(@Query('organizationId') organizationId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.reportsService.partStatistics(organizationId, from, to);
  }

  @Get('parts/export')
  @RequirePermissions(Permission.INVENTORY)
  async exportParts(@Res({ passthrough: true }) res: Response, @Query('organizationId') organizationId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.file(res, await this.reportsService.exportPartStatistics(organizationId, from, to), '备件统计.xlsx');
  }
}
