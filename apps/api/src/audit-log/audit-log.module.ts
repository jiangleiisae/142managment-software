import { Global, Module } from '@nestjs/common';
import { AuditLogController } from './audit-log.controller.js';
import { AuditLogService } from './audit-log.service.js';

/// 全局模块: 所有业务模块通过依赖注入直接使用 AuditLogService, 不必逐一 import AuditLogModule
@Global()
@Module({
  controllers: [AuditLogController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
