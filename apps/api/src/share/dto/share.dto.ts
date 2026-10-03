import { ShareType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class ShareActionDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsEnum(ShareType)
  type!: ShareType;
}
