import { apiClient } from './client'
import type { Student } from './types'

export interface Enrollment {
  id: string
  studentId: string
  courseId: string
  status: 'active' | 'completed' | 'withdrawn'
  enrolledAt: string
  completedAt?: string | null
  course?: { name: string }
}

export interface StudentDetail extends Student {
  enrollments?: Enrollment[]
}

export const studentsApi = {
  list: (organizationId: string) => apiClient.get<Student[]>('/students', { params: { organizationId } }).then((r) => r.data),

  get: (id: string) => apiClient.get<StudentDetail>(`/students/${id}`).then((r) => r.data),

  create: (data: { organizationId: string; firstName: string; lastName: string; licenceNo?: string; medicalCertExpiry?: string }) =>
    apiClient.post<Student>('/students', data).then((r) => r.data),

  enroll: (studentId: string, courseId: string) =>
    apiClient.post<Enrollment>(`/students/${studentId}/enroll`, { courseId }).then((r) => r.data),

  listExpiringMedicalCerts: (withinDays = 60) =>
    apiClient.get<Student[]>('/students/expiring-medical-certs', { params: { withinDays } }).then((r) => r.data),

  completeEnrollment: (enrollmentId: string) =>
    apiClient.post<Enrollment>(`/students/enrollments/${enrollmentId}/complete`).then((r) => r.data),

  withdrawEnrollment: (enrollmentId: string) =>
    apiClient.post<Enrollment>(`/students/enrollments/${enrollmentId}/withdraw`).then((r) => r.data),
}
