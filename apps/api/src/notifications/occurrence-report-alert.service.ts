import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationService } from './notification.service.js';

const MANDATORY_REPORT_DEADLINE_HOURS = 72;

/// 强制事件报告72小时法定时限提醒 (ORA.GEN.160): 定时扫描全部租户, 对尚未上报且已超时限的强制性
/// 事件, 通知该机构的安全经理(SAFETY_MANAGER)。用 Notification(entityType, entityId) 是否已存在
/// 做去重, 保证同一条事件只提醒一次, 不会每次任务运行都重复打扰。
///
/// 这是"推送通知"机制落地的第一个场景, 后续可以用同样的模式(定时扫描 + notify() + 去重检查)接入
/// PM任务到期、ERP演练到期、QTG季度运行到期、资质到期等其余场景。
@Injectable()
export class OccurrenceReportAlertService {
  private readonly logger = new Logger(OccurrenceReportAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async checkOverdueOccurrenceReports() {
    const cutoff = new Date(Date.now() - MANDATORY_REPORT_DEADLINE_HOURS * 60 * 60 * 1000);
    const overdueReports = await this.prisma.occurrenceReport.findMany({
      where: { isMandatory: true, reportedAt: null, discoveredAt: { lte: cutoff } },
      include: { organization: true },
    });

    let notifiedCount = 0;
    for (const report of overdueReports) {
      const existing = await this.notificationService.findExistingNotification('OccurrenceReport', report.id);
      if (existing) continue;

      const safetyManagers = await this.prisma.personnelRoleAssignment.findMany({
        where: { organizationId: report.organizationId, role: 'SAFETY_MANAGER', endDate: null },
        include: { personnel: { include: { user: true } } },
      });

      for (const assignment of safetyManagers) {
        await this.notificationService.notify({
          tenantId: report.organization.tenantId,
          recipientUserId: assignment.personnel.user?.id,
          title: '强制事件报告已超72小时未上报',
          message: `机构「${report.organization.name}」的事件报告 (类型: ${report.occurrenceType}, 发现于 ${report.discoveredAt.toISOString()}) 已超过ORA.GEN.160规定的72小时法定时限仍未上报, 请尽快处理。`,
          entityType: 'OccurrenceReport',
          entityId: report.id,
          smsPhone: assignment.personnel.phone,
        });
        notifiedCount += 1;
      }
    }

    if (notifiedCount > 0) {
      this.logger.log(`本次扫描发出 ${notifiedCount} 条超时事件报告提醒`);
    }
    return notifiedCount;
  }
}
