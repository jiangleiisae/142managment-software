import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, StreamableFile } from '@nestjs/common';
import { Permission } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import {
  CompleteDutyHandoverDto,
  CreateDutyEntryDto,
  CreateDutyHandoverDto,
  CreateDutyLogDto,
  UpdateDutyEntryDto,
  UpdateDutyHandoverDto,
  UpdateDutyLogDto,
} from './dto/duty.dto.js';
import { DutyService } from './duty.service.js';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/// 值班日志与交接班 (R4a), 权限沿用 SCHEDULING (与班表同一模块)。
/// 单段字面量路由(export/handovers)放在 :id 之前注册。
@Controller()
@RequirePermissions(Permission.SCHEDULING)
export class DutyController {
  constructor(private readonly dutyService: DutyService) {}

  @Get('duty-logs')
  list(
    @CurrentUser() user: AuthContext,
    @Query('organizationId') organizationId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('groupId') groupId?: string,
    @Query('engineerId') engineerId?: string,
    @Query('fstdId') fstdId?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.dutyService.list(user.tenantId, organizationId, { from, to, status, groupId, engineerId, fstdId, keyword });
  }

  @Get('duty-logs/export')
  async exportLogs(
    @CurrentUser() user: AuthContext,
    @Res({ passthrough: true }) res: Response,
    @Query('organizationId') organizationId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('groupId') groupId?: string,
    @Query('engineerId') engineerId?: string,
    @Query('fstdId') fstdId?: string,
    @Query('keyword') keyword?: string,
  ) {
    const buffer = await this.dutyService.exportLogs(user.tenantId, organizationId, { from, to, status, groupId, engineerId, fstdId, keyword });
    res.set({ 'Content-Type': XLSX, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('值班日志.xlsx')}` });
    return new StreamableFile(buffer);
  }

  @Post('duty-logs')
  create(@CurrentUser() user: AuthContext, @Body() dto: CreateDutyLogDto) {
    return this.dutyService.create(user.tenantId, user.email, dto);
  }

  @Get('duty-logs/:id')
  detail(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.dutyService.getDetail(user.tenantId, id);
  }

  @Patch('duty-logs/:id')
  update(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: UpdateDutyLogDto) {
    return this.dutyService.update(user.tenantId, id, dto);
  }

  @Delete('duty-logs/:id')
  remove(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.dutyService.remove(user.tenantId, id);
  }

  @Post('duty-logs/:id/submit')
  submit(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.dutyService.submit(user.tenantId, user.email, id);
  }

  @Post('duty-logs/:id/reopen')
  reopen(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.dutyService.reopen(user.tenantId, user.email, id);
  }

  @Post('duty-logs/:id/entries')
  addEntry(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: CreateDutyEntryDto) {
    return this.dutyService.addEntry(user.tenantId, id, dto);
  }

  @Patch('duty-entries/:entryId')
  updateEntry(@CurrentUser() user: AuthContext, @Param('entryId') entryId: string, @Body() dto: UpdateDutyEntryDto) {
    return this.dutyService.updateEntry(user.tenantId, entryId, dto);
  }

  @Delete('duty-entries/:entryId')
  removeEntry(@CurrentUser() user: AuthContext, @Param('entryId') entryId: string) {
    return this.dutyService.removeEntry(user.tenantId, entryId);
  }

  @Post('duty-logs/:id/handovers')
  addHandover(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: CreateDutyHandoverDto) {
    return this.dutyService.addHandover(user.tenantId, id, dto);
  }

  @Get('duty-handovers')
  listHandovers(
    @Query('organizationId') organizationId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.dutyService.listHandovers(organizationId, { from, to, status, keyword });
  }

  @Patch('duty-handovers/:handoverId')
  updateHandover(@CurrentUser() user: AuthContext, @Param('handoverId') handoverId: string, @Body() dto: UpdateDutyHandoverDto) {
    return this.dutyService.updateHandover(user.tenantId, handoverId, dto);
  }

  @Delete('duty-handovers/:handoverId')
  removeHandover(@CurrentUser() user: AuthContext, @Param('handoverId') handoverId: string) {
    return this.dutyService.removeHandover(user.tenantId, handoverId);
  }

  @Post('duty-handovers/:handoverId/complete')
  completeHandover(@CurrentUser() user: AuthContext, @Param('handoverId') handoverId: string, @Body() dto: CompleteDutyHandoverDto) {
    return this.dutyService.completeHandover(user.tenantId, user.email, handoverId, dto.completedInLogId);
  }

  @Post('duty-handovers/:handoverId/reopen')
  reopenHandover(@CurrentUser() user: AuthContext, @Param('handoverId') handoverId: string) {
    return this.dutyService.reopenHandover(user.tenantId, handoverId);
  }
}
