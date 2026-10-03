import { ShareType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ShareActionDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsEnum(ShareType)
  type!: ShareType;

  /// 设备级分享: 只显示这台模拟机的训练计划 (只能配 TRAINING_PLAN); 不传表示机构级
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  fstdId?: string;
}
