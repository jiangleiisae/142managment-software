import { PlusOutlined } from '@ant-design/icons'
import { Alert, App, Button, DatePicker, Empty, Form, Input, List, Modal, Progress, Select, Space, Table, Tag } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const { message } = App.useApp()
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
    message.success(t('students.createSuccess'))
    setModalOpen(false)
    form.resetFields()
    load()
  }

  const handleEnroll = async () => {
    if (!enrollModalStudentId) return
    const values = await enrollForm.validateFields()
    try {
      await studentsApi.enroll(enrollModalStudentId, values.courseId)
      message.success(t('students.enrollSuccess'))
      setEnrollModalStudentId(undefined)
      enrollForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('students.enrollFailed'))
    }
  }

  const transitionEnrollment = async (action: 'complete' | 'withdraw', enrollmentId: string) => {
    const fn = action === 'complete' ? studentsApi.completeEnrollment : studentsApi.withdrawEnrollment
    try {
      await fn(enrollmentId)
      message.success(t('students.enrollmentStatusUpdated'))
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('students.operationFailed'))
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
    message.success(t('students.trainingRecordAdded'))
    setRecordModalEnrollment(undefined)
    if (progressCardEnrollment?.id === recordModalEnrollment.id) {
      openProgressCard(progressCardEnrollment)
    }
  }

  const medicalStatus = (expiry?: string | null) => {
    if (!expiry) return <Tag>{t('students.medicalNotRecorded')}</Tag>
    const expired = new Date(expiry) < new Date()
    return (
      <Tag color={expired ? 'red' : 'green'}>
        {expired ? t('students.medicalExpired') : t('students.medicalValid')} ({new Date(expiry).toLocaleDateString()})
      </Tag>
    )
  }

  return (
    <div>
      <OrganizationSelector organizations={organizations} selectedId={selectedId} onChange={select} />

      {!selectedId ? (
        <Empty description={t('students.selectOrgFirst')} />
      ) : (
        <>
          {expiringSoon.length > 0 && (
            <Alert
              style={{ marginBottom: 16 }}
              type="warning"
              showIcon
              message={t('students.expiringAlertMessage', { count: expiringSoon.length })}
              description={expiringSoon.map((s) => `${s.lastName}${s.firstName}`).join('、')}
            />
          )}

          <Space style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              {t('students.addButton')}
            </Button>
          </Space>

          <Table<StudentDetail>
            rowKey="id"
            loading={loading}
            dataSource={students}
            columns={[
              { title: t('students.columnLastName'), dataIndex: 'lastName' },
              { title: t('students.columnFirstName'), dataIndex: 'firstName' },
              { title: t('students.columnLicenceNo'), dataIndex: 'licenceNo' },
              {
                title: t('students.columnMedicalStatus'),
                dataIndex: 'medicalCertExpiry',
                render: medicalStatus,
              },
              {
                title: t('students.columnActions'),
                render: (_, s) => (
                  <Button size="small" onClick={() => setEnrollModalStudentId(s.id)}>
                    {t('students.enroll')}
                  </Button>
                ),
              },
            ]}
            expandable={{
              expandedRowRender: (s) => (
                <List
                  size="small"
                  header={t('students.enrollmentsHeader')}
                  dataSource={s.enrollments ?? []}
                  locale={{ emptyText: t('students.noEnrollments') }}
                  renderItem={(e) => (
                    <List.Item
                      actions={[
                        <Button key="progress" size="small" onClick={() => openProgressCard(e)}>
                          {t('students.progressCard')}
                        </Button>,
                        ...(e.status === 'active'
                          ? [
                              <Button key="record" size="small" onClick={() => openAddTrainingRecord(e)}>
                                {t('students.addTrainingRecord')}
                              </Button>,
                              <Button key="complete" size="small" type="primary" onClick={() => transitionEnrollment('complete', e.id)}>
                                {t('students.complete')}
                              </Button>,
                              <Button key="withdraw" size="small" danger onClick={() => transitionEnrollment('withdraw', e.id)}>
                                {t('students.withdraw')}
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

      <Modal title={t('students.createModalTitle')} open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical" initialValues={{ medicalCertExpiry: dayjs().add(1, 'year') }}>
          <Form.Item name="firstName" label={t('students.fieldFirstName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="lastName" label={t('students.fieldLastName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="licenceNo" label={t('students.fieldLicenceNo')}>
            <Input />
          </Form.Item>
          <Form.Item name="medicalCertExpiry" label={t('students.fieldMedicalCertExpiry')}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('students.enrollModalTitle')} open={!!enrollModalStudentId} onOk={handleEnroll} onCancel={() => setEnrollModalStudentId(undefined)}>
        <Form form={enrollForm} layout="vertical">
          <Form.Item name="courseId" label={t('students.fieldCourse')} rules={[{ required: true }]}>
            <Select options={courses.map((c) => ({ value: c.id, label: c.name }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('students.progressCardTitle', { course: progressCardEnrollment?.course?.name ?? '' })}
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
              <Empty description={t('students.noRequirementsDefined')} />
            ) : (
              <Table
                size="small"
                rowKey="courseRequirementId"
                loading={progressCardLoading}
                dataSource={progressCard.items}
                pagination={false}
                columns={[
                  { title: t('students.columnTaskCode'), dataIndex: 'taskCode' },
                  { title: t('students.columnTaskName'), dataIndex: 'taskName' },
                  { title: t('students.columnMinHours'), dataIndex: 'minHours', render: (v?: number | null) => v ?? '-' },
                  {
                    title: t('students.columnStatus'),
                    dataIndex: 'completed',
                    render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? t('students.covered') : t('students.notCovered')}</Tag>,
                  },
                  {
                    title: t('students.columnLatestRecord'),
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
              header={t('students.allRecordsHeader')}
              style={{ marginTop: 16 }}
              dataSource={progressCardRecords}
              locale={{ emptyText: t('students.noRecords') }}
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
        title={t('students.addRecordModalTitle')}
        open={!!recordModalEnrollment}
        onOk={handleAddTrainingRecord}
        onCancel={() => setRecordModalEnrollment(undefined)}
      >
        <Form form={recordForm} layout="vertical">
          <Form.Item name="sessionDate" label={t('students.fieldSessionDate')} rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="subject" label={t('students.fieldSubject')} rules={[{ required: true }]}>
            <Input placeholder={t('students.fieldSubjectPlaceholder')} />
          </Form.Item>
          <Form.Item name="courseRequirementId" label={t('students.fieldCourseRequirement')}>
            <Select
              allowClear
              options={recordModalRequirements.map((r) => ({ value: r.id, label: `${r.taskCode} - ${r.taskName}` }))}
            />
          </Form.Item>
          <Form.Item name="testScore" label={t('students.fieldTestScore')}>
            <Input placeholder={t('students.fieldTestScorePlaceholder')} />
          </Form.Item>
          <Form.Item name="assessedById" label={t('students.fieldAssessedBy')}>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={personnel.map((p) => ({ value: p.id, label: `${p.lastName}${p.firstName}` }))}
            />
          </Form.Item>
          <Form.Item name="progressNotes" label={t('students.fieldNotes')}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
