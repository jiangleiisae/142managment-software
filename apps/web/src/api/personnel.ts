import { apiClient } from './client'
import type { InstructorInitialTraining, InstructorInitialTrainingItem, InstructorType, Personnel } from './types'

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

  // ---- CCAR-142第142.61条(c)款: 教员初始培训 ----

  listInitialTrainingItems: () => apiClient.get<string[]>('/personnel/initial-training/checklist').then((r) => r.data),

  getInitialTraining: (personnelId: string) =>
    apiClient.get<InstructorInitialTraining>(`/personnel/${personnelId}/initial-training`).then((r) => r.data),

  upsertInitialTraining: (
    personnelId: string,
    data: {
      completedAt?: string
      totalHours?: number
      items?: InstructorInitialTrainingItem[]
      writtenExamPassed?: boolean
      writtenExamDate?: string
    },
  ) => apiClient.post<InstructorInitialTraining>(`/personnel/${personnelId}/initial-training`, data).then((r) => r.data),
}
