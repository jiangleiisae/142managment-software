import { apiClient } from './client'
import type { Booking, BookingResourceType } from './types'

export interface ImportBookingsResult {
  createdCount: number
  errorCount: number
  errors: { row: number; message: string }[]
  warnings?: { row: number; message: string }[]
  missingDevices?: string[]
}

export interface BookingCustomer {
  id: string
  name: string
  color: string
}

export interface PlanQuery {
  resourceId?: string
  instructor?: string
}

export const bookingsApi = {
  listPlan: (organizationId: string, from: string, to: string, query: PlanQuery = {}) =>
    apiClient.get<Booking[]>('/bookings/plan', { params: { organizationId, from, to, ...query } }).then((r) => r.data),

  exportPlan: async (organizationId: string, from: string, to: string, query: PlanQuery = {}) => {
    const res = await apiClient.get<Blob>('/bookings/plan/export', { params: { organizationId, from, to, ...query }, responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const link = document.createElement('a')
    link.href = url
    link.download = 'training-plan.xlsx'
    link.click()
    URL.revokeObjectURL(url)
  },

  listCustomers: (organizationId: string) =>
    apiClient.get<BookingCustomer[]>('/bookings/customers', { params: { organizationId } }).then((r) => r.data),

  setCustomers: (organizationId: string, customers: { name: string; color: string }[]) =>
    apiClient.post<BookingCustomer[]>('/bookings/customers', { organizationId, customers }).then((r) => r.data),


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
