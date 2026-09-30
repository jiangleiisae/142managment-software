import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddMitigationActionDto {
  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsString()
  responsiblePersonnelId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
