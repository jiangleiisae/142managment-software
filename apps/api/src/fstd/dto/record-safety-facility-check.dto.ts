import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

class SafetyCheckItemDto {
  @IsString()
  @IsNotEmpty()
  item!: string;

  @IsBoolean()
  passed!: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordSafetyFacilityCheckDto {
  @IsDateString()
  checkedAt!: string;

  @IsOptional()
  @IsString()
  checkedById?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SafetyCheckItemDto)
  items!: SafetyCheckItemDto[];
}
