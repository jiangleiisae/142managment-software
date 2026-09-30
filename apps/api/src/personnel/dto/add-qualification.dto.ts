import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddQualificationDto {
  @IsString()
  @IsNotEmpty()
  qualificationType!: string;

  @IsOptional()
  @IsString()
  certificateNo?: string;

  @IsOptional()
  @IsString()
  issuingAuthority?: string;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
