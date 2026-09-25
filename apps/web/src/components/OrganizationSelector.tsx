import { Select, Space, Typography } from 'antd'
import type { Organization } from '../api/types'

interface Props {
  organizations: Organization[]
  selectedId?: string
  onChange: (id: string) => void
}

export function OrganizationSelector({ organizations, selectedId, onChange }: Props) {
  return (
    <Space style={{ marginBottom: 16 }}>
      <Typography.Text>当前机构:</Typography.Text>
      <Select
        style={{ width: 280 }}
        value={selectedId}
        placeholder="请选择机构 (先到「机构与证书」创建)"
        options={organizations.map((o) => ({ value: o.id, label: o.name }))}
        onChange={onChange}
      />
    </Space>
  )
}
