import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, StreamableFile } from '@nestjs/common';
import { Permission } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { RequirePermissions, SkipPermissionCheck } from '../auth/permissions.decorator.js';
import {
  CreateRosterGroupDto,
  CreateShiftTypeDto,
  CreateStaffDto,
  SetRosterEntriesDto,
  UpdateRosterGroupDto,
  UpdateShiftTypeDto,
  UpdateStaffDto,
} from './dto/roster.dto.js';
import { parseDepartment, RosterService } from './roster.service.js';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/// 人员班表: 班次配置、班组、排班人员(维护人员/行政综合人员)、班表、工时统计。权限沿用 SCHEDULING;
/// "我的排班"对任意已登录用户开放(只返回本人)。维护和行政综合两个部门用 department 参数区分, 不传默认维护。
@Controller('roster')
@RequirePermissions(Permission.SCHEDULING)
export class RosterController {
  constructor(private readonly rosterService: RosterService) {}

  private file(res: Response, buffer: Buffer, name: string) {
    res.set({ 'Content-Type': XLSX, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}` });
    return new StreamableFile(buffer);
  }

  @Get('shift-types')
  listShiftTypes(@Query('organizationId') organizationId: string, @Query('department') department?: string) {
    return this.rosterService.listShiftTypes(organizationId, parseDepartment(department));
  }

  @Post('shift-types')
  createShiftType(@CurrentUser() user: AuthContext, @Body() dto: CreateShiftTypeDto) {
    return this.rosterService.createShiftType(user.tenantId, dto);
  }

  @Patch('shift-types/:id')
  updateShiftType(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: UpdateShiftTypeDto) {
    return this.rosterService.updateShiftType(user.tenantId, id, dto);
  }

  @Get('groups')
  listGroups(@Query('organizationId') organizationId: string, @Query('department') department?: string) {
    return this.rosterService.listGroups(organizationId, parseDepartment(department));
  }

  @Post('groups')
  createGroup(@Body() dto: CreateRosterGroupDto) {
    return this.rosterService.createGroup(dto.organizationId, dto.department ?? 'MAINTENANCE', dto.name);
  }

  @Patch('groups/:id')
  updateGroup(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: UpdateRosterGroupDto) {
    return this.rosterService.updateGroup(user.tenantId, id, dto);
  }

  @Delete('groups/:id')
  deleteGroup(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.rosterService.deleteGroup(user.tenantId, id);
  }

  // ---- 排班人员 (单段字面量路由 user-options 在带参数的路由之前) ----

  @Get('staff/user-options')
  userOptions(@CurrentUser() user: AuthContext) {
    return this.rosterService.userOptions(user.tenantId);
  }

  @Get('staff')
  listStaff(@Query('organizationId') organizationId: string, @Query('department') department?: string, @Query('includeInactive') includeInactive?: string) {
    return this.rosterService.listStaff(organizationId, parseDepartment(department), includeInactive === 'true');
  }

  @Post('staff')
  createStaff(@CurrentUser() user: AuthContext, @Body() dto: CreateStaffDto) {
    return this.rosterService.createStaff(user.tenantId, user.email, dto);
  }

  @Patch('staff/:id')
  updateStaff(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: UpdateStaffDto) {
    return this.rosterService.updateStaff(user.tenantId, user.email, id, dto);
  }

  @Delete('staff/:id')
  deleteStaff(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.rosterService.deleteStaff(user.tenantId, user.email, id);
  }

  // ---- 班表 ----

  @Get('entries')
  listEntries(@Query('organizationId') organizationId: string, @Query('month') month: string, @Query('department') department?: string) {
    return this.rosterService.listEntries(organizationId, parseDepartment(department), month);
  }

  @Post('entries')
  setEntries(@CurrentUser() user: AuthContext, @Body() dto: SetRosterEntriesDto) {
    return this.rosterService.setEntries(user.tenantId, user.email, dto.organizationId, dto.cells, dto.shiftTypeId);
  }

  @Get('history')
  history(
    @CurrentUser() user: AuthContext,
    @Query('organizationId') organizationId: string,
    @Query('department') department?: string,
    @Query('staffId') staffId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.rosterService.history(user.tenantId, organizationId, parseDepartment(department), staffId, from, to);
  }

  @Get('hours')
  hours(@Query('organizationId') organizationId: string, @Query('from') from: string, @Query('to') to: string, @Query('department') department?: string, @Query('groupId') groupId?: string) {
    return this.rosterService.hours(organizationId, parseDepartment(department), from, to, groupId);
  }

  @Get('hours/export')
  async exportHours(
    @Res({ passthrough: true }) res: Response,
    @Query('organizationId') organizationId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('department') department?: string,
    @Query('groupId') groupId?: string,
  ) {
    return this.file(res, await this.rosterService.exportHours(organizationId, parseDepartment(department), from, to, groupId), '工时统计.xlsx');
  }

  @Get('export')
  async exportMonth(@Res({ passthrough: true }) res: Response, @Query('organizationId') organizationId: string, @Query('month') month: string, @Query('department') department?: string) {
    return this.file(res, await this.rosterService.exportMonth(organizationId, parseDepartment(department), month), `人员班表-${month}.xlsx`);
  }

  @Get('my')
  @SkipPermissionCheck()
  my(@CurrentUser() user: AuthContext, @Query('days') days?: string) {
    return this.rosterService.myRoster(user.tenantId, user.userId, Number(days) || 15);
  }
}
