import { Module } from '@nestjs/common';
import { ManagementSystemService } from './management-system.service.js';
import { ManagementSystemController } from './management-system.controller.js';

@Module({
  controllers: [ManagementSystemController],
  providers: [ManagementSystemService],
})
export class ManagementSystemModule {}
