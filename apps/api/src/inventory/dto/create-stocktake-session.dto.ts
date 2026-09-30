import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateStocktakeSessionDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsOptional()
  @IsString()
  title?: string;
}
