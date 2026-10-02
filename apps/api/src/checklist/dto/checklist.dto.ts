import { ChecklistType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class ChecklistItemDto {
  /// 检查项编号, 如 1 / 1.1 / 2.3, 同一套模板内唯一
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  no!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  text!: string;

  /// SOP 链接 (http/https)
  @IsOptional()
  @Matches(/^https?:\/\/\S+$/, { message: 'sopUrl 必须是 http(s) 链接' })
  @MaxLength(500)
  sopUrl?: string;
}

export class SetChecklistTemplateDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  fstdId!: string;

  @IsEnum(ChecklistType)
  type!: ChecklistType;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  items!: ChecklistItemDto[];
}

export class CloneChecklistTemplatesDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  fromFstdId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  toFstdIds!: string[];

  /// 不传则两种类型都克隆
  @IsOptional()
  @IsArray()
  @IsEnum(ChecklistType, { each: true })
  types?: ChecklistType[];

  /// 目标设备已有同类型模板时是否覆盖; 默认不覆盖(跳过)
  @IsOptional()
  @IsBoolean()
  overwrite?: boolean;
}

export class ChecklistResultDto {
  @IsString()
  @IsNotEmpty()
  no!: string;

  @IsBoolean()
  passed!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateChecklistRecordDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  fstdId!: string;

  @IsEnum(ChecklistType)
  type!: ChecklistType;

  /// 北京时间日历日
  @Matches(DAY, { message: 'date 必须是 YYYY-MM-DD 格式' })
  date!: string;

  @IsString()
  @IsNotEmpty()
  shiftTypeId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ChecklistResultDto)
  results!: ChecklistResultDto[];

  @IsOptional()
  @IsString()
  performedByPersonnelId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
