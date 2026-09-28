import { apiClient } from './client'

export type ChangeApprovalType = 'PRIOR_APPROVAL' | 'NOTIFICATION_ONLY'
export type ChangeRequestStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'LOGGED' | 'NOTIFIED'
export type ChangeEntityType = 'Organization' | 'Fstd'

export interface ChangeTypeConfig {
  changeType: string
  approvalType: ChangeApprovalType
  minNoticeDays: number
  label: string
  requiredDetailFields?: string[]
}

export interface ChangeRequest {
  id: string
  entityType: ChangeEntityType
  entityId: string
  changeType: string
  approvalType: ChangeApprovalType
  status: ChangeRequestStatus
  description?: string | null
  detailsJson?: Record<string, unknown> | null
  minNoticeDays?: number | null
  submittedAt?: string | null
  earliestEffectiveDate?: string | null
  effectiveAt?: string | null
  authorityReply?: string | null
  createdAt: string
}

export const changeRequestsApi = {
  listTypes: (entityType: ChangeEntityType) =>
    apiClient.get<ChangeTypeConfig[]>('/change-requests/types', { params: { entityType } }).then((r) => r.data),

  create: (data: { entityType: ChangeEntityType; entityId: string; changeType: string; description?: string; detailsJson?: Record<string, unknown> }) =>
    apiClient.post<ChangeRequest>('/change-requests', data).then((r) => r.data),

  list: (entityType: ChangeEntityType, entityId: string) =>
    apiClient.get<ChangeRequest[]>('/change-requests', { params: { entityType, entityId } }).then((r) => r.data),

  submit: (id: string) => apiClient.post<ChangeRequest>(`/change-requests/${id}/submit`).then((r) => r.data),

  notify: (id: string) => apiClient.post<ChangeRequest>(`/change-requests/${id}/notify`).then((r) => r.data),

  approve: (id: string) => apiClient.post<ChangeRequest>(`/change-requests/${id}/approve`).then((r) => r.data),

  reject: (id: string, reply?: string) => apiClient.post<ChangeRequest>(`/change-requests/${id}/reject`, { reply }).then((r) => r.data),
}
