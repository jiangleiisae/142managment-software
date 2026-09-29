import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

/// 通用审计轨迹写入 (ORA.GEN.220 可追溯性): 供所有会"静默覆盖既有记录"的操作调用——
/// 实体创建(仅限后续可被更新/可再次变更状态的主数据)、字段更新、状态流转(批准/驳回/关闭/撤销等)。
/// 不用于纯追加型的不可变历史记录(如故障报告本身、校准记录、性能指标读数)——那些记录自带时间戳与操作人,
/// 本身就是审计轨迹, 无需再包一层 AuditLog。
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async write(
    tenantId: string,
    entityType: string,
    entityId: string,
    action: string,
    beforeJson?: unknown,
    afterJson?: unknown,
    actorId?: string | null,
  ) {
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        entityType,
        entityId,
        action,
        actorId: actorId ?? undefined,
        beforeJson: beforeJson as Prisma.InputJsonValue,
        afterJson: afterJson as Prisma.InputJsonValue,
      },
    });
  }

  /// 供合规看板查询: 按实体类型/实体ID筛选, 不传则返回该租户全部轨迹 (限最近500条, 按时间倒序)
  list(tenantId: string, entityType?: string, entityId?: string) {
    return this.prisma.auditLog.findMany({
      where: { tenantId, entityType, entityId },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  /// 该租户内出现过的所有entityType (供看板筛选下拉框使用)
  async listEntityTypes(tenantId: string) {
    const rows = await this.prisma.auditLog.findMany({
      where: { tenantId },
      distinct: ['entityType'],
      select: { entityType: true },
      orderBy: { entityType: 'asc' },
    });
    return rows.map((r) => r.entityType);
  }
}
