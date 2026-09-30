import { PlusOutlined } from '@ant-design/icons'
import { App, Button, Form, Input, Modal, Select, Space, Table, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { personnelApi } from '../api/personnel'
import type { InstructorType, Personnel } from '../api/types'

const INSTRUCTOR_TYPES: InstructorType[] = ['FI', 'TRI', 'SFI', 'THEORETICAL', 'EXAMINER']

export function PersonnelPage() {
  const { message } = App.useApp()
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [instructorModalId, setInstructorModalId] = useState<string>()
  const [form] = Form.useForm()
  const [instructorForm] = Form.useForm()

  const load = () => {
    setLoading(true)
    personnelApi
      .list()
      .then(setPersonnel)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleCreate = async () => {
    const values = await form.validateFields()
    await personnelApi.create(values)
    message.success('人员创建成功')
    setModalOpen(false)
    form.resetFields()
    load()
  }

  const isExpiringSoon = (validUntil?: string | null) => {
    if (!validUntil) return false
    const days = (new Date(validUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return days < 90
  }

  const handleSetInstructorProfile = async () => {
    if (!instructorModalId) return
    const values = await instructorForm.validateFields()
    await personnelApi.setInstructorProfile(instructorModalId, values.instructorType)
    message.success('教员档案已登记')
    setInstructorModalId(undefined)
    load()
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          新增人员
        </Button>
      </Space>

      <Table<Personnel>
        rowKey="id"
        loading={loading}
        dataSource={personnel}
        columns={[
          { title: '姓', dataIndex: 'lastName' },
          { title: '名', dataIndex: 'firstName' },
          { title: '邮箱', dataIndex: 'email' },
          {
            title: '资质到期情况',
            dataIndex: 'qualifications',
            render: (quals: Personnel['qualifications']) => (
              <Space wrap>
                {(quals ?? []).map((q) => (
                  <Tag key={q.id} color={isExpiringSoon(q.validUntil) ? 'red' : 'default'}>
                    {q.qualificationType}
                    {q.validUntil ? ` (至 ${new Date(q.validUntil).toLocaleDateString()})` : ''}
                  </Tag>
                ))}
              </Space>
            ),
          },
          {
            title: '教员类型 (3.5)',
            dataIndex: 'instructorProfile',
            render: (profile: Personnel['instructorProfile']) =>
              profile ? <Tag color="blue">{profile.instructorType}</Tag> : <Tag>非教员</Tag>,
          },
          {
            title: '操作',
            render: (_, p) => (
              <Button
                size="small"
                onClick={() => {
                  instructorForm.setFieldsValue({ instructorType: p.instructorProfile?.instructorType ?? 'FI' })
                  setInstructorModalId(p.id)
                }}
              >
                登记教员类型
              </Button>
            ),
          },
        ]}
      />

      <Modal title="新增人员" open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="firstName" label="名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="lastName" label="姓" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="登记教员类型 (3.5)"
        open={!!instructorModalId}
        onOk={handleSetInstructorProfile}
        onCancel={() => setInstructorModalId(undefined)}
      >
        <Form form={instructorForm} layout="vertical">
          <Form.Item name="instructorType" label="教员类型" rules={[{ required: true }]}>
            <Select options={INSTRUCTOR_TYPES.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
