import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DemandRequestStatus,
  FaultyPartStatus,
  PartCategory,
  PartMovementType,
  PurchaseOrderStatus,
  ScrapRequestStatus,
} from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // ==================== 3.4.1 备件库存 ====================

  private async findSparePartOrThrow(id: string, tenantId: string) {
    const part = await this.prisma.sparePart.findUnique({ where: { id }, include: { organization: true } });
    if (!part || part.organization.tenantId !== tenantId) throw new NotFoundException(`SparePart ${id} not found`);
    return part;
  }

  createSparePart(data: {
    organizationId: string;
    partNumber: string;
    name: string;
    compatibleWith?: string;
    partCategory?: PartCategory;
    unit?: string;
    minQuantity?: number;
    location?: string;
  }) {
    return this.prisma.sparePart.create({ data });
  }

  listSpareParts(organizationId: string) {
    return this.prisma.sparePart.findMany({ where: { organizationId }, orderBy: { partNumber: 'asc' } });
  }

  async listMovements(sparePartId: string, tenantId: string) {
    await this.findSparePartOrThrow(sparePartId, tenantId);
    return this.prisma.partMovement.findMany({
      where: { sparePartId },
      include: { relatedDiscrepancy: { include: { fstd: true } } },
      orderBy: { performedAt: 'desc' },
    });
  }

  /// 出入库: IN/ADJUSTMENT(正数)增加库存, OUT/ADJUSTMENT(负数)减少库存; OUT不允许扣成负库存。
  /// relatedDiscrepancyId (吸收天津飞安实践): 领用备件时可关联触发本次领用的缺陷记录, 形成"缺陷→领用备件"追溯链;
  /// 须校验该缺陷确实属于同一租户, 且实际归属的FSTD与本次出入库场景一致 (不强制同一台设备, 因备件可能跨设备通用)。
  async recordMovement(
    sparePartId: string,
    tenantId: string,
    data: { type: PartMovementType; quantity: number; note?: string; relatedDiscrepancyId?: string },
  ) {
    const part = await this.findSparePartOrThrow(sparePartId, tenantId);
    if (data.quantity <= 0 && data.type !== PartMovementType.ADJUSTMENT) {
      throw new BadRequestException('quantity 必须为正数 (ADJUSTMENT 类型除外)');
    }

    if (data.relatedDiscrepancyId) {
      const discrepancy = await this.prisma.discrepancyLog.findUnique({
        where: { id: data.relatedDiscrepancyId },
        include: { fstd: { include: { organization: true } } },
      });
      if (!discrepancy || discrepancy.fstd.organization.tenantId !== tenantId) {
        throw new NotFoundException(`Discrepancy ${data.relatedDiscrepancyId} not found`);
      }
    }

    const delta = data.type === PartMovementType.OUT ? -Math.abs(data.quantity) : data.quantity;
    const newQuantity = part.currentQuantity + delta;
    if (newQuantity < 0) {
      throw new BadRequestException(`库存不足: 当前 ${part.currentQuantity}, 无法出库 ${Math.abs(delta)}`);
    }

    const [movement] = await this.prisma.$transaction([
      this.prisma.partMovement.create({
        data: {
          sparePartId,
          type: data.type,
          quantity: data.quantity,
          note: data.note,
          relatedDiscrepancyId: data.relatedDiscrepancyId,
        },
        include: { relatedDiscrepancy: { include: { fstd: true } } },
      }),
      this.prisma.sparePart.update({ where: { id: sparePartId }, data: { currentQuantity: newQuantity } }),
    ]);
    return movement;
  }

  /// 某条缺陷记录关联的所有备件领用记录 (供FSTD缺陷详情页展示"配件领用记录", 反向查询)
  async listMovementsByDiscrepancy(discrepancyId: string, tenantId: string) {
    const discrepancy = await this.prisma.discrepancyLog.findUnique({
      where: { id: discrepancyId },
      include: { fstd: { include: { organization: true } } },
    });
    if (!discrepancy || discrepancy.fstd.organization.tenantId !== tenantId) {
      throw new NotFoundException(`Discrepancy ${discrepancyId} not found`);
    }
    return this.prisma.partMovement.findMany({
      where: { relatedDiscrepancyId: discrepancyId },
      include: { sparePart: true },
      orderBy: { performedAt: 'desc' },
    });
  }

  /// 低于最低库存量的备件, 供仪表盘/告警使用 (对标 Simorg "quantity alert to prevent stock-outs")
  listLowStock(tenantId: string) {
    return this.prisma.$queryRaw`
      SELECT id, "partNumber", name, "currentQuantity", "minQuantity"
      FROM spare_parts
      WHERE "organizationId" IN (SELECT id FROM organizations WHERE "tenantId" = ${tenantId})
        AND "currentQuantity" < "minQuantity"
      ORDER BY ("minQuantity" - "currentQuantity") DESC
    `;
  }

  // ==================== 3.4.2 工具校准 ====================

  private async findToolOrThrow(id: string, tenantId: string) {
    const tool = await this.prisma.tool.findUnique({ where: { id }, include: { organization: true } });
    if (!tool || tool.organization.tenantId !== tenantId) throw new NotFoundException(`Tool ${id} not found`);
    return tool;
  }

  createTool(data: {
    organizationId: string;
    toolCode: string;
    name: string;
    category?: string;
    location?: string;
    calibrationIntervalMonths?: number;
  }) {
    return this.prisma.tool.create({ data });
  }

  listTools(organizationId: string) {
    return this.prisma.tool.findMany({
      where: { organizationId },
      include: { calibrations: { orderBy: { calibratedAt: 'desc' }, take: 1 } },
    });
  }

  async listCalibrations(toolId: string, tenantId: string) {
    await this.findToolOrThrow(toolId, tenantId);
    return this.prisma.toolCalibrationRecord.findMany({ where: { toolId }, orderBy: { calibratedAt: 'desc' } });
  }

  /// 校准周期到期日 = 本次校准日 + 工具设定的校准间隔月数 (需求清单3.4: 对标Simorg "Managing calibration schedule for FSTDs")
  async recordCalibration(toolId: string, tenantId: string, data: { calibratedAt: string; result?: string; performedBy?: string }) {
    const tool = await this.findToolOrThrow(toolId, tenantId);
    const calibratedAt = new Date(data.calibratedAt);
    const nextDueDate = new Date(calibratedAt);
    nextDueDate.setMonth(nextDueDate.getMonth() + tool.calibrationIntervalMonths);

    return this.prisma.toolCalibrationRecord.create({
      data: { toolId, calibratedAt, result: data.result ?? 'pass', performedBy: data.performedBy, nextDueDate },
    });
  }

  /// 找出校准即将到期/已过期/从未校准过的工具 (镜像 FSTD.findEvaluationsDueSoon 的模式)
  async findCalibrationsDueSoon(tenantId: string, withinDays = 60) {
    const tools = await this.prisma.tool.findMany({
      where: { organization: { tenantId } },
      include: { calibrations: { orderBy: { calibratedAt: 'desc' }, take: 1 } },
    });
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + withinDays);
    return tools
      .filter((t) => {
        const latest = t.calibrations[0];
        return !latest || (latest.nextDueDate && latest.nextDueDate <= cutoff);
      })
      .map((t) => ({
        toolId: t.id,
        toolCode: t.toolCode,
        name: t.name,
        nextDueDate: t.calibrations[0]?.nextDueDate ?? null,
      }));
  }

  // ==================== 3.4.3 供应商与采购订单 ====================

  createSupplier(data: { organizationId: string; name: string; serviceCategory?: string; contactInfo?: string }) {
    return this.prisma.supplier.create({ data });
  }

  listSuppliers(organizationId: string) {
    return this.prisma.supplier.findMany({ where: { organizationId } });
  }

  private async findPurchaseOrderOrThrow(id: string, tenantId: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { organization: true, items: { include: { sparePart: true } }, supplier: true },
    });
    if (!po || po.organization.tenantId !== tenantId) throw new NotFoundException(`PurchaseOrder ${id} not found`);
    return po;
  }

  createPurchaseOrder(data: {
    organizationId: string;
    supplierId: string;
    items: { sparePartId: string; quantity: number; unitPrice?: number }[];
  }) {
    return this.prisma.purchaseOrder.create({
      data: {
        organizationId: data.organizationId,
        supplierId: data.supplierId,
        items: { create: data.items },
      },
      include: { items: true },
    });
  }

  listPurchaseOrders(organizationId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { organizationId },
      include: { supplier: true, items: { include: { sparePart: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private assertTransition(current: PurchaseOrderStatus, allowed: PurchaseOrderStatus[], target: PurchaseOrderStatus) {
    if (!allowed.includes(target)) {
      throw new BadRequestException(`Cannot transition purchase order from ${current} to ${target}`);
    }
  }

  async submitPurchaseOrder(id: string, tenantId: string) {
    const po = await this.findPurchaseOrderOrThrow(id, tenantId);
    this.assertTransition(po.status, [PurchaseOrderStatus.SUBMITTED, PurchaseOrderStatus.CANCELLED], PurchaseOrderStatus.SUBMITTED);
    const updated = await this.prisma.purchaseOrder.update({ where: { id }, data: { status: PurchaseOrderStatus.SUBMITTED } });
    await this.auditLog.write(tenantId, 'PurchaseOrder', id, `status_change:${po.status}->${updated.status}`, po, updated);
    return updated;
  }

  async approvePurchaseOrder(id: string, tenantId: string) {
    const po = await this.findPurchaseOrderOrThrow(id, tenantId);
    if (po.status !== PurchaseOrderStatus.SUBMITTED) {
      throw new BadRequestException(`Cannot approve purchase order from status ${po.status}`);
    }
    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.APPROVED, approvedAt: new Date() },
    });
    await this.auditLog.write(tenantId, 'PurchaseOrder', id, `status_change:${po.status}->${updated.status}`, po, updated);
    return updated;
  }

  async cancelPurchaseOrder(id: string, tenantId: string) {
    const po = await this.findPurchaseOrderOrThrow(id, tenantId);
    if (po.status === PurchaseOrderStatus.RECEIVED) throw new BadRequestException('已入库的订单不能取消');
    const updated = await this.prisma.purchaseOrder.update({ where: { id }, data: { status: PurchaseOrderStatus.CANCELLED } });
    await this.auditLog.write(tenantId, 'PurchaseOrder', id, `status_change:${po.status}->${updated.status}`, po, updated);
    return updated;
  }

  /// 到货入库: 批准后的订单一次性全部入库, 按明细逐条生成入库movement并累加库存 (与3.4.1的库存联动)
  async receivePurchaseOrder(id: string, tenantId: string) {
    const po = await this.findPurchaseOrderOrThrow(id, tenantId);
    if (po.status !== PurchaseOrderStatus.APPROVED) {
      throw new BadRequestException(`Cannot receive purchase order from status ${po.status}`);
    }

    await this.prisma.$transaction([
      ...po.items.flatMap((item) => [
        this.prisma.partMovement.create({
          data: {
            sparePartId: item.sparePartId,
            type: PartMovementType.IN,
            quantity: item.quantity,
            note: `采购订单 ${po.id} 到货入库`,
          },
        }),
        this.prisma.sparePart.update({
          where: { id: item.sparePartId },
          data: { currentQuantity: { increment: item.quantity } },
        }),
      ]),
      this.prisma.purchaseOrder.update({
        where: { id },
        data: { status: PurchaseOrderStatus.RECEIVED, receivedAt: new Date() },
      }),
    ]);

    const updated = await this.findPurchaseOrderOrThrow(id, tenantId);
    await this.auditLog.write(tenantId, 'PurchaseOrder', id, `status_change:${po.status}->${updated.status}`, po, updated);
    return updated;
  }

  // ==================== 3.4.4 故障件管理 (吸收天津飞安实践) ====================

  async reportFaultyPart(
    tenantId: string,
    data: {
      sparePartId: string;
      removedFromFstdId?: string;
      relatedDiscrepancyId?: string;
      quantity?: number;
      faultDescription: string;
    },
  ) {
    await this.findSparePartOrThrow(data.sparePartId, tenantId);
    const record = await this.prisma.faultyPartRecord.create({
      data: {
        sparePartId: data.sparePartId,
        removedFromFstdId: data.removedFromFstdId,
        relatedDiscrepancyId: data.relatedDiscrepancyId,
        quantity: data.quantity ?? 1,
        faultDescription: data.faultDescription,
      },
      include: { sparePart: true, removedFromFstd: true },
    });
    await this.auditLog.write(tenantId, 'FaultyPartRecord', record.id, 'create', null, record);
    return record;
  }

  listFaultyParts(organizationId: string) {
    return this.prisma.faultyPartRecord.findMany({
      where: { sparePart: { organizationId } },
      include: { sparePart: true, removedFromFstd: true, supplier: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findFaultyPartOrThrow(id: string, tenantId: string) {
    const record = await this.prisma.faultyPartRecord.findUnique({
      where: { id },
      include: { sparePart: { include: { organization: true } } },
    });
    if (!record || record.sparePart.organization.tenantId !== tenantId) {
      throw new NotFoundException(`FaultyPartRecord ${id} not found`);
    }
    return record;
  }

  /// REPAIRED_RETURNED_TO_STOCK: 视为送修返回的合格品, 自动生成IN movement重新计入库存
  async updateFaultyPartStatus(
    id: string,
    tenantId: string,
    data: { status: FaultyPartStatus; supplierId?: string; resolutionNotes?: string },
  ) {
    const record = await this.findFaultyPartOrThrow(id, tenantId);
    const now = new Date();
    const baseData = {
      status: data.status,
      resolutionNotes: data.resolutionNotes,
      ...(data.supplierId ? { supplierId: data.supplierId } : {}),
      ...(data.status === 'SENT_FOR_REPAIR' || data.status === 'RETURNED_TO_SUPPLIER' ? { sentAt: now } : {}),
      ...(data.status === 'REPAIRED_RETURNED_TO_STOCK' || data.status === 'SCRAPPED' ? { resolvedAt: now } : {}),
    };

    let updated;
    if (data.status === FaultyPartStatus.REPAIRED_RETURNED_TO_STOCK) {
      const [, , faultyUpdated] = await this.prisma.$transaction([
        this.prisma.partMovement.create({
          data: {
            sparePartId: record.sparePartId,
            type: PartMovementType.IN,
            quantity: record.quantity,
            note: `故障件送修返回入库 (FaultyPartRecord ${id})`,
          },
        }),
        this.prisma.sparePart.update({
          where: { id: record.sparePartId },
          data: { currentQuantity: { increment: record.quantity } },
        }),
        this.prisma.faultyPartRecord.update({ where: { id }, data: baseData }),
      ]);
      updated = faultyUpdated;
    } else {
      updated = await this.prisma.faultyPartRecord.update({ where: { id }, data: baseData });
    }
    await this.auditLog.write(tenantId, 'FaultyPartRecord', id, `status_change:${record.status}->${updated.status}`, record, updated);
    return updated;
  }

  // ==================== 3.4.5 备件报废管理 (吸收天津飞安实践) ====================

  async requestScrap(tenantId: string, data: { sparePartId: string; quantity: number; reasonCode: string; requestedById?: string }) {
    const part = await this.findSparePartOrThrow(data.sparePartId, tenantId);
    if (data.quantity <= 0) throw new BadRequestException('quantity 必须为正数');
    if (data.quantity > part.currentQuantity) {
      throw new BadRequestException(`库存不足: 当前 ${part.currentQuantity}, 无法申请报废 ${data.quantity}`);
    }
    const request = await this.prisma.partScrapRequest.create({
      data: {
        sparePartId: data.sparePartId,
        quantity: data.quantity,
        reasonCode: data.reasonCode,
        requestedById: data.requestedById,
      },
      include: { sparePart: true },
    });
    await this.auditLog.write(tenantId, 'PartScrapRequest', request.id, 'create', null, request);
    return request;
  }

  listScrapRequests(organizationId: string) {
    return this.prisma.partScrapRequest.findMany({
      where: { sparePart: { organizationId } },
      include: { sparePart: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findScrapRequestOrThrow(id: string, tenantId: string) {
    const request = await this.prisma.partScrapRequest.findUnique({
      where: { id },
      include: { sparePart: { include: { organization: true } } },
    });
    if (!request || request.sparePart.organization.tenantId !== tenantId) {
      throw new NotFoundException(`PartScrapRequest ${id} not found`);
    }
    return request;
  }

  /// 报废原因码(reasonCode)+审批人+审批时间齐全后才真正扣减库存, 不是申请时就直接扣 (吸收天津飞安实践: 报废须走审批流程)
  async approveScrap(id: string, tenantId: string, approvedById: string) {
    const request = await this.findScrapRequestOrThrow(id, tenantId);
    if (request.status !== ScrapRequestStatus.PENDING) {
      throw new BadRequestException(`Cannot approve scrap request from status ${request.status}`);
    }
    if (request.quantity > request.sparePart.currentQuantity) {
      throw new BadRequestException(`库存不足: 当前 ${request.sparePart.currentQuantity}, 无法报废 ${request.quantity}`);
    }
    const [, , updated] = await this.prisma.$transaction([
      this.prisma.partMovement.create({
        data: {
          sparePartId: request.sparePartId,
          type: PartMovementType.ADJUSTMENT,
          quantity: -request.quantity,
          note: `报废审批通过 (PartScrapRequest ${id}, 原因: ${request.reasonCode})`,
        },
      }),
      this.prisma.sparePart.update({
        where: { id: request.sparePartId },
        data: { currentQuantity: { decrement: request.quantity } },
      }),
      this.prisma.partScrapRequest.update({
        where: { id },
        data: { status: ScrapRequestStatus.APPROVED, approvedById, approvedAt: new Date() },
      }),
    ]);
    await this.auditLog.write(tenantId, 'PartScrapRequest', id, 'status_change:PENDING->APPROVED', request, updated);
    return updated;
  }

  async rejectScrap(id: string, tenantId: string, rejectedReason?: string) {
    const request = await this.findScrapRequestOrThrow(id, tenantId);
    if (request.status !== ScrapRequestStatus.PENDING) {
      throw new BadRequestException(`Cannot reject scrap request from status ${request.status}`);
    }
    const updated = await this.prisma.partScrapRequest.update({
      where: { id },
      data: { status: ScrapRequestStatus.REJECTED, rejectedReason },
    });
    await this.auditLog.write(tenantId, 'PartScrapRequest', id, 'status_change:PENDING->REJECTED', request, updated);
    return updated;
  }

  // ==================== 3.4.6 备件需求登记 (吸收天津飞安实践) ====================

  /// 需求登记是正式采购单之前的"预测/提前标记"阶段, 与已发出的PurchaseOrder是两个不同阶段;
  /// 允许登记尚未在系统建档的备件(仅填partNumber/name), 但这类需求无法直接转采购单, 须先在3.4.1建档。
  createDemandRequest(data: {
    organizationId: string;
    sparePartId?: string;
    partNumber?: string;
    name?: string;
    quantity: number;
    neededBy?: string;
    requestedById?: string;
    notes?: string;
  }) {
    if (!data.sparePartId && !data.partNumber) {
      throw new BadRequestException('须提供 sparePartId (系统内已建档的备件) 或 partNumber (尚未建档的备件编号) 其中之一');
    }
    return this.prisma.partDemandRequest.create({
      data: {
        organizationId: data.organizationId,
        sparePartId: data.sparePartId,
        partNumber: data.partNumber,
        name: data.name,
        quantity: data.quantity,
        neededBy: data.neededBy ? new Date(data.neededBy) : undefined,
        requestedById: data.requestedById,
        notes: data.notes,
      },
      include: { sparePart: true },
    });
  }

  listDemandRequests(organizationId: string) {
    return this.prisma.partDemandRequest.findMany({
      where: { organizationId },
      include: { sparePart: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findDemandRequestOrThrow(id: string, tenantId: string) {
    const request = await this.prisma.partDemandRequest.findUnique({ where: { id }, include: { organization: true } });
    if (!request || request.organization.tenantId !== tenantId) throw new NotFoundException(`PartDemandRequest ${id} not found`);
    return request;
  }

  async cancelDemandRequest(id: string, tenantId: string) {
    const request = await this.findDemandRequestOrThrow(id, tenantId);
    if (request.status !== DemandRequestStatus.PENDING) {
      throw new BadRequestException(`Cannot cancel demand request from status ${request.status}`);
    }
    const updated = await this.prisma.partDemandRequest.update({ where: { id }, data: { status: DemandRequestStatus.CANCELLED } });
    await this.auditLog.write(tenantId, 'PartDemandRequest', id, 'status_change:PENDING->CANCELLED', request, updated);
    return updated;
  }

  /// 需求登记转正式采购单: 须已挂钩系统内已建档的备件(sparePartId), 未建档的须先在3.4.1建档后再转
  async convertDemandToPurchaseOrder(id: string, tenantId: string, supplierId: string) {
    const request = await this.findDemandRequestOrThrow(id, tenantId);
    if (request.status !== DemandRequestStatus.PENDING) {
      throw new BadRequestException(`Cannot convert demand request from status ${request.status}`);
    }
    if (!request.sparePartId) {
      throw new BadRequestException('该需求登记的备件尚未在系统建档, 须先在备件库存建档后才能转为采购单');
    }

    const po = await this.prisma.purchaseOrder.create({
      data: {
        organizationId: request.organizationId,
        supplierId,
        items: { create: [{ sparePartId: request.sparePartId, quantity: request.quantity }] },
      },
      include: { items: true },
    });
    const updated = await this.prisma.partDemandRequest.update({
      where: { id },
      data: { status: DemandRequestStatus.CONVERTED, purchaseOrderId: po.id },
    });
    await this.auditLog.write(tenantId, 'PartDemandRequest', id, 'status_change:PENDING->CONVERTED', request, updated);
    return updated;
  }

  // ==================== 3.4.7 备件盘点 (吸收天津飞安实践) ====================

  /// 开始盘点: 为机构下每件备件按当前账面库存快照生成一条盘点条目, 后续逐项录入实盘数
  async createStocktakeSession(organizationId: string, title?: string) {
    const parts = await this.prisma.sparePart.findMany({ where: { organizationId } });
    return this.prisma.stocktakeSession.create({
      data: {
        organizationId,
        title,
        items: { create: parts.map((p) => ({ sparePartId: p.id, systemQuantity: p.currentQuantity })) },
      },
      include: { items: { include: { sparePart: true } } },
    });
  }

  listStocktakeSessions(organizationId: string) {
    return this.prisma.stocktakeSession.findMany({
      where: { organizationId },
      include: { items: { include: { sparePart: true } } },
      orderBy: { startedAt: 'desc' },
    });
  }

  private async findStocktakeSessionOrThrow(id: string, tenantId: string) {
    const session = await this.prisma.stocktakeSession.findUnique({
      where: { id },
      include: { organization: true, items: { include: { sparePart: true } } },
    });
    if (!session || session.organization.tenantId !== tenantId) throw new NotFoundException(`StocktakeSession ${id} not found`);
    return session;
  }

  getStocktakeSession(id: string, tenantId: string) {
    return this.findStocktakeSessionOrThrow(id, tenantId);
  }

  async recordStocktakeCount(itemId: string, tenantId: string, countedQuantity: number) {
    const item = await this.prisma.stocktakeItem.findUnique({
      where: { id: itemId },
      include: { stocktakeSession: { include: { organization: true } } },
    });
    if (!item || item.stocktakeSession.organization.tenantId !== tenantId) {
      throw new NotFoundException(`StocktakeItem ${itemId} not found`);
    }
    if (item.stocktakeSession.status !== 'IN_PROGRESS') {
      throw new BadRequestException('该盘点已对账完成, 不能再修改清点数');
    }
    return this.prisma.stocktakeItem.update({ where: { id: itemId }, data: { countedQuantity } });
  }

  /// 对账: 仅对已清点(countedQuantity非null)且与账面不符的条目逐条生成ADJUSTMENT movement并更新库存, 会话标记为已对账
  async reconcileStocktake(id: string, tenantId: string, reconciledById?: string) {
    const session = await this.findStocktakeSessionOrThrow(id, tenantId);
    if (session.status !== 'IN_PROGRESS') {
      throw new BadRequestException(`Cannot reconcile stocktake from status ${session.status}`);
    }

    const discrepancies = session.items.filter((i) => i.countedQuantity !== null && i.countedQuantity !== i.systemQuantity);
    const adjustmentOps = discrepancies.flatMap((i) => {
      const delta = i.countedQuantity! - i.systemQuantity;
      return [
        this.prisma.partMovement.create({
          data: {
            sparePartId: i.sparePartId,
            type: PartMovementType.ADJUSTMENT,
            quantity: delta,
            note: `盘点对账调整 (StocktakeSession ${id})`,
          },
        }),
        this.prisma.sparePart.update({ where: { id: i.sparePartId }, data: { currentQuantity: i.countedQuantity! } }),
      ];
    });
    await this.prisma.$transaction([
      ...adjustmentOps,
      this.prisma.stocktakeSession.update({
        where: { id },
        data: { status: 'RECONCILED', reconciledAt: new Date(), reconciledById },
      }),
    ]);
    const updated = await this.findStocktakeSessionOrThrow(id, tenantId);
    await this.auditLog.write(tenantId, 'StocktakeSession', id, 'reconcile', session, updated);
    return updated;
  }
}
