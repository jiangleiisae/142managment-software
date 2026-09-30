import { Body, Controller, Get, Inject, Param, Post, Query, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Permission } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { FILE_STORAGE, type FileStorage } from '../storage/file-storage.interface.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { RequirePermissions, SkipPermissionCheck } from '../auth/permissions.decorator.js';
import { AddQtgDocumentDto } from './dto/add-qtg-document.dto.js';
import { AddQualifiedTaskDto } from './dto/add-qualified-task.dto.js';
import { AddTrainingMatrixEntryDto } from './dto/add-training-matrix-entry.dto.js';
import { CorrectDiscrepancyDto } from './dto/correct-discrepancy.dto.js';
import { CreateEslRevisionDto } from './dto/create-esl-revision.dto.js';
import { CreateFstdDto } from './dto/create-fstd.dto.js';
import { CreatePmTaskDto } from './dto/create-pm-task.dto.js';
import { DeclareEslDto } from './dto/declare-esl.dto.js';
import { RecordPerformanceMetricDto } from './dto/record-performance-metric.dto.js';
import { RecordQuarterlyQtgRunDto } from './dto/record-quarterly-qtg-run.dto.js';
import { RecordRecurrentEvaluationDto } from './dto/record-recurrent-evaluation.dto.js';
import { RecordSafetyFacilityCheckDto } from './dto/record-safety-facility-check.dto.js';
import { ReportDiscrepancyDto } from './dto/report-discrepancy.dto.js';
import { ReviewPmTaskDto } from './dto/review-pm-task.dto.js';
import { SetDiscrepancyRetentionDto } from './dto/set-discrepancy-retention.dto.js';
import { SetFcsCapabilityDto } from './dto/set-fcs-capability.dto.js';
import { SetPmChecklistTemplateDto } from './dto/set-pm-checklist-template.dto.js';
import { FstdService } from './fstd.service.js';
import { qtgFileUploadOptions } from './qtg-file-storage.js';

@Controller('fstds')
@RequirePermissions(Permission.FSTD)
export class FstdController {
  constructor(
    private readonly fstdService: FstdService,
    @Inject(FILE_STORAGE) private readonly fileStorage: FileStorage,
  ) {}

  @Post()
  create(@Body() dto: CreateFstdDto) {
    // organizationId 的租户归属已由全局 TenantGuard 校验
    return this.fstdService.create(dto);
  }

  @Get()
  @SkipPermissionCheck() // Kiosk缺陷报告页面需要枚举设备列表, 不应受FSTD模块权限限制
  findAll(@Query('organizationId') organizationId: string) {
    return this.fstdService.findAll(organizationId);
  }

  // ---- 3.3.3 训练矩阵 (全局配置表, 必须在 :id 路由之前注册以避免被误匹配) ----

  @Post('training-matrix-entries')
  addTrainingMatrixEntry(@Body() dto: AddTrainingMatrixEntryDto) {
    return this.fstdService.addTrainingMatrixEntry(dto);
  }

  @Get('training-matrix-entries')
  listTrainingMatrixEntries(@Query('taskCode') taskCode?: string) {
    return this.fstdService.listTrainingMatrixEntries(taskCode);
  }

  // ---- 3.3.10 常规维护(PM)检查单模板 (机构级全局配置, 同样须在 :id 路由之前注册) ----

  @Post('pm-checklist-templates')
  setPmChecklistTemplate(@CurrentUser() user: AuthContext, @Body() dto: SetPmChecklistTemplateDto) {
    return this.fstdService.setPmChecklistTemplate(dto.organizationId, user.tenantId, dto);
  }

  @Get('pm-checklist-templates')
  listPmChecklistTemplates(@Query('organizationId') organizationId: string) {
    return this.fstdService.listPmChecklistTemplates(organizationId);
  }

  @Get('pm-tasks/due-soon')
  findPmTasksDueSoon(@CurrentUser() user: AuthContext, @Query('withinDays') withinDays: string) {
    return this.fstdService.findPmTasksDueSoon(user.tenantId, Number(withinDays) || 60);
  }

