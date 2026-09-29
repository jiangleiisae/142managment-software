import { ReloadOutlined } from '@ant-design/icons'
import { Button, Input, Select, Space, Table, Tag, Typography } from 'antd'
import { useEffect, useState } from 'react'
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
      <Text type="secondary">
        全系统审计轨迹 (ORA.GEN.220): 记录所有会覆盖既有记录的创建/更新/状态流转操作, 供合规追溯"谁在何时改了什么"。
      </Text>
      <Space style={{ margin: '16px 0' }}>
        <Select
          allowClear
          style={{ width: 220 }}
          placeholder="按实体类型筛选"
          value={entityType}
          onChange={setEntityType}
          options={entityTypes.map((t) => ({ value: t, label: t }))}
        />
        <Input
          allowClear
          style={{ width: 220 }}
          placeholder="按实体ID筛选"
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
        />
        <Button icon={<ReloadOutlined />} onClick={load}>
          刷新
        </Button>
      </Space>
      <Table<AuditLogEntry>
        rowKey="id"
        loading={loading}
        dataSource={logs}
        columns={[
          { title: '时间', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleString(), width: 180 },
          { title: '实体类型', dataIndex: 'entityType', width: 180 },
          { title: '实体ID', dataIndex: 'entityId', render: (v: string) => <Text code copyable={{ text: v }}>{v.slice(0, 12)}...</Text> },
          { title: '操作', dataIndex: 'action', render: (v: string) => <Tag color={actionColor(v)}>{v}</Tag> },
        ]}
        expandable={{
          expandedRowRender: (log) => (
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>变更前: </Text>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(log.beforeJson, null, 2) ?? '(无)'}</pre>
              </div>
              <div>
                <Text strong>变更后: </Text>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(log.afterJson, null, 2) ?? '(无)'}</pre>
              </div>
            </Space>
          ),
        }}
      />
    </div>
  )
}
