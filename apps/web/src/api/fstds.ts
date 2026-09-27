import { apiClient } from './client'
import type { Fstd, FstdDeviceType, FstdQualificationBasisType, LegacyLevel } from './types'

export type FcsCharacteristic = 'FDK' | 'CLH' | 'CLO' | 'SYS' | 'GND' | 'IGE' | 'OGE' | 'SND' | 'VIB' | 'MTN' | 'VIS' | 'NAV' | 'ATM' | 'OST'
export type FcsFidelityLevel = 'N' | 'G' | 'R' | 'S'

export interface FstdFcsCapability {
  id: string
  fstdId: string
  characteristic: FcsCharacteristic
  fidelityLevel: FcsFidelityLevel
  subsystem?: string | null
  isAssigned: boolean
}

export interface TrainingMatrixEntry {
  id: string
  taskCode: string
  taskName: string
  characteristic: FcsCharacteristic
  thresholdT: FcsFidelityLevel
  thresholdTP: FcsFidelityLevel
}

export interface TaskCapabilityResult {
  eligible: boolean
  basis: FstdQualificationBasisType
  reason?: string
  missingCharacteristics?: { characteristic: FcsCharacteristic; required: FcsFidelityLevel; actual: FcsFidelityLevel | null }[]
}

export interface RecurrentEvaluation {
  id: string
  periodStart: string
  periodEnd: string
  evaluationType: string
  result?: string | null
  nextDueDate?: string | null
}

export interface FstdChangeRequest {
  id: string
  changeType: string
  description?: string | null
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  notifiedAuthorityAt?: string | null
  createdAt: string
}

export interface EvaluationDueSoonItem {
  fstdId: string
  deviceCode: string
  nextDueDate?: string | null
  lastResult?: string | null
}

export interface SafetyFacilityCheckItem {
  item: string
  passed: boolean
  notes?: string
}

export interface SafetyFacilityCheck {
  id: string
  fstdId: string
  checkedAt: string
  checkedById?: string | null
  itemsJson: SafetyFacilityCheckItem[]
  overallResult: 'pass' | 'issues_found'
  nextDueDate: string
  createdAt: string
}

export interface SafetyCheckDueSoonItem {
  fstdId: string
  deviceCode: string
  nextDueDate?: string | null
  lastResult?: string | null
}

export type QtgDocumentType = 'SOC' | 'VDR' | 'MQTG'

export interface QtgDocument {
  id: string
  fstdId: string
  documentType: QtgDocumentType
  version: string
  effectiveDate: string
  pointerUrl?: string | null
  originalFileName?: string | null
  mimeType?: string | null
  fileSize?: number | null
  supersededAt?: string | null
  createdAt: string
}

export interface QuarterlyQtgRun {
  id: string
  fstdId: string
  year: number
  quarter: number
  completedAt?: string | null
  result?: string | null
  notes?: string | null
  burstTested: boolean
}

export interface QuarterlyQtgIssue {
  fstdId: string
  deviceCode: string
  year: number
  quarter: number
  issueType: 'overdue' | 'burst_tested'
}

export interface Discrepancy {
  id: string
  fstdId: string
  reportedById?: string | null
  reportedAt: string
  description: string
  isMmi: boolean
  severityRating?: number | null
  trainingTimeLostMinutes?: number | null
  correctiveAction?: string | null
  correctedById?: string | null
  correctedAt?: string | null
  status: 'open' | 'corrected'
  dueDate?: string | null
  fstd?: { deviceCode: string }
}

