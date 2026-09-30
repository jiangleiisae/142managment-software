import { PmCheckLevel } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

class PmTaskItemResultDto {
  @IsString()
  @IsNotEmpty()
  item!: string;

  @IsBoolean()
  passed!: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePmTaskDto {
  @IsEnum(PmCheckLevel)
  level!: PmCheckLevel;

  @IsDateString()
  taskDate!: string;

  @IsOptional()
  @IsString()
  performedById?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  responsibleIds?: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PmTaskItemResultDto)
  itemResultsJson!: PmTaskItemResultDto[];
}
