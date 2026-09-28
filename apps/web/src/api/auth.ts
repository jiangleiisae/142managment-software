import { apiClient } from './client'
import type { Permission } from './users'

export type UserRole = 'OWNER' | 'ADMIN' | 'STAFF'

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  permissions: Permission[]
}

interface AuthResponse {
  accessToken: string
  user: AuthUser
}

export const authApi = {
  register: (data: { tenantName: string; email: string; password: string }) =>
    apiClient.post<AuthResponse>('/auth/register', data).then((r) => r.data),

  login: (data: { email: string; password: string }) =>
    apiClient.post<AuthResponse>('/auth/login', data).then((r) => r.data),
}
