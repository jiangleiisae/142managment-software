import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class ReportDiscrepancyDto {
  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsBoolean()
  isMmi?: boolean;

  @IsOptional()
  @IsString()
  reportedById?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  severityRating?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  trainingTimeLostMinutes?: number;
}
