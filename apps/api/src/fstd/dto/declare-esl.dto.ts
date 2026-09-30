import { IsNotEmpty, IsString } from 'class-validator';

export class DeclareEslDto {
  @IsString()
  @IsNotEmpty()
  personnelId!: string;
}
