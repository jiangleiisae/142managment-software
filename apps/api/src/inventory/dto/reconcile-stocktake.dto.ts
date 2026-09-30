import { IsOptional, IsString } from 'class-validator';

export class ReconcileStocktakeDto {
  @IsOptional()
  @IsString()
  reconciledById?: string;
}
