import { IsInt, Min } from 'class-validator';

export class RecordStocktakeCountDto {
  @IsInt()
  @Min(0)
  countedQuantity!: number;
}
