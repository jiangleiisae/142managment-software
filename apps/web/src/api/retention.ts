import { apiClient } from './client'

export interface RetentionPolicy {
  id: string
  documentType: string
  retentionMonths?: number | null
  anchorEvent: string
  basisRegulation?: string | null
  description?: string | null
}

export interface RetentionStatusItem {
  documentType: string
  description?: string | null
  basisRegulation?: string | null
  retentionMonths?: number | null
  caacMinimum?: { months: number; basis: string; note: string }
  totalCount: number
  protectedCount: number
  eligibleForArchivalCount: number
}

export const retentionApi = {
  listPolicies: () => apiClient.get<RetentionPolicy[]>('/retention-policies').then((r) => r.data),

  getComplianceStatus: () =>
    apiClient.get<RetentionStatusItem[]>('/retention-policies/compliance-status').then((r) => r.data),
}
