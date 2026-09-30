import { IsNotEmpty, IsString } from 'class-validator';

export class LinkPersonnelDto {
  @IsString()
  @IsNotEmpty()
  personnelId!: string;
}
