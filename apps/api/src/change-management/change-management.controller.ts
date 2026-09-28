import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { ChangeManagementService } from './change-management.service.js';

/// 通用变更管理接口 (ORA.GEN.130), 供机构(3.1)/FSTD(3.3.6)等模块共用。
/// 不用 @RequirePermissions() 类级声明, 因为同一接口按 entityType 对应不同模块权限 (校验在service内完成)。
@Controller('change-requests')
export class ChangeManagementController {
  constructor(private readonly service: ChangeManagementService) {}

  @Get('types')
  listChangeTypes(@Query('entityType') entityType: string) {
    return this.service.listChangeTypes(entityType);
  }

  @Post()
  create(
    @CurrentUser() user: AuthContext,
    @Body()
    dto: { entityType: string; entityId: string; changeType: string; description?: string; detailsJson?: Record<string, unknown> },
  ) {
    return this.service.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthContext, @Query('entityType') entityType: string, @Query('entityId') entityId: string) {
    return this.service.list(user, entityType, entityId);
  }

  @Post(':id/submit')
  submit(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.service.submit(user, id);
  }

  @Post(':id/notify')
  notify(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.service.notify(user, id);
  }

  @Post(':id/approve')
  approve(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.service.approve(user, id);
  }

  @Post(':id/reject')
  reject(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: { reply?: string }) {
    return this.service.reject(user, id, dto.reply);
  }
}
