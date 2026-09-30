import { Logger } from '@nestjs/common';
import type { SmsSender } from './sms-sender.interface.js';

/// 默认短信后端: 不实际发送, 只记日志。没配置真实短信服务商(SMS_PROVIDER)时用这个, 保证开发/测试
/// 环境不需要短信账号也能跑通"通知"这条完整链路。
export class LogSmsSender implements SmsSender {
  private readonly logger = new Logger('LogSmsSender');

  async send(phone: string, message: string): Promise<void> {
    this.logger.log(`[模拟短信, 未真实发送] -> ${phone}: ${message}`);
  }
}
