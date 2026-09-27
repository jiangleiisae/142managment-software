import { apiClient } from './client'

export type InfoAssetCriticality = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface InfoSecurityMitigationAction {
  id: string
  riskAssessmentId: string
  description: string
  responsiblePersonnelId?: string | null
  dueDate?: string | null
  status: string
}

export interface InfoSecurityRiskAssessment {
  id: string
  assetId: string
  likelihoodLevel: number
  impactLevel: number
  riskScore: number
  existingControls?: string | null
  residualRiskLevel?: number | null
  mitigations?: InfoSecurityMitigationAction[]
}

export interface InformationAsset {
  id: string
  organizationId: string
  name: string
  category: string
  criticality: InfoAssetCriticality
  ownerPersonnelId?: string | null
  description?: string | null
  createdAt: string
  riskAssessments?: InfoSecurityRiskAssessment[]
}

export type InfoSecurityIncidentStatus = 'OPEN' | 'CONTAINED' | 'RESOLVED'

export interface InfoSecurityIncident {
  id: string
  organizationId: string
  discoveredAt: string
  incidentType: string
  description: string
  affectedAssetId?: string | null
  affectedAsset?: { name: string } | null
  severity: number
  status: InfoSecurityIncidentStatus
  responseActions?: string | null
  containedAt?: string | null
  resolvedAt?: string | null
}

export const ismsApi = {
  createAsset: (data: {
    organizationId: string
    name: string
    category: string
    criticality?: InfoAssetCriticality
    ownerPersonnelId?: string
    description?: string
  }) => apiClient.post<InformationAsset>('/isms/assets', data).then((r) => r.data),

  listAssets: (organizationId: string) =>
    apiClient.get<InformationAsset[]>('/isms/assets', { params: { organizationId } }).then((r) => r.data),

  assessRisk: (
    assetId: string,
    data: { likelihoodLevel: number; impactLevel: number; existingControls?: string },
  ) => apiClient.post<InfoSecurityRiskAssessment>(`/isms/assets/${assetId}/risk-assessments`, data).then((r) => r.data),

  addMitigationAction: (riskAssessmentId: string, data: { description: string; dueDate?: string }) =>
    apiClient.post<InfoSecurityMitigationAction>(`/isms/risk-assessments/${riskAssessmentId}/mitigation-actions`, data).then((r) => r.data),

  closeMitigationAction: (id: string) =>
    apiClient.post<InfoSecurityMitigationAction>(`/isms/mitigation-actions/${id}/close`).then((r) => r.data),

  listOpenHighRisks: () => apiClient.get<InfoSecurityRiskAssessment[]>('/isms/risks/open-high').then((r) => r.data),

  reportIncident: (data: {
    organizationId: string
    discoveredAt: string
    incidentType: string
    description: string
    affectedAssetId?: string
    severity: number
  }) => apiClient.post<InfoSecurityIncident>('/isms/incidents', data).then((r) => r.data),

  listIncidents: (organizationId: string) =>
    apiClient.get<InfoSecurityIncident[]>('/isms/incidents', { params: { organizationId } }).then((r) => r.data),

  listOpenIncidents: () => apiClient.get<InfoSecurityIncident[]>('/isms/incidents/open').then((r) => r.data),

  containIncident: (id: string, responseActions: string) =>
    apiClient.post<InfoSecurityIncident>(`/isms/incidents/${id}/contain`, { responseActions }).then((r) => r.data),

  resolveIncident: (id: string) => apiClient.post<InfoSecurityIncident>(`/isms/incidents/${id}/resolve`).then((r) => r.data),
}
