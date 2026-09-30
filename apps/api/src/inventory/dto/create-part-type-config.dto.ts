import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePartTypeConfigDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  label!: string;
}
