import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReportOccurrenceDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsDateString()
  discoveredAt!: string;

  @IsString()
  @IsNotEmpty()
  occurrenceType!: string;

  @IsOptional()
  @IsString()
  involvedPersonnel?: string;

  @IsOptional()
  @IsString()
  involvedAircraft?: string;

  @IsOptional()
  @IsString()
  involvedFstdId?: string;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;
}
