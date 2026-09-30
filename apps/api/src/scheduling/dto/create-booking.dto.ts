import { BookingResourceType } from '@prisma/client';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsEnum(BookingResourceType)
  resourceType!: BookingResourceType;

  @IsString()
  @IsNotEmpty()
  resourceId!: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  taskCode?: string;
}
