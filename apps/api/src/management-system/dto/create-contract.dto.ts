import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateContractDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  contractorName!: string;

  @IsString()
  @IsNotEmpty()
  scope!: string;

  @IsOptional()
  @IsString()
  agreementRef?: string;

  @IsOptional()
  @IsBoolean()
  includedInAudit?: boolean;
}
