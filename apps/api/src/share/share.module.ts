import { Module } from '@nestjs/common';
import { PublicShareController, ShareController } from './share.controller.js';
import { ShareService } from './share.service.js';

@Module({
  controllers: [ShareController, PublicShareController],
  providers: [ShareService],
})
export class ShareModule {}
