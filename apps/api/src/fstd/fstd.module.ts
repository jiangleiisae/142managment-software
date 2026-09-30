import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { FstdService } from './fstd.service.js';
import { FstdController } from './fstd.controller.js';

@Module({
  imports: [StorageModule],
  controllers: [FstdController],
  providers: [FstdService],
  exports: [FstdService],
})
export class FstdModule {}
