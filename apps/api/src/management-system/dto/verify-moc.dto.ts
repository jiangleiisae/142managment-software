import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyMocDto {
  @IsString()
  @IsNotEmpty()
  verificationNotes!: string;
}
