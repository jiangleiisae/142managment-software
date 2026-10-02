import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ChecklistType, Permission } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { ChecklistService } from './checklist.service.js';
import { CloneChecklistTemplatesDto, CreateChecklistRecordDto, SetChecklistTemplateDto } from './dto/checklist.dto.js';

/// 设备级检查单 (R4b): 模板配置、今天应做清单、执行记录。权限沿用 FSTD (设备运行维护模块)。
@Controller('checklists')
@RequirePermissions(Permission.FSTD)
export class ChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Get('templates')
  listTemplates(@Query('organizationId') organizationId: string, @Query('fstdId') fstdId?: string) {
    return this.checklistService.listTemplates(organizationId, fstdId);
  }

  @Put('templates')
  setTemplate(@CurrentUser() user: AuthContext, @Body() dto: SetChecklistTemplateDto) {
    return this.checklistService.setTemplate(user.tenantId, dto);
  }

  @Post('templates/clone')
  cloneTemplates(@CurrentUser() user: AuthContext, @Body() dto: CloneChecklistTemplatesDto) {
    return this.checklistService.cloneTemplates(user.tenantId, dto);
  }

  @Get('expected')
  expected(@CurrentUser() user: AuthContext, @Query('organizationId') organizationId: string, @Query('date') date: string, @Query('type') type?: ChecklistType) {
    return this.checklistService.expected(user.tenantId, organizationId, date, type);
  }

  @Post('records')
  createRecord(@CurrentUser() user: AuthContext, @Body() dto: CreateChecklistRecordDto) {
    return this.checklistService.createRecord(user.tenantId, user.email, dto);
  }

  @Get('records')
  listRecords(
    @CurrentUser() user: AuthContext,
    @Query('organizationId') organizationId: string,
    @Query('type') type?: string,
    @Query('fstdId') fstdId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.checklistService.listRecords(user.tenantId, organizationId, { type, fstdId, from, to });
  }

  @Get('records/:id')
  getRecord(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.checklistService.getRecord(user.tenantId, id);
  }
}
