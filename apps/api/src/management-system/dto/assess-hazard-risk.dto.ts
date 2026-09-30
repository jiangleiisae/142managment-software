import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AssessHazardRiskDto {
  @IsInt()
  @Min(1)
  @Max(5)
  probabilityLevel!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  severityLevel!: number;

  @IsOptional()
  @IsString()
  existingMitigation?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  residualRiskLevel?: number;
}
