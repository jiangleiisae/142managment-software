import { apiClient } from './client'

export type ShiftCategory = 'WORK' | 'BUSINESS_TRIP' | 'SICK_LEAVE' | 'COMPENSATORY_LEAVE' | 'ANNUAL_LEAVE' | 'OTHER'
/// 排班的部门: 维护 / 行政综合 (前台、行政、司机、保洁等)
export type StaffDepartment = 'MAINTENANCE' | 'ADMIN'

export interface ShiftType {
  id: string
  organizationId: string
  department: StaffDepartment
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

export type ShiftTypeInput = Partial<Omit<ShiftType, 'id' | 'organizationId' | 'department'>> & { code?: string }

export interface RosterGroup {
  id: string
  department: StaffDepartment
  name: string
  sortOrder: number
}

/// 排班人员 (维护人员 / 行政综合人员), 独立于「人员资质」的人员档案
export interface Staff {
  id: string
  department: StaffDepartment
  name: string
  employeeNo: string | null
  position: string | null
  phone: string | null
  notes: string | null
  groupId: string | null
  groupName: string | null
  userId: string | null
  userEmail: string | null
  sortOrder: number
  isActive: boolean
}

export interface StaffInput {
  name?: string
  employeeNo?: string
  position?: string
  phone?: string
  notes?: string
  groupId?: string | null
  userId?: string | null
  sortOrder?: number
  isActive?: boolean
}

export interface RosterEntry {
  staffId: string
  date: string
  shiftTypeId: string
}

export interface HoursRow {
  staffId: string
  name: string
  position: string | null
  groupId: string | null
  groupName: string | null
  isActive: boolean
  workDays: number
  totalHours: number
  byShift: Record<string, { days: number; hours: number }>
}

export interface RosterHistoryRow {
  at: string
  staffId: string
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
  listShiftTypes: (organizationId: string, department: StaffDepartment = 'MAINTENANCE') => apiClient.get<ShiftType[]>('/roster/shift-types', { params: { organizationId, department } }).then((r) => r.data),
  createShiftType: (organizationId: string, department: StaffDepartment, data: ShiftTypeInput) => apiClient.post<ShiftType>('/roster/shift-types', { organizationId, department, ...data }).then((r) => r.data),
  updateShiftType: (id: string, data: ShiftTypeInput) => apiClient.patch<ShiftType>(`/roster/shift-types/${id}`, data).then((r) => r.data),

  listGroups: (organizationId: string, department: StaffDepartment = 'MAINTENANCE') => apiClient.get<RosterGroup[]>('/roster/groups', { params: { organizationId, department } }).then((r) => r.data),
  createGroup: (organizationId: string, department: StaffDepartment, name: string) => apiClient.post<RosterGroup>('/roster/groups', { organizationId, department, name }).then((r) => r.data),
  updateGroup: (id: string, data: { name?: string; sortOrder?: number }) => apiClient.patch<RosterGroup>(`/roster/groups/${id}`, data).then((r) => r.data),
  deleteGroup: (id: string) => apiClient.delete(`/roster/groups/${id}`).then((r) => r.data),

  listStaff: (organizationId: string, department: StaffDepartment, includeInactive = false) =>
    apiClient.get<Staff[]>('/roster/staff', { params: { organizationId, department, includeInactive: includeInactive ? 'true' : undefined } }).then((r) => r.data),
  createStaff: (organizationId: string, department: StaffDepartment, data: StaffInput & { name: string }) => apiClient.post<Staff>('/roster/staff', { organizationId, department, ...data }).then((r) => r.data),
  updateStaff: (id: string, data: StaffInput) => apiClient.patch<Staff>(`/roster/staff/${id}`, data).then((r) => r.data),
  deleteStaff: (id: string) => apiClient.delete(`/roster/staff/${id}`).then((r) => r.data),
  userOptions: () => apiClient.get<{ id: string; email: string }[]>('/roster/staff/user-options').then((r) => r.data),

  listEntries: (organizationId: string, department: StaffDepartment, month: string) => apiClient.get<RosterEntry[]>('/roster/entries', { params: { organizationId, department, month } }).then((r) => r.data),
  setEntries: (organizationId: string, cells: { staffId: string; date: string }[], shiftTypeId: string | null) =>
    apiClient.post<{ requested: number; changed: number; unchanged: number }>('/roster/entries', { organizationId, cells, shiftTypeId }).then((r) => r.data),

  history: (organizationId: string, department: StaffDepartment, from?: string, to?: string, staffId?: string) =>
    apiClient.get<RosterHistoryRow[]>('/roster/history', { params: { organizationId, department, from, to, staffId } }).then((r) => r.data),

  hours: (organizationId: string, department: StaffDepartment, from: string, to: string, groupId?: string) =>
    apiClient
      .get<{ shiftTypes: { id: string; code: string; name: string; category: ShiftCategory }[]; rows: HoursRow[] }>('/roster/hours', { params: { organizationId, department, from, to, groupId } })
      .then((r) => r.data),

  my: (days = 15) => apiClient.get<MyRoster>('/roster/my', { params: { days } }).then((r) => r.data),

  exportMonth: (organizationId: string, department: StaffDepartment, month: string) => download('/roster/export', { organizationId, department, month }, `roster-${department.toLowerCase()}-${month}.xlsx`),
  exportHours: (organizationId: string, department: StaffDepartment, from: string, to: string, groupId?: string) =>
    download('/roster/hours/export', { organizationId, department, from, to, groupId }, `roster-hours-${department.toLowerCase()}-${from}_${to}.xlsx`),
}
