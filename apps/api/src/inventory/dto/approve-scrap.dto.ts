import { IsNotEmpty, IsString } from 'class-validator';

export class ApproveScrapDto {
  @IsString()
  @IsNotEmpty()
  approvedById!: string;
}
