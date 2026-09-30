import { PlusOutlined } from '@ant-design/icons'
import { Alert, App, Button, Empty, Form, Input, List, Modal, Select, Space, Table, Tag } from 'antd'
import { useEffect, useState } from 'react'
import type { CourseRequirement, FstdCompatibilityResult } from '../api/courses'
import { coursesApi } from '../api/courses'
import { fstdsApi } from '../api/fstds'
import type { Course, CourseType, Fstd } from '../api/types'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'

const COURSE_TYPES: CourseType[] = ['LAPL', 'PPL', 'CPL', 'MPL', 'ATPL', 'INSTRUMENT_RATING', 'TYPE_RATING', 'OTHER']

interface CourseWithRequirements extends Course {
  requirements?: CourseRequirement[]
}

export function CoursesPage() {
  const { message } = App.useApp()
  const { organizations, selectedId, select } = useSelectedOrganization()
  const [courses, setCourses] = useState<CourseWithRequirements[]>([])
  const [fstds, setFstds] = useState<Fstd[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [requirementModalCourseId, setRequirementModalCourseId] = useState<string>()
  const [compatModalCourseId, setCompatModalCourseId] = useState<string>()
  const [compatResult, setCompatResult] = useState<FstdCompatibilityResult>()
  const [form] = Form.useForm()
  const [requirementForm] = Form.useForm()
  const [compatForm] = Form.useForm()

  const load = async () => {
    if (!selectedId) return
    setLoading(true)
    try {
      const list = await coursesApi.list(selectedId)
      const withReqs = await Promise.all(
        list.map(async (c) => ({ ...c, requirements: await coursesApi.listRequirements(c.id) })),
      )
      setCourses(withReqs)
    } finally {
      setLoading(false)
    }
    fstdsApi.list(selectedId).then(setFstds)
  }

  useEffect(() => {
    load()
  }, [selectedId])

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

  const handleAddRequirement = async () => {
    if (!requirementModalCourseId) return
    const values = await requirementForm.validateFields()
    await coursesApi.addRequirement(requirementModalCourseId, values)
    message.success('课程要求已添加')
    setRequirementModalCourseId(undefined)
    requirementForm.resetFields()
    load()
  }

  const handleCheckCompatibility = async () => {
    if (!compatModalCourseId) return
    const values = await compatForm.validateFields()
    const result = await coursesApi.checkFstdCompatibility(compatModalCourseId, values.fstdId)
    setCompatResult(result)
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

          <Table<CourseWithRequirements>
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
              {
                title: '操作',
                render: (_, course) => (
                  <Space>
                    <Button size="small" onClick={() => setRequirementModalCourseId(course.id)}>
                      添加课程要求
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        setCompatModalCourseId(course.id)
                        setCompatResult(undefined)
                      }}
                    >
                      检查设备兼容性
                    </Button>
                  </Space>
                ),
              },
            ]}
            expandable={{
              expandedRowRender: (course) => (
                <List
                  size="small"
                  header="课程要求 (需要设备已鉴定以下训练科目)"
                  dataSource={course.requirements ?? []}
                  locale={{ emptyText: '尚未设置课程要求' }}
                  renderItem={(r) => (
                    <List.Item>
                      <Tag color="blue">{r.taskCode}</Tag> {r.taskName}
                      {r.minHours ? ` (最低${r.minHours}小时)` : ''}
                    </List.Item>
                  )}
                />
              ),
            }}
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

      <Modal
        title="添加课程要求"
        open={!!requirementModalCourseId}
        onOk={handleAddRequirement}
        onCancel={() => setRequirementModalCourseId(undefined)}
      >
        <Form form={requirementForm} layout="vertical">
          <Form.Item name="taskCode" label="训练科目编号" rules={[{ required: true }]}>
            <Input placeholder="如: UPRT-01 (需与FSTD已鉴定任务清单里的编号一致)" />
          </Form.Item>
          <Form.Item name="taskName" label="科目名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="检查设备兼容性"
        open={!!compatModalCourseId}
        onCancel={() => setCompatModalCourseId(undefined)}
        footer={null}
      >
        <Form form={compatForm} layout="vertical" onFinish={handleCheckCompatibility}>
          <Form.Item name="fstdId" label="选择模拟机" rules={[{ required: true }]}>
            <Select options={fstds.map((f) => ({ value: f.id, label: f.deviceCode }))} />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            检查
          </Button>
        </Form>
        {compatResult && (
          <Alert
            style={{ marginTop: 16 }}
            type={compatResult.compatible ? 'success' : 'error'}
            showIcon
            message={compatResult.compatible ? '该设备满足课程全部训练科目要求' : '该设备不满足课程要求'}
            description={
              compatResult.compatible
                ? undefined
                : `缺少科目: ${compatResult.missingTasks.map((t) => `${t.taskCode}(${t.taskName})`).join('、')}`
            }
          />
        )}
      </Modal>
    </div>
  )
}
