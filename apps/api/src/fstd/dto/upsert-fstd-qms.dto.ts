import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { FstdQmsChecklistItemDto } from './fstd-qms-checklist-item.dto.js';

export class UpsertFstdQmsDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsOptional()
  @IsDateString()
  establishedAt?: string;

  @IsOptional()
  @IsString()
  designatedManagerName?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FstdQmsChecklistItemDto)
  items?: FstdQmsChecklistItemDto[];

  @IsOptional()
  @IsDateString()
  lastInternalAuditAt?: string;
}
