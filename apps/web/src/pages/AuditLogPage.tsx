import { ReloadOutlined } from '@ant-design/icons'
import { Button, Input, Select, Space, Table, Tag, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AuditLogEntry } from '../api/auditLogs'
import { auditLogsApi } from '../api/auditLogs'

const { Text } = Typography

function actionColor(action: string) {
  if (action.startsWith('create')) return 'green'
  if (action.startsWith('status_change') || action === 'declare' || action === 'sign' || action === 'end') return 'blue'
  if (action.startsWith('set_') || action === 'update' || action === 'approve') return 'orange'
  if (action.startsWith('clear_') || action === 'reject' || action === 'status_change:->closed') return 'red'
  return 'default'
}

/// 仅OWNER/ADMIN可见 (见 App.tsx 的 AdminOnlyRoute, 与 UsersPage 一致)。
/// 跨模块通用审计轨迹 (ORA.GEN.220): 展示所有entityType共用的AuditLog表, 支持按类型/ID筛选。
export function AuditLogPage() {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [entityTypes, setEntityTypes] = useState<string[]>([])
  const [entityType, setEntityType] = useState<string>()
  const [entityId, setEntityId] = useState<string>()
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      setLogs(await auditLogsApi.list({ entityType, entityId: entityId || undefined }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    auditLogsApi.listEntityTypes().then(setEntityTypes)
  }, [])

  useEffect(() => {
    load()
  }, [entityType, entityId])

  return (
    <div>
      <Text type="secondary">{t('auditLog.description')}</Text>
      <Space style={{ margin: '16px 0' }}>
        <Select
          allowClear
          style={{ width: 220 }}
          placeholder={t('auditLog.filterByEntityType')}
          value={entityType}
          onChange={setEntityType}
          options={entityTypes.map((et) => ({ value: et, label: et }))}
        />
        <Input
          allowClear
          style={{ width: 220 }}
          placeholder={t('auditLog.filterByEntityId')}
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
        />
        <Button icon={<ReloadOutlined />} onClick={load}>
          {t('auditLog.refresh')}
        </Button>
      </Space>
      <Table<AuditLogEntry>
        rowKey="id"
        loading={loading}
        dataSource={logs}
        columns={[
          { title: t('auditLog.columnTime'), dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleString(), width: 180 },
          { title: t('auditLog.columnEntityType'), dataIndex: 'entityType', width: 180 },
          { title: t('auditLog.columnEntityId'), dataIndex: 'entityId', render: (v: string) => <Text code copyable={{ text: v }}>{v.slice(0, 12)}...</Text> },
          { title: t('auditLog.columnAction'), dataIndex: 'action', render: (v: string) => <Tag color={actionColor(v)}>{v}</Tag> },
        ]}
        expandable={{
          expandedRowRender: (log) => (
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>{t('auditLog.before')}</Text>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(log.beforeJson, null, 2) ?? t('auditLog.none')}</pre>
              </div>
              <div>
                <Text strong>{t('auditLog.after')}</Text>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(log.afterJson, null, 2) ?? t('auditLog.none')}</pre>
              </div>
            </Space>
          ),
        }}
      />
    </div>
  )
}
