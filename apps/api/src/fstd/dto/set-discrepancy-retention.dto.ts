import { RetentionCategory } from '@prisma/client';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SetDiscrepancyRetentionDto {
  @IsEnum(RetentionCategory)
  category!: RetentionCategory;

  @IsString()
  @IsNotEmpty()
  justification!: string;

  @IsString()
  @IsNotEmpty()
  approvedById!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
