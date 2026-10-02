import { apiClient } from './client'

export type ReportKind = 'operational-efficiency' | 'faults' | 'pm' | 'parts'

export interface OperationalEfficiencyRow {
  fstdId: string
  deviceCode: string
  representedAircraft: string
  monthsWithData: number
  monthsExpected: number
  plannedAvailableHours: number
  scheduledTrainingHours: number
  supportHours: number
  interruptionHours: number
  fstdFailureHours: number
  externalFailureHours: number
  lostTrainingHours: number
  interruptionCount: number
  discrepancyCount: number
  interruptionRatePercent: number | null
  onTimeClosureRatePercent: number | null
  openDiscrepancyCount: number
  operatingEfficiencyPercent: number | null
  availabilityPercent: number | null
}

export interface FaultRow {
  fstdId: string
  deviceCode: string
  representedAircraft: string
  total: number
  corrected: number
  open: number
  overdueOpen: number
  mmi: number
  deferred: number
  trainingTimeLostMinutes: number
  averageSeverity: number | null
  averageRepairDays: number | null
  onTimeClosureRatePercent: number | null
}

export interface FaultDetail {
  id: string
  deviceCode: string
  reportedAt: string
  description: string
  isMmi: boolean
  status: string
  correctedAt: string | null
  correctedBy: string | null
  dueDate: string | null
  trainingTimeLostMinutes: number | null
  severityRating: number | null
}

export interface PmLevelStat {
  total: number
  approved: number
  pendingReview: number
  rejected: number
}

export interface PmRow {
  fstdId: string
  deviceCode: string
  representedAircraft: string
  total: number
  byLevel: Record<'WEEKLY' | 'MONTHLY' | 'SEMI_ANNUAL' | 'ANNUAL', PmLevelStat>
}

export interface PartRow {
  sparePartId: string
  partNumber: string
  name: string
  unit: string
  currentQuantity: number
  minQuantity: number
  belowMinimum: boolean
  received: number
  used: number
  adjustment: number
  loanedOutQuantity: number
  returnedQuantity: number
  outstandingLoanQuantity: number
  overdueLoanCount: number
  faultyRecordCount: number
  faultyQuantity: number
}

export const reportsApi = {
  operationalEfficiency: (organizationId: string, from: string, to: string) =>
    apiClient.get<{ rows: OperationalEfficiencyRow[] }>('/reports/operational-efficiency', { params: { organizationId, from, to } }).then((r) => r.data),

  faults: (organizationId: string, from: string, to: string) =>
    apiClient
      .get<{ rows: FaultRow[]; people: { personnelId: string; name: string; corrected: number }[]; details: FaultDetail[]; detailsTruncated: boolean }>('/reports/faults', { params: { organizationId, from, to } })
      .then((r) => r.data),

  pm: (organizationId: string, from: string, to: string) =>
    apiClient
      .get<{ rows: PmRow[]; people: { personnelId: string; name: string; count: number }[] }>('/reports/pm', { params: { organizationId, from, to } })
      .then((r) => r.data),

  parts: (organizationId: string, from: string, to: string) =>
    apiClient
      .get<{
        totals: { partKinds: number; usedQuantity: number; receivedQuantity: number; loanedOutQuantity: number; outstandingLoanQuantity: number; faultyQuantity: number; belowMinimumCount: number }
        rows: PartRow[]
      }>('/reports/parts', { params: { organizationId, from, to } })
      .then((r) => r.data),

  exportReport: async (kind: ReportKind, organizationId: string, from: string, to: string) => {
    const res = await apiClient.get<Blob>(`/reports/${kind}/export`, { params: { organizationId, from, to }, responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const link = document.createElement('a')
    link.href = url
    link.download = `${kind}-${from}_${to}.xlsx`
    link.click()
    URL.revokeObjectURL(url)
  },
}
