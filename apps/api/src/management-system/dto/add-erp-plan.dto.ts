import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class AddErpPlanDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  version!: string;

  @IsString()
  @IsNotEmpty()
  planText!: string;

  @IsDateString()
  effectiveDate!: string;
}
