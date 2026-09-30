import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class RecordRecurrentEvaluationDto {
  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  @IsString()
  evaluationType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  extensionMonths?: number;

  @IsOptional()
  @IsString()
  result?: string;
}
