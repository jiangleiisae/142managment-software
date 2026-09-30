import { apiClient } from './client'
import type { UserRole } from './auth'

export type Permission =
  | 'ORGANIZATION'
  | 'MANAGEMENT_SYSTEM'
  | 'FSTD'
  | 'INVENTORY'
  | 'PERSONNEL'
  | 'COURSES'
  | 'STUDENTS'
  | 'SCHEDULING'
  | 'ISMS'

export interface ManagedUser {
  id: string
  email: string
  role: UserRole
  permissions: Permission[]
  isActive: boolean
  personnelId?: string | null
  createdAt: string
}

export const usersApi = {
  list: () => apiClient.get<ManagedUser[]>('/users').then((r) => r.data),

  create: (data: { email: string; password: string; role: 'ADMIN' | 'STAFF'; permissions: Permission[] }) =>
    apiClient.post<ManagedUser>('/users', data).then((r) => r.data),

  update: (id: string, data: { role?: 'ADMIN' | 'STAFF'; permissions?: Permission[]; isActive?: boolean }) =>
    apiClient.patch<ManagedUser>(`/users/${id}`, data).then((r) => r.data),

  resetPassword: (id: string, newPassword: string) =>
    apiClient.post<{ success: boolean }>(`/users/${id}/reset-password`, { newPassword }).then((r) => r.data),

  linkPersonnel: (id: string, personnelId: string) =>
    apiClient.post<ManagedUser>(`/users/${id}/link-personnel`, { personnelId }).then((r) => r.data),

  unlinkPersonnel: (id: string) => apiClient.post<ManagedUser>(`/users/${id}/unlink-personnel`).then((r) => r.data),
}
