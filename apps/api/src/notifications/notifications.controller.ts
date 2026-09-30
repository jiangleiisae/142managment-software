import { Controller, ForbiddenException, Get, Param, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { NotificationService } from './notification.service.js';
import { OccurrenceReportAlertService } from './occurrence-report-alert.service.js';

/// 个人站内通知收件箱, 不声明 @RequirePermissions() - 只要登录就能看自己的通知, 不受模块权限限制。
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly occurrenceReportAlertService: OccurrenceReportAlertService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthContext) {
    return this.notificationService.listForUser(user.userId, user.tenantId);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthContext) {
    return { count: await this.notificationService.countUnread(user.userId, user.tenantId) };
  }

  @Post(':id/read')
  markRead(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.notificationService.markRead(id, user.userId);
  }

  /// 手动立即触发一次"超72小时未上报事件"扫描, 不必等下一次定时任务(默认每小时一次)。
  /// 仅管理账户可用, 与其余"仅OWNER/ADMIN"端点保持同样的校验方式(见 user.service.ts)。
  @Post('check-overdue-occurrence-reports')
  async triggerOverdueOccurrenceReportCheck(@CurrentUser() user: AuthContext) {
    if (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('仅管理账户(OWNER/ADMIN)可手动触发通知扫描');
    }
    const notifiedCount = await this.occurrenceReportAlertService.checkOverdueOccurrenceReports();
    return { notifiedCount };
  }
}
