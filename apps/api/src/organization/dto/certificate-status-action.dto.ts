import { IsOptional, IsString } from 'class-validator';

/// 供 suspend / revoke / terminate / restore 四个状态迁移动作复用 (需求清单 3.1 证书状态机)
export class CertificateStatusActionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
