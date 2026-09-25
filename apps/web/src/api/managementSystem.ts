import { apiClient } from './client'

export type ManagementRoleType =
  | 'ACCOUNTABLE_MANAGER'
  | 'NOMINATED_PERSON_COMPLIANCE'
  | 'SAFETY_MANAGER'
  | 'COMPLIANCE_MONITORING_MANAGER'
  | 'HEAD_OF_TRAINING'
  | 'CFI'
  | 'CTKI'

export interface RoleAssignment {
  id: string
  organizationId: string
  personnelId: string
  role: ManagementRoleType
  startDate: string
  endDate?: string | null
  personnel?: { firstName: string; lastName: string }
}

export interface OccurrenceReport {
  id: string
  discoveredAt: string
  occurrenceType: string
  isMandatory: boolean
  reportedAt?: string | null
  reportedTo?: string | null
}

export const managementSystemApi = {
  listRoleAssignments: (organizationId: string) =>
    apiClient.get<RoleAssignment[]>('/management-system/role-assignments', { params: { organizationId } }).then((r) => r.data),

  assignRole: (data: { organizationId: string; personnelId: string; role: ManagementRoleType; startDate: string }) =>
    apiClient.post<RoleAssignment>('/management-system/role-assignments', data).then((r) => r.data),

  reportOccurrence: (data: { organizationId: string; discoveredAt: string; occurrenceType: string; isMandatory?: boolean }) =>
    apiClient.post<OccurrenceReport>('/management-system/occurrence-reports', data).then((r) => r.data),

  listOverdueOccurrences: () =>
    apiClient.get<OccurrenceReport[]>('/management-system/occurrence-reports/overdue').then((r) => r.data),
}
