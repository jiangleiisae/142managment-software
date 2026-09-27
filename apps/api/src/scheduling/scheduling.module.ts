import { Module } from '@nestjs/common';
import { FstdModule } from '../fstd/fstd.module.js';
import { SchedulingService } from './scheduling.service.js';
import { SchedulingController } from './scheduling.controller.js';

@Module({
  imports: [FstdModule],
  controllers: [SchedulingController],
  providers: [SchedulingService],
})
export class SchedulingModule {}
