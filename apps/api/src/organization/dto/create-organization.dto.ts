import { IsBoolean, IsOptional, IsString, IsEnum, MinLength } from 'class-validator';
import { OrganizationType, RegulatoryStandard } from '@prisma/client';

export class CreateOrganizationDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsEnum(OrganizationType)
  type?: OrganizationType;

  @IsOptional()
  @IsEnum(RegulatoryStandard)
  regulatoryStandard?: RegulatoryStandard;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  competentAuthority?: string;

  // AMC1 ORA.GEN.200(b) 复杂机构判定, 见需求清单 3.1
  @IsOptional()
  @IsBoolean()
  isComplexOrg?: boolean;

  @IsOptional()
  @IsString()
  complexOrgReason?: string;
}
