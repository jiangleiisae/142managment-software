import { PmCheckLevel } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { PmChecklistItemDto } from './pm-checklist-item.dto.js';

export class SetPmChecklistTemplateDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsEnum(PmCheckLevel)
  level!: PmCheckLevel;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PmChecklistItemDto)
  itemsJson!: PmChecklistItemDto[];
}
