import { Module } from '@nestjs/common';
import { FstdService } from './fstd.service.js';
import { FstdController } from './fstd.controller.js';

@Module({
  controllers: [FstdController],
  providers: [FstdService],
  exports: [FstdService],
})
export class FstdModule {}
