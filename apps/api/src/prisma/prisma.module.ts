import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

/// 全局模块: 所有业务模块通过依赖注入直接使用 PrismaService, 不必逐一 import PrismaModule
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
