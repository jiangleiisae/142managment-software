import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReviewPmTaskDto {
  @IsBoolean()
  approve!: boolean;

  @IsString()
  @IsNotEmpty()
  reviewedById!: string;

  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
