import { IsDateString, IsOptional, IsString } from 'class-validator';

export class RecordPartInspectionDto {
  @IsDateString()
  inspectedAt!: string;

  @IsOptional()
  @IsString()
  result?: string;

  @IsOptional()
  @IsString()
  inspectorId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
