import { ManagementRoleType } from '@prisma/client';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AssignRoleDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  personnelId!: string;

  @IsEnum(ManagementRoleType)
  role!: ManagementRoleType;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsString()
  appointmentRef?: string;
}
