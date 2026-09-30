import { InfoAssetCriticality } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateInfoAssetDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsOptional()
  @IsEnum(InfoAssetCriticality)
  criticality?: InfoAssetCriticality;

  @IsOptional()
  @IsString()
  ownerPersonnelId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
