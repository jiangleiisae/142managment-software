import { FcsCharacteristic, FcsFidelityLevel } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class AddTrainingMatrixEntryDto {
  @IsString()
  @IsNotEmpty()
  taskCode!: string;

  @IsString()
  @IsNotEmpty()
  taskName!: string;

  @IsEnum(FcsCharacteristic)
  characteristic!: FcsCharacteristic;

  @IsEnum(FcsFidelityLevel)
  thresholdT!: FcsFidelityLevel;

  @IsEnum(FcsFidelityLevel)
  thresholdTP!: FcsFidelityLevel;
}
