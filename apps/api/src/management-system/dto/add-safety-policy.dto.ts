import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class AddSafetyPolicyDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  version!: string;

  @IsString()
  @IsNotEmpty()
  policyText!: string;

  @IsDateString()
  effectiveDate!: string;
}
