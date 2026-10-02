import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsNumber, IsOptional, Min, ValidateNested } from 'class-validator';
import { InitialTrainingItemDto } from './initial-training-item.dto.js';

export class UpsertInitialTrainingDto {
  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalHours?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InitialTrainingItemDto)
  items?: InitialTrainingItemDto[];

  @IsOptional()
  @IsBoolean()
  writtenExamPassed?: boolean;

  @IsOptional()
  @IsDateString()
  writtenExamDate?: string;
}
