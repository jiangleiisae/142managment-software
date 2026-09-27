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

export interface TrainingRecord {
  id: string
  enrollmentId: string
  courseRequirementId?: string | null
  sessionDate: string
  subject: string
  progressNotes?: string | null
  testScore?: string | null
  assessedById?: string | null
  courseRequirement?: { taskCode: string; taskName: string } | null
}

export interface ProgressCardItem {
  courseRequirementId: string
  taskCode: string
  taskName: string
  minHours?: number | null
  completed: boolean
  latestSessionDate?: string | null
  latestTestScore?: string | null
  recordCount: number
}

export interface ProgressCard {
  enrollmentId: string
  totalRequirements: number
  completedCount: number
  completionRate: number | null
  items: ProgressCardItem[]
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

  listTrainingRecords: (enrollmentId: string) =>
    apiClient.get<TrainingRecord[]>(`/students/enrollments/${enrollmentId}/training-records`).then((r) => r.data),

  addTrainingRecord: (
    enrollmentId: string,
    data: {
      sessionDate: string
      subject: string
      progressNotes?: string
      testScore?: string
      assessedById?: string
      courseRequirementId?: string
    },
  ) => apiClient.post<TrainingRecord>(`/students/enrollments/${enrollmentId}/training-records`, data).then((r) => r.data),

  getProgressCard: (enrollmentId: string) =>
    apiClient.get<ProgressCard>(`/students/enrollments/${enrollmentId}/progress-card`).then((r) => r.data),
}
