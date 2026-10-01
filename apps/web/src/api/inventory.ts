import { apiClient } from './client'

export type PartMovementType = 'IN' | 'OUT' | 'ADJUSTMENT'
export type PurchaseOrderStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'RECEIVED' | 'CANCELLED'
/// 不再是固定枚举: 内置"CONSUMABLE"/"ROTABLE"外, 机构可通过 PartTypeConfig 字典自行扩展 (吸收天津飞安实践)
export type PartCategory = string

export interface SparePart {
  id: string
  organizationId: string
  partNumber: string
  name: string
  compatibleWith?: string | null
  partCategory: PartCategory
  unit: string
  minQuantity: number
  currentQuantity: number
  location?: string | null
  requiresInspection: boolean
  inspectionIntervalMonths?: number | null
}

export interface PartMovement {
  id: string
  type: PartMovementType
  quantity: number
  note?: string | null
  relatedDiscrepancyId?: string | null
  relatedDiscrepancy?: { id: string; description: string; fstd: { id: string; deviceCode: string } } | null
  warehouseId?: string | null
  warehouse?: { id: string; name: string } | null
  usageLocation?: string | null
  performedAt: string
}

export interface PartTypeConfig {
  id: string
  code: string
  label: string
  isBuiltIn: boolean
}

export type WarehouseType = 'OWN' | 'CONSIGNMENT' | 'THIRD_PARTY_MANAGED'

export interface Warehouse {
  id: string
  name: string
  type: WarehouseType
  externalPartyInfo?: string | null
}

export interface WarehouseStock {
  id: string
  warehouseId: string
  sparePartId: string
  quantity: number
  warehouse?: Warehouse
  sparePart?: SparePart
}

export interface PartLoan {
  id: string
  sparePart: SparePart
  quantity: number
  borrowerInfo: string
  purposeNote?: string | null
  loanedAt: string
  dueDate?: string | null
  returnedAt?: string | null
}

export interface PartInspectionRecord {
  id: string
  inspectedAt: string
  result: string
  inspectorId?: string | null
  nextDueDate?: string | null
  notes?: string | null
}

export interface PartInspectionDueSoonItem {
  sparePartId: string
  partNumber: string
  name: string
  nextDueDate?: string | null
}

export interface LowStockItem {
  id: string
  partNumber: string
  name: string
  currentQuantity: number
  minQuantity: number
}

export interface Tool {
  id: string
  toolCode: string
  name: string
  category?: string | null
  calibrationIntervalMonths: number
  calibrations?: { nextDueDate?: string | null; result: string }[]
}

export interface ToolCalibrationRecord {
  id: string
  calibratedAt: string
  result: string
  nextDueDate?: string | null
}

export interface CalibrationDueSoonItem {
  toolId: string
  toolCode: string
  name: string
  nextDueDate?: string | null
}

export interface Supplier {
  id: string
  name: string
  serviceCategory?: string | null
}

export interface PurchaseOrder {
  id: string
  status: PurchaseOrderStatus
  createdAt: string
  supplier: Supplier
  items: { id: string; quantity: number; unitPrice?: number | null; sparePart: SparePart }[]
}

export type FaultyPartStatus = 'PENDING_DECISION' | 'SENT_FOR_REPAIR' | 'RETURNED_TO_SUPPLIER' | 'REPAIRED_RETURNED_TO_STOCK' | 'SCRAPPED'

export interface FaultyPartRecord {
  id: string
  sparePart: SparePart
  removedFromFstd?: { id: string; deviceCode: string } | null
  quantity: number
  faultDescription: string
  status: FaultyPartStatus
  supplier?: Supplier | null
  sentAt?: string | null
  resolvedAt?: string | null
  resolutionNotes?: string | null
  createdAt: string
}

export type ScrapRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface PartScrapRequest {
  id: string
  sparePart: SparePart
  quantity: number
  reasonCode: string
  status: ScrapRequestStatus
  approvedAt?: string | null
  rejectedReason?: string | null
  createdAt: string
}

