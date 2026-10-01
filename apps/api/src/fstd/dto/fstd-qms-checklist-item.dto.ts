import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class FstdQmsChecklistItemDto {
  @IsString()
  item!: string;

  @IsBoolean()
  compliant!: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
