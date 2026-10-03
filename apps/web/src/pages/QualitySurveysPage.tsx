import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Alert, App, Button, Card, Checkbox, Drawer, Empty, Form, Input, Modal, Popconfirm, Progress, Radio, Rate, Select, Space, Switch, Table, Tag, Typography } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MySurvey, QuestionType, Survey, SurveyQuestionInput, SurveyStats } from '../api/quality'
import { qualityApi } from '../api/quality'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'
import { cnDateTimeLabel } from '../utils/trainingPlanTime'

const TYPES: QuestionType[] = ['SINGLE', 'MULTI', 'RATING', 'TEXT']
const STATUS_COLOR = { DRAFT: 'orange', PUBLISHED: 'green', CLOSED: 'default' } as const
const apiError = (e: unknown, fallback: string) => {
  const msg = (e as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
  return (Array.isArray(msg) ? msg.join('; ') : msg) ?? fallback
}

/// 问卷管理: 新建/编辑草稿 → 发布(全员收到站内通知) → 统计 → 关闭。
export function QualitySurveysPage() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { organizations, selectedId, select } = useSelectedOrganization()
  const [rows, setRows] = useState<Survey[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!selectedId) return
    setLoading(true)
    try {
      setRows(await qualityApi.listSurveys(selectedId))
    } catch (e) {
      message.error(apiError(e, t('quality.failed')))
    } finally {
      setLoading(false)
    }
  }, [selectedId, message, t])

  useEffect(() => {
    load()
  }, [load])

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn()
      message.success(ok)
      await load()
    } catch (e) {
      message.error(apiError(e, t('quality.failed')))
    }
  }

  // ---------------- 编辑 ----------------
  const [modal, setModal] = useState<{ open: boolean; editing?: Survey }>({ open: false })
  const [form] = Form.useForm()

  const openModal = (editing?: Survey) => {
    form.resetFields()
    form.setFieldsValue(
      editing
        ? { title: editing.title, description: editing.description ?? undefined, anonymous: editing.anonymous, questions: editing.questions.map((q) => ({ type: q.type, text: q.text, required: q.required, options: q.options })) }
        : { anonymous: false, questions: [{ type: 'RATING', text: '', required: true }] },
    )
    setModal({ open: true, editing })
  }

  const save = async () => {
    const v = await form.validateFields()
    if (!selectedId) return
    const questions: SurveyQuestionInput[] = (v.questions ?? []).map((q: SurveyQuestionInput) => ({
      type: q.type,
      text: q.text,
      required: !!q.required,
      ...(q.type === 'SINGLE' || q.type === 'MULTI' ? { options: q.options ?? [] } : {}),
    }))
    const data = { title: v.title.trim(), description: v.description?.trim() || undefined, anonymous: !!v.anonymous, questions }
    try {
      if (modal.editing) await qualityApi.updateSurvey(modal.editing.id, data)
      else await qualityApi.createSurvey({ organizationId: selectedId, ...data })
      message.success(t('quality.saved'))
      setModal({ open: false })
      await load()
    } catch (e) {
      message.error(apiError(e, t('quality.failed')))
    }
  }

  // ---------------- 统计 ----------------
  const [stats, setStats] = useState<SurveyStats>()
  const openStats = async (id: string) => {
    try {
      setStats(await qualityApi.surveyStats(id))
    } catch (e) {
      message.error(apiError(e, t('quality.failed')))
    }
  }

  return (
    <div>
      <OrganizationSelector organizations={organizations} selectedId={selectedId} onChange={select} />
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        {t('quality.surveysTitle')}
      </Typography.Title>
      <Typography.Paragraph type="secondary">{t('quality.surveysIntro')}</Typography.Paragraph>
      <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 8 }} disabled={!selectedId} onClick={() => openModal()}>
        {t('quality.addSurvey')}
      </Button>
      {!selectedId ? (
        <Empty description={t('common.selectOrganizationPlaceholder')} />
      ) : (
        <Table
          rowKey="id"
          size="small"
          loading={loading}
          dataSource={rows}
          locale={{ emptyText: t('quality.noData') }}
          columns={[
            { title: t('quality.surveyTitle'), dataIndex: 'title' },
            { title: t('quality.status'), render: (_, s) => <Tag color={STATUS_COLOR[s.status]}>{t(`quality.surveyStatus.${s.status}`)}</Tag> },
            { title: t('quality.anonymous'), render: (_, s) => (s.anonymous ? t('quality.yes') : '-') },
            { title: t('quality.questionCount'), render: (_, s) => s.questions.length },
            { title: t('quality.responseCount'), dataIndex: 'responseCount' },
            {
              title: '',
              render: (_, s) => (
                <Space size={4} wrap>
                  {s.status === 'DRAFT' && (
                    <>
                      <Button size="small" onClick={() => openModal(s)}>{t('quality.edit')}</Button>
                      <Popconfirm title={t('quality.publishConfirm')} onConfirm={() => act(() => qualityApi.publishSurvey(s.id), t('quality.published'))}>
                        <Button size="small" type="primary">{t('quality.publish')}</Button>
                      </Popconfirm>
                      <Popconfirm title={t('quality.deleteConfirm')} onConfirm={() => act(() => qualityApi.deleteSurvey(s.id), t('quality.deleted'))}>
                        <Button size="small" danger>{t('quality.delete')}</Button>
                      </Popconfirm>
                    </>
                  )}
                  {s.status !== 'DRAFT' && <Button size="small" onClick={() => openStats(s.id)}>{t('quality.stats')}</Button>}
                  {s.status === 'PUBLISHED' && (
                    <Popconfirm title={t('quality.closeConfirm')} onConfirm={() => act(() => qualityApi.closeSurvey(s.id), t('quality.closed'))}>
                      <Button size="small">{t('quality.close')}</Button>
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
        />
      )}

      <Modal title={modal.editing ? t('quality.editSurvey') : t('quality.addSurvey')} open={modal.open} onCancel={() => setModal({ open: false })} onOk={save} width={720} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label={t('quality.surveyTitle')} rules={[{ required: true }]}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item name="description" label={t('quality.description')}>
            <Input.TextArea rows={2} maxLength={2000} />
          </Form.Item>
          <Form.Item name="anonymous" label={t('quality.anonymous')} valuePropName="checked" extra={t('quality.anonymousHint')}>
            <Switch />
          </Form.Item>
          <Form.List name="questions">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => (
                  <Card key={field.key} size="small" style={{ marginBottom: 8 }} title={`${t('quality.question')} ${index + 1}`} extra={fields.length > 1 && <Button size="small" icon={<DeleteOutlined />} onClick={() => remove(field.name)} />}>
                    <Space style={{ display: 'flex' }} align="start">
                      <Form.Item name={[field.name, 'type']} label={t('quality.questionType')} style={{ minWidth: 130 }}>
                        <Select options={TYPES.map((x) => ({ value: x, label: t(`quality.questionTypes.${x}`) }))} />
                      </Form.Item>
                      <Form.Item name={[field.name, 'text']} label={t('quality.questionText')} rules={[{ required: true }]} style={{ minWidth: 380 }}>
                        <Input maxLength={300} />
                      </Form.Item>
                      <Form.Item name={[field.name, 'required']} label={t('quality.required')} valuePropName="checked">
                        <Switch />
                      </Form.Item>
                    </Space>
                    <Form.Item noStyle shouldUpdate={(prev, cur) => prev.questions?.[field.name]?.type !== cur.questions?.[field.name]?.type}>
                      {({ getFieldValue }) => {
                        const type = getFieldValue(['questions', field.name, 'type'])
                        return type === 'SINGLE' || type === 'MULTI' ? (
                          <Form.Item name={[field.name, 'options']} label={t('quality.options')} rules={[{ required: true, type: 'array', min: 2, message: t('quality.optionsRule') }]} extra={t('quality.optionsHint')}>
                            <Select mode="tags" open={false} tokenSeparators={[',', '，', '\n']} />
                          </Form.Item>
                        ) : null
                      }}
                    </Form.Item>
                  </Card>
                ))}
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ type: 'SINGLE', text: '', required: false, options: [] })}>
                  {t('quality.addQuestion')}
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      <Drawer open={!!stats} onClose={() => setStats(undefined)} width={640} title={stats?.title} destroyOnHidden>
        {stats && (
          <>
            <Space style={{ marginBottom: 12 }}>
              <Tag color={STATUS_COLOR[stats.status]}>{t(`quality.surveyStatus.${stats.status}`)}</Tag>
              <Typography.Text>{t('quality.totalResponses', { count: stats.totalResponses })}</Typography.Text>
              {stats.anonymous && <Tag>{t('quality.anonymous')}</Tag>}
            </Space>
            {stats.stats.map((q, i) => (
              <Card key={q.id} size="small" style={{ marginBottom: 8 }} title={`${i + 1}. ${q.text}`} extra={<Typography.Text type="secondary">{t('quality.answeredCount', { count: q.answered })}</Typography.Text>}>
                {q.options && q.options.map((o) => (
                  <div key={o.option} style={{ marginBottom: 4 }}>
                    <Typography.Text>{o.option}</Typography.Text>
                    <Progress percent={o.percent} format={() => `${o.count} (${o.percent}%)`} size="small" />
                  </div>
                ))}
                {q.type === 'RATING' && (
                  <>
                    <Typography.Paragraph>
                      {t('quality.average')}：<b>{q.average ?? '-'}</b>
                    </Typography.Paragraph>
                    {q.distribution?.map((d) => (
                      <div key={d.score}>
                        <Rate disabled value={d.score} count={5} style={{ fontSize: 12 }} /> × {d.count}
                      </div>
                    ))}
                  </>
                )}
                {q.type === 'TEXT' && (q.texts?.length ? q.texts.map((x, idx) => <div key={idx}>· {x}</div>) : <Typography.Text type="secondary">{t('quality.noData')}</Typography.Text>)}
              </Card>
            ))}
            <Typography.Title level={5}>{t('quality.records')}</Typography.Title>
            <Table
              rowKey={(_, i) => String(i)}
              size="small"
              pagination={{ pageSize: 10 }}
              dataSource={stats.records}
              locale={{ emptyText: t('quality.noData') }}
              columns={[
                { title: t('quality.respondent'), render: (_, r) => r.respondent ?? t('quality.anonymousRespondent') },
                { title: t('quality.submittedAt'), render: (_, r) => cnDateTimeLabel(r.submittedAt) },
              ]}
            />
          </>
        )}
      </Drawer>
    </div>
  )
}

