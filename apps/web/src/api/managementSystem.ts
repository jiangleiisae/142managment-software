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

export interface SafetyPolicy {
  id: string
  organizationId: string
  version: string
  policyText: string
  effectiveDate: string
  signedById?: string | null
  signedAt?: string | null
  supersededAt?: string | null
}

export type MocStatus = 'DRAFT' | 'RISK_ASSESSED' | 'IMPLEMENTED' | 'VERIFIED'

export interface ManagementOfChange {
  id: string
  organizationId: string
  changeDescription: string
  status: MocStatus
  riskAssessmentId?: string | null
  riskAssessment?: RiskAssessment | null
  implementationPlan?: string | null
  implementedAt?: string | null
  verificationNotes?: string | null
  verifiedAt?: string | null
  createdAt: string
}

export interface ErpDrill {
  id: string
  erpId: string
  drilledAt: string
  scenario: string
  outcome?: string | null
  nextDueDate: string
}

export interface EmergencyResponsePlan {
  id: string
  organizationId: string
  version: string
  planText: string
  effectiveDate: string
  supersededAt?: string | null
  drills?: ErpDrill[]
}

export interface ErpDrillDueSoonItem {
  erpId: string
  organizationName: string
  nextDueDate?: string | null
}

export type SpiDirection = 'LOWER_IS_BETTER' | 'HIGHER_IS_BETTER'

export interface SafetyIndicatorWithStatus {
  id: string
  name: string
  description?: string | null
  targetValue: number
  direction: SpiDirection
  latestValue?: number | null
  latestPeriodEnd?: string | null
  breached: boolean
}

export interface SrbAction {
  id: string
  meetingId: string
  description: string
  responsiblePersonnelId?: string | null
  dueDate?: string | null
  status: string
}

export interface SrbMeeting {
  id: string
  organizationId: string
  meetingDate: string
  attendeeRoles: string[]
  agenda: string
  decisions?: string | null
  actions?: SrbAction[]
}

export interface ContractRecord {
  id: string
  organizationId: string
  contractorName: string
  scope: string
  agreementRef?: string | null
  includedInAudit: boolean
  createdAt: string
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

  // ---- 3.2.2 安全政策 ----

  addSafetyPolicy: (data: { organizationId: string; version: string; policyText: string; effectiveDate: string }) =>
    apiClient.post<SafetyPolicy>('/management-system/safety-policies', data).then((r) => r.data),

  listSafetyPolicies: (organizationId: string) =>
    apiClient.get<SafetyPolicy[]>('/management-system/safety-policies', { params: { organizationId } }).then((r) => r.data),

  signSafetyPolicy: (id: string, personnelId: string) =>
    apiClient.post<SafetyPolicy>(`/management-system/safety-policies/${id}/sign`, { personnelId }).then((r) => r.data),

  // ---- 3.2.2 变更管理 MOC ----

  createMoc: (data: { organizationId: string; changeDescription: string }) =>
    apiClient.post<ManagementOfChange>('/management-system/mocs', data).then((r) => r.data),

  listMocs: (organizationId: string) =>
    apiClient.get<ManagementOfChange[]>('/management-system/mocs', { params: { organizationId } }).then((r) => r.data),

  attachRiskAssessmentToMoc: (id: string, riskAssessmentId: string) =>
    apiClient.post<ManagementOfChange>(`/management-system/mocs/${id}/risk-assessment`, { riskAssessmentId }).then((r) => r.data),

  implementMoc: (id: string, implementationPlan: string) =>
    apiClient.post<ManagementOfChange>(`/management-system/mocs/${id}/implement`, { implementationPlan }).then((r) => r.data),

  verifyMoc: (id: string, verificationNotes: string) =>
    apiClient.post<ManagementOfChange>(`/management-system/mocs/${id}/verify`, { verificationNotes }).then((r) => r.data),

  // ---- 3.2.2 应急响应计划 ERP ----

  addErpPlan: (data: { organizationId: string; version: string; planText: string; effectiveDate: string }) =>
    apiClient.post<EmergencyResponsePlan>('/management-system/erp-plans', data).then((r) => r.data),

  listErpPlans: (organizationId: string) =>
    apiClient.get<EmergencyResponsePlan[]>('/management-system/erp-plans', { params: { organizationId } }).then((r) => r.data),

  recordErpDrill: (erpId: string, data: { drilledAt: string; scenario: string; outcome?: string }) =>
    apiClient.post<ErpDrill>(`/management-system/erp-plans/${erpId}/drills`, data).then((r) => r.data),

  findErpDrillsDueSoon: () =>
    apiClient.get<ErpDrillDueSoonItem[]>('/management-system/erp-plans/drills/due-soon').then((r) => r.data),

  // ---- 3.2.2 安全绩效指标 SPI/SPT ----

  createIndicator: (data: { organizationId: string; name: string; description?: string; targetValue: number; direction?: SpiDirection }) =>
    apiClient.post<SafetyIndicatorWithStatus>('/management-system/safety-indicators', data).then((r) => r.data),

  listIndicatorsWithStatus: (organizationId: string) =>
    apiClient
      .get<SafetyIndicatorWithStatus[]>('/management-system/safety-indicators', { params: { organizationId } })
      .then((r) => r.data),

  recordMeasurement: (indicatorId: string, data: { periodStart: string; periodEnd: string; value: number }) =>
    apiClient.post(`/management-system/safety-indicators/${indicatorId}/measurements`, data).then((r) => r.data),

  // ---- 3.2.2 安全评审委员会 ----

  createSrbMeeting: (data: { organizationId: string; meetingDate: string; attendeeRoles: string[]; agenda: string; decisions?: string }) =>
    apiClient.post<SrbMeeting>('/management-system/srb-meetings', data).then((r) => r.data),

  listSrbMeetings: (organizationId: string) =>
    apiClient.get<SrbMeeting[]>('/management-system/srb-meetings', { params: { organizationId } }).then((r) => r.data),

  addSrbAction: (meetingId: string, data: { description: string; responsiblePersonnelId?: string; dueDate?: string }) =>
    apiClient.post<SrbAction>(`/management-system/srb-meetings/${meetingId}/actions`, data).then((r) => r.data),

  closeSrbAction: (id: string) =>
    apiClient.post<SrbAction>(`/management-system/srb-actions/${id}/close`).then((r) => r.data),

  // ---- 3.2.5 承包活动管理 ----

  createContract: (data: { organizationId: string; contractorName: string; scope: string; agreementRef?: string }) =>
    apiClient.post<ContractRecord>('/management-system/contracts', data).then((r) => r.data),

  listContracts: (organizationId: string) =>
    apiClient.get<ContractRecord[]>('/management-system/contracts', { params: { organizationId } }).then((r) => r.data),

  updateContract: (id: string, data: { includedInAudit?: boolean }) =>
    apiClient.post<ContractRecord>(`/management-system/contracts/${id}`, data).then((r) => r.data),
}
