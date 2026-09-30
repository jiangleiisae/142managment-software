import { IsNotEmpty, IsString } from 'class-validator';

export class EnrollStudentDto {
  @IsString()
  @IsNotEmpty()
  courseId!: string;
}
