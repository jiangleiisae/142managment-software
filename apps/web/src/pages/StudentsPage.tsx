import { PlusOutlined } from '@ant-design/icons'
import { Button, DatePicker, Empty, Form, Input, Modal, Space, Table, Tag, message } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { studentsApi } from '../api/students'
import type { Student } from '../api/types'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'

export function StudentsPage() {
  const { organizations, selectedId, select } = useSelectedOrganization()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  const load = () => {
    if (!selectedId) return
    setLoading(true)
    studentsApi
      .list(selectedId)
      .then(setStudents)
      .finally(() => setLoading(false))
  }

  useEffect(load, [selectedId])

  const handleCreate = async () => {
    if (!selectedId) return
    const values = await form.validateFields()
    await studentsApi.create({
      organizationId: selectedId,
      ...values,
      medicalCertExpiry: values.medicalCertExpiry ? values.medicalCertExpiry.format('YYYY-MM-DD') : undefined,
    })
    message.success('学员创建成功')
    setModalOpen(false)
    form.resetFields()
    load()
  }

  const medicalStatus = (expiry?: string | null) => {
    if (!expiry) return <Tag>未记录</Tag>
    const expired = new Date(expiry) < new Date()
    return (
      <Tag color={expired ? 'red' : 'green'}>
        {expired ? '已过期' : '有效'} ({new Date(expiry).toLocaleDateString()})
      </Tag>
    )
  }

  return (
    <div>
      <OrganizationSelector organizations={organizations} selectedId={selectedId} onChange={select} />

      {!selectedId ? (
        <Empty description="请先创建并选择一个机构" />
      ) : (
        <>
          <Space style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              新增学员
            </Button>
          </Space>

          <Table<Student>
            rowKey="id"
            loading={loading}
            dataSource={students}
            columns={[
              { title: '姓', dataIndex: 'lastName' },
              { title: '名', dataIndex: 'firstName' },
              { title: '执照号', dataIndex: 'licenceNo' },
              {
                title: '体检证状态 (ORA.ATO.120(c))',
                dataIndex: 'medicalCertExpiry',
                render: medicalStatus,
              },
            ]}
          />
        </>
      )}

      <Modal title="新增学员" open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical" initialValues={{ medicalCertExpiry: dayjs().add(1, 'year') }}>
          <Form.Item name="firstName" label="名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="lastName" label="姓" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="licenceNo" label="执照号">
            <Input />
          </Form.Item>
          <Form.Item name="medicalCertExpiry" label="体检证到期日">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
