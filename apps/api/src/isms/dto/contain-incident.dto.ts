import { IsNotEmpty, IsString } from 'class-validator';

export class ContainIncidentDto {
  @IsString()
  @IsNotEmpty()
  responseActions!: string;
}
