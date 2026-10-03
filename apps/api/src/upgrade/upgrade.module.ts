import { Module } from '@nestjs/common';
import { UpgradeController } from './upgrade.controller.js';
import { UpgradeService } from './upgrade.service.js';

@Module({
  controllers: [UpgradeController],
  providers: [UpgradeService],
})
export class UpgradeModule {}
