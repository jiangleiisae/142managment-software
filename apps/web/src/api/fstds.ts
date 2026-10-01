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
  basis: FstdQualificationBasisType
  canStartTraining: boolean
  canCompleteTraining: boolean
  reason?: string
  missingForStart?: { characteristic: FcsCharacteristic; required: FcsFidelityLevel; actual: FcsFidelityLevel | null }[]
  missingForCompletion?: { characteristic: FcsCharacteristic; required: FcsFidelityLevel; actual: FcsFidelityLevel | null }[]
}

export interface RecurrentEvaluation {
  id: string
  periodStart: string
  periodEnd: string
  evaluationType: string
  result?: string | null
  nextDueDate?: string | null
  isWithinWindow: boolean | null
}

export interface ExtensionEligibility {
  has36MonthsCompliantRecord: boolean
  hasAnnualManagementAudit: boolean
  requiresManualSelfAssessmentConfirmation: boolean
}

export interface FstdQmsChecklistItem {
  item: string
  compliant: boolean
  notes?: string
}

export interface FstdQms {
  id?: string
  organizationId?: string
  establishedAt?: string | null
  designatedManagerName?: string | null
  itemsJson?: FstdQmsChecklistItem[]
  lastInternalAuditAt?: string | null
  isEstablished: boolean
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

export interface PreFlightCheckItem {
  item: string
  passed: boolean
  notes?: string
}

export interface PreFlightCheck {
  id: string
  fstdId: string
  checkDate: string
  performedById?: string | null
  itemsJson: PreFlightCheckItem[]
  overallResult: 'pass' | 'issues_found'
  nextDueDate: string
  createdAt: string
}

export interface PreFlightCheckDueSoonItem {
  fstdId: string
  deviceCode: string
  nextDueDate?: string | null
  lastResult?: string | null
}

export interface EslFeatureEntry {
  id: string
  eslId: string
  characteristic: FcsCharacteristic
  fidelityLevel?: FcsFidelityLevel | null
  equipmentDescription?: string | null
  limitations?: string | null
}

export interface EquipmentSpecificationList {
  id: string
  fstdId: string
  revisionNumber: string
  revisionDate: string
  declaredById?: string | null
  declaredAt?: string | null
  supersededAt?: string | null
  createdAt: string
  entries: EslFeatureEntry[]
}

export interface FstdPerformanceMetric {
  id: string
  fstdId: string
  year: number
  month: number
  plannedAvailableHours: number
  scheduledTrainingHours: number
  supportHours: number
  fstdFailureHours: number
  externalFailureHours: number
  lostTrainingHours: number
  discrepancyCount: number
  interruptionCount: number
  downtimeHours: number
  availabilityPercent: number | null
  reliabilityPercent: number | null
  createdAt: string
}

export interface PerformanceMetricsSummary {
  monthly: FstdPerformanceMetric[]
  last12Months: {
    monthCount: number
    plannedAvailableHours: number
    scheduledTrainingHours: number
    supportHours: number
    fstdFailureHours: number
    externalFailureHours: number
    downtimeHours: number
    lostTrainingHours: number
    discrepancyCount: number
    interruptionCount: number
    availabilityPercent: number | null
    reliabilityPercent: number | null
  }
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

export type RetentionCategory = 'CATEGORY_I' | 'CATEGORY_II' | 'CATEGORY_III'

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
  retentionCategory?: RetentionCategory | null
  retentionJustification?: string | null
  retentionApprovedById?: string | null
  retentionApprovedAt?: string | null
  retentionExpiresAt?: string | null
  fstd?: { deviceCode: string }
}

export type PmCheckLevel = 'WEEKLY' | 'MONTHLY' | 'SEMI_ANNUAL' | 'ANNUAL'

export interface PmChecklistTemplate {
  id: string
  level: PmCheckLevel
  itemsJson: { item: string }[]
  updatedAt: string
}

export type PmTaskStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'

export interface PmTask {
  id: string
  fstdId: string
  level: PmCheckLevel
  taskDate: string
  performedById?: string | null
  responsibleIds: string[]
  itemResultsJson: { item: string; passed: boolean; notes?: string }[]
  status: PmTaskStatus
  reviewedById?: string | null
  reviewedAt?: string | null
  reviewNotes?: string | null
  createdAt: string
}

export interface PmTaskDueSoonItem {
  fstdId: string
  deviceCode: string
  level: PmCheckLevel
  nextDueDate?: string | null
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
    isLargeAircraftPublicTransport?: boolean
  }) => apiClient.post<Fstd>('/fstds', data).then((r) => r.data),

  update: (id: string, data: { isLargeAircraftPublicTransport?: boolean }) =>
    apiClient.post<Fstd>(`/fstds/${id}`, data).then((r) => r.data),

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

  listOpenDiscrepanciesForOrg: (organizationId: string) =>
    apiClient.get<Discrepancy[]>('/fstds/discrepancies/open', { params: { organizationId } }).then((r) => r.data),

  // ---- 故障保留分级 (吸收天津飞安实践) ----

  setDiscrepancyRetention: (
    discrepancyId: string,
    data: { category: RetentionCategory; justification: string; approvedById: string; expiresAt?: string },
  ) => apiClient.post<Discrepancy>(`/fstds/discrepancies/${discrepancyId}/retention`, data).then((r) => r.data),

  clearDiscrepancyRetention: (discrepancyId: string) =>
    apiClient.post<Discrepancy>(`/fstds/discrepancies/${discrepancyId}/retention/clear`).then((r) => r.data),

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

  // ---- CCAR-60第60.37条(a)(2)(3): 飞行前功能检查 (每日使用前 + 每7日保底) ----

  listPreFlightCheckItems: () => apiClient.get<string[]>('/fstds/pre-flight-checks/checklist').then((r) => r.data),

  recordPreFlightCheck: (fstdId: string, data: { checkDate: string; performedById?: string; items: PreFlightCheckItem[] }) =>
    apiClient.post<PreFlightCheck>(`/fstds/${fstdId}/pre-flight-checks`, data).then((r) => r.data),

  listPreFlightChecks: (fstdId: string) =>
    apiClient.get<PreFlightCheck[]>(`/fstds/${fstdId}/pre-flight-checks`).then((r) => r.data),

  findPreFlightChecksDueSoon: (withinDays = 2) =>
    apiClient
      .get<PreFlightCheckDueSoonItem[]>('/fstds/pre-flight-checks/due-soon', { params: { withinDays } })
      .then((r) => r.data),

  // ---- 装备规格清单 ESL (AMC1/AMC2 ORA.FSTD.120) ----

  createEslRevision: (
    fstdId: string,
    data: {
      revisionNumber: string
      revisionDate: string
      entries: { characteristic: FcsCharacteristic; fidelityLevel?: FcsFidelityLevel; equipmentDescription?: string; limitations?: string }[]
    },
  ) => apiClient.post<EquipmentSpecificationList>(`/fstds/${fstdId}/esl`, data).then((r) => r.data),

  listEsls: (fstdId: string) =>
    apiClient.get<EquipmentSpecificationList[]>(`/fstds/${fstdId}/esl`).then((r) => r.data),

  declareEsl: (eslId: string, personnelId: string) =>
    apiClient.post<EquipmentSpecificationList>(`/fstds/esl/${eslId}/declare`, { personnelId }).then((r) => r.data),

  // ---- FSTD性能指标 (AMC1 ORA.FSTD.100(d)) ----

  recordPerformanceMetric: (
    fstdId: string,
    data: {
      year: number
      month: number
      plannedAvailableHours: number
      scheduledTrainingHours: number
      supportHours: number
      fstdFailureHours: number
      externalFailureHours: number
      lostTrainingHours: number
      discrepancyCount: number
      interruptionCount: number
    },
  ) => apiClient.post<FstdPerformanceMetric>(`/fstds/${fstdId}/performance-metrics`, data).then((r) => r.data),

  getPerformanceMetrics: (fstdId: string) =>
    apiClient.get<PerformanceMetricsSummary>(`/fstds/${fstdId}/performance-metrics`).then((r) => r.data),

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

  recordRecurrentEvaluation: (
    fstdId: string,
    data: { periodStart: string; periodEnd: string; evaluationType?: string; extensionMonths?: number; result?: string },
  ) => apiClient.post<RecurrentEvaluation>(`/fstds/${fstdId}/recurrent-evaluations`, data).then((r) => r.data),

  listRecurrentEvaluations: (fstdId: string) =>
    apiClient.get<RecurrentEvaluation[]>(`/fstds/${fstdId}/recurrent-evaluations`).then((r) => r.data),

  checkExtensionEligibility: (fstdId: string) =>
    apiClient.get<ExtensionEligibility>(`/fstds/${fstdId}/recurrent-evaluations/extension-eligibility`).then((r) => r.data),

  listEvaluationsDueSoon: (withinDays = 60) =>
    apiClient.get<EvaluationDueSoonItem[]>('/fstds/evaluations/due-soon', { params: { withinDays } }).then((r) => r.data),

  // ---- CCAR-60 附录B: FSTD质量管理系统 (机构级) ----

  listQmsChecklistItems: () => apiClient.get<string[]>('/fstds/qms/checklist').then((r) => r.data),

  getQms: (organizationId: string) => apiClient.get<FstdQms>('/fstds/qms', { params: { organizationId } }).then((r) => r.data),

  upsertQms: (data: {
    organizationId: string
    establishedAt?: string
    designatedManagerName?: string
    items?: FstdQmsChecklistItem[]
    lastInternalAuditAt?: string
  }) => apiClient.post<FstdQms>('/fstds/qms', data).then((r) => r.data),

  // 3.3.6 变更管理已迁移至通用 changeRequestsApi (entityType='Fstd'), 见 api/changeRequests.ts

  // ---- 3.3.10 常规维护(PM)排期 ----

  setPmChecklistTemplate: (data: { organizationId: string; level: PmCheckLevel; itemsJson: { item: string }[] }) =>
    apiClient.post<PmChecklistTemplate>('/fstds/pm-checklist-templates', data).then((r) => r.data),

  listPmChecklistTemplates: (organizationId: string) =>
    apiClient.get<PmChecklistTemplate[]>('/fstds/pm-checklist-templates', { params: { organizationId } }).then((r) => r.data),

  createPmTask: (
    fstdId: string,
    data: {
      level: PmCheckLevel
      taskDate: string
      performedById?: string
      responsibleIds?: string[]
      itemResultsJson: { item: string; passed: boolean; notes?: string }[]
    },
  ) => apiClient.post<PmTask>(`/fstds/${fstdId}/pm-tasks`, data).then((r) => r.data),

  listPmTasks: (fstdId: string) => apiClient.get<PmTask[]>(`/fstds/${fstdId}/pm-tasks`).then((r) => r.data),

  reviewPmTask: (taskId: string, data: { approve: boolean; reviewedById: string; reviewNotes?: string }) =>
    apiClient.post<PmTask>(`/fstds/pm-tasks/${taskId}/review`, data).then((r) => r.data),

  findPmTasksDueSoon: (withinDays = 60) =>
    apiClient.get<PmTaskDueSoonItem[]>('/fstds/pm-tasks/due-soon', { params: { withinDays } }).then((r) => r.data),
}
