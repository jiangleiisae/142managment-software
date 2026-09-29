import { apiClient } from './client'

export interface AuditLogEntry {
  id: string
  entityType: string
  entityId: string
  action: string
  actorId?: string | null
  beforeJson?: unknown
  afterJson?: unknown
  createdAt: string
}

export const auditLogsApi = {
  list: (filters?: { entityType?: string; entityId?: string }) =>
    apiClient.get<AuditLogEntry[]>('/audit-logs', { params: filters }).then((r) => r.data),

  listEntityTypes: () => apiClient.get<string[]>('/audit-logs/entity-types').then((r) => r.data),
}
