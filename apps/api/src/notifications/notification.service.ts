import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditLogService } from '../audit-log/audit-log.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SMS_SENDER, type SmsSender } from './sms-sender.interface.js';

export interface NotifyInput {
  tenantId: string;
  /// 站内通知的接收账户; 为空则只发短信不建站内通知(比如该人员没有登录账户)。
  recipientUserId?: string | null;
  title: string;
  message: string;
  /// 关联实体, 用于调用方自行判断"是否已经通知过", 见 findExistingNotification()。
  entityType?: string;
  entityId?: string;
  smsPhone?: string | null;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    @Inject(SMS_SENDER) private readonly smsSender: SmsSender,
  ) {}

  /// 调用方在生成一条新通知前, 用这个检查是否已经为同一个实体发过通知, 避免定时任务每次运行都重复提醒。
  async findExistingNotification(entityType: string, entityId: string) {
    return this.prisma.notification.findFirst({ where: { entityType, entityId } });
  }

  async notify(input: NotifyInput) {
    let notification = null;
    if (input.recipientUserId) {
      notification = await this.prisma.notification.create({
        data: {
          tenantId: input.tenantId,
          recipientUserId: input.recipientUserId,
          title: input.title,
          message: input.message,
          entityType: input.entityType,
          entityId: input.entityId,
        },
      });
    }

    if (input.smsPhone) {
      try {
        await this.smsSender.send(input.smsPhone, `${input.title}: ${input.message}`);
        await this.auditLog.write(input.tenantId, 'Notification', notification?.id ?? input.entityId ?? 'n/a', 'sms_sent', null, {
          phone: input.smsPhone,
        });
      } catch (err) {
        this.logger.error(`短信发送失败: ${(err as Error).message}`);
        await this.auditLog.write(input.tenantId, 'Notification', notification?.id ?? input.entityId ?? 'n/a', 'sms_failed', null, {
          phone: input.smsPhone,
          error: (err as Error).message,
        });
      }
    }

    return notification;
  }

  async listForUser(userId: string, tenantId: string) {
    return this.prisma.notification.findMany({
      where: { recipientUserId: userId, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async countUnread(userId: string, tenantId: string) {
    return this.prisma.notification.count({ where: { recipientUserId: userId, tenantId, readAt: null } });
  }

  async markRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.recipientUserId !== userId) {
      throw new NotFoundException(`Notification ${id} not found`);
    }
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }
}
