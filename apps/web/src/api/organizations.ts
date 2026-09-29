import { apiClient } from './client'
import type { Organization, OrganizationCertificate } from './types'

export interface SelfReviewChecklistItem {
  item: string
  compliant: boolean
  notes?: string
}

export interface OrganisationalSelfReview {
  id: string
  organizationId: string
  year: number
  reviewedAt: string
  itemsJson: SelfReviewChecklistItem[]
  overallResult: 'compliant' | 'issues_found'
  notifiedAuthorityAt?: string | null
  createdAt: string
}

export interface OrgMissingSelfReview {
  organizationId: string
  name: string
  year: number
}

export const organizationsApi = {
  // tenantId 由后端从JWT解析, 不再由客户端传入
  list: () => apiClient.get<Organization[]>('/organizations').then((r) => r.data),

  get: (id: string) => apiClient.get<Organization>(`/organizations/${id}`).then((r) => r.data),

  create: (data: { name: string; address?: string; competentAuthority?: string; isComplexOrg?: boolean }) =>
    apiClient.post<Organization>('/organizations', data).then((r) => r.data),

  addCertificate: (
    organizationId: string,
    data: { certificateNo: string; issuedAuthority: string; approvalScope: string; issuedAt: string },
  ) => apiClient.post<OrganizationCertificate>(`/organizations/${organizationId}/certificates`, data).then((r) => r.data),

  suspendCertificate: (certId: string, reason?: string) =>
    apiClient.post<OrganizationCertificate>(`/organizations/certificates/${certId}/suspend`, { reason }).then((r) => r.data),

  restoreCertificate: (certId: string, reason?: string) =>
    apiClient.post<OrganizationCertificate>(`/organizations/certificates/${certId}/restore`, { reason }).then((r) => r.data),

  revokeCertificate: (certId: string, reason?: string) =>
    apiClient.post<OrganizationCertificate>(`/organizations/certificates/${certId}/revoke`, { reason }).then((r) => r.data),

  terminateCertificate: (certId: string, reason?: string) =>
    apiClient.post<OrganizationCertificate>(`/organizations/certificates/${certId}/terminate`, { reason }).then((r) => r.data),

  // ---- 3.2.2 非复杂机构简化路径: 年度机构自查 (GM2 ORA.GEN.200(c)) ----

  listSelfReviewChecklist: () => apiClient.get<string[]>('/organizations/self-review-checklist').then((r) => r.data),

  listSelfReviews: (organizationId: string) =>
    apiClient.get<OrganisationalSelfReview[]>(`/organizations/${organizationId}/self-reviews`).then((r) => r.data),

  recordSelfReview: (organizationId: string, data: { year: number; reviewedAt: string; items: SelfReviewChecklistItem[] }) =>
    apiClient.post<OrganisationalSelfReview>(`/organizations/${organizationId}/self-reviews`, data).then((r) => r.data),

  notifySelfReview: (reviewId: string) =>
    apiClient.post<OrganisationalSelfReview>(`/organizations/self-reviews/${reviewId}/notify`).then((r) => r.data),

  findOrgsMissingCurrentYearSelfReview: () =>
    apiClient.get<OrgMissingSelfReview[]>('/organizations/self-reviews/missing-current-year').then((r) => r.data),
}
