import { DutyEntryKind } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class CreateDutyLogDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  /// 北京时间日历日 YYYY-MM-DD
  @Matches(DAY, { message: 'date 必须是 YYYY-MM-DD 格式' })
  date!: string;

  @IsString()
  @IsNotEmpty()
  shiftTypeId!: string;

  @IsOptional()
  @IsString()
  groupId?: string;
}

export class UpdateDutyLogDto {
  /// 值班工程师 Personnel.id, 整体替换
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  engineerIds?: string[];
}

export class CreateDutyEntryDto {
  @IsEnum(DutyEntryKind)
  kind!: DutyEntryKind;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;

  @IsOptional()
  @IsString()
  fstdId?: string;
}

export class UpdateDutyEntryDto {
  @IsOptional()
  @IsEnum(DutyEntryKind)
  kind?: DutyEntryKind;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content?: string;

  /// 传空字符串表示取消关联设备
  @IsOptional()
  @IsString()
  fstdId?: string;
}

export class CreateDutyHandoverDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;

  @IsOptional()
  @IsString()
  fstdId?: string;

  /// 不传则默认转给下一个工作班次; 指定时必须同时给出 toDate 和 toShiftTypeId
  @IsOptional()
  @Matches(DAY, { message: 'toDate 必须是 YYYY-MM-DD 格式' })
  toDate?: string;

  @IsOptional()
  @IsString()
  toShiftTypeId?: string;
}

export class UpdateDutyHandoverDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content?: string;

  @IsOptional()
  @IsString()
  fstdId?: string;

  @IsOptional()
  @Matches(DAY, { message: 'toDate 必须是 YYYY-MM-DD 格式' })
  toDate?: string;

  @IsOptional()
  @IsString()
  toShiftTypeId?: string;
}

export class CompleteDutyHandoverDto {
  /// 在哪份值班日志里处理的 (可选, 仅用于追溯)
  @IsOptional()
  @IsString()
  completedInLogId?: string;
}
