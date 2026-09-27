import { Module } from '@nestjs/common';
import { IsmsController } from './isms.controller.js';
import { IsmsService } from './isms.service.js';

@Module({
  controllers: [IsmsController],
  providers: [IsmsService],
})
export class IsmsModule {}
