import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CorrectDiscrepancyDto {
  @IsString()
  @IsNotEmpty()
  correctiveAction!: string;

  @IsOptional()
  @IsString()
  correctedById?: string;
}
