import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RecordErpDrillDto {
  @IsDateString()
  drilledAt!: string;

  @IsString()
  @IsNotEmpty()
  scenario!: string;

  @IsOptional()
  @IsString()
  outcome?: string;
}
