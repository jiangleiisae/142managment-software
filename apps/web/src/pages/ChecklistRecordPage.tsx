import { Alert, App, Button, DatePicker, Empty, Input, Modal, Radio, Select, Space, Table, Tabs, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { ChecklistRecordRow, ChecklistTemplate, ChecklistType, ExpectedItem, ExpectedResult } from '../api/checklists'
import { checklistsApi } from '../api/checklists'
import { fstdsApi } from '../api/fstds'
import type { RosterMember } from '../api/roster'
import { rosterApi } from '../api/roster'
import type { Fstd } from '../api/types'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'
import { cnTodayString, shiftDay } from '../utils/trainingPlanTime'

const { RangePicker } = DatePicker
const apiError = (e: unknown, fallback: string) => {
  const msg = (e as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
  return (Array.isArray(msg) ? msg.join('; ') : msg) ?? fallback
}

const STATUS_COLOR: Record<ExpectedItem['status'], string> = { DONE: 'green', PENDING: 'blue', UPCOMING: 'default', MISSED: 'red' }

/// 航前记录 / 航后记录 (同一个页面, 按 type 区分): 今日应做清单 + 登记 + 历史记录。
export function ChecklistRecordPage({ type }: { type: ChecklistType }) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { organizations, selectedId, select } = useSelectedOrganization()
  const today = cnTodayString()
  const label = t(type === 'PRE_FLIGHT' ? 'checklist.preFlight' : 'checklist.postFlight')

  const [fstds, setFstds] = useState<Fstd[]>([])
  const [members, setMembers] = useState<RosterMember[]>([])
  useEffect(() => {
    if (!selectedId) return
    Promise.all([fstdsApi.list(selectedId), rosterApi.listMembers(selectedId)]).then(([f, m]) => {
      setFstds(f)
      setMembers(m)
    })
  }, [selectedId])

  // ---------------- 今日清单 ----------------
  const [date, setDate] = useState(today)
  const [expected, setExpected] = useState<ExpectedResult>()
  const [loading, setLoading] = useState(false)

  const loadExpected = useCallback(async () => {
    if (!selectedId) return
    setLoading(true)
    try {
      setExpected(await checklistsApi.expected(selectedId, date, type))
    } catch (e) {
      message.error(apiError(e, t('checklist.failed')))
    } finally {
      setLoading(false)
    }
  }, [selectedId, date, type, message, t])

  useEffect(() => {
    loadExpected()
  }, [loadExpected])

  // ---------------- 登记 / 查看 ----------------
  const [doing, setDoing] = useState<ExpectedItem>()
  const [template, setTemplate] = useState<ChecklistTemplate>()
  const [results, setResults] = useState<Record<string, { passed: boolean; notes: string }>>({})
  const [performer, setPerformer] = useState<string>()
  const [note, setNote] = useState('')
  const [viewing, setViewing] = useState<ChecklistRecordRow>()

  const openDo = async (item: ExpectedItem) => {
    if (!selectedId) return
    const [tpl] = await checklistsApi.listTemplates(selectedId, item.fstdId).then((rows) => rows.filter((r) => r.type === type))
    setTemplate(tpl)
    setResults(Object.fromEntries((tpl?.items ?? []).map((i) => [i.no, { passed: true, notes: '' }])))
    setPerformer(undefined)
    setNote('')
    setDoing(item)
  }

  const submit = async () => {
    if (!doing || !selectedId || !template) return
    try {
      await checklistsApi.createRecord({
        organizationId: selectedId,
        fstdId: doing.fstdId,
        type,
        date,
        shiftTypeId: doing.shiftTypeId,
        results: template.items.map((i) => ({ no: i.no, passed: results[i.no]?.passed ?? false, notes: results[i.no]?.notes || undefined })),
        performedByPersonnelId: performer,
        note: note || undefined,
      })
      message.success(t('checklist.saved'))
      setDoing(undefined)
      await loadExpected()
      await loadHistory()
    } catch (e) {
      message.error(apiError(e, t('checklist.failed')))
    }
  }

  const openView = async (recordId: string) => {
    if (!selectedId) return
    const rows = await checklistsApi.listRecords(selectedId, { type, from: date, to: date })
    setViewing(rows.find((r) => r.id === recordId))
  }

  const statusText: Record<ExpectedItem['status'], string> = {
    DONE: t('checklist.statusDone'),
    PENDING: t('checklist.statusPending'),
    UPCOMING: t('checklist.statusUpcoming'),
    MISSED: t('checklist.statusMissed'),
  }

  const expectedColumns: ColumnsType<ExpectedItem> = [
    { title: t('checklist.device'), render: (_, i) => `${i.deviceCode} ${i.representedAircraft}` },
    { title: t('checklist.shift'), render: (_, i) => `${i.shiftCode} ${i.shiftName}` },
    { title: t('checklist.rostered'), render: (_, i) => i.rostered.join('、') },
    { title: t('checklist.status'), render: (_, i) => <Tag color={STATUS_COLOR[i.status]}>{statusText[i.status]}</Tag> },
    { title: t('checklist.result'), render: (_, i) => (i.overallResult ? (i.overallResult === 'pass' ? <Tag color="green">{t('checklist.pass')}</Tag> : <Tag color="orange">{t('checklist.issues')}</Tag>) : '-') },
    { title: t('checklist.performedBy'), render: (_, i) => i.performedBy ?? '-' },
    {
      title: '',
      render: (_, i) =>
        i.status === 'DONE' && i.recordId ? (
          <Button size="small" onClick={() => openView(i.recordId as string)}>
            {t('checklist.view')}
          </Button>
        ) : (
          <Button size="small" type="primary" onClick={() => openDo(i)}>
            {t('checklist.record')}
          </Button>
        ),
    },
  ]

  const todayTab = (
    <>
      <Space style={{ marginBottom: 8 }} wrap>
        <DatePicker allowClear={false} value={dayjs(date)} onChange={(v) => v && setDate(v.format('YYYY-MM-DD'))} />
        <Button onClick={loadExpected}>{t('checklist.refresh')}</Button>
      </Space>
      <Typography.Paragraph type="secondary">{t('checklist.expectedNote')}</Typography.Paragraph>
      {expected?.noFlaggedShift && <Alert style={{ marginBottom: 8 }} type="warning" showIcon message={t('checklist.noFlaggedShift')} description={<Link to="/roster">{t('checklist.goShifts')}</Link>} />}
      {!!expected?.shiftsWithoutRoster.length && !expected.noFlaggedShift && (
        <Alert style={{ marginBottom: 8 }} type="info" showIcon message={t('checklist.noRoster', { codes: expected.shiftsWithoutRoster.join('、') })} description={<Link to="/roster">{t('checklist.goRoster')}</Link>} />
      )}
      {!!expected?.missingTemplates.filter((m) => m.type === type).length && (
        <Alert
          style={{ marginBottom: 8 }}
          type="warning"
          showIcon
          message={t('checklist.missingTemplate', { devices: [...new Set(expected.missingTemplates.filter((m) => m.type === type).map((m) => m.deviceCode))].join('、') })}
          description={<Link to="/checklist-config">{t('checklist.goConfig')}</Link>}
        />
      )}
      {!!expected?.grounded.length && (
        <Space style={{ marginBottom: 8 }}>
          <Typography.Text type="secondary">{t('checklist.groundedToday')}</Typography.Text>
          {expected.grounded.map((g) => (
            <Tag key={g.fstdId}>{g.deviceCode}</Tag>
          ))}
        </Space>
      )}
      <Table rowKey={(i) => `${i.fstdId}-${i.shiftTypeId}`} size="small" loading={loading} dataSource={expected?.items ?? []} columns={expectedColumns} pagination={false} locale={{ emptyText: t('checklist.noItems') }} />
    </>
  )

  // ---------------- 历史 ----------------
  const [range, setRange] = useState<[string, string]>([shiftDay(today, -14), today])
  const [historyFstd, setHistoryFstd] = useState<string>()
  const [history, setHistory] = useState<ChecklistRecordRow[]>([])

  const loadHistory = useCallback(async () => {
    if (!selectedId) return
    try {
      setHistory(await checklistsApi.listRecords(selectedId, { type, fstdId: historyFstd, from: range[0], to: range[1] }))
    } catch (e) {
      message.error(apiError(e, t('checklist.failed')))
    }
  }, [selectedId, type, historyFstd, range, message, t])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const historyTab = (
    <>
      <Space wrap style={{ marginBottom: 8 }}>
        <RangePicker allowClear={false} value={[dayjs(range[0]), dayjs(range[1])]} onChange={(v) => v?.[0] && v[1] && setRange([v[0].format('YYYY-MM-DD'), v[1].format('YYYY-MM-DD')])} />
        <Select allowClear style={{ width: 160 }} placeholder={t('checklist.device')} value={historyFstd} onChange={setHistoryFstd} options={fstds.map((f) => ({ value: f.id, label: f.deviceCode }))} />
      </Space>
      <Table
        rowKey="id"
        size="small"
        dataSource={history}
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: t('checklist.noData') }}
        columns={[
          { title: t('checklist.date'), dataIndex: 'date' },
          { title: t('checklist.device'), dataIndex: 'deviceCode' },
          { title: t('checklist.shift'), dataIndex: 'shiftCode' },
          { title: t('checklist.performedBy'), render: (_, r) => r.performedBy ?? '-' },
          { title: t('checklist.result'), render: (_, r) => (r.overallResult === 'pass' ? <Tag color="green">{t('checklist.pass')}</Tag> : <Tag color="orange">{t('checklist.issues')}</Tag>) },
          { title: '', render: (_, r) => <Button size="small" onClick={() => setViewing(r)}>{t('checklist.view')}</Button> },
        ]}
      />
    </>
  )

  return (
    <div>
      <OrganizationSelector organizations={organizations} selectedId={selectedId} onChange={select} />
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        {label}
      </Typography.Title>
      {!selectedId ? <Empty description={t('common.selectOrganizationPlaceholder')} /> : <Tabs items={[{ key: 'today', label: t('checklist.tabToday'), children: todayTab }, { key: 'history', label: t('checklist.tabHistory'), children: historyTab }]} />}

      <Modal
        open={!!doing}
        title={doing ? `${label} · ${doing.deviceCode} · ${date} ${doing.shiftCode}` : ''}
        onCancel={() => setDoing(undefined)}
        onOk={submit}
        okText={t('checklist.submit')}
        width={720}
        destroyOnHidden
      >
        {!template ? (
          <Alert type="warning" showIcon message={t('checklist.noTemplate')} />
        ) : (
          <>
            <Table
              rowKey="no"
              size="small"
              pagination={false}
              dataSource={template.items}
              columns={[
                { title: t('checklist.itemNo'), dataIndex: 'no', width: 60 },
                {
                  title: t('checklist.item'),
                  render: (_, i) => (
                    <>
                      {i.text}
                      {i.sopUrl && (
                        <>
                          {' '}
                          <a href={i.sopUrl} target="_blank" rel="noreferrer">
                            SOP
                          </a>
                        </>
                      )}
                    </>
                  ),
                },
                {
                  title: t('checklist.result'),
                  width: 150,
                  render: (_, i) => (
                    <Radio.Group
                      size="small"
                      value={results[i.no]?.passed ? 'pass' : 'fail'}
                      onChange={(e) => setResults((r) => ({ ...r, [i.no]: { passed: e.target.value === 'pass', notes: r[i.no]?.notes ?? '' } }))}
                      options={[{ value: 'pass', label: t('checklist.pass') }, { value: 'fail', label: t('checklist.fail') }]}
                      optionType="button"
                    />
                  ),
                },
                {
                  title: t('checklist.notes'),
                  render: (_, i) => <Input size="small" maxLength={500} value={results[i.no]?.notes ?? ''} onChange={(e) => setResults((r) => ({ ...r, [i.no]: { passed: r[i.no]?.passed ?? true, notes: e.target.value } }))} />,
                },
              ]}
            />
            <Space direction="vertical" style={{ width: '100%', marginTop: 12 }}>
              <Select allowClear showSearch optionFilterProp="label" style={{ width: '100%' }} placeholder={t('checklist.performer')} value={performer} onChange={setPerformer} options={members.map((m) => ({ value: m.personnelId, label: m.name }))} />
              <Input.TextArea rows={2} maxLength={500} placeholder={t('checklist.note')} value={note} onChange={(e) => setNote(e.target.value)} />
            </Space>
          </>
        )}
      </Modal>

      <Modal open={!!viewing} title={viewing ? `${label} · ${viewing.deviceCode} · ${viewing.date} ${viewing.shiftCode}` : ''} footer={null} onCancel={() => setViewing(undefined)} width={640}>
        {viewing && (
          <>
            <Typography.Paragraph>
              {t('checklist.performedBy')}：{viewing.performedBy ?? '-'}　{viewing.overallResult === 'pass' ? <Tag color="green">{t('checklist.pass')}</Tag> : <Tag color="orange">{t('checklist.issues')}</Tag>}
            </Typography.Paragraph>
            <Table
              rowKey="no"
              size="small"
              pagination={false}
              dataSource={viewing.items}
              columns={[
                { title: t('checklist.itemNo'), dataIndex: 'no', width: 60 },
                { title: t('checklist.item'), dataIndex: 'text' },
                { title: t('checklist.result'), width: 80, render: (_, i) => (i.passed ? <Tag color="green">{t('checklist.pass')}</Tag> : <Tag color="red">{t('checklist.fail')}</Tag>) },
                { title: t('checklist.notes'), render: (_, i) => i.notes ?? '' },
              ]}
            />
            {viewing.note && <Typography.Paragraph style={{ marginTop: 8 }}>{viewing.note}</Typography.Paragraph>}
          </>
        )}
      </Modal>
    </div>
  )
}
