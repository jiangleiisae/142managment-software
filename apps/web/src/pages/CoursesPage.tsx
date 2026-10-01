import { PlusOutlined } from '@ant-design/icons'
import { Alert, App, Button, Empty, Form, Input, List, Modal, Select, Space, Table, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
    message.success(t('courses.createSuccess'))
    setModalOpen(false)
    form.resetFields()
    load()
  }

  const approve = async (id: string) => {
    await coursesApi.approve(id)
    message.success(t('courses.approved'))
    load()
  }

  const handleAddRequirement = async () => {
    if (!requirementModalCourseId) return
    const values = await requirementForm.validateFields()
    await coursesApi.addRequirement(requirementModalCourseId, values)
    message.success(t('courses.requirementAdded'))
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
        <Empty description={t('courses.selectOrgFirst')} />
      ) : (
        <>
          <Space style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              {t('courses.addButton')}
            </Button>
          </Space>

          <Table<CourseWithRequirements>
            rowKey="id"
            loading={loading}
            dataSource={courses}
            columns={[
              { title: t('courses.columnName'), dataIndex: 'name' },
              { title: t('courses.columnType'), dataIndex: 'courseType' },
              {
                title: t('courses.columnApprovalStatus'),
                dataIndex: 'isApproved',
                render: (v: boolean, record) =>
                  v ? (
                    <Tag color="green">{t('courses.approvedTag')}</Tag>
                  ) : (
                    <Space>
                      <Tag color="orange">{t('courses.pendingTag')}</Tag>
                      <Button size="small" onClick={() => approve(record.id)}>
                        {t('courses.approve')}
                      </Button>
                    </Space>
                  ),
              },
              {
                title: t('courses.columnActions'),
                render: (_, course) => (
                  <Space>
                    <Button size="small" onClick={() => setRequirementModalCourseId(course.id)}>
                      {t('courses.addRequirement')}
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        setCompatModalCourseId(course.id)
                        setCompatResult(undefined)
                      }}
                    >
                      {t('courses.checkCompatibility')}
                    </Button>
                  </Space>
                ),
              },
            ]}
            expandable={{
              expandedRowRender: (course) => (
                <List
                  size="small"
                  header={t('courses.requirementsHeader')}
                  dataSource={course.requirements ?? []}
                  locale={{ emptyText: t('courses.noRequirements') }}
                  renderItem={(r) => (
                    <List.Item>
                      <Tag color="blue">{r.taskCode}</Tag> {r.taskName}
                      {r.minHours ? t('courses.minHours', { hours: r.minHours }) : ''}
                    </List.Item>
                  )}
                />
              ),
            }}
          />
        </>
      )}

      <Modal title={t('courses.createModalTitle')} open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t('courses.fieldName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="courseType" label={t('courses.fieldCourseType')} rules={[{ required: true }]}>
            <Select options={COURSE_TYPES.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('courses.addRequirementModalTitle')}
        open={!!requirementModalCourseId}
        onOk={handleAddRequirement}
        onCancel={() => setRequirementModalCourseId(undefined)}
      >
        <Form form={requirementForm} layout="vertical">
          <Form.Item name="taskCode" label={t('courses.fieldTaskCode')} rules={[{ required: true }]}>
            <Input placeholder={t('courses.fieldTaskCodePlaceholder')} />
          </Form.Item>
          <Form.Item name="taskName" label={t('courses.fieldTaskName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('courses.checkCompatModalTitle')}
        open={!!compatModalCourseId}
        onCancel={() => setCompatModalCourseId(undefined)}
        footer={null}
      >
        <Form form={compatForm} layout="vertical" onFinish={handleCheckCompatibility}>
          <Form.Item name="fstdId" label={t('courses.fieldSelectFstd')} rules={[{ required: true }]}>
            <Select options={fstds.map((f) => ({ value: f.id, label: f.deviceCode }))} />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            {t('courses.checkButton')}
          </Button>
        </Form>
        {compatResult && (
          <Alert
            style={{ marginTop: 16 }}
            type={compatResult.compatible ? 'success' : 'error'}
            showIcon
            message={compatResult.compatible ? t('courses.compatibleMessage') : t('courses.incompatibleMessage')}
            description={
              compatResult.compatible
                ? undefined
                : t('courses.missingTasks', {
                    tasks: compatResult.missingTasks.map((task) => `${task.taskCode}(${task.taskName})`).join('、'),
                  })
            }
          />
        )}
      </Modal>
    </div>
  )
}
