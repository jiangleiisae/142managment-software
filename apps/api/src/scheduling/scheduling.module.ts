import { Module } from '@nestjs/common';
import { SchedulingService } from './scheduling.service.js';
import { SchedulingController } from './scheduling.controller.js';

@Module({
  controllers: [SchedulingController],
  providers: [SchedulingService],
})
export class SchedulingModule {}
