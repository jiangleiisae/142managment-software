import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateSparePartDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  compatibleWith?: string;

  @IsOptional()
  @IsString()
  partCategory?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minQuantity?: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsBoolean()
  requiresInspection?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  inspectionIntervalMonths?: number;
}
