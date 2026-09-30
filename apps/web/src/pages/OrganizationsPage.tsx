import { PlusOutlined } from '@ant-design/icons'
import { App, Button, Form, Input, Modal, Space, Switch, Table, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { organizationsApi } from '../api/organizations'
import type { Organization } from '../api/types'

export function OrganizationsPage() {
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
      message.success('机构创建成功')
      setModalOpen(false)
      form.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '创建失败')
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          新建机构
        </Button>
      </Space>

      <Table<Organization>
        rowKey="id"
        loading={loading}
        dataSource={organizations}
        onRow={(record) => ({ onClick: () => navigate(`/organizations/${record.id}`) })}
        columns={[
          { title: '机构名称', dataIndex: 'name' },
          { title: '主管当局', dataIndex: 'competentAuthority' },
          {
            title: '复杂机构 (AMC1 ORA.GEN.200(b))',
            dataIndex: 'isComplexOrg',
            render: (v: boolean) => (v ? <Tag color="orange">复杂机构</Tag> : <Tag>非复杂</Tag>),
          },
          { title: '创建时间', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
        ]}
      />

      <Modal title="新建机构" open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="机构名称" rules={[{ required: true, message: '请输入机构名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="address" label="地址">
            <Input />
          </Form.Item>
          <Form.Item name="competentAuthority" label="主管当局">
            <Input placeholder="如: CAAC / EASA member state authority" />
          </Form.Item>
          <Form.Item name="isComplexOrg" label="是否复杂机构" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
