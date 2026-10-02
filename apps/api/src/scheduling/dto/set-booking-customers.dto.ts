import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsNotEmpty, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';

export class BookingCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color 必须是 #RRGGBB 格式' })
  color!: string;
}

export class SetBookingCustomersDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => BookingCustomerDto)
  customers!: BookingCustomerDto[];
}