/// 我的问卷: 任意登录用户填写本租户已发布的问卷, 每份只能填一次。
export function MySurveysPage() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [surveys, setSurveys] = useState<MySurvey[]>([])
  const [filling, setFilling] = useState<MySurvey>()
  const [answers, setAnswers] = useState<Record<string, unknown>>({})

  const load = useCallback(async () => {
    try {
      setSurveys(await qualityApi.mySurveys())
    } catch (e) {
      message.error(apiError(e, t('quality.failed')))
    }
  }, [message, t])

  useEffect(() => {
    load()
  }, [load])

  const submit = async () => {
    if (!filling) return
    const missing = filling.questions.find((q) => q.required && (answers[q.id] === undefined || answers[q.id] === '' || (Array.isArray(answers[q.id]) && (answers[q.id] as unknown[]).length === 0)))
    if (missing) {
      message.warning(t('quality.requiredMissing', { text: missing.text }))
      return
    }
    try {
      await qualityApi.respond(filling.id, answers)
      message.success(t('quality.submitted'))
      setFilling(undefined)
      await load()
    } catch (e) {
      message.error(apiError(e, t('quality.failed')))
    }
  }

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        {t('quality.mySurveysTitle')}
      </Typography.Title>
      {surveys.length === 0 ? (
        <Empty description={t('quality.noSurveys')} />
      ) : (
        <Space direction="vertical" style={{ width: '100%', maxWidth: 720 }}>
          {surveys.map((s) => (
            <Card
              key={s.id}
              size="small"
              title={s.title}
              extra={s.answered ? <Tag color="green">{t('quality.answered')}</Tag> : <Button type="primary" size="small" onClick={() => { setAnswers({}); setFilling(s) }}>{t('quality.fill')}</Button>}
            >
              <Typography.Text type="secondary">{s.organizationName}{s.anonymous ? ` · ${t('quality.anonymous')}` : ''}</Typography.Text>
              {s.description && <Typography.Paragraph style={{ marginBottom: 0 }}>{s.description}</Typography.Paragraph>}
            </Card>
          ))}
        </Space>
      )}
      <Modal open={!!filling} title={filling?.title} onCancel={() => setFilling(undefined)} onOk={submit} okText={t('quality.submit')} width={640} destroyOnHidden>
        {filling?.anonymous && <Alert type="info" showIcon style={{ marginBottom: 12 }} message={t('quality.anonymousHint')} />}
        {filling?.questions.map((q, i) => (
          <div key={q.id} style={{ marginBottom: 16 }}>
            <Typography.Paragraph strong style={{ marginBottom: 4 }}>
              {i + 1}. {q.text} {q.required && <span style={{ color: '#cf1322' }}>*</span>}
            </Typography.Paragraph>
            {q.type === 'SINGLE' && <Radio.Group value={answers[q.id]} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} options={(q.options ?? []).map((o) => ({ value: o, label: o }))} />}
            {q.type === 'MULTI' && <Checkbox.Group value={(answers[q.id] as string[]) ?? []} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} options={(q.options ?? []).map((o) => ({ value: o, label: o }))} />}
            {q.type === 'RATING' && <Rate value={(answers[q.id] as number) ?? 0} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v || undefined }))} />}
            {q.type === 'TEXT' && <Input.TextArea rows={3} maxLength={2000} value={(answers[q.id] as string) ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} />}
          </div>
        ))}
      </Modal>
    </div>
  )
}
