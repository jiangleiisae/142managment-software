import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAuditTaskDto {
  @IsOptional()
  @IsString()
  auditorId?: string;

  @IsString()
  @IsNotEmpty()
  scope!: string;
}
