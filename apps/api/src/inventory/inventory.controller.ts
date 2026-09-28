import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PartMovementType, Permission } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { InventoryService } from './inventory.service.js';

@Controller('inventory')
@RequirePermissions(Permission.INVENTORY)
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  // ---- 3.4.1 备件库存 ----

  @Post('spare-parts')
  createSparePart(
    @Body()
    dto: {
      organizationId: string;
      partNumber: string;
      name: string;
      compatibleWith?: string;
      unit?: string;
      minQuantity?: number;
      location?: string;
    },
  ) {
    return this.service.createSparePart(dto);
  }

  @Get('spare-parts')
  listSpareParts(@Query('organizationId') organizationId: string) {
    return this.service.listSpareParts(organizationId);
  }

  @Get('spare-parts/low-stock')
  listLowStock(@CurrentUser() user: AuthContext) {
    return this.service.listLowStock(user.tenantId);
  }

  @Get('spare-parts/:id/movements')
  listMovements(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.service.listMovements(id, user.tenantId);
  }

  @Post('spare-parts/:id/movements')
  recordMovement(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: { type: PartMovementType; quantity: number; note?: string; relatedDiscrepancyId?: string },
  ) {
    return this.service.recordMovement(id, user.tenantId, dto);
  }

  // ---- 3.4.2 工具校准 ----

  @Post('tools')
  createTool(
    @Body()
    dto: { organizationId: string; toolCode: string; name: string; category?: string; location?: string; calibrationIntervalMonths?: number },
  ) {
    return this.service.createTool(dto);
  }

  @Get('tools')
  listTools(@Query('organizationId') organizationId: string) {
    return this.service.listTools(organizationId);
  }

  @Get('tools/calibrations/due-soon')
  findCalibrationsDueSoon(@CurrentUser() user: AuthContext, @Query('withinDays') withinDays: string) {
    return this.service.findCalibrationsDueSoon(user.tenantId, Number(withinDays) || 60);
  }

  @Get('tools/:id/calibrations')
  listCalibrations(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.service.listCalibrations(id, user.tenantId);
  }

  @Post('tools/:id/calibrations')
  recordCalibration(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: { calibratedAt: string; result?: string; performedBy?: string },
  ) {
    return this.service.recordCalibration(id, user.tenantId, dto);
  }

  // ---- 3.4.3 供应商与采购订单 ----

  @Post('suppliers')
  createSupplier(@Body() dto: { organizationId: string; name: string; serviceCategory?: string; contactInfo?: string }) {
    return this.service.createSupplier(dto);
  }

  @Get('suppliers')
  listSuppliers(@Query('organizationId') organizationId: string) {
    return this.service.listSuppliers(organizationId);
  }

  @Post('purchase-orders')
  createPurchaseOrder(
    @Body()
    dto: {
      organizationId: string;
      supplierId: string;
      items: { sparePartId: string; quantity: number; unitPrice?: number }[];
    },
  ) {
    return this.service.createPurchaseOrder(dto);
  }

  @Get('purchase-orders')
  listPurchaseOrders(@Query('organizationId') organizationId: string) {
    return this.service.listPurchaseOrders(organizationId);
  }

  @Post('purchase-orders/:id/submit')
  submitPurchaseOrder(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.service.submitPurchaseOrder(id, user.tenantId);
  }

  @Post('purchase-orders/:id/approve')
  approvePurchaseOrder(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.service.approvePurchaseOrder(id, user.tenantId);
  }

  @Post('purchase-orders/:id/cancel')
  cancelPurchaseOrder(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.service.cancelPurchaseOrder(id, user.tenantId);
  }

  @Post('purchase-orders/:id/receive')
  receivePurchaseOrder(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.service.receivePurchaseOrder(id, user.tenantId);
  }
}
