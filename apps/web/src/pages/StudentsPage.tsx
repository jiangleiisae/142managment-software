import { PlusOutlined } from '@ant-design/icons'
import { Alert, Button, DatePicker, Empty, Form, Input, List, Modal, Progress, Select, Space, Table, Tag, message } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import type { CourseRequirement } from '../api/courses'
import { coursesApi } from '../api/courses'
import { personnelApi } from '../api/personnel'
import type { Enrollment, ProgressCard, StudentDetail, TrainingRecord } from '../api/students'
import { studentsApi } from '../api/students'
import type { Course, Personnel } from '../api/types'
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
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [expiringSoon, setExpiringSoon] = useState<StudentDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [enrollModalStudentId, setEnrollModalStudentId] = useState<string>()
  const [form] = Form.useForm()
  const [enrollForm] = Form.useForm()
  const [recordForm] = Form.useForm()

  const [progressCardEnrollment, setProgressCardEnrollment] = useState<Enrollment>()
  const [progressCard, setProgressCard] = useState<ProgressCard>()
  const [progressCardRecords, setProgressCardRecords] = useState<TrainingRecord[]>([])
  const [progressCardLoading, setProgressCardLoading] = useState(false)

  const [recordModalEnrollment, setRecordModalEnrollment] = useState<Enrollment>()
  const [recordModalRequirements, setRecordModalRequirements] = useState<CourseRequirement[]>([])

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
    personnelApi.list().then(setPersonnel)
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
    try {
      await fn(enrollmentId)
      message.success('学籍状态已更新')
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '操作失败')
    }
  }

  const openProgressCard = async (enrollment: Enrollment) => {
    setProgressCardEnrollment(enrollment)
    setProgressCardLoading(true)
    try {
      const [card, records] = await Promise.all([
        studentsApi.getProgressCard(enrollment.id),
        studentsApi.listTrainingRecords(enrollment.id),
      ])
      setProgressCard(card)
      setProgressCardRecords(records)
    } finally {
      setProgressCardLoading(false)
    }
  }

  const openAddTrainingRecord = async (enrollment: Enrollment) => {
    setRecordModalEnrollment(enrollment)
    recordForm.resetFields()
    recordForm.setFieldsValue({ sessionDate: dayjs() })
    setRecordModalRequirements(await coursesApi.listRequirements(enrollment.courseId))
  }

  const handleAddTrainingRecord = async () => {
    if (!recordModalEnrollment) return
    const values = await recordForm.validateFields()
    await studentsApi.addTrainingRecord(recordModalEnrollment.id, {
      ...values,
      sessionDate: values.sessionDate.format('YYYY-MM-DD'),
    })
    message.success('训练记录已登记')
    setRecordModalEnrollment(undefined)
    if (progressCardEnrollment?.id === recordModalEnrollment.id) {
      openProgressCard(progressCardEnrollment)
    }
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
                      actions={[
                        <Button key="progress" size="small" onClick={() => openProgressCard(e)}>
                          进度卡
                        </Button>,
                        ...(e.status === 'active'
                          ? [
                              <Button key="record" size="small" onClick={() => openAddTrainingRecord(e)}>
                                登记训练记录
                              </Button>,
                              <Button key="complete" size="small" type="primary" onClick={() => transitionEnrollment('complete', e.id)}>
                                结业
                              </Button>,
                              <Button key="withdraw" size="small" danger onClick={() => transitionEnrollment('withdraw', e.id)}>
                                退学
                              </Button>,
                            ]
                          : []),
                      ]}
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

      <Modal
        title={`进度卡 - ${progressCardEnrollment?.course?.name ?? ''} (3.7 ORA.ATO.120 训练记录)`}
        open={!!progressCardEnrollment}
        onCancel={() => setProgressCardEnrollment(undefined)}
        footer={null}
        width={700}
      >
        {progressCard && (
          <>
            <Progress
              percent={Math.round((progressCard.completionRate ?? 0) * 100)}
              status={progressCard.completionRate === 1 ? 'success' : 'active'}
              style={{ marginBottom: 16 }}
            />
            {progressCard.totalRequirements === 0 ? (
              <Empty description="该课程未定义要求科目 (CourseRequirement), 无法生成进度卡" />
            ) : (
              <Table
                size="small"
                rowKey="courseRequirementId"
                loading={progressCardLoading}
                dataSource={progressCard.items}
                pagination={false}
                columns={[
                  { title: '科目编号', dataIndex: 'taskCode' },
                  { title: '科目名称', dataIndex: 'taskName' },
                  { title: '要求最少学时', dataIndex: 'minHours', render: (v?: number | null) => v ?? '-' },
                  {
                    title: '状态',
                    dataIndex: 'completed',
                    render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '已覆盖' : '未覆盖'}</Tag>,
                  },
                  {
                    title: '最近记录',
                    render: (_, item) =>
                      item.latestSessionDate
                        ? `${new Date(item.latestSessionDate).toLocaleDateString()} (${item.latestTestScore ?? '-'})`
                        : '-',
                  },
                ]}
              />
            )}
            <List
              size="small"
              header="全部训练记录 (含未挂钩具体科目的地面训练)"
              style={{ marginTop: 16 }}
              dataSource={progressCardRecords}
              locale={{ emptyText: '尚无训练记录' }}
              renderItem={(r) => (
                <List.Item>
                  {new Date(r.sessionDate).toLocaleDateString()} · {r.subject}
                  {r.courseRequirement ? (
                    <Tag style={{ marginLeft: 8 }} color="blue">
                      {r.courseRequirement.taskCode}
                    </Tag>
                  ) : null}
                  {r.testScore ? <Tag style={{ marginLeft: 8 }}>{r.testScore}</Tag> : null}
                </List.Item>
              )}
            />
          </>
        )}
      </Modal>

      <Modal
        title="登记训练记录 (ORA.ATO.120)"
        open={!!recordModalEnrollment}
        onOk={handleAddTrainingRecord}
        onCancel={() => setRecordModalEnrollment(undefined)}
      >
        <Form form={recordForm} layout="vertical">
          <Form.Item name="sessionDate" label="训练日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="subject" label="训练内容" rules={[{ required: true }]}>
            <Input placeholder="如: Basic maneuvers session 1 / 地面课: 空中法规" />
          </Form.Item>
          <Form.Item name="courseRequirementId" label="对应课程要求科目 (用于进度卡, 不选则视为地面训练)">
            <Select
              allowClear
              options={recordModalRequirements.map((r) => ({ value: r.id, label: `${r.taskCode} - ${r.taskName}` }))}
            />
          </Form.Item>
          <Form.Item name="testScore" label="测评结果">
            <Input placeholder="如: Pass / Fail / 85分" />
          </Form.Item>
          <Form.Item name="assessedById" label="教员/考核人">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={personnel.map((p) => ({ value: p.id, label: `${p.lastName}${p.firstName}` }))}
            />
          </Form.Item>
          <Form.Item name="progressNotes" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
