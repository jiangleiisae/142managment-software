import { IsNotEmpty, IsString } from 'class-validator';

export class ConvertDemandToPurchaseOrderDto {
  @IsString()
  @IsNotEmpty()
  supplierId!: string;
}
