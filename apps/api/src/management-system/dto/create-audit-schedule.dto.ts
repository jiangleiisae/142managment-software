import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAuditScheduleDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsDateString()
  plannedAt!: string;

  @IsOptional()
  @IsString()
  scopeTag?: string;
}
