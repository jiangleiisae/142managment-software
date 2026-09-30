import * as Dysmsapi from '@alicloud/dysmsapi20170525';
import * as OpenApi from '@alicloud/openapi-client';
import * as Util from '@alicloud/tea-util';
import { Logger } from '@nestjs/common';
import type { SmsSender } from './sms-sender.interface.js';

// nodenext 对这个包的默认导出(`exports.default = Client`)解析有已知的类型推断问题(会把默认导出
// 误判成整个命名空间, 导致既不能当类型用也不能 new), 改为从命名空间导入后手动取 .default 绕开。
const DysmsapiClient = (Dysmsapi as unknown as { default: new (config: OpenApi.Config) => DysmsapiClientInstance }).default;
interface DysmsapiClientInstance {
  sendSmsWithOptions(
    request: Dysmsapi.SendSmsRequest,
    runtime: Util.RuntimeOptions,
  ): Promise<{ body?: { code?: string; message?: string; bizId?: string } }>;
}

export interface AliyunSmsConfig {
  accessKeyId: string;
  accessKeySecret: string;
  signName: string;
  templateCode: string;
  /// 短信模板里承载消息正文的变量名, 如模板是 "您有一条新提醒: ${content}", 这里就是 "content"。
  /// 阿里云短信要求模板须提前报备审核, 具体变量名由审核通过的模板决定, 因此做成可配置。
  templateParamKey: string;
}

/// 阿里云短信服务 (SMS_PROVIDER=aliyun)。用官方 SDK 而非手写签名算法, 减少协议层出错的可能。
/// 注意: 这里只能对照官方文档实现, 没有真实的阿里云账号/已报备模板可供联调, 未做过真实发送验证 -
/// 上线前务必用真实账号跑一次 send() 确认签名/模板参数无误。
export class AliyunSmsSender implements SmsSender {
  private readonly logger = new Logger('AliyunSmsSender');
  private readonly client: DysmsapiClientInstance;

  constructor(private readonly config: AliyunSmsConfig) {
    const openApiConfig = new OpenApi.Config({
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      endpoint: 'dysmsapi.aliyuncs.com',
    });
    this.client = new DysmsapiClient(openApiConfig);
  }

  async send(phone: string, message: string): Promise<void> {
    const request = new Dysmsapi.SendSmsRequest({
      phoneNumbers: phone,
      signName: this.config.signName,
      templateCode: this.config.templateCode,
      templateParam: JSON.stringify({ [this.config.templateParamKey]: message }),
    });
    const response = await this.client.sendSmsWithOptions(request, new Util.RuntimeOptions({}));
    if (response.body?.code !== 'OK') {
      throw new Error(`阿里云短信发送失败: ${response.body?.code} ${response.body?.message}`);
    }
    this.logger.log(`短信已发送至 ${phone}, bizId=${response.body?.bizId}`);
  }
}
