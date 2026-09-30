import { IsNotEmpty, IsString } from 'class-validator';

export class UpdatePartTypeConfigLabelDto {
  @IsString()
  @IsNotEmpty()
  label!: string;
}
