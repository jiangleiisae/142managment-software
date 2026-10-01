import { Select, Space, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import type { Organization } from '../api/types'

interface Props {
  organizations: Organization[]
  selectedId?: string
  onChange: (id: string) => void
}

export function OrganizationSelector({ organizations, selectedId, onChange }: Props) {
  const { t } = useTranslation()
  return (
    <Space style={{ marginBottom: 16 }}>
      <Typography.Text>{t('common.currentOrganization')}</Typography.Text>
      <Select
        style={{ width: 280 }}
        value={selectedId}
        placeholder={t('common.selectOrganizationPlaceholder')}
        options={organizations.map((o) => ({ value: o.id, label: o.name }))}
        onChange={onChange}
      />
    </Space>
  )
}
