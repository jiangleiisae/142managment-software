import { PlusOutlined } from '@ant-design/icons'
import { App, Button, Form, Input, Modal, Select, Space, Switch, Table, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { organizationsApi } from '../api/organizations'
import type { Organization } from '../api/types'

export function OrganizationsPage() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const navigate = useNavigate()

  const load = () => {
    setLoading(true)
    organizationsApi
      .list()
      .then(setOrganizations)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleCreate = async () => {
    const values = await form.validateFields()
    try {
      await organizationsApi.create(values)
      message.success(t('organizations.list.createSuccess'))
      setModalOpen(false)
      form.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('organizations.list.createFailed'))
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          {t('organizations.list.createButton')}
        </Button>
      </Space>

      <Table<Organization>
        rowKey="id"
        loading={loading}
        dataSource={organizations}
        onRow={(record) => ({ onClick: () => navigate(`/organizations/${record.id}`) })}
        columns={[
          { title: t('organizations.list.columnName'), dataIndex: 'name' },
          { title: t('organizations.list.columnAuthority'), dataIndex: 'competentAuthority' },
          {
            title: t('organizations.list.columnStandard'),
            dataIndex: 'regulatoryStandard',
            render: (v: Organization['regulatoryStandard']) => (
              <Tag color={v === 'CAAC' ? 'blue' : 'default'}>{v === 'CAAC' ? t('organizations.list.standardCAAC') : t('organizations.list.standardEASA')}</Tag>
            ),
          },
          {
            title: t('organizations.list.columnComplex'),
            dataIndex: 'isComplexOrg',
            render: (v: boolean) =>
              v ? (
                <Tag color="orange">{t('organizations.list.complexTag')}</Tag>
              ) : (
                <Tag>{t('organizations.list.nonComplexTag')}</Tag>
              ),
          },
          { title: t('organizations.list.columnCreatedAt'), dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
        ]}
      />

      <Modal title={t('organizations.list.createModalTitle')} open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t('organizations.list.fieldName')} rules={[{ required: true, message: t('organizations.list.fieldNameRequired') }]}>
            <Input />
          </Form.Item>
          <Form.Item name="address" label={t('organizations.list.fieldAddress')}>
            <Input />
          </Form.Item>
          <Form.Item name="competentAuthority" label={t('organizations.list.fieldAuthority')}>
            <Input placeholder={t('organizations.list.fieldAuthorityPlaceholder')} />
          </Form.Item>
          <Form.Item
            name="regulatoryStandard"
            label={t('organizations.list.fieldStandard')}
            initialValue="EASA"
            tooltip={t('organizations.list.fieldStandardTooltip')}
          >
            <Select
              options={[
                { value: 'EASA', label: t('organizations.list.standardEASA') },
                { value: 'CAAC', label: t('organizations.list.standardCAAC') },
              ]}
            />
          </Form.Item>
          <Form.Item name="isComplexOrg" label={t('organizations.list.fieldIsComplex')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
