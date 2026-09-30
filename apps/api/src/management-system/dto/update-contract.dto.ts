import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateContractDto {
  @IsOptional()
  @IsString()
  contractorName?: string;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsString()
  agreementRef?: string;

  @IsOptional()
  @IsBoolean()
  includedInAudit?: boolean;
}
