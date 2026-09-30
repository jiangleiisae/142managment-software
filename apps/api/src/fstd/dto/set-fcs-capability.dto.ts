import { FcsCharacteristic, FcsFidelityLevel } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class SetFcsCapabilityDto {
  @IsEnum(FcsCharacteristic)
  characteristic!: FcsCharacteristic;

  @IsEnum(FcsFidelityLevel)
  fidelityLevel!: FcsFidelityLevel;

  @IsOptional()
  @IsString()
  subsystem?: string;

  @IsOptional()
  @IsBoolean()
  isAssigned?: boolean;
}
