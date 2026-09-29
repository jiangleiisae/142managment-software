import { apiClient } from './client'
import type { InstructorType, Personnel } from './types'

export const personnelApi = {
  list: () => apiClient.get<Personnel[]>('/personnel').then((r) => r.data),

  create: (data: { firstName: string; lastName: string; email?: string; phone?: string }) =>
    apiClient.post<Personnel>('/personnel', data).then((r) => r.data),

  addQualification: (
    personnelId: string,
    data: { qualificationType: string; certificateNo?: string; validUntil?: string },
  ) => apiClient.post(`/personnel/${personnelId}/qualifications`, data).then((r) => r.data),

  setInstructorProfile: (personnelId: string, instructorType: InstructorType) =>
    apiClient.post(`/personnel/${personnelId}/instructor-profile`, { instructorType }).then((r) => r.data),
}
