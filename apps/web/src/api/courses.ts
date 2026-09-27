import { apiClient } from './client'
import type { Course, CourseType } from './types'

export interface CourseRequirement {
  id: string
  taskCode: string
  taskName: string
  minHours?: number | null
}

export interface FstdCompatibilityResult {
  compatible: boolean
  totalRequirements: number
  missingTasks: { taskCode: string; taskName: string }[]
}

export const coursesApi = {
  list: (organizationId: string) => apiClient.get<Course[]>('/courses', { params: { organizationId } }).then((r) => r.data),

  create: (data: { organizationId: string; name: string; courseType: CourseType }) =>
    apiClient.post<Course>('/courses', data).then((r) => r.data),

  approve: (id: string) => apiClient.post<Course>(`/courses/${id}/approve`).then((r) => r.data),

  addRequirement: (courseId: string, data: { taskCode: string; taskName: string; minHours?: number }) =>
    apiClient.post<CourseRequirement>(`/courses/${courseId}/requirements`, data).then((r) => r.data),

  listRequirements: (courseId: string) =>
    apiClient.get<CourseRequirement[]>(`/courses/${courseId}/requirements`).then((r) => r.data),

  checkFstdCompatibility: (courseId: string, fstdId: string) =>
    apiClient.get<FstdCompatibilityResult>(`/courses/${courseId}/fstd-compatibility/${fstdId}`).then((r) => r.data),
}
