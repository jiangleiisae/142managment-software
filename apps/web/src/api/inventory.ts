import { apiClient } from './client'

export type PartMovementType = 'IN' | 'OUT' | 'ADJUSTMENT'
export type PurchaseOrderStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'RECEIVED' | 'CANCELLED'

export interface SparePart {
  id: string
  organizationId: string
  partNumber: string
  name: string
  compatibleWith?: string | null
  unit: string
  minQuantity: number
  currentQuantity: number
  location?: string | null
}

export interface PartMovement {
  id: string
  type: PartMovementType
  quantity: number
  note?: string | null
  performedAt: string
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

export const inventoryApi = {
  // 备件
  createSparePart: (data: { organizationId: string; partNumber: string; name: string; compatibleWith?: string; minQuantity?: number }) =>
    apiClient.post<SparePart>('/inventory/spare-parts', data).then((r) => r.data),

  listSpareParts: (organizationId: string) =>
    apiClient.get<SparePart[]>('/inventory/spare-parts', { params: { organizationId } }).then((r) => r.data),

  listLowStock: () => apiClient.get<LowStockItem[]>('/inventory/spare-parts/low-stock').then((r) => r.data),

  listMovements: (sparePartId: string) =>
    apiClient.get<PartMovement[]>(`/inventory/spare-parts/${sparePartId}/movements`).then((r) => r.data),

  recordMovement: (sparePartId: string, data: { type: PartMovementType; quantity: number; note?: string }) =>
    apiClient.post<PartMovement>(`/inventory/spare-parts/${sparePartId}/movements`, data).then((r) => r.data),

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
}
