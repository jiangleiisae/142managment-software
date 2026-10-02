import { apiClient } from './client'

export type DutyLogStatus = 'DRAFT' | 'SUBMITTED'
export type DutyEntryKind = 'ROUTINE' | 'NON_ROUTINE'

export interface DutyLogSummary {
  id: string
  date: string
  status: DutyLogStatus
  shiftCode: string
  shiftName: string
  groupName: string | null
  engineers: string[]
  entryCount: number
  nonRoutineCount: number
  handoverCount: number
  openHandoverCount: number
}

export interface DutyFilters {
  from?: string
  to?: string
  status?: string
  groupId?: string
  engineerId?: string
  fstdId?: string
  keyword?: string
}

export interface DutyDetail {
  id: string
  organizationId: string
  date: string
  status: DutyLogStatus
  submittedAt: string | null
  createdByEmail: string | null
  shift: { id: string; code: string; name: string; startTime: string | null; endTime: string | null; endsNextDay: boolean }
  group: { id: string; name: string } | null
  engineers: { personnelId: string; name: string }[]
  entries: { id: string; kind: DutyEntryKind; content: string; fstdId: string | null; deviceCode: string | null }[]
  outgoing: { id: string; content: string; fstdId: string | null; deviceCode: string | null; toDate: string; toShiftTypeId: string; toShiftCode: string; completedAt: string | null }[]
  incoming: { id: string; content: string; deviceCode: string | null; fromDate: string; fromShiftCode: string; fromGroupName: string | null; toDate: string; completedAt: string | null; completedInThisLog: boolean }[]
  drRecords: { discrepancyId: string; deviceCode: string; action: 'REPORTED' | 'CORRECTED'; at: string; description: string; correctiveAction: string | null; isMmi: boolean }[]
  drIsSnapshot: boolean
  nextSuggestion: { date: string; shiftTypeId: string; shiftCode: string } | null
}

export interface HandoverRow {
  id: string
  logId: string
  content: string
  deviceCode: string | null
  fromDate: string
  fromShiftCode: string
  fromGroupName: string | null
  toDate: string
  toShiftCode: string
  completedAt: string | null
  completedByEmail: string | null
}

export const dutyApi = {
  list: (organizationId: string, filters: DutyFilters = {}) =>
    apiClient.get<DutyLogSummary[]>('/duty-logs', { params: { organizationId, ...filters } }).then((r) => r.data),
  create: (organizationId: string, date: string, shiftTypeId: string, groupId?: string) =>
    apiClient.post<{ id: string }>('/duty-logs', { organizationId, date, shiftTypeId, groupId }).then((r) => r.data),
  detail: (id: string) => apiClient.get<DutyDetail>(`/duty-logs/${id}`).then((r) => r.data),
  setEngineers: (id: string, engineerIds: string[]) => apiClient.patch(`/duty-logs/${id}`, { engineerIds }).then((r) => r.data),
  remove: (id: string) => apiClient.delete(`/duty-logs/${id}`).then((r) => r.data),
  submit: (id: string) => apiClient.post(`/duty-logs/${id}/submit`).then((r) => r.data),
  reopen: (id: string) => apiClient.post(`/duty-logs/${id}/reopen`).then((r) => r.data),

  addEntry: (id: string, data: { kind: DutyEntryKind; content: string; fstdId?: string }) => apiClient.post(`/duty-logs/${id}/entries`, data).then((r) => r.data),
  removeEntry: (entryId: string) => apiClient.delete(`/duty-entries/${entryId}`).then((r) => r.data),

  addHandover: (id: string, data: { content: string; fstdId?: string; toDate?: string; toShiftTypeId?: string }) => apiClient.post(`/duty-logs/${id}/handovers`, data).then((r) => r.data),
  removeHandover: (handoverId: string) => apiClient.delete(`/duty-handovers/${handoverId}`).then((r) => r.data),
  completeHandover: (handoverId: string, completedInLogId?: string) => apiClient.post(`/duty-handovers/${handoverId}/complete`, { completedInLogId }).then((r) => r.data),
  reopenHandover: (handoverId: string) => apiClient.post(`/duty-handovers/${handoverId}/reopen`).then((r) => r.data),
  listHandovers: (organizationId: string, params: { from?: string; to?: string; status?: string; keyword?: string } = {}) =>
    apiClient.get<HandoverRow[]>('/duty-handovers', { params: { organizationId, ...params } }).then((r) => r.data),

  exportLogs: async (organizationId: string, filters: DutyFilters = {}) => {
    const res = await apiClient.get<Blob>('/duty-logs/export', { params: { organizationId, ...filters }, responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const link = document.createElement('a')
    link.href = url
    link.download = 'duty-logs.xlsx'
    link.click()
    URL.revokeObjectURL(url)
  },
}
