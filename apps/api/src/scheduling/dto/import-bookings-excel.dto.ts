import { IsNotEmpty, IsString } from 'class-validator';

export class ImportBookingsExcelDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;
}
