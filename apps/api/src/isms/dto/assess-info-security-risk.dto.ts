import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AssessInfoSecurityRiskDto {
  @IsInt()
  @Min(1)
  @Max(5)
  likelihoodLevel!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  impactLevel!: number;

  @IsOptional()
  @IsString()
  existingControls?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  residualRiskLevel?: number;
}
