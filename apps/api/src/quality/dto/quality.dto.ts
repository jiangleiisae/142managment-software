import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// ---- 会议记录 ----

export class MeetingTaskDto {
  @IsIn(['DAILY', 'MAJOR', 'QTG', 'OTHER'])
  category!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  content!: string;
}

export class SaveMeetingDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject!: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsIn(['ONSITE', 'ONLINE', 'HYBRID'])
  method?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  hostPersonnelId?: string;

  @IsOptional()
  @IsString()
  recorderPersonnelId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  attendeeIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  topics?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  lastWeekReport?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => MeetingTaskDto)
  thisWeekTasks?: MeetingTaskDto[];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  faultAnalysis?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  suggestions?: string;
}

/// 修改时不再允许换机构
export class UpdateMeetingDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsIn(['ONSITE', 'ONLINE', 'HYBRID'])
  method?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  hostPersonnelId?: string;

  @IsOptional()
  @IsString()
  recorderPersonnelId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  attendeeIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  topics?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  lastWeekReport?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => MeetingTaskDto)
  thisWeekTasks?: MeetingTaskDto[];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  faultAnalysis?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  suggestions?: string;
}

// ---- 培训管理 ----

export class SaveTrainingDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject!: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  trainerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @IsString({ each: true })
  attendeeIds?: string[];
}

export class UpdateTrainingDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  trainerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @IsString({ each: true })
  attendeeIds?: string[];
}

// ---- 其他检查 ----

export class SetInspectionItemsDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  /// 整体替换: 列表里没有的已有检查项会被停用(历史记录保留快照), 同名的保持启用并按此顺序排序
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  names!: string[];
}

export class InspectionResultDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsBoolean()
  passed!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateInspectionDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @Matches(DAY, { message: 'inspectedOn 必须是 YYYY-MM-DD 格式' })
  inspectedOn!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  performedByPersonnelId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => InspectionResultDto)
  results!: InspectionResultDto[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

// ---- 问卷 ----

export class SurveyQuestionDto {
  @IsIn(['SINGLE', 'MULTI', 'RATING', 'TEXT'])
  type!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  text!: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  options?: string[];
}

export class SaveSurveyDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  anonymous?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SurveyQuestionDto)
  questions!: SurveyQuestionDto[];
}

export class UpdateSurveyDto {
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
  @IsBoolean()
  anonymous?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SurveyQuestionDto)
  questions?: SurveyQuestionDto[];
}

export class RespondSurveyDto {
  /// { [questionId]: string | string[] | number }
  @IsObject()
  answers!: Record<string, unknown>;
}

