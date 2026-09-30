import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateStudentDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsOptional()
  @IsString()
  licenceNo?: string;

  @IsOptional()
  @IsDateString()
  medicalCertExpiry?: string;
}
