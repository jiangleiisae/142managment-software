import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateLoanDto {
  @IsString()
  @IsNotEmpty()
  sparePartId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  borrowerInfo!: string;

  @IsOptional()
  @IsString()
  purposeNote?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
