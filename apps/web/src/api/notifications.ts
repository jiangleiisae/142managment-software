import { apiClient } from './client'

export interface AppNotification {
  id: string
  title: string
  message: string
  entityType?: string | null
  entityId?: string | null
  readAt?: string | null
  createdAt: string
}

export const notificationsApi = {
  list: () => apiClient.get<AppNotification[]>('/notifications').then((r) => r.data),

  unreadCount: () => apiClient.get<{ count: number }>('/notifications/unread-count').then((r) => r.data.count),

  markRead: (id: string) => apiClient.post<AppNotification>(`/notifications/${id}/read`).then((r) => r.data),

  checkOverdueOccurrenceReports: () =>
    apiClient.post<{ notifiedCount: number }>('/notifications/check-overdue-occurrence-reports').then((r) => r.data),
}