  @Post('pm-tasks/:taskId/review')
  reviewPmTask(@CurrentUser() user: AuthContext, @Param('taskId') taskId: string, @Body() dto: ReviewPmTaskDto) {
    return this.fstdService.reviewPmTask(taskId, user.tenantId, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.fstdService.findOne(id, user.tenantId);
  }

  @Post(':id/qualified-tasks')
  addQualifiedTask(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: AddQualifiedTaskDto) {
    return this.fstdService.addQualifiedTask(id, user.tenantId, dto);
  }

  @Get(':id/can-perform/:taskCode')
  canPerformTask(@CurrentUser() user: AuthContext, @Param('id') id: string, @Param('taskCode') taskCode: string) {
    return this.fstdService.canPerformTask(id, user.tenantId, taskCode);
  }

  // ---- 3.3.2 FCS能力矩阵 ----

  @Post(':id/fcs-capabilities')
  setFcsCapability(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: SetFcsCapabilityDto) {
    return this.fstdService.setFcsCapability(id, user.tenantId, dto);
  }

  @Get(':id/fcs-capabilities')
  listFcsCapabilities(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.fstdService.listFcsCapabilities(id, user.tenantId);
  }

  // ---- 装备规格清单 ESL ----

  @Post(':id/esl')
  createEslRevision(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: CreateEslRevisionDto) {
    return this.fstdService.createEslRevision(id, user.tenantId, dto);
  }

  @Get(':id/esl')
  listEsls(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.fstdService.listEsls(id, user.tenantId);
  }

  @Post('esl/:eslId/declare')
  declareEsl(@CurrentUser() user: AuthContext, @Param('eslId') eslId: string, @Body() dto: DeclareEslDto) {
    return this.fstdService.declareEsl(eslId, user.tenantId, dto.personnelId);
  }

  // ---- FSTD性能指标 (AMC1 ORA.FSTD.100(d)) ----

  @Post(':id/performance-metrics')
  recordPerformanceMetric(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: RecordPerformanceMetricDto) {
    return this.fstdService.recordPerformanceMetric(id, user.tenantId, dto);
  }

  @Get(':id/performance-metrics')
  getPerformanceMetrics(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.fstdService.getPerformanceMetrics(id, user.tenantId);
  }

  @Post(':id/discrepancies')
  @SkipPermissionCheck() // Kiosk场景: 任何在场人员都应能报告缺陷, 不受FSTD模块权限限制
  reportDiscrepancy(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: ReportDiscrepancyDto) {
    return this.fstdService.reportDiscrepancy(id, user.tenantId, dto);
  }

  @Get(':id/discrepancies')
  listDiscrepancies(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.fstdService.listDiscrepancies(id, user.tenantId);
  }

  @Get('discrepancies/overdue')
  findOverdueDiscrepancies(@CurrentUser() user: AuthContext) {
    return this.fstdService.findOverdueDiscrepancies(user.tenantId);
  }

  @Post('discrepancies/:discrepancyId/correct')
  correctDiscrepancy(
    @CurrentUser() user: AuthContext,
    @Param('discrepancyId') discrepancyId: string,
    @Body() dto: CorrectDiscrepancyDto,
  ) {
    return this.fstdService.correctDiscrepancy(discrepancyId, user.tenantId, dto);
  }

  @Get('discrepancies/open')
  @SkipPermissionCheck() // 主要消费方是库存页面的"关联缺陷"下拉框(需INVENTORY权限), 不应额外要求FSTD权限
  listOpenDiscrepanciesForOrg(@CurrentUser() user: AuthContext, @Query('organizationId') organizationId: string) {
    return this.fstdService.listOpenDiscrepanciesForOrg(organizationId, user.tenantId);
  }

  @Post('discrepancies/:discrepancyId/retention')
  setDiscrepancyRetention(
    @CurrentUser() user: AuthContext,
    @Param('discrepancyId') discrepancyId: string,
    @Body() dto: SetDiscrepancyRetentionDto,
  ) {
    return this.fstdService.setDiscrepancyRetention(discrepancyId, user.tenantId, dto);
  }

  @Post('discrepancies/:discrepancyId/retention/clear')
  clearDiscrepancyRetention(@CurrentUser() user: AuthContext, @Param('discrepancyId') discrepancyId: string) {
    return this.fstdService.clearDiscrepancyRetention(discrepancyId, user.tenantId);
  }

  // ---- 3.3.5 周期性评估 ----

  @Post(':id/recurrent-evaluations')
  recordRecurrentEvaluation(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: RecordRecurrentEvaluationDto) {
    return this.fstdService.recordRecurrentEvaluation(id, user.tenantId, dto);
  }

  @Get(':id/recurrent-evaluations')
  listRecurrentEvaluations(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.fstdService.listRecurrentEvaluations(id, user.tenantId);
  }

  @Get(':id/recurrent-evaluations/extension-eligibility')
  checkExtensionEligibility(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.fstdService.checkExtensionEligibility(id, user.tenantId);
  }

  @Get('evaluations/due-soon')
  findEvaluationsDueSoon(@CurrentUser() user: AuthContext, @Query('withinDays') withinDays: string) {
    return this.fstdService.findEvaluationsDueSoon(user.tenantId, Number(withinDays) || 60);
  }

  // ---- 3.3.8 安全设施年检 ----

  @Post(':id/safety-facility-checks')
  recordSafetyFacilityCheck(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: RecordSafetyFacilityCheckDto) {
    return this.fstdService.recordSafetyFacilityCheck(id, user.tenantId, dto);
  }

  @Get(':id/safety-facility-checks')
  listSafetyFacilityChecks(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.fstdService.listSafetyFacilityChecks(id, user.tenantId);
  }

  @Get('safety-facility-checks/due-soon')
  findSafetyChecksDueSoon(@CurrentUser() user: AuthContext, @Query('withinDays') withinDays: string) {
    return this.fstdService.findSafetyChecksDueSoon(user.tenantId, Number(withinDays) || 60);
  }

  // ---- 3.3.4 QTG/MQTG生命周期: 文档版本管理 ----

  @Post(':id/qtg-documents')
  @UseInterceptors(FileInterceptor('file', qtgFileUploadOptions))
  async addQtgDocument(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: AddQtgDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const storedFileName = file
      ? await this.fileStorage.save(file.buffer, { originalName: file.originalname, mimeType: file.mimetype })
      : undefined;
    return this.fstdService.addQtgDocument(id, user.tenantId, {
      ...dto,
      storedFileName,
      originalFileName: file?.originalname,
      mimeType: file?.mimetype,
      fileSize: file?.size,
    });
  }

  @Get(':id/qtg-documents')
  listQtgDocuments(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.fstdService.listQtgDocuments(id, user.tenantId);
  }

  @Get('qtg-documents/:docId/file')
  async downloadQtgDocumentFile(
    @CurrentUser() user: AuthContext,
    @Param('docId') docId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const doc = await this.fstdService.findQtgDocumentForDownload(docId, user.tenantId);
    res.set({
      'Content-Type': doc.mimeType ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(doc.originalFileName!)}`,
    });
    return new StreamableFile(await this.fileStorage.getStream(doc.pointerUrl!));
  }

  // ---- 3.3.4 年度QTG按季度滚动运行 ----

  @Post(':id/qtg-quarterly-runs')
  recordQuarterlyQtgRun(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: RecordQuarterlyQtgRunDto) {
    return this.fstdService.recordQuarterlyQtgRun(id, user.tenantId, dto);
  }

  @Get(':id/qtg-quarterly-runs')
  listQuarterlyQtgRuns(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.fstdService.listQuarterlyQtgRuns(id, user.tenantId);
  }

  @Get('qtg-quarterly-runs/issues')
  findQuarterlyQtgIssues(@CurrentUser() user: AuthContext) {
    return this.fstdService.findQuarterlyQtgIssues(user.tenantId);
  }

  // 3.3.6 变更管理已迁移至通用 /change-requests 接口 (entityType=Fstd), 见 change-management 模块

  // ---- 3.3.10 常规维护(PM)排期: 设备维度的任务登记, 检查单模板/审核/到期告警见上方 :id 路由之前的注册区 ----

  @Post(':id/pm-tasks')
  createPmTask(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: CreatePmTaskDto) {
    return this.fstdService.createPmTask(id, user.tenantId, dto);
  }

  @Get(':id/pm-tasks')
  listPmTasks(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.fstdService.listPmTasks(id, user.tenantId);
  }
}
