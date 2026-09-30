import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class AddCourseRequirementDto {
  @IsString()
  @IsNotEmpty()
  taskCode!: string;

  @IsString()
  @IsNotEmpty()
  taskName!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minHours?: number;
}
