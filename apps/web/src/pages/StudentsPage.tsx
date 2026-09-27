import { PlusOutlined } from '@ant-design/icons'
import { Alert, Button, DatePicker, Empty, Form, Input, List, Modal, Select, Space, Table, Tag, message } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { coursesApi } from '../api/courses'
import type { Enrollment, StudentDetail } from '../api/students'
import { studentsApi } from '../api/students'
import type { Course } from '../api/types'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'

const ENROLLMENT_STATUS_COLOR: Record<Enrollment['status'], string> = {
  active: 'processing',
  completed: 'green',
  withdrawn: 'default',
}

export function StudentsPage() {
  const { organizations, selectedId, select } = useSelectedOrganization()
  const [students, setStudents] = useState<StudentDetail[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [expiringSoon, setExpiringSoon] = useState<StudentDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [enrollModalStudentId, setEnrollModalStudentId] = useState<string>()
  const [form] = Form.useForm()
  const [enrollForm] = Form.useForm()

  const load = async () => {
    if (!selectedId) return
    setLoading(true)
    try {
      const list = await studentsApi.list(selectedId)
      const detailed = await Promise.all(list.map((s) => studentsApi.get(s.id)))
      setStudents(detailed)
    } finally {
      setLoading(false)
    }
    coursesApi.list(selectedId).then(setCourses)
    studentsApi.listExpiringMedicalCerts().then(setExpiringSoon)
  }

  useEffect(() => {
    load()
  }, [selectedId])

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

  const handleEnroll = async () => {
    if (!enrollModalStudentId) return
    const values = await enrollForm.validateFields()
    try {
      await studentsApi.enroll(enrollModalStudentId, values.courseId)
      message.success('入学成功')
      setEnrollModalStudentId(undefined)
      enrollForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '入学失败')
    }
  }

  const transitionEnrollment = async (action: 'complete' | 'withdraw', enrollmentId: string) => {
    const fn = action === 'complete' ? studentsApi.completeEnrollment : studentsApi.withdrawEnrollment
    await fn(enrollmentId)
    message.success('学籍状态已更新')
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
          {expiringSoon.length > 0 && (
            <Alert
              style={{ marginBottom: 16 }}
              type="warning"
              showIcon
              message={`有 ${expiringSoon.length} 名学员体检证即将到期或已过期 (ORA.ATO.145 训练前置条件)`}
              description={expiringSoon.map((s) => `${s.lastName}${s.firstName}`).join('、')}
            />
          )}

          <Space style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              新增学员
            </Button>
          </Space>

          <Table<StudentDetail>
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
              {
                title: '操作',
                render: (_, s) => (
                  <Button size="small" onClick={() => setEnrollModalStudentId(s.id)}>
                    办理入学
                  </Button>
                ),
              },
            ]}
            expandable={{
              expandedRowRender: (s) => (
                <List
                  size="small"
                  header="学籍记录"
                  dataSource={s.enrollments ?? []}
                  locale={{ emptyText: '尚未入学任何课程' }}
                  renderItem={(e) => (
                    <List.Item
                      actions={
                        e.status === 'active'
                          ? [
                              <Button key="complete" size="small" type="primary" onClick={() => transitionEnrollment('complete', e.id)}>
                                结业
                              </Button>,
                              <Button key="withdraw" size="small" danger onClick={() => transitionEnrollment('withdraw', e.id)}>
                                退学
                              </Button>,
                            ]
                          : []
                      }
                    >
                      <Tag color={ENROLLMENT_STATUS_COLOR[e.status]}>{e.status}</Tag> {e.course?.name ?? e.courseId}
                    </List.Item>
                  )}
                />
              ),
            }}
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

      <Modal title="办理入学" open={!!enrollModalStudentId} onOk={handleEnroll} onCancel={() => setEnrollModalStudentId(undefined)}>
        <Form form={enrollForm} layout="vertical">
          <Form.Item name="courseId" label="课程" rules={[{ required: true }]}>
            <Select options={courses.map((c) => ({ value: c.id, label: c.name }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
