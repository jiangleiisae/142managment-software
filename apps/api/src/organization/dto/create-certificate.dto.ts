import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

/// 对应 EASA Form 143 模板字段 (需求清单 3.1)
export class CreateCertificateDto {
  @IsString()
  @MinLength(1)
  certificateNo!: string;

  @IsString()
  @MinLength(1)
  issuedAuthority!: string;

  @IsOptional()
  @IsString()
  regulationBasis?: string;

  @IsString()
  @MinLength(1)
  approvalScope!: string;

  @IsDateString()
  issuedAt!: string;
}
