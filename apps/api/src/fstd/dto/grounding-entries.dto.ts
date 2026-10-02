import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';

export class GroundingEntryDto {
  @IsString()
  @IsNotEmpty()
  fstdId!: string;

  /// 北京时间的日历日, YYYY-MM-DD
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date 必须是 YYYY-MM-DD 格式' })
  date!: string;
}

export class GroundingEntriesDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => GroundingEntryDto)
  entries!: GroundingEntryDto[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
