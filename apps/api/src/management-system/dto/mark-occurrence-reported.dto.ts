import { IsNotEmpty, IsString } from 'class-validator';

export class MarkOccurrenceReportedDto {
  @IsString()
  @IsNotEmpty()
  reportedTo!: string;
}
