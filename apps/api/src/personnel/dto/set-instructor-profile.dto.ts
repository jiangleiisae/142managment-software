import { InstructorType } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class SetInstructorProfileDto {
  @IsEnum(InstructorType)
  instructorType!: InstructorType;
}
