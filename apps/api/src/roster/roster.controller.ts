import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, StreamableFile } from '@nestjs/common';
import { Permission } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { RequirePermissions, SkipPermissionCheck } from '../auth/permissions.decorator.js';
import {
  AddRosterMembersDto,
  CreateRosterMemberDto,
  CreateRosterGroupDto,
  CreateShiftTypeDto,
  SetRosterEntriesDto,
  UpdateRosterGroupDto,
  UpdateRosterMemberDto,
  UpdateShiftTypeDto,
} from './dto/roster.dto.js';
import { RosterService } from './roster.service.js';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/// 人员班表 (R2): 班次配置、班组与人员、班表、工时统计。权限沿用 SCHEDULING; "我的排班"对任意已登录用户开放(只返回本人)。
@Controller('roster')
@RequirePermissions(Permission.SCHEDULING)
export class RosterController {
  constructor(private readonly rosterService: RosterService) {}

  private file(res: Response, buffer: Buffer, name: string) {
    res.set({ 'Content-Type': XLSX, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}` });
    return new StreamableFile(buffer);
  }

  @Get('shift-types')
  listShiftTypes(@Query('organizationId') organizationId: string) {
    return this.rosterService.listShiftTypes(organizationId);
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
  listGroups(@Query('organizationId') organizationId: string) {
    return this.rosterService.listGroups(organizationId);
  }

  @Post('groups')
  createGroup(@Body() dto: CreateRosterGroupDto) {
    return this.rosterService.createGroup(dto.organizationId, dto.name);
  }

  @Patch('groups/:id')
  updateGroup(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: UpdateRosterGroupDto) {
    return this.rosterService.updateGroup(user.tenantId, id, dto);
  }

  @Delete('groups/:id')
  deleteGroup(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.rosterService.deleteGroup(user.tenantId, id);
  }

  @Get('members')
  listMembers(@Query('organizationId') organizationId: string) {
    return this.rosterService.listMembers(organizationId);
  }

  @Get('personnel-options')
  personnelOptions(@CurrentUser() user: AuthContext, @Query('organizationId') organizationId: string) {
    return this.rosterService.personnelOptions(user.tenantId, organizationId);
  }

  @Post('members/new')
  createMember(@CurrentUser() user: AuthContext, @Body() dto: CreateRosterMemberDto) {
    return this.rosterService.createMember(user.tenantId, user.email, dto.organizationId, dto);
  }

  @Post('members')
  addMembers(@CurrentUser() user: AuthContext, @Body() dto: AddRosterMembersDto) {
    return this.rosterService.addMembers(user.tenantId, dto.organizationId, dto.personnelIds, dto.groupId);
  }

  @Patch('members/:id')
  updateMember(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: UpdateRosterMemberDto) {
    return this.rosterService.updateMember(user.tenantId, id, dto);
  }

  @Delete('members/:id')
  removeMember(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.rosterService.removeMember(user.tenantId, id);
  }

  @Get('entries')
  listEntries(@Query('organizationId') organizationId: string, @Query('month') month: string) {
    return this.rosterService.listEntries(organizationId, month);
  }

  @Post('entries')
  setEntries(@CurrentUser() user: AuthContext, @Body() dto: SetRosterEntriesDto) {
    return this.rosterService.setEntries(user.tenantId, user.email, dto.organizationId, dto.cells, dto.shiftTypeId);
  }

  @Get('history')
  history(
    @CurrentUser() user: AuthContext,
    @Query('organizationId') organizationId: string,
    @Query('personnelId') personnelId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.rosterService.history(user.tenantId, organizationId, personnelId, from, to);
  }

  @Get('hours')
  hours(@Query('organizationId') organizationId: string, @Query('from') from: string, @Query('to') to: string, @Query('groupId') groupId?: string) {
    return this.rosterService.hours(organizationId, from, to, groupId);
  }

  @Get('hours/export')
  async exportHours(@Res({ passthrough: true }) res: Response, @Query('organizationId') organizationId: string, @Query('from') from: string, @Query('to') to: string, @Query('groupId') groupId?: string) {
    return this.file(res, await this.rosterService.exportHours(organizationId, from, to, groupId), '工时统计.xlsx');
  }

  @Get('export')
  async exportMonth(@Res({ passthrough: true }) res: Response, @Query('organizationId') organizationId: string, @Query('month') month: string) {
    return this.file(res, await this.rosterService.exportMonth(organizationId, month), `人员班表-${month}.xlsx`);
  }

  @Get('my')
  @SkipPermissionCheck()
  my(@CurrentUser() user: AuthContext, @Query('days') days?: string) {
    return this.rosterService.myRoster(user.tenantId, user.userId, Number(days) || 15);
  }
}
