import { apiClient } from './client'
import type { Organization, OrganizationCertificate } from './types'

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
}
