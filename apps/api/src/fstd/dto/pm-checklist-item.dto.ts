import { IsNotEmpty, IsString } from 'class-validator';

export class PmChecklistItemDto {
  @IsString()
  @IsNotEmpty()
  item!: string;
}
