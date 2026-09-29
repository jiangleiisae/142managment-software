import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ChangeRequest, Prisma } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CHANGE_TYPE_CONFIG, ENTITY_PERMISSION } from './change-type-config.js';

/// 通用变更管理服务 (ORA.GEN.130): 机构(3.1)/FSTD(3.3.6)共用同一套状态机与审批规则引擎。
/// 权限校验手写在service内 (而非@RequirePermissions()), 因为同一个接口按entityType对应不同模块权限。
@Injectable()
export class ChangeManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  listChangeTypes(entityType: string) {
    const config = CHANGE_TYPE_CONFIG[entityType];
    if (!config) throw new BadRequestException(`不支持的实体类型: ${entityType}`);
    return Object.entries(config).map(([changeType, c]) => ({ changeType, ...c }));
  }

  private getConfig(entityType: string, changeType: string) {
    const entityConfig = CHANGE_TYPE_CONFIG[entityType];
    if (!entityConfig) throw new BadRequestException(`不支持的实体类型: ${entityType}`);
    const config = entityConfig[changeType];
    if (!config) throw new BadRequestException(`实体类型 ${entityType} 不支持变更类型 ${changeType}`);
    return config;
  }

  private assertPermission(actor: AuthContext, entityType: string) {
    if (actor.role === 'OWNER' || actor.role === 'ADMIN') return;
    const required = ENTITY_PERMISSION[entityType];
    if (required && !actor.permissions.includes(required)) {
      throw new ForbiddenException(`缺少所需权限: ${required}`);
    }
  }

  private async resolveTenantId(entityType: string, entityId: string): Promise<string> {
    if (entityType === 'Organization') {
      const org = await this.prisma.organization.findUnique({ where: { id: entityId } });
      if (!org) throw new NotFoundException(`Organization ${entityId} not found`);
      return org.tenantId;
    }
    if (entityType === 'Fstd') {
      const fstd = await this.prisma.fstd.findUnique({ where: { id: entityId }, include: { organization: true } });
      if (!fstd) throw new NotFoundException(`Fstd ${entityId} not found`);
      return fstd.organization.tenantId;
    }
    throw new BadRequestException(`不支持的实体类型: ${entityType}`);
  }

  async create(
    actor: AuthContext,
    data: { entityType: string; entityId: string; changeType: string; description?: string; detailsJson?: Record<string, unknown> },
  ) {
    this.assertPermission(actor, data.entityType);
    const tenantId = await this.resolveTenantId(data.entityType, data.entityId);
    if (tenantId !== actor.tenantId) throw new NotFoundException(`${data.entityType} ${data.entityId} not found`);

    const config = this.getConfig(data.entityType, data.changeType);
    const missing = (config.requiredDetailFields ?? []).filter((f) => {
      const v = data.detailsJson?.[f];
      return v === undefined || v === null || v === '';
    });
    if (missing.length > 0) {
      throw new BadRequestException(`变更类型 "${config.label}" 须填写: ${missing.join(', ')}`);
    }

    const created = await this.prisma.changeRequest.create({
      data: {
        tenantId,
        entityType: data.entityType,
        entityId: data.entityId,
        changeType: data.changeType,
        approvalType: config.approvalType,
        minNoticeDays: config.minNoticeDays,
        description: data.description,
        detailsJson: data.detailsJson as Prisma.InputJsonValue | undefined,
      },
    });
    await this.auditLog.write(tenantId, 'ChangeRequest', created.id, 'create', null, created);
    return created;
  }

  async list(actor: AuthContext, entityType: string, entityId: string) {
    return this.prisma.changeRequest.findMany({
      where: { tenantId: actor.tenantId, entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findOrThrow(actor: AuthContext, id: string) {
    const cr = await this.prisma.changeRequest.findUnique({ where: { id } });
    if (!cr || cr.tenantId !== actor.tenantId) throw new NotFoundException(`ChangeRequest ${id} not found`);
    this.assertPermission(actor, cr.entityType);
    return cr;
  }

  /// 事先批准类: DRAFT -> SUBMITTED (记录提前通知天数对应的最早生效日期)
  /// 无需事先批准类: DRAFT -> LOGGED (内部记录, 等待notify()通知当局)
  async submit(actor: AuthContext, id: string) {
    const cr = await this.findOrThrow(actor, id);
    if (cr.status !== 'DRAFT') throw new BadRequestException(`当前状态 ${cr.status} 不可提交`);

    const now = new Date();
    let updated: ChangeRequest;
    if (cr.approvalType === 'NOTIFICATION_ONLY') {
      updated = await this.prisma.changeRequest.update({ where: { id }, data: { status: 'LOGGED', submittedAt: now } });
    } else {
      const earliestEffectiveDate = new Date(now);
      earliestEffectiveDate.setDate(earliestEffectiveDate.getDate() + (cr.minNoticeDays ?? 0));
      updated = await this.prisma.changeRequest.update({
        where: { id },
        data: { status: 'SUBMITTED', submittedAt: now, earliestEffectiveDate },
      });
    }
    await this.auditLog.write(actor.tenantId, 'ChangeRequest', id, `status_change:${cr.status}->${updated.status}`, cr, updated);
    return updated;
  }

  /// 无需事先批准类专用: LOGGED -> NOTIFIED, 立即生效 (无需等待提前通知期)
  async notify(actor: AuthContext, id: string) {
    const cr = await this.findOrThrow(actor, id);
    if (cr.approvalType !== 'NOTIFICATION_ONLY') throw new BadRequestException('仅无需事先批准类变更使用此操作');
    if (cr.status !== 'LOGGED') throw new BadRequestException(`当前状态 ${cr.status} 不可通知`);
    const updated = await this.prisma.changeRequest.update({ where: { id }, data: { status: 'NOTIFIED', effectiveAt: new Date() } });
    await this.auditLog.write(actor.tenantId, 'ChangeRequest', id, 'status_change:LOGGED->NOTIFIED', cr, updated);
    return updated;
  }

  async approve(actor: AuthContext, id: string) {
    const cr = await this.findOrThrow(actor, id);
    if (cr.approvalType !== 'PRIOR_APPROVAL') throw new BadRequestException('无需事先批准类变更无需此操作');
    if (cr.status !== 'SUBMITTED' && cr.status !== 'UNDER_REVIEW') {
      throw new BadRequestException(`当前状态 ${cr.status} 不可批准`);
    }
    await this.assertTypeSpecificApprovalGate(cr);

    const now = new Date();
    const effectiveAt = cr.earliestEffectiveDate && cr.earliestEffectiveDate > now ? cr.earliestEffectiveDate : now;
    const updated = await this.prisma.changeRequest.update({ where: { id }, data: { status: 'APPROVED', effectiveAt } });
    await this.auditLog.write(actor.tenantId, 'ChangeRequest', id, `status_change:${cr.status}->APPROVED`, cr, updated);
    return updated;
  }

  async reject(actor: AuthContext, id: string, reply?: string) {
    const cr = await this.findOrThrow(actor, id);
    if (cr.status === 'APPROVED' || cr.status === 'REJECTED' || cr.status === 'NOTIFIED') {
      throw new BadRequestException(`当前状态 ${cr.status} 不可驳回`);
    }
    const updated = await this.prisma.changeRequest.update({ where: { id }, data: { status: 'REJECTED', authorityReply: reply } });
    await this.auditLog.write(actor.tenantId, 'ChangeRequest', id, `status_change:${cr.status}->REJECTED`, cr, updated);
    return updated;
  }

  /// 需求清单3.3.6差异化规则的可自动校验部分:
  /// - 搬迁(RELOCATION): 恢复前须完成≥1/3验证测试
  /// - 升级/重新分级(UPGRADE): 须有一次晚于本次变更申请的全新周期性评估记录 (不可复用历史评估结果)
  /// 其余类型 (重大改装/停用/转手) 的规则依赖人工判断的文档内容 (影响评估/存储计划等), 已在创建时强制要求相应字段, 不做自动阻断。
  private async assertTypeSpecificApprovalGate(cr: ChangeRequest) {
    if (cr.entityType !== 'Fstd') return;

    if (cr.changeType === 'RELOCATION') {
      const detail = cr.detailsJson as Record<string, unknown> | null;
      const pct = typeof detail?.verificationTestPercentComplete === 'number' ? detail.verificationTestPercentComplete : 0;
      if (pct < 34) {
        throw new BadRequestException(`搬迁变更批准前须完成至少1/3验证测试, 当前仅完成 ${pct}%`);
      }
    }

    if (cr.changeType === 'UPGRADE') {
      const freshEval = await this.prisma.fstdRecurrentEvaluation.findFirst({
        where: { fstdId: cr.entityId, createdAt: { gt: cr.createdAt } },
      });
      if (!freshEval) {
        throw new BadRequestException('升级/重新分级变更批准前须完成一次晚于本次申请的完整周期性评估 (不可复用历史评估结果)');
      }
    }
  }
}
