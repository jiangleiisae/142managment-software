import axios from 'axios'
import { apiClient } from './client'

export type ShareType = 'TRAINING_PLAN' | 'ROSTER'

export interface ShareInfo {
  type: ShareType
  fstdId: string | null
  enabled: boolean
  token: string | null
  createdAt: string | null
  rotatedAt: string | null
}

export const sharesApi = {
  list: (organizationId: string, fstdId?: string) => apiClient.get<ShareInfo[]>('/shares', { params: { organizationId, fstdId } }).then((r) => r.data),
  listDevices: (organizationId: string) => apiClient.get<DeviceShare[]>('/shares/devices', { params: { organizationId } }).then((r) => r.data),
  enable: (organizationId: string, type: ShareType, fstdId?: string) => apiClient.post<ShareInfo>('/shares/enable', { organizationId, type, fstdId }).then((r) => r.data),
  rotate: (organizationId: string, type: ShareType, fstdId?: string) => apiClient.post<ShareInfo>('/shares/rotate', { organizationId, type, fstdId }).then((r) => r.data),
  disable: (organizationId: string, type: ShareType, fstdId?: string) => apiClient.post<ShareInfo>('/shares/disable', { organizationId, type, fstdId }).then((r) => r.data),
}

export interface DeviceShare {
  fstdId: string
  deviceCode: string
  representedAircraft: string
  enabled: boolean
  token: string | null
}

export interface PublicPlanItem {
  deviceCode: string
  aircraft: string
  startAt: string
  endAt: string
  trainingType: string | null
  customerName: string | null
  pilotName: string | null
  instructorName: string | null
  examinerName: string | null
}

export interface PublicShareBase {
  organizationName: string
  generatedAt: string
  today: string
}

export type PublicShareData =
  | (PublicShareBase & { type: 'TRAINING_PLAN'; from: string; days: number; device: { code: string; aircraft: string } | null; groundedDates: string[]; devices: { code: string; aircraft: string }[]; items: PublicPlanItem[] })
  | (PublicShareBase & {
      type: 'ROSTER'
      month: string
      days: string[]
      shifts: { code: string; name: string; category: string; color: string; startTime: string | null; endTime: string | null; endsNextDay: boolean }[]
      rows: { name: string; groupName: string | null; cells: Record<string, string> }[]
    })

/// 公开页面专用的客户端: 不带登录凭证, 也不会在 401 时跳转登录页
const publicClient = axios.create({ baseURL: '/api' })

export const publicShareApi = {
  view: (token: string, params: { date?: string; days?: number; month?: string }) => publicClient.get<PublicShareData>(`/public/share/${token}`, { params }).then((r) => r.data),
}
