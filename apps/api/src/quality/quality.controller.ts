import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { Permission } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { RequirePermissions, SkipPermissionCheck } from '../auth/permissions.decorator.js';
import {
  CreateInspectionDto,
  RespondSurveyDto,
  SaveMeetingDto,
  SaveSurveyDto,
  SaveTrainingDto,
  SetInspectionItemsDto,
  UpdateMeetingDto,
  UpdateSurveyDto,
  UpdateTrainingDto,
} from './dto/quality.dto.js';
import { QualityService } from './quality.service.js';

/// 质量管理 (R6): 会议记录、培训管理、其他检查、问卷。权限沿用 MANAGEMENT_SYSTEM (管理体系 SMS/QMS);
/// 问卷的"我的问卷/填写"对任意已登录用户开放 (只能看到本租户已发布的问卷, 每人每份只能填一次)。
@Controller('quality')
@RequirePermissions(Permission.MANAGEMENT_SYSTEM)
export class QualityController {
  constructor(private readonly qualityService: QualityService) {}

  // ---- 会议记录 ----

  @Get('meetings')
  listMeetings(@CurrentUser() user: AuthContext, @Query('organizationId') organizationId: string, @Query('from') from?: string, @Query('to') to?: string, @Query('keyword') keyword?: string) {
    return this.qualityService.listMeetings(user.tenantId, organizationId, { from, to, keyword });
  }

  @Post('meetings')
  createMeeting(@CurrentUser() user: AuthContext, @Body() dto: SaveMeetingDto) {
    return this.qualityService.createMeeting(user.tenantId, user.email, dto);
  }

  @Patch('meetings/:id')
  updateMeeting(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: UpdateMeetingDto) {
    return this.qualityService.updateMeeting(user.tenantId, id, dto);
  }

  @Delete('meetings/:id')
  deleteMeeting(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.qualityService.deleteMeeting(user.tenantId, id);
  }

  // ---- 培训管理 ----

  @Get('trainings')
  listTrainings(@CurrentUser() user: AuthContext, @Query('organizationId') organizationId: string, @Query('from') from?: string, @Query('to') to?: string, @Query('keyword') keyword?: string) {
    return this.qualityService.listTrainings(user.tenantId, organizationId, { from, to, keyword });
  }

  @Post('trainings')
  createTraining(@CurrentUser() user: AuthContext, @Body() dto: SaveTrainingDto) {
    return this.qualityService.createTraining(user.tenantId, user.email, dto);
  }

  @Patch('trainings/:id')
  updateTraining(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: UpdateTrainingDto) {
    return this.qualityService.updateTraining(user.tenantId, id, dto);
  }

  @Delete('trainings/:id')
  deleteTraining(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.qualityService.deleteTraining(user.tenantId, id);
  }

  // ---- 其他检查 ----

  @Get('inspection-items')
  listInspectionItems(@Query('organizationId') organizationId: string) {
    return this.qualityService.listInspectionItems(organizationId);
  }

  @Put('inspection-items')
  setInspectionItems(@CurrentUser() user: AuthContext, @Body() dto: SetInspectionItemsDto) {
    return this.qualityService.setInspectionItems(user.tenantId, dto.organizationId, dto.names);
  }

  @Get('inspections')
  listInspections(@CurrentUser() user: AuthContext, @Query('organizationId') organizationId: string, @Query('from') from?: string, @Query('to') to?: string, @Query('result') result?: string) {
    return this.qualityService.listInspections(user.tenantId, organizationId, { from, to, result });
  }

  @Post('inspections')
  createInspection(@CurrentUser() user: AuthContext, @Body() dto: CreateInspectionDto) {
    return this.qualityService.createInspection(user.tenantId, user.email, dto);
  }

  // ---- 问卷管理 ----

  @Get('surveys')
  listSurveys(@Query('organizationId') organizationId: string) {
    return this.qualityService.listSurveys(organizationId);
  }

  @Post('surveys')
  createSurvey(@CurrentUser() user: AuthContext, @Body() dto: SaveSurveyDto) {
    return this.qualityService.createSurvey(user.tenantId, user.email, dto);
  }

  @Patch('surveys/:id')
  updateSurvey(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: UpdateSurveyDto) {
    return this.qualityService.updateSurvey(user.tenantId, id, dto);
  }

  @Delete('surveys/:id')
  deleteSurvey(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.qualityService.deleteSurvey(user.tenantId, id);
  }

  @Post('surveys/:id/publish')
  publishSurvey(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.qualityService.publishSurvey(user.tenantId, user.email, id);
  }

  @Post('surveys/:id/close')
  closeSurvey(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.qualityService.closeSurvey(user.tenantId, user.email, id);
  }

  @Get('surveys/:id/stats')
  surveyStats(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.qualityService.surveyStats(user.tenantId, id);
  }

  // ---- 填写问卷 (任意已登录用户) ----

  @Get('my-surveys')
  @SkipPermissionCheck()
  mySurveys(@CurrentUser() user: AuthContext) {
    return this.qualityService.mySurveys(user.tenantId, user.userId);
  }

  @Post('surveys/:id/respond')
  @SkipPermissionCheck()
  respond(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: RespondSurveyDto) {
    return this.qualityService.respond(user.tenantId, user.userId, user.email, id, dto.answers);
  }
}
