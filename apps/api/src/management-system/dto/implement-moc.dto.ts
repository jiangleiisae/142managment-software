import { IsNotEmpty, IsString } from 'class-validator';

export class ImplementMocDto {
  @IsString()
  @IsNotEmpty()
  implementationPlan!: string;
}
