import { IsDateString, IsNumber } from 'class-validator';

export class RecordSafetyMeasurementDto {
  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsNumber()
  value!: number;
}
