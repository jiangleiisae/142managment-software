import { apiClient } from './client'
import type { Student } from './types'

export const studentsApi = {
  list: (organizationId: string) => apiClient.get<Student[]>('/students', { params: { organizationId } }).then((r) => r.data),

  create: (data: { organizationId: string; firstName: string; lastName: string; licenceNo?: string; medicalCertExpiry?: string }) =>
    apiClient.post<Student>('/students', data).then((r) => r.data),

  enroll: (studentId: string, courseId: string) =>
    apiClient.post(`/students/${studentId}/enroll`, { courseId }).then((r) => r.data),
}
