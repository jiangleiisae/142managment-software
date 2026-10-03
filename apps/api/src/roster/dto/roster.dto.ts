import { ShiftCategory, StaffDepartment } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateShiftTypeDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  /// 不传默认维护部门
  @IsOptional()
  @IsEnum(StaffDepartment)
  department?: StaffDepartment;

  @Matches(/^[A-Za-z0-9]{1,8}$/, { message: 'code 只能是 1-8 位字母或数字' })
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @IsEnum(ShiftCategory)
  category!: ShiftCategory;

  @IsOptional()
  @Matches(HHMM, { message: 'startTime 必须是 HH:mm' })
  startTime?: string;

  @IsOptional()
  @Matches(HHMM, { message: 'endTime 必须是 HH:mm' })
  endTime?: string;

  @IsOptional()
  @IsBoolean()
  endsNextDay?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(720)
  restMinutes?: number;

  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color 必须是 #RRGGBB 格式' })
  color!: string;

  @IsOptional()
  @IsBoolean()
  generatesMaintenanceTasks?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;
}

/// 班次代码和所属部门创建后不可改 (班表、统计、导出都按代码展示), 其余字段可改; 停用而不是删除
export class UpdateShiftTypeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsEnum(ShiftCategory)
  category?: ShiftCategory;

  @IsOptional()
  @Matches(HHMM, { message: 'startTime 必须是 HH:mm' })
  startTime?: string;

  @IsOptional()
  @Matches(HHMM, { message: 'endTime 必须是 HH:mm' })
  endTime?: string;

  @IsOptional()
  @IsBoolean()
  endsNextDay?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(720)
  restMinutes?: number;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color 必须是 #RRGGBB 格式' })
  color?: string;

  @IsOptional()
  @IsBoolean()
  generatesMaintenanceTasks?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateRosterGroupDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsOptional()
  @IsEnum(StaffDepartment)
  department?: StaffDepartment;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;
}

export class UpdateRosterGroupDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;
}

/// 排班人员 (维护人员 / 行政综合人员)
export class CreateStaffDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsEnum(StaffDepartment)
  department!: StaffDepartment;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  /// 关联登录账号 (用于"我的排班")
  @IsOptional()
  @IsString()
  userId?: string;
}

/// 部门创建后不可改; groupId/userId 传 null 表示取消分组/取消关联账号
export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  groupId?: string | null;

  @IsOptional()
  @IsString()
  userId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class RosterCellDto {
  @IsString()
  @IsNotEmpty()
  staffId!: string;

  /// 北京时间日历日 YYYY-MM-DD
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date 必须是 YYYY-MM-DD 格式' })
  date!: string;
}

export class SetRosterEntriesDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => RosterCellDto)
  cells!: RosterCellDto[];

  /// 不传或 null 表示清除这些格子的班次; 班次必须和这些人员属于同一个部门
  @IsOptional()
  @IsString()
  shiftTypeId?: string | null;
}
