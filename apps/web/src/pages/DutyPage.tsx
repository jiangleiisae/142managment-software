import { DownloadOutlined, PlusOutlined, PrinterOutlined } from '@ant-design/icons'
import { Alert, App, Button, DatePicker, Descriptions, Divider, Drawer, Empty, Form, Input, Modal, Popconfirm, Radio, Select, Space, Table, Tabs, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DutyDetail, DutyEntryKind, DutyFilters, DutyLogSummary, HandoverRow } from '../api/duty'
import { dutyApi } from '../api/duty'
import { fstdsApi } from '../api/fstds'
import type { RosterGroup, ShiftType, Staff } from '../api/roster'
import { rosterApi } from '../api/roster'
import type { Fstd } from '../api/types'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'
import { cnDateTimeLabel, cnTodayString, shiftDay } from '../utils/trainingPlanTime'

const { RangePicker } = DatePicker
const apiError = (e: unknown, fallback: string) => {
  const msg = (e as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
  return (Array.isArray(msg) ? msg.join('; ') : msg) ?? fallback
}

export function DutyPage() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { organizations, selectedId, select } = useSelectedOrganization()
  const today = cnTodayString()

  const [shifts, setShifts] = useState<ShiftType[]>([])
  const [groups, setGroups] = useState<RosterGroup[]>([])
  const [members, setMembers] = useState<Staff[]>([])
  const [fstds, setFstds] = useState<Fstd[]>([])

  useEffect(() => {
    if (!selectedId) return
    Promise.all([rosterApi.listShiftTypes(selectedId, 'MAINTENANCE'), rosterApi.listGroups(selectedId, 'MAINTENANCE'), rosterApi.listStaff(selectedId, 'MAINTENANCE'), fstdsApi.list(selectedId)]).then(([s, g, m, f]) => {
      setShifts(s)
      setGroups(g)
      setMembers(m)
      setFstds(f)
    })
  }, [selectedId])

  const workShifts = shifts.filter((s) => s.category === 'WORK' && s.isActive)
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn()
      if (ok) message.success(ok)
      return true
    } catch (e) {
      message.error(apiError(e, t('duty.failed')))
      return false
    }
  }

  // ---------------- 日志列表 ----------------
  const [range, setRange] = useState<[string, string]>([shiftDay(today, -14), today])
  const [filters, setFilters] = useState<Pick<DutyFilters, 'status' | 'groupId' | 'engineerId' | 'fstdId' | 'keyword'>>({})
  const [logs, setLogs] = useState<DutyLogSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [openId, setOpenId] = useState<string>()

  const loadLogs = useCallback(async () => {
    if (!selectedId) return
    setLoading(true)
    try {
      setLogs(await dutyApi.list(selectedId, { from: range[0], to: range[1], ...filters }))
    } catch (e) {
      message.error(apiError(e, t('duty.failed')))
    } finally {
      setLoading(false)
    }
  }, [selectedId, range, filters, message, t])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm] = Form.useForm()

  const doCreate = async () => {
    const v = await createForm.validateFields()
    if (!selectedId) return
    try {
      const created = await dutyApi.create(selectedId, v.date.format('YYYY-MM-DD'), v.shiftTypeId, v.groupId)
      setCreateOpen(false)
      await loadLogs()
      setOpenId(created.id)
    } catch (e) {
      message.error(apiError(e, t('duty.failed')))
    }
  }

  const logColumns: ColumnsType<DutyLogSummary> = [
    { title: t('duty.date'), dataIndex: 'date' },
    { title: t('duty.shift'), render: (_, l) => `${l.shiftCode} ${l.shiftName}` },
    { title: t('duty.group'), render: (_, l) => l.groupName ?? '-' },
    { title: t('duty.engineers'), render: (_, l) => (l.engineers.length ? l.engineers.join('、') : '-') },
    { title: t('duty.status'), render: (_, l) => (l.status === 'SUBMITTED' ? <Tag color="green">{t('duty.submitted')}</Tag> : <Tag color="orange">{t('duty.draft')}</Tag>) },
    { title: t('duty.entryCount'), render: (_, l) => (l.nonRoutineCount ? `${l.entryCount} (${t('duty.nonRoutineShort', { count: l.nonRoutineCount })})` : l.entryCount) },
    { title: t('duty.handoverCount'), render: (_, l) => (l.openHandoverCount ? <Tag color="red">{`${l.openHandoverCount}/${l.handoverCount}`}</Tag> : l.handoverCount) },
    { title: '', render: (_, l) => <Button size="small" onClick={() => setOpenId(l.id)}>{t('duty.open')}</Button> },
  ]

  const logsTab = (
    <>
      <Space wrap style={{ marginBottom: 8 }} className="no-print">
        <RangePicker allowClear={false} value={[dayjs(range[0]), dayjs(range[1])]} onChange={(v) => v?.[0] && v[1] && setRange([v[0].format('YYYY-MM-DD'), v[1].format('YYYY-MM-DD')])} />
        <Select allowClear style={{ width: 110 }} placeholder={t('duty.status')} value={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} options={[{ value: 'DRAFT', label: t('duty.draft') }, { value: 'SUBMITTED', label: t('duty.submitted') }]} />
        <Select allowClear style={{ width: 130 }} placeholder={t('duty.group')} value={filters.groupId} onChange={(v) => setFilters((f) => ({ ...f, groupId: v }))} options={groups.map((g) => ({ value: g.id, label: g.name }))} />
        <Select allowClear showSearch optionFilterProp="label" style={{ width: 130 }} placeholder={t('duty.engineer')} value={filters.engineerId} onChange={(v) => setFilters((f) => ({ ...f, engineerId: v }))} options={members.map((m) => ({ value: m.id, label: m.name }))} />
        <Select allowClear style={{ width: 150 }} placeholder={t('duty.device')} value={filters.fstdId} onChange={(v) => setFilters((f) => ({ ...f, fstdId: v }))} options={fstds.map((f) => ({ value: f.id, label: `${f.deviceCode} ${f.representedAircraft}` }))} />
        <Input.Search allowClear style={{ width: 180 }} placeholder={t('duty.keyword')} onSearch={(v) => setFilters((f) => ({ ...f, keyword: v || undefined }))} />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); createForm.setFieldsValue({ date: dayjs(today) }); setCreateOpen(true) }}>
          {t('duty.create')}
        </Button>
        <Button icon={<DownloadOutlined />} disabled={!selectedId} onClick={() => selectedId && dutyApi.exportLogs(selectedId, { from: range[0], to: range[1], ...filters })}>
          {t('duty.export')}
        </Button>
        <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
          {t('duty.print')}
        </Button>
      </Space>
      <Table rowKey="id" size="small" loading={loading} dataSource={logs} columns={logColumns} pagination={{ pageSize: 20 }} locale={{ emptyText: t('duty.noData') }} />
      <Modal title={t('duty.create')} open={createOpen} onCancel={() => setCreateOpen(false)} onOk={doCreate} destroyOnHidden>
        <Form form={createForm} layout="vertical">
          <Form.Item name="date" label={t('duty.date')} rules={[{ required: true }]}>
            <DatePicker allowClear={false} />
          </Form.Item>
          <Form.Item name="shiftTypeId" label={t('duty.shift')} rules={[{ required: true }]}>
            <Select options={workShifts.map((s) => ({ value: s.id, label: `${s.code} ${s.name} ${s.startTime}-${s.endTime}${s.endsNextDay ? '(+1)' : ''}` }))} />
          </Form.Item>
          <Form.Item name="groupId" label={t('duty.group')}>
            <Select allowClear placeholder={t('duty.noGroup')} options={groups.map((g) => ({ value: g.id, label: g.name }))} />
          </Form.Item>
          <Typography.Text type="secondary">{t('duty.createHint')}</Typography.Text>
        </Form>
      </Modal>
    </>
  )

  // ---------------- 交接班查询 ----------------
  const [hoRange, setHoRange] = useState<[string, string]>([shiftDay(today, -14), today])
  const [hoStatus, setHoStatus] = useState<string>()
  const [hoKeyword, setHoKeyword] = useState<string>()
  const [handovers, setHandovers] = useState<HandoverRow[]>([])

  const loadHandovers = useCallback(async () => {
    if (!selectedId) return
    try {
      setHandovers(await dutyApi.listHandovers(selectedId, { from: hoRange[0], to: hoRange[1], status: hoStatus, keyword: hoKeyword }))
    } catch (e) {
      message.error(apiError(e, t('duty.failed')))
    }
  }, [selectedId, hoRange, hoStatus, hoKeyword, message, t])

  useEffect(() => {
    loadHandovers()
  }, [loadHandovers])

  const handoverTab = (
    <>
      <Space wrap style={{ marginBottom: 8 }}>
        <RangePicker allowClear={false} value={[dayjs(hoRange[0]), dayjs(hoRange[1])]} onChange={(v) => v?.[0] && v[1] && setHoRange([v[0].format('YYYY-MM-DD'), v[1].format('YYYY-MM-DD')])} />
        <Select allowClear style={{ width: 120 }} placeholder={t('duty.status')} value={hoStatus} onChange={setHoStatus} options={[{ value: 'open', label: t('duty.hoOpen') }, { value: 'completed', label: t('duty.hoDone') }]} />
        <Input.Search allowClear style={{ width: 200 }} placeholder={t('duty.keyword')} onSearch={(v) => setHoKeyword(v || undefined)} />
      </Space>
      <Typography.Paragraph type="secondary">{t('duty.handoverNote')}</Typography.Paragraph>
      <Table
        rowKey="id"
        size="small"
        dataSource={handovers}
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: t('duty.noData') }}
        columns={[
          { title: t('duty.from'), render: (_, h) => `${h.fromDate} ${h.fromShiftCode}${h.fromGroupName ? ` · ${h.fromGroupName}` : ''}` },
          { title: t('duty.to'), render: (_, h) => `${h.toDate} ${h.toShiftCode}` },
          { title: t('duty.device'), render: (_, h) => h.deviceCode ?? '-' },
          { title: t('duty.content'), dataIndex: 'content' },
          { title: t('duty.status'), render: (_, h) => (h.completedAt ? <Tag color="green">{t('duty.hoDone')}</Tag> : <Tag color="red">{t('duty.hoOpen')}</Tag>) },
          { title: '', render: (_, h) => <Button size="small" onClick={() => setOpenId(h.logId)}>{t('duty.open')}</Button> },
        ]}
      />
    </>
  )

  return (
    <div>
      <OrganizationSelector organizations={organizations} selectedId={selectedId} onChange={select} />
      <Typography.Paragraph type="secondary" className="no-print">{t('duty.intro')}</Typography.Paragraph>
      {!selectedId ? (
        <Empty description={t('common.selectOrganizationPlaceholder')} />
      ) : (
        <Tabs items={[{ key: 'logs', label: t('duty.tabLogs'), children: logsTab }, { key: 'handovers', label: t('duty.tabHandovers'), children: handoverTab }]} />
      )}
      <DutyDrawer
        id={openId}
        members={members}
        fstds={fstds}
        workShifts={workShifts}
        run={run}
        onClose={() => {
          setOpenId(undefined)
          loadLogs()
          loadHandovers()
        }}
      />
    </div>
  )
}

