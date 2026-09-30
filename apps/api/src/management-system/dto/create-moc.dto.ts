import { IsNotEmpty, IsString } from 'class-validator';

export class CreateMocDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  changeDescription!: string;
}
