import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class ReportFaultyPartDto {
  @IsString()
  @IsNotEmpty()
  sparePartId!: string;

  @IsOptional()
  @IsString()
  removedFromFstdId?: string;

  @IsOptional()
  @IsString()
  relatedDiscrepancyId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsString()
  @IsNotEmpty()
  faultDescription!: string;
}
