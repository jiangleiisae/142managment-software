import { IsNotEmpty, IsString } from 'class-validator';

export class AttachRiskAssessmentToMocDto {
  @IsString()
  @IsNotEmpty()
  riskAssessmentId!: string;
}
