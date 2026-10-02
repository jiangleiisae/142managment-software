import { apiClient } from './client'
import type { Booking, BookingResourceType } from './types'

export interface ImportBookingsResult {
  createdCount: number
  errorCount: number
  errors: { row: number; message: string }[]
  warnings?: { row: number; message: string }[]
  missingDevices?: string[]
}

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

  importExcel: (organizationId: string, file: File) => {
    const form = new FormData()
    form.append('organizationId', organizationId)
    form.append('file', file)
    return apiClient
      .post<ImportBookingsResult>(
        '/bookings/import-excel',
        form,
      )
      .then((r) => r.data)
  },
}
