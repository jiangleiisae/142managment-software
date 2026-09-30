import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReportHazardDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  source!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsString()
  affectedArea?: string;
}
