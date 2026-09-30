import type { Prisma } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';

export class SetTrainingProgrammeDto {
  @IsOptional()
  @IsString()
  summary?: string;

  // 训练大纲阶段/标准任务清单为机构自定义结构化数据, 一期不强约束具体字段形状
  @IsOptional()
  stagesJson?: Prisma.InputJsonValue;

  @IsOptional()
  standardTasksJson?: Prisma.InputJsonValue;
}
