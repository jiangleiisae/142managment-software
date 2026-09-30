import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class RequestScrapDto {
  @IsString()
  @IsNotEmpty()
  sparePartId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  reasonCode!: string;

  @IsOptional()
  @IsString()
  requestedById?: string;
}
