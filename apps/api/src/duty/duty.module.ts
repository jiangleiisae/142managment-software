import { Module } from '@nestjs/common';
import { DutyController } from './duty.controller.js';
import { DutyService } from './duty.service.js';

@Module({
  controllers: [DutyController],
  providers: [DutyService],
})
export class DutyModule {}
