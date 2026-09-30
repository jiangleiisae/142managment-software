import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class RecordQuarterlyQtgRunDto {
  @IsInt()
  year!: number;

  @IsInt()
  @Min(1)
  @Max(4)
  quarter!: number;

  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @IsOptional()
  @IsString()
  result?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
