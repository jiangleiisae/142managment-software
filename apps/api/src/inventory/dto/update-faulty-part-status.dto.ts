import { FaultyPartStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateFaultyPartStatusDto {
  @IsEnum(FaultyPartStatus)
  status!: FaultyPartStatus;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  resolutionNotes?: string;
}
