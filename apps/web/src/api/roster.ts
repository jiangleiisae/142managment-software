import { apiClient } from './client'

export type ShiftCategory = 'WORK' | 'BUSINESS_TRIP' | 'SICK_LEAVE' | 'COMPENSATORY_LEAVE' | 'ANNUAL_LEAVE' | 'OTHER'

export interface ShiftType {
  id: string
  organizationId: string
  code: string
  name: string
  category: ShiftCategory
  startTime: string | null
  endTime: string | null
  endsNextDay: boolean
  restMinutes: number
  color: string
  generatesMaintenanceTasks: boolean
  description: string | null
  sortOrder: number
  isActive: boolean
}

export type ShiftTypeInput = Partial<Omit<ShiftType, 'id' | 'organizationId'>> & { code?: string }

export interface RosterGroup {
  id: string
  name: string
  sortOrder: number
}

export interface RosterMember {
  id: string
  personnelId: string
  name: string
  groupId: string | null
  groupName: string | null
  sortOrder: number
}

export interface RosterEntry {
  personnelId: string
  date: string
  shiftTypeId: string
}

export interface HoursRow {
  personnelId: string
  name: string
  groupId: string | null
  groupName: string | null
  workDays: number
  totalHours: number
  byShift: Record<string, { days: number; hours: number }>
}

export interface RosterHistoryRow {
  at: string
  personnelId: string
  name: string
  date: string
  before: string | null
  after: string | null
  by: string | null
}

export interface MyRoster {
  linked: boolean
  days: { date: string; organizationName: string; shift: { code: string; name: string; color: string; startTime: string | null; endTime: string | null; endsNextDay: boolean } }[]
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

export const rosterApi = {
  listShiftTypes: (organizationId: string) => apiClient.get<ShiftType[]>('/roster/shift-types', { params: { organizationId } }).then((r) => r.data),
  createShiftType: (organizationId: string, data: ShiftTypeInput) => apiClient.post<ShiftType>('/roster/shift-types', { organizationId, ...data }).then((r) => r.data),
  updateShiftType: (id: string, data: ShiftTypeInput) => apiClient.patch<ShiftType>(`/roster/shift-types/${id}`, data).then((r) => r.data),

  listGroups: (organizationId: string) => apiClient.get<RosterGroup[]>('/roster/groups', { params: { organizationId } }).then((r) => r.data),
  createGroup: (organizationId: string, name: string) => apiClient.post<RosterGroup>('/roster/groups', { organizationId, name }).then((r) => r.data),
  updateGroup: (id: string, data: { name?: string; sortOrder?: number }) => apiClient.patch<RosterGroup>(`/roster/groups/${id}`, data).then((r) => r.data),
  deleteGroup: (id: string) => apiClient.delete(`/roster/groups/${id}`).then((r) => r.data),

  listMembers: (organizationId: string) => apiClient.get<RosterMember[]>('/roster/members', { params: { organizationId } }).then((r) => r.data),
  personnelOptions: (organizationId: string) => apiClient.get<{ id: string; name: string }[]>('/roster/personnel-options', { params: { organizationId } }).then((r) => r.data),
  createMember: (organizationId: string, data: { lastName: string; firstName: string; groupId?: string }) => apiClient.post<{ id: string; personnelId: string; name: string }>('/roster/members/new', { organizationId, ...data }).then((r) => r.data),
  addMembers: (organizationId: string, personnelIds: string[], groupId?: string) => apiClient.post('/roster/members', { organizationId, personnelIds, groupId }).then((r) => r.data),
  updateMember: (id: string, data: { groupId?: string | null; sortOrder?: number }) => apiClient.patch(`/roster/members/${id}`, data).then((r) => r.data),
  removeMember: (id: string) => apiClient.delete(`/roster/members/${id}`).then((r) => r.data),

  listEntries: (organizationId: string, month: string) => apiClient.get<RosterEntry[]>('/roster/entries', { params: { organizationId, month } }).then((r) => r.data),
  setEntries: (organizationId: string, cells: { personnelId: string; date: string }[], shiftTypeId: string | null) =>
    apiClient.post<{ requested: number; changed: number; unchanged: number }>('/roster/entries', { organizationId, cells, shiftTypeId }).then((r) => r.data),

  history: (organizationId: string, from?: string, to?: string, personnelId?: string) =>
    apiClient.get<RosterHistoryRow[]>('/roster/history', { params: { organizationId, from, to, personnelId } }).then((r) => r.data),

  hours: (organizationId: string, from: string, to: string, groupId?: string) =>
    apiClient
      .get<{ shiftTypes: { id: string; code: string; name: string; category: ShiftCategory }[]; rows: HoursRow[] }>('/roster/hours', { params: { organizationId, from, to, groupId } })
      .then((r) => r.data),

  my: (days = 15) => apiClient.get<MyRoster>('/roster/my', { params: { days } }).then((r) => r.data),

  exportMonth: (organizationId: string, month: string) => download('/roster/export', { organizationId, month }, `roster-${month}.xlsx`),
  exportHours: (organizationId: string, from: string, to: string, groupId?: string) => download('/roster/hours/export', { organizationId, from, to, groupId }, `roster-hours-${from}_${to}.xlsx`),
}
