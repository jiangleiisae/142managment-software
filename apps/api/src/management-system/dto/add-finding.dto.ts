import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class AddFindingDto {
  @IsInt()
  @Min(1)
  level!: number;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsString()
  rootCause?: string;
}
