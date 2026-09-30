import { PartMovementType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class RecordMovementDto {
  @IsEnum(PartMovementType)
  type!: PartMovementType;

  @IsInt()
  quantity!: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  relatedDiscrepancyId?: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  usageLocation?: string;
}
