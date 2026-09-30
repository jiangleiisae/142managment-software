export const SMS_SENDER = Symbol('SMS_SENDER');

/// 短信发送后端抽象, 同 ../storage/file-storage.interface.ts 的思路: 上层(NotificationService)
/// 只管调用 send(), 不关心背后是哪个短信服务商。
export interface SmsSender {
  send(phone: string, message: string): Promise<void>;
}
