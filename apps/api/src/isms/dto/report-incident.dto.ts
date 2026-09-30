import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class ReportIncidentDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsDateString()
  discoveredAt!: string;

  @IsString()
  @IsNotEmpty()
  incidentType!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsString()
  affectedAssetId?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  severity!: number;
}