export const fstdsApi = {
  list: (organizationId: string) => apiClient.get<Fstd[]>('/fstds', { params: { organizationId } }).then((r) => r.data),

  get: (id: string) => apiClient.get<Fstd>(`/fstds/${id}`).then((r) => r.data),

  create: (data: {
    organizationId: string
    deviceCode: string
    representedAircraft: string
    deviceType: FstdDeviceType
    legacyLevel?: LegacyLevel
    qualificationBasisType?: FstdQualificationBasisType
  }) => apiClient.post<Fstd>('/fstds', data).then((r) => r.data),

  addQualifiedTask: (fstdId: string, data: { taskCode: string; taskName: string }) =>
    apiClient.post(`/fstds/${fstdId}/qualified-tasks`, data).then((r) => r.data),

  canPerformTask: (fstdId: string, taskCode: string) =>
    apiClient.get<TaskCapabilityResult>(`/fstds/${fstdId}/can-perform/${taskCode}`).then((r) => r.data),

  // ---- 3.3.2 FCS能力矩阵 ----

  setFcsCapability: (
    fstdId: string,
    data: { characteristic: FcsCharacteristic; fidelityLevel: FcsFidelityLevel; subsystem?: string; isAssigned?: boolean },
  ) => apiClient.post<FstdFcsCapability>(`/fstds/${fstdId}/fcs-capabilities`, data).then((r) => r.data),

  listFcsCapabilities: (fstdId: string) =>
    apiClient.get<FstdFcsCapability[]>(`/fstds/${fstdId}/fcs-capabilities`).then((r) => r.data),

  // ---- 3.3.3 训练矩阵 (全局配置表) ----

  addTrainingMatrixEntry: (data: {
    taskCode: string
    taskName: string
    characteristic: FcsCharacteristic
    thresholdT: FcsFidelityLevel
    thresholdTP: FcsFidelityLevel
  }) => apiClient.post<TrainingMatrixEntry>('/fstds/training-matrix-entries', data).then((r) => r.data),

  listTrainingMatrixEntries: (taskCode?: string) =>
    apiClient
      .get<TrainingMatrixEntry[]>('/fstds/training-matrix-entries', { params: taskCode ? { taskCode } : undefined })
      .then((r) => r.data),

  reportDiscrepancy: (
    fstdId: string,
    data: {
      description: string
      isMmi?: boolean
      reportedById?: string
      severityRating?: number
      trainingTimeLostMinutes?: number
    },
  ) => apiClient.post<Discrepancy>(`/fstds/${fstdId}/discrepancies`, data).then((r) => r.data),

  listDiscrepancies: (fstdId: string) =>
    apiClient.get<Discrepancy[]>(`/fstds/${fstdId}/discrepancies`).then((r) => r.data),

  findOverdueDiscrepancies: () =>
    apiClient.get<Discrepancy[]>('/fstds/discrepancies/overdue').then((r) => r.data),

  correctDiscrepancy: (discrepancyId: string, data: { correctiveAction: string; correctedById?: string }) =>
    apiClient.post<Discrepancy>(`/fstds/discrepancies/${discrepancyId}/correct`, data).then((r) => r.data),

  // ---- 3.3.8 安全设施年检 ----

  recordSafetyFacilityCheck: (
    fstdId: string,
    data: { checkedAt: string; checkedById?: string; items: SafetyFacilityCheckItem[] },
  ) => apiClient.post<SafetyFacilityCheck>(`/fstds/${fstdId}/safety-facility-checks`, data).then((r) => r.data),

  listSafetyFacilityChecks: (fstdId: string) =>
    apiClient.get<SafetyFacilityCheck[]>(`/fstds/${fstdId}/safety-facility-checks`).then((r) => r.data),

  findSafetyChecksDueSoon: (withinDays = 60) =>
    apiClient
      .get<SafetyCheckDueSoonItem[]>('/fstds/safety-facility-checks/due-soon', { params: { withinDays } })
      .then((r) => r.data),

  // ---- 3.3.4 QTG/MQTG生命周期 ----

  addQtgDocument: (
    fstdId: string,
    data: { documentType: QtgDocumentType; version: string; effectiveDate: string; pointerUrl?: string; file?: File },
  ) => {
    const form = new FormData()
    form.append('documentType', data.documentType)
    form.append('version', data.version)
    form.append('effectiveDate', data.effectiveDate)
    if (data.pointerUrl) form.append('pointerUrl', data.pointerUrl)
    if (data.file) form.append('file', data.file)
    return apiClient.post<QtgDocument>(`/fstds/${fstdId}/qtg-documents`, form).then((r) => r.data)
  },

  downloadQtgDocumentFile: async (doc: QtgDocument) => {
    const res = await apiClient.get(`/fstds/qtg-documents/${doc.id}/file`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data as Blob)
    const link = document.createElement('a')
    link.href = url
    link.download = doc.originalFileName ?? doc.version
    link.click()
    URL.revokeObjectURL(url)
  },

  listQtgDocuments: (fstdId: string) =>
    apiClient.get<QtgDocument[]>(`/fstds/${fstdId}/qtg-documents`).then((r) => r.data),

  recordQuarterlyQtgRun: (
    fstdId: string,
    data: { year: number; quarter: number; completedAt?: string; result?: string; notes?: string },
  ) => apiClient.post<QuarterlyQtgRun>(`/fstds/${fstdId}/qtg-quarterly-runs`, data).then((r) => r.data),

  listQuarterlyQtgRuns: (fstdId: string) =>
    apiClient.get<QuarterlyQtgRun[]>(`/fstds/${fstdId}/qtg-quarterly-runs`).then((r) => r.data),

  findQuarterlyQtgIssues: () =>
    apiClient.get<QuarterlyQtgIssue[]>('/fstds/qtg-quarterly-runs/issues').then((r) => r.data),

  // ---- 3.3.5 周期性评估 ----

  recordRecurrentEvaluation: (fstdId: string, data: { periodStart: string; periodEnd: string; result?: string }) =>
    apiClient.post<RecurrentEvaluation>(`/fstds/${fstdId}/recurrent-evaluations`, data).then((r) => r.data),

  listRecurrentEvaluations: (fstdId: string) =>
    apiClient.get<RecurrentEvaluation[]>(`/fstds/${fstdId}/recurrent-evaluations`).then((r) => r.data),

  listEvaluationsDueSoon: (withinDays = 60) =>
    apiClient.get<EvaluationDueSoonItem[]>('/fstds/evaluations/due-soon', { params: { withinDays } }).then((r) => r.data),

  // ---- 3.3.6 变更管理 ----

  createChangeRequest: (fstdId: string, data: { changeType: string; description?: string }) =>
    apiClient.post<FstdChangeRequest>(`/fstds/${fstdId}/change-requests`, data).then((r) => r.data),

  listChangeRequests: (fstdId: string) =>
    apiClient.get<FstdChangeRequest[]>(`/fstds/${fstdId}/change-requests`).then((r) => r.data),

  submitChangeRequest: (crId: string) =>
    apiClient.post<FstdChangeRequest>(`/fstds/change-requests/${crId}/submit`).then((r) => r.data),

  approveChangeRequest: (crId: string) =>
    apiClient.post<FstdChangeRequest>(`/fstds/change-requests/${crId}/approve`).then((r) => r.data),

  rejectChangeRequest: (crId: string) =>
    apiClient.post<FstdChangeRequest>(`/fstds/change-requests/${crId}/reject`).then((r) => r.data),
}
