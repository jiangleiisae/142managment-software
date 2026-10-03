import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Res, StreamableFile } from '@nestjs/common';
import { Permission } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { CreateUpgradeRecordDto, SetQtgPlanDto, UpdateUpgradeRecordDto } from './dto/upgrade.dto.js';
import { UpgradeService } from './upgrade.service.js';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/// 升级/改装/校准记录与 QTG 执行计划 (R7), 权限沿用 FSTD。单段字面量路由(export)放在 :id 之前。
@Controller()
@RequirePermissions(Permission.FSTD)
export class UpgradeController {
  constructor(private readonly upgradeService: UpgradeService) {}

  @Get('upgrades')
  list(
    @CurrentUser() user: AuthContext,
    @Query('organizationId') organizationId: string,
    @Query('category') category?: string,
    @Query('fstdId') fstdId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.upgradeService.list(user.tenantId, organizationId, { category, fstdId, from, to });
  }

  @Get('upgrades/export')
  async exportRecords(
    @CurrentUser() user: AuthContext,
    @Res({ passthrough: true }) res: Response,
    @Query('organizationId') organizationId: string,
    @Query('category') category?: string,
    @Query('fstdId') fstdId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const buffer = await this.upgradeService.exportRecords(user.tenantId, organizationId, { category, fstdId, from, to });
    res.set({ 'Content-Type': XLSX, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('升级校准记录.xlsx')}` });
    return new StreamableFile(buffer);
  }

  @Post('upgrades')
  create(@CurrentUser() user: AuthContext, @Body() dto: CreateUpgradeRecordDto) {
    return this.upgradeService.create(user.tenantId, user.email, dto);
  }

  @Patch('upgrades/:id')
  update(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: UpdateUpgradeRecordDto) {
    return this.upgradeService.update(user.tenantId, id, dto);
  }

  @Get('qtg-plans/schedule')
  qtgSchedule(@CurrentUser() user: AuthContext, @Query('organizationId') organizationId: string, @Query('year') year: string) {
    return this.upgradeService.qtgSchedule(user.tenantId, organizationId, Number(year));
  }

  @Put('qtg-plans')
  setQtgPlan(@CurrentUser() user: AuthContext, @Body() dto: SetQtgPlanDto) {
    return this.upgradeService.setQtgPlan(user.tenantId, dto);
  }

  @Delete('qtg-plans')
  clearQtgPlan(@CurrentUser() user: AuthContext, @Query('organizationId') organizationId: string, @Query('fstdId') fstdId: string, @Query('quarter') quarter: string) {
    return this.upgradeService.clearQtgPlan(user.tenantId, organizationId, fstdId, Number(quarter));
  }
}
