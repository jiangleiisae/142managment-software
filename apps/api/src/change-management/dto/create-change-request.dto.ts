import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateChangeRequestDto {
  @IsString()
  @IsNotEmpty()
  entityType!: string;

  @IsString()
  @IsNotEmpty()
  entityId!: string;

  @IsString()
  @IsNotEmpty()
  changeType!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  detailsJson?: Record<string, unknown>;
}
