import { Module } from '@nestjs/common';
import { PersonnelService } from './personnel.service.js';
import { PersonnelController } from './personnel.controller.js';

@Module({
  controllers: [PersonnelController],
  providers: [PersonnelService],
  exports: [PersonnelService],
})
export class PersonnelModule {}
