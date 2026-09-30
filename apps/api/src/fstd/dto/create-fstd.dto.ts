import { FstdDeviceType, FstdQualificationBasisType, LegacyLevel } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateFstdDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  deviceCode!: string;

  @IsString()
  @IsNotEmpty()
  representedAircraft!: string;

  @IsEnum(FstdDeviceType)
  deviceType!: FstdDeviceType;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsEnum(LegacyLevel)
  legacyLevel?: LegacyLevel;

  @IsOptional()
  @IsEnum(FstdQualificationBasisType)
  qualificationBasisType?: FstdQualificationBasisType;
}
