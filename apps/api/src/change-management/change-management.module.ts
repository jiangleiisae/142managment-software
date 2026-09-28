import { Module } from '@nestjs/common';
import { ChangeManagementController } from './change-management.controller.js';
import { ChangeManagementService } from './change-management.service.js';

@Module({
  controllers: [ChangeManagementController],
  providers: [ChangeManagementService],
})
export class ChangeManagementModule {}
