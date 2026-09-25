import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateOrganizationDto } from './create-organization.dto.js';

// tenantId 不可通过更新接口变更
export class UpdateOrganizationDto extends PartialType(
  OmitType(CreateOrganizationDto, ['tenantId'] as const),
) {}
