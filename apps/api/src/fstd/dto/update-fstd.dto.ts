import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateFstdDto {
  @IsOptional()
  @IsBoolean()
  isLargeAircraftPublicTransport?: boolean;
}
