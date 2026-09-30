import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddSrbActionDto {
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
