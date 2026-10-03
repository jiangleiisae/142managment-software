import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { App, Button, DatePicker, Descriptions, Empty, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { personnelApi } from '../api/personnel'
import type { Meeting, MeetingMethod, TaskCategory, Training } from '../api/quality'
import { qualityApi } from '../api/quality'
import type { Personnel } from '../api/types'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'
import { cnDateTimeLabel, cnTodayString, shiftDay } from '../utils/trainingPlanTime'

const { RangePicker } = DatePicker
const METHODS: MeetingMethod[] = ['ONSITE', 'ONLINE', 'HYBRID']
const CATEGORIES: TaskCategory[] = ['DAILY', 'MAJOR', 'QTG', 'OTHER']
const apiError = (e: unknown, fallback: string) => {
  const msg = (e as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
  return (Array.isArray(msg) ? msg.join('; ') : msg) ?? fallback
}

/// 起止时间一律按北京时间解释, 不受浏览器时区影响
const toIso = (v: dayjs.Dayjs) => new Date(`${v.format('YYYY-MM-DD')}T${v.format('HH:mm')}:00+08:00`).toISOString()
const fromIso = (iso: string) => dayjs(cnDateTimeLabel(iso).replace(' ', 'T'))
const text = (v?: string) => (v && v.trim() ? v.trim() : undefined)

/// 会议记录 (日常部门会议) 与 培训管理 (维护/运行人员内部培训) 共用的页面, 按 kind 区分字段。
export function QualityMeetingsPage({ kind }: { kind: 'meeting' | 'training' }) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { organizations, selectedId, select } = useSelectedOrganization()
  const today = cnTodayString()
  const isMeeting = kind === 'meeting'

  const [personnel, setPersonnel] = useState<Personnel[]>([])
  useEffect(() => {
    personnelApi.list().then(setPersonnel)
  }, [])
  const personnelOptions = personnel.map((p) => ({ value: p.id, label: `${p.lastName}${p.firstName}` }))

  const [range, setRange] = useState<[string, string]>([shiftDay(today, -90), today])
  const [keyword, setKeyword] = useState<string>()
  const [rows, setRows] = useState<(Meeting | Training)[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!selectedId) return
    setLoading(true)
    try {
      const params = { from: range[0], to: range[1], keyword }
      setRows(isMeeting ? await qualityApi.listMeetings(selectedId, params) : await qualityApi.listTrainings(selectedId, params))
    } catch (e) {
      message.error(apiError(e, t('quality.failed')))
    } finally {
      setLoading(false)
    }
  }, [selectedId, range, keyword, isMeeting, message, t])

  useEffect(() => {
    load()
  }, [load])

  // ---------------- 新增 / 编辑 ----------------
  const [modal, setModal] = useState<{ open: boolean; editing?: Meeting | Training }>({ open: false })
  const [viewing, setViewing] = useState<Meeting | Training>()
  const [form] = Form.useForm()

  const openModal = (editing?: Meeting | Training) => {
    form.resetFields()
    if (editing) {
      form.setFieldsValue({
        ...editing,
        range: [fromIso(editing.startAt), fromIso(editing.endAt)],
        thisWeekTasks: isMeeting ? (editing as Meeting).thisWeekTasksJson : undefined,
        hostPersonnelId: (editing as Meeting).hostPersonnelId ?? undefined,
        recorderPersonnelId: (editing as Meeting).recorderPersonnelId ?? undefined,
      })
    } else {
      form.setFieldsValue({ range: [dayjs(`${today}T09:00`), dayjs(`${today}T10:00`)], method: 'ONSITE', thisWeekTasks: [] })
    }
    setModal({ open: true, editing })
  }

  const save = async () => {
    const v = await form.validateFields()
    if (!selectedId) return
    const [start, end] = v.range as [dayjs.Dayjs, dayjs.Dayjs]
    try {
      if (isMeeting) {
        const data = {
          subject: v.subject.trim(),
          startAt: toIso(start),
          endAt: toIso(end),
          method: v.method,
          department: text(v.department),
          location: text(v.location),
          hostPersonnelId: v.hostPersonnelId || undefined,
          recorderPersonnelId: v.recorderPersonnelId || undefined,
          attendeeIds: v.attendeeIds ?? [],
          topics: text(v.topics),
          lastWeekReport: text(v.lastWeekReport),
          thisWeekTasks: (v.thisWeekTasks ?? []).filter((x: { content?: string }) => x?.content?.trim()),
          faultAnalysis: text(v.faultAnalysis),
          suggestions: text(v.suggestions),
        }
        if (modal.editing) await qualityApi.updateMeeting(modal.editing.id, data)
        else await qualityApi.createMeeting({ organizationId: selectedId, ...data })
      } else {
        const data = { subject: v.subject.trim(), startAt: toIso(start), endAt: toIso(end), location: text(v.location), trainerName: text(v.trainerName), content: text(v.content), attendeeIds: v.attendeeIds ?? [] }
        if (modal.editing) await qualityApi.updateTraining(modal.editing.id, data)
        else await qualityApi.createTraining({ organizationId: selectedId, ...data })
      }
      message.success(t('quality.saved'))
      setModal({ open: false })
      await load()
    } catch (e) {
      message.error(apiError(e, t('quality.failed')))
    }
  }

  const remove = async (id: string) => {
    try {
      if (isMeeting) await qualityApi.deleteMeeting(id)
      else await qualityApi.deleteTraining(id)
      message.success(t('quality.deleted'))
      await load()
    } catch (e) {
      message.error(apiError(e, t('quality.failed')))
    }
  }

  const columns: ColumnsType<Meeting | Training> = [
    { title: t('quality.subject'), dataIndex: 'subject' },
    { title: t('quality.startAt'), render: (_, r) => cnDateTimeLabel(r.startAt) },
    { title: t('quality.endAt'), render: (_, r) => cnDateTimeLabel(r.endAt).slice(11) },
    ...(isMeeting
      ? [
          { title: t('quality.method'), render: (_: unknown, r: Meeting | Training) => <Tag>{t(`quality.methods.${(r as Meeting).method}`)}</Tag> },
          { title: t('quality.host'), render: (_: unknown, r: Meeting | Training) => (r as Meeting).host ?? '-' },
          { title: t('quality.recorder'), render: (_: unknown, r: Meeting | Training) => (r as Meeting).recorder ?? '-' },
        ]
      : [{ title: t('quality.trainer'), render: (_: unknown, r: Meeting | Training) => (r as Training).trainerName ?? '-' }]),
    { title: t('quality.location'), render: (_, r) => r.location ?? '-' },
    { title: t('quality.attendees'), render: (_, r) => (r.attendees.length ? `${r.attendees.length}` : '-') },
    {
      title: '',
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" onClick={() => setViewing(r)}>
            {t('quality.view')}
          </Button>
          <Button size="small" onClick={() => openModal(r)}>
            {t('quality.edit')}
          </Button>
          <Popconfirm title={t('quality.deleteConfirm')} onConfirm={() => remove(r.id)}>
            <Button size="small" danger>
              {t('quality.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const view = viewing as Meeting | undefined
  return (
    <div>
      <OrganizationSelector organizations={organizations} selectedId={selectedId} onChange={select} />
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        {t(isMeeting ? 'quality.meetingsTitle' : 'quality.trainingsTitle')}
      </Typography.Title>
      <Typography.Paragraph type="secondary">{t(isMeeting ? 'quality.meetingsIntro' : 'quality.trainingsIntro')}</Typography.Paragraph>
      <Space wrap style={{ marginBottom: 8 }}>
        <RangePicker allowClear={false} value={[dayjs(range[0]), dayjs(range[1])]} onChange={(v) => v?.[0] && v[1] && setRange([v[0].format('YYYY-MM-DD'), v[1].format('YYYY-MM-DD')])} />
        <Input.Search allowClear style={{ width: 200 }} placeholder={t('quality.keyword')} onSearch={(v) => setKeyword(v || undefined)} />
        <Button type="primary" icon={<PlusOutlined />} disabled={!selectedId} onClick={() => openModal()}>
          {t('quality.add')}
        </Button>
      </Space>
      {!selectedId ? <Empty description={t('common.selectOrganizationPlaceholder')} /> : <Table rowKey="id" size="small" loading={loading} dataSource={rows} columns={columns} pagination={{ pageSize: 20 }} locale={{ emptyText: t('quality.noData') }} />}

      <Modal title={`${modal.editing ? t('quality.edit') : t('quality.add')} · ${t(isMeeting ? 'quality.meetingsTitle' : 'quality.trainingsTitle')}`} open={modal.open} onCancel={() => setModal({ open: false })} onOk={save} width={720} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="subject" label={t('quality.subject')} rules={[{ required: true }]}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item name="range" label={t('quality.timeRange')} rules={[{ required: true }]} extra={t('quality.beijingTime')}>
            <RangePicker showTime={{ format: 'HH:mm', minuteStep: 5 }} format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          {isMeeting ? (
            <>
              <Space style={{ display: 'flex' }} align="start">
                <Form.Item name="method" label={t('quality.method')} style={{ minWidth: 140 }}>
                  <Select options={METHODS.map((m) => ({ value: m, label: t(`quality.methods.${m}`) }))} />
                </Form.Item>
                <Form.Item name="department" label={t('quality.department')} style={{ minWidth: 180 }}>
                  <Input maxLength={100} />
                </Form.Item>
                <Form.Item name="location" label={t('quality.location')} style={{ minWidth: 200 }}>
                  <Input maxLength={200} />
                </Form.Item>
              </Space>
              <Space style={{ display: 'flex' }} align="start">
                <Form.Item name="hostPersonnelId" label={t('quality.host')} style={{ minWidth: 200 }}>
                  <Select allowClear showSearch optionFilterProp="label" options={personnelOptions} />
                </Form.Item>
                <Form.Item name="recorderPersonnelId" label={t('quality.recorder')} style={{ minWidth: 200 }}>
                  <Select allowClear showSearch optionFilterProp="label" options={personnelOptions} />
                </Form.Item>
              </Space>
            </>
          ) : (
            <Space style={{ display: 'flex' }} align="start">
              <Form.Item name="location" label={t('quality.location')} style={{ minWidth: 220 }}>
                <Input maxLength={200} />
              </Form.Item>
              <Form.Item name="trainerName" label={t('quality.trainer')} style={{ minWidth: 220 }}>
                <Input maxLength={100} />
              </Form.Item>
            </Space>
          )}
          <Form.Item name="attendeeIds" label={t('quality.attendees')}>
            <Select mode="multiple" showSearch optionFilterProp="label" options={personnelOptions} />
          </Form.Item>
          {isMeeting ? (
            <>
              <Form.Item name="topics" label={t('quality.topics')}>
                <Input.TextArea rows={2} maxLength={4000} />
              </Form.Item>
              <Form.Item name="lastWeekReport" label={t('quality.lastWeekReport')}>
                <Input.TextArea rows={2} maxLength={4000} />
              </Form.Item>
              <Form.Item label={t('quality.thisWeekTasks')}>
                <Form.List name="thisWeekTasks">
                  {(fields, { add, remove: removeField }) => (
                    <>
                      {fields.map((field) => (
                        <Space key={field.key} style={{ display: 'flex', marginBottom: 6 }} align="start">
                          <Form.Item name={[field.name, 'category']} noStyle initialValue="DAILY">
                            <Select style={{ width: 130 }} options={CATEGORIES.map((c) => ({ value: c, label: t(`quality.taskCategories.${c}`) }))} />
                          </Form.Item>
                          <Form.Item name={[field.name, 'content']} noStyle>
                            <Input style={{ width: 460 }} maxLength={500} />
                          </Form.Item>
                          <Button icon={<DeleteOutlined />} onClick={() => removeField(field.name)} />
                        </Space>
                      ))}
                      <Button type="dashed" onClick={() => add({ category: 'DAILY', content: '' })} icon={<PlusOutlined />}>
                        {t('quality.addTask')}
                      </Button>
                    </>
                  )}
                </Form.List>
              </Form.Item>
              <Form.Item name="faultAnalysis" label={t('quality.faultAnalysis')}>
                <Input.TextArea rows={2} maxLength={4000} />
              </Form.Item>
              <Form.Item name="suggestions" label={t('quality.suggestions')}>
                <Input.TextArea rows={2} maxLength={4000} />
              </Form.Item>
            </>
          ) : (
            <Form.Item name="content" label={t('quality.trainingContent')}>
              <Input.TextArea rows={4} maxLength={4000} />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal open={!!viewing} title={viewing?.subject} footer={null} onCancel={() => setViewing(undefined)} width={720}>
        {viewing && (
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label={t('quality.timeRange')}>{`${cnDateTimeLabel(viewing.startAt)} ~ ${cnDateTimeLabel(viewing.endAt)}`}</Descriptions.Item>
            {isMeeting && view ? (
              <>
                <Descriptions.Item label={t('quality.method')}>{t(`quality.methods.${view.method}`)}</Descriptions.Item>
                <Descriptions.Item label={t('quality.department')}>{view.department ?? '-'}</Descriptions.Item>
                <Descriptions.Item label={t('quality.location')}>{view.location ?? '-'}</Descriptions.Item>
                <Descriptions.Item label={t('quality.host')}>{view.host ?? '-'}</Descriptions.Item>
                <Descriptions.Item label={t('quality.recorder')}>{view.recorder ?? '-'}</Descriptions.Item>
                <Descriptions.Item label={t('quality.attendees')}>{view.attendees.join('、') || '-'}</Descriptions.Item>
                <Descriptions.Item label={t('quality.topics')}>{view.topics ?? '-'}</Descriptions.Item>
                <Descriptions.Item label={t('quality.lastWeekReport')}>{view.lastWeekReport ?? '-'}</Descriptions.Item>
                <Descriptions.Item label={t('quality.thisWeekTasks')}>
                  {view.thisWeekTasksJson.length ? view.thisWeekTasksJson.map((x, i) => <div key={i}>{`[${t(`quality.taskCategories.${x.category}`)}] ${x.content}`}</div>) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label={t('quality.faultAnalysis')}>{view.faultAnalysis ?? '-'}</Descriptions.Item>
                <Descriptions.Item label={t('quality.suggestions')}>{view.suggestions ?? '-'}</Descriptions.Item>
              </>
            ) : (
              <>
                <Descriptions.Item label={t('quality.location')}>{viewing.location ?? '-'}</Descriptions.Item>
                <Descriptions.Item label={t('quality.trainer')}>{(viewing as Training).trainerName ?? '-'}</Descriptions.Item>
                <Descriptions.Item label={t('quality.attendees')}>{viewing.attendees.join('、') || '-'}</Descriptions.Item>
                <Descriptions.Item label={t('quality.trainingContent')}>{(viewing as Training).content ?? '-'}</Descriptions.Item>
              </>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}
