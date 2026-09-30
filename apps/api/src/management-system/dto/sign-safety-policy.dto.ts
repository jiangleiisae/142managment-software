import { IsNotEmpty, IsString } from 'class-validator';

export class SignSafetyPolicyDto {
  @IsString()
  @IsNotEmpty()
  personnelId!: string;
}
