import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddQualifiedTaskDto {
  @IsString()
  @IsNotEmpty()
  taskCode!: string;

  @IsString()
  @IsNotEmpty()
  taskName!: string;

  @IsOptional()
  @IsBoolean()
  requiresSpecialAuth?: boolean;
}
