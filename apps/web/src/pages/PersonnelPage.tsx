import { PlusOutlined } from '@ant-design/icons'
import { App, Button, DatePicker, Form, Input, InputNumber, List, Modal, Select, Space, Switch, Table, Tag } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { personnelApi } from '../api/personnel'
import type { InstructorType, Personnel } from '../api/types'

const INSTRUCTOR_TYPES: InstructorType[] = ['FI', 'TRI', 'SFI', 'THEORETICAL', 'EXAMINER']

export function PersonnelPage() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [instructorModalId, setInstructorModalId] = useState<string>()
  const [initialTrainingModalId, setInitialTrainingModalId] = useState<string>()
  const [initialTrainingItems, setInitialTrainingItems] = useState<string[]>([])
  const [initialTrainingItemState, setInitialTrainingItemState] = useState<Record<string, boolean>>({})
  const [form] = Form.useForm()
  const [instructorForm] = Form.useForm()
  const [initialTrainingForm] = Form.useForm()

  const load = () => {
    setLoading(true)
    personnelApi
      .list()
      .then(setPersonnel)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])
  useEffect(() => {
    personnelApi.listInitialTrainingItems().then(setInitialTrainingItems)
  }, [])

  const handleCreate = async () => {
    const values = await form.validateFields()
    await personnelApi.create(values)
    message.success(t('personnel.createSuccess'))
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
    message.success(t('personnel.instructorProfileSet'))
    setInstructorModalId(undefined)
    load()
  }

  const openInitialTrainingModal = async (p: Personnel) => {
    const training = await personnelApi.getInitialTraining(p.id)
    initialTrainingForm.setFieldsValue({
      completedAt: training.completedAt ? dayjs(training.completedAt) : undefined,
      totalHours: training.totalHours ?? 8,
      writtenExamPassed: training.writtenExamPassed ?? false,
      writtenExamDate: training.writtenExamDate ? dayjs(training.writtenExamDate) : undefined,
    })
    setInitialTrainingItemState(
      Object.fromEntries(initialTrainingItems.map((item) => [item, training.itemsJson?.find((i) => i.item === item)?.completed ?? false])),
    )
    setInitialTrainingModalId(p.id)
  }

  const handleSaveInitialTraining = async () => {
    if (!initialTrainingModalId) return
    const values = await initialTrainingForm.validateFields()
    await personnelApi.upsertInitialTraining(initialTrainingModalId, {
      completedAt: values.completedAt ? values.completedAt.format('YYYY-MM-DD') : undefined,
      totalHours: values.totalHours,
      items: initialTrainingItems.map((item) => ({ item, completed: initialTrainingItemState[item] ?? false })),
      writtenExamPassed: values.writtenExamPassed,
      writtenExamDate: values.writtenExamDate ? values.writtenExamDate.format('YYYY-MM-DD') : undefined,
    })
    message.success(t('personnel.initialTrainingSaved'))
    setInitialTrainingModalId(undefined)
    load()
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          {t('personnel.addButton')}
        </Button>
      </Space>

      <Table<Personnel>
        rowKey="id"
        loading={loading}
        dataSource={personnel}
        columns={[
          { title: t('personnel.columnLastName'), dataIndex: 'lastName' },
          { title: t('personnel.columnFirstName'), dataIndex: 'firstName' },
          { title: t('personnel.columnEmail'), dataIndex: 'email' },
          {
            title: t('personnel.columnQualifications'),
            dataIndex: 'qualifications',
            render: (quals: Personnel['qualifications']) => (
              <Space wrap>
                {(quals ?? []).map((q) => (
                  <Tag key={q.id} color={isExpiringSoon(q.validUntil) ? 'red' : 'default'}>
                    {q.qualificationType}
                    {q.validUntil
                      ? ` (${t('personnel.validUntil', { date: new Date(q.validUntil).toLocaleDateString() })})`
                      : ''}
                  </Tag>
                ))}
              </Space>
            ),
          },
          {
            title: t('personnel.columnInstructorType'),
            dataIndex: 'instructorProfile',
            render: (profile: Personnel['instructorProfile']) =>
              profile ? <Tag color="blue">{profile.instructorType}</Tag> : <Tag>{t('personnel.notInstructor')}</Tag>,
          },
          {
            title: t('personnel.columnInitialTraining'),
            dataIndex: 'instructorProfile',
            render: (profile: Personnel['instructorProfile']) =>
              profile ? (
                <Tag color={profile.initialTraining?.isComplete ? 'green' : 'orange'}>
                  {profile.initialTraining?.isComplete ? t('personnel.initialTrainingComplete') : t('personnel.initialTrainingIncomplete')}
                </Tag>
              ) : (
                '-'
              ),
          },
          {
            title: t('personnel.columnActions'),
            render: (_, p) => (
              <Space>
              <Button
                size="small"
                onClick={() => {
                  instructorForm.setFieldsValue({ instructorType: p.instructorProfile?.instructorType ?? 'FI' })
                  setInstructorModalId(p.id)
                }}
              >
                {t('personnel.setInstructorType')}
              </Button>
              {p.instructorProfile && (
                <Button size="small" onClick={() => openInitialTrainingModal(p)}>
                  {t('personnel.setInitialTraining')}
                </Button>
              )}
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={t('personnel.createModalTitle')}
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => setModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="firstName" label={t('personnel.fieldFirstName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="lastName" label={t('personnel.fieldLastName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label={t('personnel.fieldEmail')}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('personnel.instructorModalTitle')}
        open={!!instructorModalId}
        onOk={handleSetInstructorProfile}
        onCancel={() => setInstructorModalId(undefined)}
      >
        <Form form={instructorForm} layout="vertical">
          <Form.Item name="instructorType" label={t('personnel.fieldInstructorType')} rules={[{ required: true }]}>
            <Select options={INSTRUCTOR_TYPES.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('personnel.initialTrainingModalTitle')}
        open={!!initialTrainingModalId}
        onOk={handleSaveInitialTraining}
        onCancel={() => setInitialTrainingModalId(undefined)}
        width={600}
      >
        <Form form={initialTrainingForm} layout="vertical">
          <Space size="large" wrap>
            <Form.Item name="completedAt" label={t('personnel.fieldCompletedAt')}>
              <DatePicker />
            </Form.Item>
            <Form.Item name="totalHours" label={t('personnel.fieldTotalHours')}>
              <InputNumber min={0} step={0.5} />
            </Form.Item>
            <Form.Item name="writtenExamPassed" label={t('personnel.fieldWrittenExamPassed')} valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="writtenExamDate" label={t('personnel.fieldWrittenExamDate')}>
              <DatePicker />
            </Form.Item>
          </Space>
        </Form>
        <List
          size="small"
          header={t('personnel.initialTrainingItemsHeader')}
          dataSource={initialTrainingItems}
          renderItem={(item) => (
            <List.Item>
              <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
                <span>{item}</span>
                <Switch
                  checked={initialTrainingItemState[item] ?? false}
                  checkedChildren={t('fstdsPage.passedSwitch')}
                  unCheckedChildren={t('fstdsPage.notPassedSwitch')}
                  onChange={(checked) => setInitialTrainingItemState((s) => ({ ...s, [item]: checked }))}
                />
              </Space>
            </List.Item>
          )}
        />
      </Modal>
    </div>
  )
}
