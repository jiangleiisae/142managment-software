import { apiClient } from './client'
import type { Course, CourseType } from './types'

export const coursesApi = {
  list: (organizationId: string) => apiClient.get<Course[]>('/courses', { params: { organizationId } }).then((r) => r.data),

  create: (data: { organizationId: string; name: string; courseType: CourseType }) =>
    apiClient.post<Course>('/courses', data).then((r) => r.data),

  approve: (id: string) => apiClient.post<Course>(`/courses/${id}/approve`).then((r) => r.data),
}
