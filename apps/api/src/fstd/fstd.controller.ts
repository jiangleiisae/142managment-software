import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { Body, Controller, Get, Param, Post, Query, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  FcsCharacteristic,
  FcsFidelityLevel,
  FstdDeviceType,
  FstdQualificationBasisType,
  LegacyLevel,
  QtgDocumentType,
} from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { FstdService } from './fstd.service.js';
import { QTG_UPLOAD_DIR, qtgFileUploadOptions } from './qtg-file-storage.js';

@Controller('fstds')
export class FstdController {
  constructor(private readonly fstdService: FstdService) {}

  @Post()
  create(
    @Body()
    dto: {
      organizationId: string;
      deviceCode: string;
      representedAircraft: string;
      deviceType: FstdDeviceType;
      serialNumber?: string;
      location?: string;
      legacyLevel?: LegacyLevel;
      qualificationBasisType?: FstdQualificationBasisType;
    },
  ) {
    // organizationId 的租户归属已由全局 TenantGuard 校验
    return this.fstdService.create(dto);
  }

  @Get()
  findAll(@Query('organizationId') organizationId: string) {
    return this.fstdService.findAll(organizationId);
  }

  // ---- 3.3.3 训练矩阵 (全局配置表, 必须在 :id 路由之前注册以避免被误匹配) ----

  @Post('training-matrix-entries')
  addTrainingMatrixEntry(
    @Body()
    dto: { taskCode: string; taskName: string; characteristic: FcsCharacteristic; thresholdT: FcsFidelityLevel; thresholdTP: FcsFidelityLevel },
  ) {
    return this.fstdService.addTrainingMatrixEntry(dto);
  }

  @Get('training-matrix-entries')
  listTrainingMatrixEntries(@Query('taskCode') taskCode?: string) {
    return this.fstdService.listTrainingMatrixEntries(taskCode);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.fstdService.findOne(id, user.tenantId);
  }

  @Post(':id/qualified-tasks')
  addQualifiedTask(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: { taskCode: string; taskName: string; requiresSpecialAuth?: boolean },
  ) {
    return this.fstdService.addQualifiedTask(id, user.tenantId, dto);
  }

  @Get(':id/can-perform/:taskCode')
  canPerformTask(@CurrentUser() user: AuthContext, @Param('id') id: string, @Param('taskCode') taskCode: string) {
    return this.fstdService.canPerformTask(id, user.tenantId, taskCode);
  }

  // ---- 3.3.2 FCS能力矩阵 ----

  @Post(':id/fcs-capabilities')
  setFcsCapability(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body()
    dto: { characteristic: FcsCharacteristic; fidelityLevel: FcsFidelityLevel; subsystem?: string; isAssigned?: boolean },
  ) {
    return this.fstdService.setFcsCapability(id, user.tenantId, dto);
  }

  @Get(':id/fcs-capabilities')
  listFcsCapabilities(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.fstdService.listFcsCapabilities(id, user.tenantId);
  }

  @Post(':id/discrepancies')
  reportDiscrepancy(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body()
    dto: {
      description: string;
      isMmi?: boolean;
      reportedById?: string;
      severityRating?: number;
      trainingTimeLostMinutes?: number;
    },
  ) {
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
    @Body() dto: { correctiveAction: string; correctedById?: string },
  ) {
    return this.fstdService.correctDiscrepancy(discrepancyId, user.tenantId, dto);
  }

  // ---- 3.3.5 周期性评估 ----

  @Post(':id/recurrent-evaluations')
  recordRecurrentEvaluation(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: { periodStart: string; periodEnd: string; evaluationType?: string; result?: string },
  ) {
    return this.fstdService.recordRecurrentEvaluation(id, user.tenantId, dto);
  }

  @Get(':id/recurrent-evaluations')
  listRecurrentEvaluations(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.fstdService.listRecurrentEvaluations(id, user.tenantId);
  }

  @Get('evaluations/due-soon')
  findEvaluationsDueSoon(@CurrentUser() user: AuthContext, @Query('withinDays') withinDays: string) {
    return this.fstdService.findEvaluationsDueSoon(user.tenantId, Number(withinDays) || 60);
  }

  // ---- 3.3.8 安全设施年检 ----

  @Post(':id/safety-facility-checks')
  recordSafetyFacilityCheck(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body()
    dto: { checkedAt: string; checkedById?: string; items: { item: string; passed: boolean; notes?: string }[] },
  ) {
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
  addQtgDocument(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: { documentType: QtgDocumentType; version: string; effectiveDate: string; pointerUrl?: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.fstdService.addQtgDocument(id, user.tenantId, {
      ...dto,
      storedFileName: file?.filename,
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
    return new StreamableFile(createReadStream(join(QTG_UPLOAD_DIR, doc.pointerUrl!)));
  }

  // ---- 3.3.4 年度QTG按季度滚动运行 ----

  @Post(':id/qtg-quarterly-runs')
  recordQuarterlyQtgRun(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: { year: number; quarter: number; completedAt?: string; result?: string; notes?: string },
  ) {
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

  // ---- 3.3.6 变更管理: draft -> submitted -> approved / rejected ----

  @Post(':id/change-requests')
  createChangeRequest(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: { changeType: string; description?: string },
  ) {
    return this.fstdService.createChangeRequest(id, user.tenantId, dto);
  }

  @Get(':id/change-requests')
  listChangeRequests(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.fstdService.listChangeRequests(id, user.tenantId);
  }

  @Post('change-requests/:crId/submit')
  submitChangeRequest(@CurrentUser() user: AuthContext, @Param('crId') crId: string) {
    return this.fstdService.submitChangeRequest(crId, user.tenantId);
  }

  @Post('change-requests/:crId/approve')
  approveChangeRequest(@CurrentUser() user: AuthContext, @Param('crId') crId: string) {
    return this.fstdService.approveChangeRequest(crId, user.tenantId);
  }

  @Post('change-requests/:crId/reject')
  rejectChangeRequest(@CurrentUser() user: AuthContext, @Param('crId') crId: string) {
    return this.fstdService.rejectChangeRequest(crId, user.tenantId);
  }
}
