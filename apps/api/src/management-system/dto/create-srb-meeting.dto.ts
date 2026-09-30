import { ArrayMinSize, IsArray, IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSrbMeetingDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsDateString()
  meetingDate!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  attendeeRoles!: string[];

  @IsString()
  @IsNotEmpty()
  agenda!: string;

  @IsOptional()
  @IsString()
  decisions?: string;
}
