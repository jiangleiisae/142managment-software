import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { FaultyPartStatus, PartMovementType, Permission, WarehouseType } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { RequirePermissions, SkipPermissionCheck } from '../auth/permissions.decorator.js';
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
      partCategory?: string;
      unit?: string;
      minQuantity?: number;
      location?: string;
      requiresInspection?: boolean;
      inspectionIntervalMonths?: number;
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
    @Body()
    dto: {
      type: PartMovementType;
      quantity: number;
      note?: string;
      relatedDiscrepancyId?: string;
      warehouseId?: string;
      usageLocation?: string;
    },
  ) {
    return this.service.recordMovement(id, user.tenantId, dto);
  }

  @Get('discrepancies/:id/movements')
  @SkipPermissionCheck() // 主要消费方是FSTD缺陷详情页(需FSTD权限), 不应额外要求INVENTORY权限才能看到"配件领用记录"
  listMovementsByDiscrepancy(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.service.listMovementsByDiscrepancy(id, user.tenantId);
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

  // ---- 3.4.4 故障件管理 ----

  @Post('faulty-parts')
  reportFaultyPart(
    @CurrentUser() user: AuthContext,
    @Body()
    dto: {
      sparePartId: string;
      removedFromFstdId?: string;
      relatedDiscrepancyId?: string;
      quantity?: number;
      faultDescription: string;
    },
  ) {
    return this.service.reportFaultyPart(user.tenantId, dto);
  }

  @Get('faulty-parts')
  listFaultyParts(@Query('organizationId') organizationId: string) {
    return this.service.listFaultyParts(organizationId);
  }

  @Post('faulty-parts/:id/status')
  updateFaultyPartStatus(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: { status: FaultyPartStatus; supplierId?: string; resolutionNotes?: string },
  ) {
    return this.service.updateFaultyPartStatus(id, user.tenantId, dto);
  }

  // ---- 3.4.5 备件报废管理 ----

  @Post('scrap-requests')
  requestScrap(
    @CurrentUser() user: AuthContext,
    @Body() dto: { sparePartId: string; quantity: number; reasonCode: string; requestedById?: string },
  ) {
    return this.service.requestScrap(user.tenantId, dto);
  }

  @Get('scrap-requests')
  listScrapRequests(@Query('organizationId') organizationId: string) {
    return this.service.listScrapRequests(organizationId);
  }

  @Post('scrap-requests/:id/approve')
  approveScrap(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: { approvedById: string }) {
    return this.service.approveScrap(id, user.tenantId, dto.approvedById);
  }

  @Post('scrap-requests/:id/reject')
  rejectScrap(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: { rejectedReason?: string }) {
    return this.service.rejectScrap(id, user.tenantId, dto.rejectedReason);
  }

  // ---- 3.4.6 备件需求登记 ----

  @Post('demand-requests')
  createDemandRequest(
    @Body()
    dto: {
      organizationId: string;
      sparePartId?: string;
      partNumber?: string;
      name?: string;
      quantity: number;
      neededBy?: string;
      requestedById?: string;
      notes?: string;
    },
  ) {
    return this.service.createDemandRequest(dto);
  }

  @Get('demand-requests')
  listDemandRequests(@Query('organizationId') organizationId: string) {
    return this.service.listDemandRequests(organizationId);
  }

  @Post('demand-requests/:id/cancel')
  cancelDemandRequest(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.service.cancelDemandRequest(id, user.tenantId);
  }

  @Post('demand-requests/:id/convert')
  convertDemandToPurchaseOrder(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: { supplierId: string },
  ) {
    return this.service.convertDemandToPurchaseOrder(id, user.tenantId, dto.supplierId);
  }

  // ---- 3.4.7 备件盘点 ----

  @Post('stocktakes')
  createStocktakeSession(@Body() dto: { organizationId: string; title?: string }) {
    return this.service.createStocktakeSession(dto.organizationId, dto.title);
  }

  @Get('stocktakes')
  listStocktakeSessions(@Query('organizationId') organizationId: string) {
    return this.service.listStocktakeSessions(organizationId);
  }

  @Get('stocktakes/:id')
  getStocktakeSession(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.service.getStocktakeSession(id, user.tenantId);
  }

  @Post('stocktakes/items/:itemId/count')
  recordStocktakeCount(
    @CurrentUser() user: AuthContext,
    @Param('itemId') itemId: string,
    @Body() dto: { countedQuantity: number },
  ) {
    return this.service.recordStocktakeCount(itemId, user.tenantId, dto.countedQuantity);
  }

  @Post('stocktakes/:id/reconcile')
  reconcileStocktake(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: { reconciledById?: string }) {
    return this.service.reconcileStocktake(id, user.tenantId, dto.reconciledById);
  }

  // ---- 3.4.10 备件信息配置字典表 ----

  @Get('part-type-configs')
  listPartTypeConfigs(@Query('organizationId') organizationId: string) {
    return this.service.listPartTypeConfigs(organizationId);
  }

  @Post('part-type-configs')
  createPartTypeConfig(@CurrentUser() user: AuthContext, @Body() dto: { organizationId: string; code: string; label: string }) {
    return this.service.createPartTypeConfig(user.tenantId, dto);
  }

  @Post('part-type-configs/:id')
  updatePartTypeConfigLabel(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: { label: string }) {
    return this.service.updatePartTypeConfigLabel(id, user.tenantId, dto.label);
  }

  @Post('part-type-configs/:id/delete')
  deletePartTypeConfig(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.service.deletePartTypeConfig(id, user.tenantId);
  }

  // ---- 3.4.3 多仓库 + 寄售/托管库房 ----

  @Post('warehouses')
  createWarehouse(@Body() dto: { organizationId: string; name: string; type?: WarehouseType; externalPartyInfo?: string }) {
    return this.service.createWarehouse(dto);
  }

  @Get('warehouses')
  listWarehouses(@Query('organizationId') organizationId: string) {
    return this.service.listWarehouses(organizationId);
  }

  @Get('warehouses/:id/stock')
  listWarehouseStock(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.service.listWarehouseStock(id, user.tenantId);
  }

  @Get('spare-parts/:id/warehouse-stock')
  listWarehouseStockByPart(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.service.listWarehouseStockByPart(id, user.tenantId);
  }

  // ---- 3.4.5 借用件管理 ----

  @Post('loans')
  createLoan(
    @CurrentUser() user: AuthContext,
    @Body() dto: { sparePartId: string; quantity: number; borrowerInfo: string; purposeNote?: string; dueDate?: string },
  ) {
    return this.service.createLoan(user.tenantId, dto);
  }

  @Get('loans')
  listLoans(@Query('organizationId') organizationId: string) {
    return this.service.listLoans(organizationId);
  }

  @Get('loans/overdue')
  findOverdueLoans(@CurrentUser() user: AuthContext) {
    return this.service.findOverdueLoans(user.tenantId);
  }

  @Post('loans/:id/return')
  returnLoan(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.service.returnLoan(id, user.tenantId);
  }

  // ---- 3.4.8 备件检测管理 ----

  @Post('spare-parts/:id/inspections')
  recordPartInspection(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: { inspectedAt: string; result?: string; inspectorId?: string; notes?: string },
  ) {
    return this.service.recordPartInspection(id, user.tenantId, dto);
  }

  @Get('spare-parts/:id/inspections')
  listPartInspections(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.service.listPartInspections(id, user.tenantId);
  }

  @Get('inspections/due-soon')
  findPartInspectionsDueSoon(@CurrentUser() user: AuthContext, @Query('withinDays') withinDays: string) {
    return this.service.findPartInspectionsDueSoon(user.tenantId, Number(withinDays) || 60);
  }
}
