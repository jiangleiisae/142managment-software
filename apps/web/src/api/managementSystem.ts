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

export interface MitigationAction {
  id: string
  description: string
  responsiblePersonnelId?: string | null
  dueDate?: string | null
  status: string
}

export interface RiskAssessment {
  id: string
  hazardId: string
  probabilityLevel: number
  severityLevel: number
  riskScore: number
  mitigations?: MitigationAction[]
}

export interface HazardRegisterEntry {
  id: string
  organizationId: string
  source: string
  description: string
  affectedArea?: string | null
  createdAt: string
  riskAssessments?: RiskAssessment[]
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

  // ---- SMS 风险管理闭环 ----

  reportHazard: (data: { organizationId: string; source: string; description: string; affectedArea?: string }) =>
    apiClient.post<HazardRegisterEntry>('/management-system/hazards', data).then((r) => r.data),

  listHazards: (organizationId: string) =>
    apiClient.get<HazardRegisterEntry[]>('/management-system/hazards', { params: { organizationId } }).then((r) => r.data),

  assessRisk: (
    hazardId: string,
    data: { probabilityLevel: number; severityLevel: number; existingMitigation?: string },
  ) => apiClient.post<RiskAssessment>(`/management-system/hazards/${hazardId}/risk-assessments`, data).then((r) => r.data),

  addMitigationAction: (riskAssessmentId: string, data: { description: string; dueDate?: string }) =>
    apiClient.post<MitigationAction>(`/management-system/risk-assessments/${riskAssessmentId}/mitigation-actions`, data).then((r) => r.data),

  closeMitigationAction: (id: string) =>
    apiClient.post<MitigationAction>(`/management-system/mitigation-actions/${id}/close`).then((r) => r.data),

  listOpenHighRisks: () =>
    apiClient.get<RiskAssessment[]>('/management-system/risks/open-high').then((r) => r.data),
}
