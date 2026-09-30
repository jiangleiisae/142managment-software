import { FcsCharacteristic, FcsFidelityLevel } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

class EslEntryDto {
  @IsEnum(FcsCharacteristic)
  characteristic!: FcsCharacteristic;

  @IsOptional()
  @IsEnum(FcsFidelityLevel)
  fidelityLevel?: FcsFidelityLevel;

  @IsOptional()
  @IsString()
  equipmentDescription?: string;

  @IsOptional()
  @IsString()
  limitations?: string;
}

export class CreateEslRevisionDto {
  @IsString()
  @IsNotEmpty()
  revisionNumber!: string;

  @IsDateString()
  revisionDate!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EslEntryDto)
  entries!: EslEntryDto[];
}
