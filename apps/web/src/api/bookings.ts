import { apiClient } from './client'
import type { Booking, BookingResourceType } from './types'

export const bookingsApi = {
  listByResource: (resourceType: BookingResourceType, resourceId: string) =>
    apiClient.get<Booking[]>('/bookings', { params: { resourceType, resourceId } }).then((r) => r.data),

  create: (data: {
    organizationId: string
    resourceType: BookingResourceType
    resourceId: string
    startAt: string
    endAt: string
    studentId?: string
    taskCode?: string
  }) => apiClient.post<Booking>('/bookings', data).then((r) => r.data),

  cancel: (id: string) => apiClient.post(`/bookings/${id}/cancel`).then((r) => r.data),
}
