import { apiClient } from './client'

export type UpgradeCategory = 'MODEL_UPGRADE' | 'SUBSYSTEM_UPGRADE' | 'INSTRUMENT_CALIBRATION' | 'DATABASE_UPDATE'

export interface UpgradeRecord {
  id: string
  fstdId: string
  deviceCode: string
  representedAircraft: string
  category: UpgradeCategory
  performedOn: string
  title: string
  description: string | null
  subsystem: string | null
  versionFrom: string | null
  versionTo: string | null
  performedByPersonnelId: string | null
  performedBy: string | null
  performedByName: string | null
  result: string
  nextDueDate: string | null
  overdue: boolean
  isModification: boolean
  caacReportRef: string | null
  caacReportedOn: string | null
  needsCaacReport: boolean
  notes: string | null
}

export interface UpgradeInput {
  fstdId?: string
  category?: UpgradeCategory
  performedOn: string
  title: string
  description?: string
  subsystem?: string
  versionFrom?: string
  versionTo?: string
  performedByPersonnelId?: string
  performedByName?: string
  result?: string
  nextDueDate?: string
  isModification?: boolean
  caacReportRef?: string
  caacReportedOn?: string
  notes?: string
}

export interface UpgradeFilters {
  category?: UpgradeCategory
  fstdId?: string
  from?: string
  to?: string
}

export type QtgQuarterStatus = 'DONE' | 'DONE_OUTSIDE' | 'UPCOMING' | 'PENDING' | 'OVERDUE'

export interface QtgScheduleRow {
  fstdId: string
  deviceCode: string
  representedAircraft: string
  quarters: {
    quarter: number
    configured: boolean
    windowStart: string
    windowEnd: string
    responsibleIds: string[]
    responsible: string[]
    completedOn: string | null
    result: string | null
    status: QtgQuarterStatus
  }[]
}

const download = async (path: string, params: Record<string, string | undefined>, filename: string) => {
  const res = await apiClient.get<Blob>(path, { params, responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export const upgradesApi = {
  list: (organizationId: string, filters: UpgradeFilters = {}) => apiClient.get<UpgradeRecord[]>('/upgrades', { params: { organizationId, ...filters } }).then((r) => r.data),
  create: (organizationId: string, data: UpgradeInput) => apiClient.post('/upgrades', { organizationId, ...data }).then((r) => r.data),
  update: (id: string, data: Partial<UpgradeInput>) => apiClient.patch(`/upgrades/${id}`, data).then((r) => r.data),
  exportRecords: (organizationId: string, filters: UpgradeFilters = {}) => download('/upgrades/export', { organizationId, ...filters }, 'upgrade-records.xlsx'),
  exportAnnualReport: (organizationId: string, from: string, to: string) => download('/reports/annual-operations/export', { organizationId, from, to }, `annual-operations-${from}_${to}.xlsx`),

  qtgSchedule: (organizationId: string, year: number) => apiClient.get<QtgScheduleRow[]>('/qtg-plans/schedule', { params: { organizationId, year } }).then((r) => r.data),
  setQtgPlan: (data: { organizationId: string; fstdId: string; quarter: number; windowStart: string; windowEnd: string; responsibleIds: string[] }) => apiClient.put('/qtg-plans', data).then((r) => r.data),
  clearQtgPlan: (organizationId: string, fstdId: string, quarter: number) => apiClient.delete('/qtg-plans', { params: { organizationId, fstdId, quarter } }).then((r) => r.data),
}
