import { IsInt, IsNumber, Max, Min } from 'class-validator';

export class RecordPerformanceMetricDto {
  @IsInt()
  year!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsNumber()
  plannedAvailableHours!: number;

  @IsNumber()
  scheduledTrainingHours!: number;

  @IsNumber()
  supportHours!: number;

  @IsNumber()
  fstdFailureHours!: number;

  @IsNumber()
  externalFailureHours!: number;

  @IsNumber()
  lostTrainingHours!: number;

  @IsInt()
  discrepancyCount!: number;

  @IsInt()
  interruptionCount!: number;
}
