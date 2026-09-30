import { IsDateString, IsOptional, IsString } from 'class-validator';

export class RecordCalibrationDto {
  @IsDateString()
  calibratedAt!: string;

  @IsOptional()
  @IsString()
  result?: string;

  @IsOptional()
  @IsString()
  performedBy?: string;
}
