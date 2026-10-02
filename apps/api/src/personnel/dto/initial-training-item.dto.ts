import { IsBoolean, IsString } from 'class-validator';

export class InitialTrainingItemDto {
  @IsString()
  item!: string;

  @IsBoolean()
  completed!: boolean;
}
