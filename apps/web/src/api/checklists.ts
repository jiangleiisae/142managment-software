import { apiClient } from './client'

export type ChecklistType = 'PRE_FLIGHT' | 'POST_FLIGHT'

export interface ChecklistItem {
  no: string
  text: string
  sopUrl?: string
}

export interface ChecklistTemplate {
  id: string
  fstdId: string
  type: ChecklistType
  items: ChecklistItem[]
}

export type ExpectedStatus = 'DONE' | 'PENDING' | 'UPCOMING' | 'MISSED'

export interface ExpectedItem {
  fstdId: string
  deviceCode: string
  representedAircraft: string
  type: ChecklistType
  shiftTypeId: string
  shiftCode: string
  shiftName: string
  rostered: string[]
  status: ExpectedStatus
  recordId: string | null
  performedBy: string | null
  overallResult: string | null
}

export interface ExpectedResult {
  date: string
  items: ExpectedItem[]
  grounded: { fstdId: string; deviceCode: string }[]
  missingTemplates: { fstdId: string; deviceCode: string; type: ChecklistType }[]
  noFlaggedShift: boolean
  shiftsWithoutRoster: string[]
}

export interface ChecklistRecordRow {
  id: string
  type: ChecklistType
  date: string
  deviceCode: string
  shiftCode: string
  performedBy: string | null
  overallResult: string
  note: string | null
  items: { no: string; text: string; passed: boolean; notes: string | null }[]
}

export const checklistsApi = {
  listTemplates: (organizationId: string, fstdId?: string) =>
    apiClient.get<ChecklistTemplate[]>('/checklists/templates', { params: { organizationId, fstdId } }).then((r) => r.data),
  setTemplate: (organizationId: string, fstdId: string, type: ChecklistType, items: ChecklistItem[]) =>
    apiClient.put('/checklists/templates', { organizationId, fstdId, type, items }).then((r) => r.data),
  cloneTemplates: (organizationId: string, fromFstdId: string, toFstdIds: string[], overwrite: boolean, types?: ChecklistType[]) =>
    apiClient.post<{ created: number; overwritten: number; skipped: number }>('/checklists/templates/clone', { organizationId, fromFstdId, toFstdIds, overwrite, types }).then((r) => r.data),

  expected: (organizationId: string, date: string, type?: ChecklistType) =>
    apiClient.get<ExpectedResult>('/checklists/expected', { params: { organizationId, date, type } }).then((r) => r.data),

  createRecord: (data: {
    organizationId: string
    fstdId: string
    type: ChecklistType
    date: string
    shiftTypeId: string
    results: { no: string; passed: boolean; notes?: string }[]
    performedByPersonnelId?: string
    note?: string
  }) => apiClient.post<{ id: string; overallResult: string }>('/checklists/records', data).then((r) => r.data),

  listRecords: (organizationId: string, params: { type?: ChecklistType; fstdId?: string; from?: string; to?: string } = {}) =>
    apiClient.get<ChecklistRecordRow[]>('/checklists/records', { params: { organizationId, ...params } }).then((r) => r.data),
}
