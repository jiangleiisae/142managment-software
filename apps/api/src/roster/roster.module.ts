import { Module } from '@nestjs/common';
import { RosterController } from './roster.controller.js';
import { RosterService } from './roster.service.js';

@Module({
  controllers: [RosterController],
  providers: [RosterService],
})
export class RosterModule {}
