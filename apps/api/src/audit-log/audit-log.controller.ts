import { Controller, ForbiddenException, Get, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { AuditLogService } from './audit-log.service.js';

/// 全系统审计轨迹查询 (ORA.GEN.220): 跨模块合规看板, 不声明 @RequirePermissions() ——
/// 能否查看由角色(OWNER/ADMIN)决定而非某个具体业务模块权限, 镜像 UserController 的做法。
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  private assertIsAdmin(actor: AuthContext) {
    if (actor.role !== UserRole.OWNER && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('仅管理账户(OWNER/ADMIN)可查看审计轨迹');
    }
  }

  @Get()
  list(@CurrentUser() user: AuthContext, @Query('entityType') entityType?: string, @Query('entityId') entityId?: string) {
    this.assertIsAdmin(user);
    return this.auditLogService.list(user.tenantId, entityType, entityId);
  }

  @Get('entity-types')
  listEntityTypes(@CurrentUser() user: AuthContext) {
    this.assertIsAdmin(user);
    return this.auditLogService.listEntityTypes(user.tenantId);
  }
}