function DutyDrawer({
  id,
  members,
  fstds,
  workShifts,
  run,
  onClose,
}: {
  id?: string
  members: Staff[]
  fstds: Fstd[]
  workShifts: ShiftType[]
  run: (fn: () => Promise<unknown>, ok?: string) => Promise<boolean>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [d, setD] = useState<DutyDetail>()
  const [entryKind, setEntryKind] = useState<DutyEntryKind>('ROUTINE')
  const [entryText, setEntryText] = useState('')
  const [entryFstd, setEntryFstd] = useState<string>()
  const [hoText, setHoText] = useState('')
  const [hoFstd, setHoFstd] = useState<string>()
  const [hoDate, setHoDate] = useState<string>()
  const [hoShift, setHoShift] = useState<string>()

  const reload = useCallback(async () => {
    if (id) setD(await dutyApi.detail(id))
  }, [id])

  useEffect(() => {
    setD(undefined)
    reload()
  }, [reload])

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    if (await run(fn, ok)) await reload()
  }
  const draft = d?.status === 'DRAFT'
  const fstdOptions = fstds.map((f) => ({ value: f.id, label: f.deviceCode }))
  const timeText = d?.shift.startTime ? `${d.shift.startTime}-${d.shift.endTime}${d.shift.endsNextDay ? '(+1)' : ''}` : ''

  return (
    <Drawer open={!!id} onClose={onClose} width={760} title={d ? `${d.date} ${d.shift.code} ${d.shift.name}${d.group ? ` · ${d.group.name}` : ''}` : ''} destroyOnHidden>
      {!d ? null : (
        <>
          <Space style={{ marginBottom: 12 }} wrap>
            {d.status === 'SUBMITTED' ? <Tag color="green">{t('duty.submitted')}</Tag> : <Tag color="orange">{t('duty.draft')}</Tag>}
            <Typography.Text type="secondary">{timeText}</Typography.Text>
            {draft ? (
              <>
                <Popconfirm title={t('duty.submitConfirm')} onConfirm={() => act(() => dutyApi.submit(d.id), t('duty.submittedOk'))}>
                  <Button type="primary">{t('duty.submit')}</Button>
                </Popconfirm>
                <Popconfirm
                  title={t('duty.deleteConfirm')}
                  onConfirm={async () => {
                    if (await run(() => dutyApi.remove(d.id))) onClose()
                  }}
                >
                  <Button danger>{t('duty.delete')}</Button>
                </Popconfirm>
              </>
            ) : (
              <Popconfirm title={t('duty.reopenConfirm')} onConfirm={() => act(() => dutyApi.reopen(d.id), t('duty.reopenedOk'))}>
                <Button>{t('duty.reopen')}</Button>
              </Popconfirm>
            )}
          </Space>

          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label={t('duty.engineers')}>
              <Select
                mode="multiple"
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
                disabled={!draft}
                value={d.engineers.map((e) => e.staffId)}
                options={members.map((m) => ({ value: m.id, label: m.name }))}
                onChange={(ids) => act(() => dutyApi.setEngineers(d.id, ids))}
              />
            </Descriptions.Item>
          </Descriptions>

          <Divider orientation="left">{t('duty.incoming')}</Divider>
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={d.incoming}
            locale={{ emptyText: t('duty.noIncoming') }}
            columns={[
              { title: t('duty.from'), render: (_, h) => `${h.fromDate} ${h.fromShiftCode}${h.fromGroupName ? ` · ${h.fromGroupName}` : ''}` },
              { title: t('duty.device'), render: (_, h) => h.deviceCode ?? '-' },
              { title: t('duty.content'), dataIndex: 'content' },
              {
                title: '',
                render: (_, h) =>
                  h.completedAt ? (
                    <Space>
                      <Tag color="green">{h.completedInThisLog ? t('duty.doneHere') : t('duty.hoDone')}</Tag>
                      <Button size="small" onClick={() => act(() => dutyApi.reopenHandover(h.id))}>{t('duty.undo')}</Button>
                    </Space>
                  ) : (
                    <Button size="small" type="primary" ghost onClick={() => act(() => dutyApi.completeHandover(h.id, d.id))}>{t('duty.markDone')}</Button>
                  ),
              },
            ]}
          />

          <Divider orientation="left">{t('duty.drRecords')}</Divider>
          <Typography.Paragraph type="secondary">{d.drIsSnapshot ? t('duty.drSnapshot') : t('duty.drLive')}</Typography.Paragraph>
          <Table
            rowKey={(r) => `${r.discrepancyId}-${r.action}`}
            size="small"
            pagination={false}
            dataSource={d.drRecords}
            locale={{ emptyText: t('duty.noDr') }}
            columns={[
              { title: t('duty.time'), render: (_, r) => cnDateTimeLabel(r.at) },
              { title: t('duty.device'), dataIndex: 'deviceCode' },
              { title: t('duty.drAction'), render: (_, r) => (r.action === 'REPORTED' ? <Tag color="orange">{t('duty.drReported')}</Tag> : <Tag color="green">{t('duty.drCorrected')}</Tag>) },
              { title: t('duty.content'), render: (_, r) => (r.action === 'CORRECTED' && r.correctiveAction ? `${r.description} → ${r.correctiveAction}` : r.description) },
            ]}
          />

          <Divider orientation="left">{t('duty.entries')}</Divider>
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={d.entries}
            locale={{ emptyText: t('duty.noEntries') }}
            columns={[
              { title: t('duty.kind'), render: (_, e) => (e.kind === 'NON_ROUTINE' ? <Tag color="red">{t('duty.nonRoutine')}</Tag> : <Tag>{t('duty.routine')}</Tag>) },
              { title: t('duty.device'), render: (_, e) => e.deviceCode ?? '-' },
              { title: t('duty.content'), dataIndex: 'content' },
              { title: '', render: (_, e) => draft && <Button size="small" danger onClick={() => act(() => dutyApi.removeEntry(e.id))}>{t('duty.remove')}</Button> },
            ]}
          />
          {draft && (
            <Space.Compact style={{ marginTop: 8, width: '100%' }}>
              <Radio.Group value={entryKind} onChange={(e) => setEntryKind(e.target.value)} optionType="button" options={[{ value: 'ROUTINE', label: t('duty.routine') }, { value: 'NON_ROUTINE', label: t('duty.nonRoutine') }]} />
              <Select allowClear style={{ width: 120 }} placeholder={t('duty.device')} value={entryFstd} onChange={setEntryFstd} options={fstdOptions} />
              <Input placeholder={t('duty.contentPlaceholder')} value={entryText} maxLength={2000} onChange={(e) => setEntryText(e.target.value)} onPressEnter={() => undefined} />
              <Button
                type="primary"
                disabled={!entryText.trim()}
                onClick={() => act(() => dutyApi.addEntry(d.id, { kind: entryKind, content: entryText, fstdId: entryFstd }).then(() => { setEntryText(''); setEntryFstd(undefined) }))}
              >
                {t('duty.add')}
              </Button>
            </Space.Compact>
          )}

          <Divider orientation="left">{t('duty.outgoing')}</Divider>
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={d.outgoing}
            locale={{ emptyText: t('duty.noOutgoing') }}
            columns={[
              { title: t('duty.to'), render: (_, h) => `${h.toDate} ${h.toShiftCode}` },
              { title: t('duty.device'), render: (_, h) => h.deviceCode ?? '-' },
              { title: t('duty.content'), dataIndex: 'content' },
              { title: t('duty.status'), render: (_, h) => (h.completedAt ? <Tag color="green">{t('duty.hoDone')}</Tag> : <Tag color="red">{t('duty.hoOpen')}</Tag>) },
              { title: '', render: (_, h) => draft && <Button size="small" danger onClick={() => act(() => dutyApi.removeHandover(h.id))}>{t('duty.remove')}</Button> },
            ]}
          />
          {draft && (
            <>
              <Alert style={{ marginTop: 8 }} type="info" showIcon message={d.nextSuggestion ? t('duty.defaultTarget', { date: d.nextSuggestion.date, code: d.nextSuggestion.shiftCode }) : t('duty.noNextShift')} />
              <Space.Compact style={{ marginTop: 8, width: '100%' }}>
                <Select allowClear style={{ width: 110 }} placeholder={t('duty.device')} value={hoFstd} onChange={setHoFstd} options={fstdOptions} />
                <DatePicker allowClear placeholder={t('duty.targetDate')} value={hoDate ? dayjs(hoDate) : null} onChange={(v) => setHoDate(v ? v.format('YYYY-MM-DD') : undefined)} />
                <Select allowClear style={{ width: 150 }} placeholder={t('duty.targetShift')} value={hoShift} onChange={setHoShift} options={workShifts.map((s) => ({ value: s.id, label: `${s.code} ${s.name}` }))} />
                <Input placeholder={t('duty.contentPlaceholder')} value={hoText} maxLength={2000} onChange={(e) => setHoText(e.target.value)} />
                <Button
                  type="primary"
                  disabled={!hoText.trim() || (!!hoDate !== !!hoShift)}
                  onClick={() => act(() => dutyApi.addHandover(d.id, { content: hoText, fstdId: hoFstd, toDate: hoDate, toShiftTypeId: hoShift }).then(() => { setHoText(''); setHoFstd(undefined); setHoDate(undefined); setHoShift(undefined) }))}
                >
                  {t('duty.add')}
                </Button>
              </Space.Compact>
            </>
          )}
        </>
      )}
    </Drawer>
  )
}
