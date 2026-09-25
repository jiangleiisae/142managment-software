import { apiClient } from './client'
import type { Fstd, FstdDeviceType, LegacyLevel } from './types'

export const fstdsApi = {
  list: (organizationId: string) => apiClient.get<Fstd[]>('/fstds', { params: { organizationId } }).then((r) => r.data),

  get: (id: string) => apiClient.get<Fstd>(`/fstds/${id}`).then((r) => r.data),

  create: (data: {
    organizationId: string
    deviceCode: string
    representedAircraft: string
    deviceType: FstdDeviceType
    legacyLevel?: LegacyLevel
  }) => apiClient.post<Fstd>('/fstds', data).then((r) => r.data),

  addQualifiedTask: (fstdId: string, data: { taskCode: string; taskName: string }) =>
    apiClient.post(`/fstds/${fstdId}/qualified-tasks`, data).then((r) => r.data),

  reportDiscrepancy: (fstdId: string, data: { description: string; isMmi?: boolean }) =>
    apiClient.post(`/fstds/${fstdId}/discrepancies`, data).then((r) => r.data),
}
