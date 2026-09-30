import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateSafetyIndicatorDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  targetValue!: number;

  @IsOptional()
  @IsIn(['LOWER_IS_BETTER', 'HIGHER_IS_BETTER'])
  direction?: 'LOWER_IS_BETTER' | 'HIGHER_IS_BETTER';
}
