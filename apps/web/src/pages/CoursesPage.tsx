import { PlusOutlined } from '@ant-design/icons'
import { Button, Empty, Form, Input, Modal, Select, Space, Table, Tag, message } from 'antd'
import { useEffect, useState } from 'react'
import { coursesApi } from '../api/courses'
import type { Course, CourseType } from '../api/types'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'

const COURSE_TYPES: CourseType[] = ['LAPL', 'PPL', 'CPL', 'MPL', 'ATPL', 'INSTRUMENT_RATING', 'TYPE_RATING', 'OTHER']

export function CoursesPage() {
  const { organizations, selectedId, select } = useSelectedOrganization()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  const load = () => {
    if (!selectedId) return
    setLoading(true)
    coursesApi
      .list(selectedId)
      .then(setCourses)
      .finally(() => setLoading(false))
  }

  useEffect(load, [selectedId])

  const handleCreate = async () => {
    if (!selectedId) return
    const values = await form.validateFields()
    await coursesApi.create({ organizationId: selectedId, ...values })
    message.success('课程创建成功')
    setModalOpen(false)
    form.resetFields()
    load()
  }

  const approve = async (id: string) => {
    await coursesApi.approve(id)
    message.success('课程已批准')
    load()
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
              新增课程
            </Button>
          </Space>

          <Table<Course>
            rowKey="id"
            loading={loading}
            dataSource={courses}
            columns={[
              { title: '课程名称', dataIndex: 'name' },
              { title: '类型', dataIndex: 'courseType' },
              {
                title: '审批状态',
                dataIndex: 'isApproved',
                render: (v: boolean, record) =>
                  v ? (
                    <Tag color="green">已批准</Tag>
                  ) : (
                    <Space>
                      <Tag color="orange">待批准</Tag>
                      <Button size="small" onClick={() => approve(record.id)}>
                        批准
                      </Button>
                    </Space>
                  ),
              },
            ]}
          />
        </>
      )}

      <Modal title="新增课程" open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="课程名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="courseType" label="课程类型" rules={[{ required: true }]}>
            <Select options={COURSE_TYPES.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