export type DemandRequestStatus = 'PENDING' | 'CONVERTED' | 'CANCELLED'

export interface PartDemandRequest {
  id: string
  sparePart?: SparePart | null
  partNumber?: string | null
  name?: string | null
  quantity: number
  neededBy?: string | null
  status: DemandRequestStatus
  purchaseOrderId?: string | null
  notes?: string | null
  createdAt: string
}

export type StocktakeStatus = 'IN_PROGRESS' | 'RECONCILED'

export interface StocktakeItem {
  id: string
  sparePart: SparePart
  systemQuantity: number
  countedQuantity?: number | null
  notes?: string | null
}

export interface StocktakeSession {
  id: string
  title?: string | null
  status: StocktakeStatus
  startedAt: string
  reconciledAt?: string | null
  items: StocktakeItem[]
}

export const inventoryApi = {
  // 备件
  createSparePart: (data: {
    organizationId: string
    partNumber: string
    name: string
    compatibleWith?: string
    partCategory?: PartCategory
    minQuantity?: number
    location?: string
    requiresInspection?: boolean
    inspectionIntervalMonths?: number
  }) => apiClient.post<SparePart>('/inventory/spare-parts', data).then((r) => r.data),

  listSpareParts: (organizationId: string) =>
    apiClient.get<SparePart[]>('/inventory/spare-parts', { params: { organizationId } }).then((r) => r.data),

  updateSparePart: (
    id: string,
    data: {
      name?: string
      compatibleWith?: string
      partCategory?: PartCategory
      unit?: string
      minQuantity?: number
      location?: string
      requiresInspection?: boolean
      inspectionIntervalMonths?: number
    },
  ) => apiClient.post<SparePart>(`/inventory/spare-parts/${id}`, data).then((r) => r.data),

  listLowStock: () => apiClient.get<LowStockItem[]>('/inventory/spare-parts/low-stock').then((r) => r.data),

  listMovements: (sparePartId: string) =>
    apiClient.get<PartMovement[]>(`/inventory/spare-parts/${sparePartId}/movements`).then((r) => r.data),

  recordMovement: (
    sparePartId: string,
    data: {
      type: PartMovementType
      quantity: number
      note?: string
      relatedDiscrepancyId?: string
      warehouseId?: string
      usageLocation?: string
    },
  ) => apiClient.post<PartMovement>(`/inventory/spare-parts/${sparePartId}/movements`, data).then((r) => r.data),

  listMovementsByDiscrepancy: (discrepancyId: string) =>
    apiClient.get<PartMovement[]>(`/inventory/discrepancies/${discrepancyId}/movements`).then((r) => r.data),

  // 工具
  createTool: (data: { organizationId: string; toolCode: string; name: string; category?: string; calibrationIntervalMonths?: number }) =>
    apiClient.post<Tool>('/inventory/tools', data).then((r) => r.data),

  listTools: (organizationId: string) => apiClient.get<Tool[]>('/inventory/tools', { params: { organizationId } }).then((r) => r.data),

  listCalibrationsDueSoon: () =>
    apiClient.get<CalibrationDueSoonItem[]>('/inventory/tools/calibrations/due-soon').then((r) => r.data),

  listCalibrations: (toolId: string) =>
    apiClient.get<ToolCalibrationRecord[]>(`/inventory/tools/${toolId}/calibrations`).then((r) => r.data),

  recordCalibration: (toolId: string, data: { calibratedAt: string; result?: string }) =>
    apiClient.post<ToolCalibrationRecord>(`/inventory/tools/${toolId}/calibrations`, data).then((r) => r.data),

  // 供应商 & 采购单
  createSupplier: (data: { organizationId: string; name: string; serviceCategory?: string }) =>
    apiClient.post<Supplier>('/inventory/suppliers', data).then((r) => r.data),

  listSuppliers: (organizationId: string) =>
    apiClient.get<Supplier[]>('/inventory/suppliers', { params: { organizationId } }).then((r) => r.data),

  createPurchaseOrder: (data: {
    organizationId: string
    supplierId: string
    items: { sparePartId: string; quantity: number; unitPrice?: number }[]
  }) => apiClient.post<PurchaseOrder>('/inventory/purchase-orders', data).then((r) => r.data),

  listPurchaseOrders: (organizationId: string) =>
    apiClient.get<PurchaseOrder[]>('/inventory/purchase-orders', { params: { organizationId } }).then((r) => r.data),

  submitPurchaseOrder: (id: string) => apiClient.post<PurchaseOrder>(`/inventory/purchase-orders/${id}/submit`).then((r) => r.data),
  approvePurchaseOrder: (id: string) => apiClient.post<PurchaseOrder>(`/inventory/purchase-orders/${id}/approve`).then((r) => r.data),
  cancelPurchaseOrder: (id: string) => apiClient.post<PurchaseOrder>(`/inventory/purchase-orders/${id}/cancel`).then((r) => r.data),
  receivePurchaseOrder: (id: string) => apiClient.post<PurchaseOrder>(`/inventory/purchase-orders/${id}/receive`).then((r) => r.data),

  // 故障件管理
  reportFaultyPart: (data: {
    sparePartId: string
    removedFromFstdId?: string
    relatedDiscrepancyId?: string
    quantity?: number
    faultDescription: string
  }) => apiClient.post<FaultyPartRecord>('/inventory/faulty-parts', data).then((r) => r.data),

  listFaultyParts: (organizationId: string) =>
    apiClient.get<FaultyPartRecord[]>('/inventory/faulty-parts', { params: { organizationId } }).then((r) => r.data),

  updateFaultyPartStatus: (id: string, data: { status: FaultyPartStatus; supplierId?: string; resolutionNotes?: string }) =>
    apiClient.post<FaultyPartRecord>(`/inventory/faulty-parts/${id}/status`, data).then((r) => r.data),

  // 备件报废
  requestScrap: (data: { sparePartId: string; quantity: number; reasonCode: string; requestedById?: string }) =>
    apiClient.post<PartScrapRequest>('/inventory/scrap-requests', data).then((r) => r.data),

  listScrapRequests: (organizationId: string) =>
    apiClient.get<PartScrapRequest[]>('/inventory/scrap-requests', { params: { organizationId } }).then((r) => r.data),

  approveScrap: (id: string, approvedById: string) =>
    apiClient.post<PartScrapRequest>(`/inventory/scrap-requests/${id}/approve`, { approvedById }).then((r) => r.data),

  rejectScrap: (id: string, rejectedReason?: string) =>
    apiClient.post<PartScrapRequest>(`/inventory/scrap-requests/${id}/reject`, { rejectedReason }).then((r) => r.data),

  // 备件需求登记
  createDemandRequest: (data: {
    organizationId: string
    sparePartId?: string
    partNumber?: string
    name?: string
    quantity: number
    neededBy?: string
    requestedById?: string
    notes?: string
  }) => apiClient.post<PartDemandRequest>('/inventory/demand-requests', data).then((r) => r.data),

  listDemandRequests: (organizationId: string) =>
    apiClient.get<PartDemandRequest[]>('/inventory/demand-requests', { params: { organizationId } }).then((r) => r.data),

  cancelDemandRequest: (id: string) => apiClient.post<PartDemandRequest>(`/inventory/demand-requests/${id}/cancel`).then((r) => r.data),

  convertDemandToPurchaseOrder: (id: string, supplierId: string) =>
    apiClient.post<PartDemandRequest>(`/inventory/demand-requests/${id}/convert`, { supplierId }).then((r) => r.data),

  // 备件盘点
  createStocktakeSession: (organizationId: string, title?: string) =>
    apiClient.post<StocktakeSession>('/inventory/stocktakes', { organizationId, title }).then((r) => r.data),

  listStocktakeSessions: (organizationId: string) =>
    apiClient.get<StocktakeSession[]>('/inventory/stocktakes', { params: { organizationId } }).then((r) => r.data),

  getStocktakeSession: (id: string) => apiClient.get<StocktakeSession>(`/inventory/stocktakes/${id}`).then((r) => r.data),

  recordStocktakeCount: (itemId: string, countedQuantity: number) =>
    apiClient.post<StocktakeItem>(`/inventory/stocktakes/items/${itemId}/count`, { countedQuantity }).then((r) => r.data),

  reconcileStocktake: (id: string, reconciledById?: string) =>
    apiClient.post<StocktakeSession>(`/inventory/stocktakes/${id}/reconcile`, { reconciledById }).then((r) => r.data),

  // 备件信息配置字典
  listPartTypeConfigs: (organizationId: string) =>
    apiClient.get<PartTypeConfig[]>('/inventory/part-type-configs', { params: { organizationId } }).then((r) => r.data),

  createPartTypeConfig: (data: { organizationId: string; code: string; label: string }) =>
    apiClient.post<PartTypeConfig>('/inventory/part-type-configs', data).then((r) => r.data),

  updatePartTypeConfigLabel: (id: string, label: string) =>
    apiClient.post<PartTypeConfig>(`/inventory/part-type-configs/${id}`, { label }).then((r) => r.data),

  deletePartTypeConfig: (id: string) =>
    apiClient.post<{ success: boolean }>(`/inventory/part-type-configs/${id}/delete`).then((r) => r.data),

  // 多仓库
  createWarehouse: (data: { organizationId: string; name: string; type?: WarehouseType; externalPartyInfo?: string }) =>
    apiClient.post<Warehouse>('/inventory/warehouses', data).then((r) => r.data),

  listWarehouses: (organizationId: string) =>
    apiClient.get<Warehouse[]>('/inventory/warehouses', { params: { organizationId } }).then((r) => r.data),

  listWarehouseStock: (warehouseId: string) =>
    apiClient.get<WarehouseStock[]>(`/inventory/warehouses/${warehouseId}/stock`).then((r) => r.data),

  listWarehouseStockByPart: (sparePartId: string) =>
    apiClient.get<WarehouseStock[]>(`/inventory/spare-parts/${sparePartId}/warehouse-stock`).then((r) => r.data),

  // 借用件管理
  createLoan: (data: { sparePartId: string; quantity: number; borrowerInfo: string; purposeNote?: string; dueDate?: string }) =>
    apiClient.post<PartLoan>('/inventory/loans', data).then((r) => r.data),

  listLoans: (organizationId: string) => apiClient.get<PartLoan[]>('/inventory/loans', { params: { organizationId } }).then((r) => r.data),

  findOverdueLoans: () => apiClient.get<PartLoan[]>('/inventory/loans/overdue').then((r) => r.data),

  returnLoan: (id: string) => apiClient.post<PartLoan>(`/inventory/loans/${id}/return`).then((r) => r.data),

  // 备件检测管理
  recordPartInspection: (
    sparePartId: string,
    data: { inspectedAt: string; result?: string; inspectorId?: string; notes?: string },
  ) => apiClient.post<PartInspectionRecord>(`/inventory/spare-parts/${sparePartId}/inspections`, data).then((r) => r.data),

  listPartInspections: (sparePartId: string) =>
    apiClient.get<PartInspectionRecord[]>(`/inventory/spare-parts/${sparePartId}/inspections`).then((r) => r.data),

  findPartInspectionsDueSoon: (withinDays = 60) =>
    apiClient
      .get<PartInspectionDueSoonItem[]>('/inventory/inspections/due-soon', { params: { withinDays } })
      .then((r) => r.data),
}
