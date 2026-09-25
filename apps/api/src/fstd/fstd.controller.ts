import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { FstdDeviceType, LegacyLevel } from '@prisma/client';
import { FstdService } from './fstd.service.js';

@Controller('fstds')
export class FstdController {
  constructor(private readonly fstdService: FstdService) {}

  @Post()
  create(
    @Body()
    dto: {
      organizationId: string;
      deviceCode: string;
      representedAircraft: string;
      deviceType: FstdDeviceType;
      serialNumber?: string;
      location?: string;
      legacyLevel?: LegacyLevel;
    },
  ) {
    return this.fstdService.create(dto);
  }

  @Get()
  findAll(@Query('organizationId') organizationId: string) {
    return this.fstdService.findAll(organizationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.fstdService.findOne(id);
  }

  @Post(':id/qualified-tasks')
  addQualifiedTask(
    @Param('id') id: string,
    @Body() dto: { taskCode: string; taskName: string; requiresSpecialAuth?: boolean },
  ) {
    return this.fstdService.addQualifiedTask(id, dto);
  }

  @Get(':id/can-perform/:taskCode')
  canPerformTask(@Param('id') id: string, @Param('taskCode') taskCode: string) {
    return this.fstdService.canPerformTask(id, taskCode);
  }

  @Post(':id/discrepancies')
  reportDiscrepancy(
    @Param('id') id: string,
    @Body() dto: { description: string; isMmi?: boolean; reportedById?: string },
  ) {
    return this.fstdService.reportDiscrepancy(id, dto);
  }

  @Post('discrepancies/:discrepancyId/correct')
  correctDiscrepancy(
    @Param('discrepancyId') discrepancyId: string,
    @Body() dto: { correctiveAction: string; correctedById?: string },
  ) {
    return this.fstdService.correctDiscrepancy(discrepancyId, dto);
  }
}
