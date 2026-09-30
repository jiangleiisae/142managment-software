import { Module } from '@nestjs/common';
import { AliyunSmsSender } from './aliyun-sms.sender.js';
import { LogSmsSender } from './log-sms.sender.js';
import { NotificationService } from './notification.service.js';
import { NotificationsController } from './notifications.controller.js';
import { OccurrenceReportAlertService } from './occurrence-report-alert.service.js';
import { SMS_SENDER } from './sms-sender.interface.js';

/// SMS_PROVIDER=log(默认, 只记日志不真实发送) | aliyun. 见 DEPLOYMENT.md。
function createSmsSender() {
  const provider = process.env.SMS_PROVIDER ?? 'log';
  if (provider === 'aliyun') {
    const required = (name: string) => {
      const value = process.env[name];
      if (!value) throw new Error(`SMS_PROVIDER=aliyun 需要设置环境变量 ${name}`);
      return value;
    };
    return new AliyunSmsSender({
      accessKeyId: required('ALIYUN_ACCESS_KEY_ID'),
      accessKeySecret: required('ALIYUN_ACCESS_KEY_SECRET'),
      signName: required('ALIYUN_SMS_SIGN_NAME'),
      templateCode: required('ALIYUN_SMS_TEMPLATE_CODE'),
      templateParamKey: process.env.ALIYUN_SMS_TEMPLATE_PARAM_KEY ?? 'content',
    });
  }
  return new LogSmsSender();
}

@Module({
  controllers: [NotificationsController],
  providers: [
    { provide: SMS_SENDER, useFactory: createSmsSender },
    NotificationService,
    OccurrenceReportAlertService,
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}
