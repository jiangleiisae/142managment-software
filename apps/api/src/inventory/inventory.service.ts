import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PartCategory, PartMovementType, PurchaseOrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.purchaseOrder.update({ where: { id }, data: { status: PurchaseOrderStatus.SUBMITTED } });
  }

  async approvePurchaseOrder(id: string, tenantId: string) {
    const po = await this.findPurchaseOrderOrThrow(id, tenantId);
    if (po.status !== PurchaseOrderStatus.SUBMITTED) {
      throw new BadRequestException(`Cannot approve purchase order from status ${po.status}`);
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.APPROVED, approvedAt: new Date() },
    });
  }

  async cancelPurchaseOrder(id: string, tenantId: string) {
    const po = await this.findPurchaseOrderOrThrow(id, tenantId);
    if (po.status === PurchaseOrderStatus.RECEIVED) throw new BadRequestException('已入库的订单不能取消');
    return this.prisma.purchaseOrder.update({ where: { id }, data: { status: PurchaseOrderStatus.CANCELLED } });
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

    return this.findPurchaseOrderOrThrow(id, tenantId);
  }
}
