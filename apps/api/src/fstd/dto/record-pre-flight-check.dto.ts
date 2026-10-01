import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

class PreFlightCheckItemDto {
  @IsString()
  @IsNotEmpty()
  item!: string;

  @IsBoolean()
  passed!: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordPreFlightCheckDto {
  @IsDateString()
  checkDate!: string;

  @IsOptional()
  @IsString()
  performedById?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PreFlightCheckItemDto)
  items!: PreFlightCheckItemDto[];
}
