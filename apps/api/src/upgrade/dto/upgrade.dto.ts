import { UpgradeCategory } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MMDD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export class CreateUpgradeRecordDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  fstdId!: string;

  @IsEnum(UpgradeCategory)
  category!: UpgradeCategory;

  @Matches(DAY, { message: 'performedOn 必须是 YYYY-MM-DD 格式' })
  performedOn!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  subsystem?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  versionFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  versionTo?: string;

  @IsOptional()
  @IsString()
  performedByPersonnelId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  performedByName?: string;

  @IsOptional()
  @IsIn(['pass', 'fail'])
  result?: string;

  @IsOptional()
  @Matches(DAY, { message: 'nextDueDate 必须是 YYYY-MM-DD 格式' })
  nextDueDate?: string;

  @IsOptional()
  @IsBoolean()
  isModification?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  caacReportRef?: string;

  @IsOptional()
  @Matches(DAY, { message: 'caacReportedOn 必须是 YYYY-MM-DD 格式' })
  caacReportedOn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

/// 修正已登记的记录; 设备和类别创建后不可改
export class UpdateUpgradeRecordDto {
  @IsOptional()
  @Matches(DAY, { message: 'performedOn 必须是 YYYY-MM-DD 格式' })
  performedOn?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  subsystem?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  versionFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  versionTo?: string;

  @IsOptional()
  @IsString()
  performedByPersonnelId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  performedByName?: string;

  @IsOptional()
  @IsIn(['pass', 'fail'])
  result?: string;

  @IsOptional()
  @Matches(DAY, { message: 'nextDueDate 必须是 YYYY-MM-DD 格式' })
  nextDueDate?: string;

  @IsOptional()
  @IsBoolean()
  isModification?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  caacReportRef?: string;

  @IsOptional()
  @Matches(DAY, { message: 'caacReportedOn 必须是 YYYY-MM-DD 格式' })
  caacReportedOn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class SetQtgPlanDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  fstdId!: string;

  @IsInt()
  @Min(1)
  @Max(4)
  quarter!: number;

  /// 每年重复的计划执行时段, MM-DD
  @Matches(MMDD, { message: 'windowStart 必须是 MM-DD 格式' })
  windowStart!: string;

  @Matches(MMDD, { message: 'windowEnd 必须是 MM-DD 格式' })
  windowEnd!: string;

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  responsibleIds!: string[];
}
