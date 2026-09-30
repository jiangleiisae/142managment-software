import { IsOptional, IsString } from 'class-validator';

export class RejectChangeRequestDto {
  @IsOptional()
  @IsString()
  reply?: string;
}
