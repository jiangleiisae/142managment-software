import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddTrainingRecordDto {
  @IsDateString()
  sessionDate!: string;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsOptional()
  @IsString()
  progressNotes?: string;

  @IsOptional()
  @IsString()
  testScore?: string;

  @IsOptional()
  @IsString()
  assessedById?: string;

  @IsOptional()
  @IsString()
  courseRequirementId?: string;
}
