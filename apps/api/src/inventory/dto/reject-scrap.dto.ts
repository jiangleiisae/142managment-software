import { IsOptional, IsString } from 'class-validator';

export class RejectScrapDto {
  @IsOptional()
  @IsString()
  rejectedReason?: string;
}
