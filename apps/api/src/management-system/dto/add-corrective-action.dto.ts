import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddCorrectiveActionDto {
  @IsString()
  @IsNotEmpty()
  planDescription!: string;

  @IsOptional()
  @IsString()
  responsiblePersonnelId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
