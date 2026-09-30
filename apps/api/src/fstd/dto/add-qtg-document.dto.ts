import { QtgDocumentType } from '@prisma/client';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddQtgDocumentDto {
  @IsEnum(QtgDocumentType)
  documentType!: QtgDocumentType;

  @IsString()
  @IsNotEmpty()
  version!: string;

  @IsDateString()
  effectiveDate!: string;

  @IsOptional()
  @IsString()
  pointerUrl?: string;
}
