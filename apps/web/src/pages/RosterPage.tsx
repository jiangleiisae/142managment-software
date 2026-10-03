import { DownloadOutlined, PlusOutlined, QrcodeOutlined, UserOutlined } from '@ant-design/icons'
import { Alert, App, Button, Card, Checkbox, ColorPicker, DatePicker, Empty, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tabs, Tag, TimePicker, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { HoursRow, MyRoster, RosterEntry, RosterGroup, RosterHistoryRow, ShiftCategory, ShiftType, Staff, StaffDepartment } from '../api/roster'
import { rosterApi } from '../api/roster'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { ShareQrModal } from '../components/ShareQrModal'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'
import { cnDateTimeLabel, cnMonthRange, cnTodayString, readableTextColor, weekdayLabel } from '../utils/trainingPlanTime'

const { RangePicker } = DatePicker
const CATEGORIES: ShiftCategory[] = ['WORK', 'BUSINESS_TRIP', 'SICK_LEAVE', 'COMPENSATORY_LEAVE', 'ANNUAL_LEAVE', 'OTHER']
const key = (staffId: string, date: string) => `${staffId}|${date}`
const apiError = (e: unknown, fallback: string) => {
  const msg = (e as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
  return (Array.isArray(msg) ? msg.join('; ') : msg) ?? fallback
}

/// 人员班表: 维护部门 (/roster) 和行政综合部门 (/admin/roster) 共用, 各有自己的人员、班组、班次、班表。
export function RosterPage({ department }: { department: StaffDepartment }) {
  const { t, i18n } = useTranslation()
  const { message } = App.useApp()
  const { organizations, selectedId, select } = useSelectedOrganization()
  const today = cnTodayString()
  const isAdmin = department === 'ADMIN'
  const staffPath = isAdmin ? '/admin/staff' : '/maintenance-staff'

  const [shifts, setShifts] = useState<ShiftType[]>([])
  const [groups, setGroups] = useState<RosterGroup[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [my, setMy] = useState<MyRoster>()
  const [qrOpen, setQrOpen] = useState(false)

  const reloadBase = useCallback(async () => {
    if (!selectedId) return
    const [s, g, m] = await Promise.all([rosterApi.listShiftTypes(selectedId, department), rosterApi.listGroups(selectedId, department), rosterApi.listStaff(selectedId, department)])
    setShifts(s)
    setGroups(g)
    setStaff(m)
  }, [selectedId, department])

  useEffect(() => {
    reloadBase()
  }, [reloadBase])

  useEffect(() => {
    rosterApi.my(15).then(setMy).catch(() => undefined)
  }, [])

  const shiftById = useMemo(() => new Map(shifts.map((s) => [s.id, s])), [shifts])
  const shiftLabel = (s: Pick<ShiftType, 'code' | 'name'>) => `${s.code} ${s.name}`
  const timeText = (s: { startTime: string | null; endTime: string | null; endsNextDay: boolean }) => (s.startTime && s.endTime ? `${s.startTime}-${s.endTime}${s.endsNextDay ? '(+1)' : ''}` : '')

  // ---------------- 班表 ----------------
  const [month, setMonth] = useState(today.slice(0, 7))
  const [entries, setEntries] = useState<RosterEntry[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const days = useMemo(() => cnMonthRange(month).days, [month])
  const entryMap = useMemo(() => new Map(entries.map((e) => [key(e.staffId, e.date), e.shiftTypeId])), [entries])

  const loadEntries = useCallback(async () => {
    if (!selectedId) return
    setEntries(await rosterApi.listEntries(selectedId, department, month))
  }, [selectedId, department, month])

  useEffect(() => {
    setSelected(new Set())
    loadEntries()
  }, [loadEntries])

  const toggleCells = (cells: string[]) =>
    setSelected((cur) => {
      const next = new Set(cur)
      const all = cells.every((c) => next.has(c))
      cells.forEach((c) => (all ? next.delete(c) : next.add(c)))
      return next
    })

  const applyShift = async (shiftTypeId: string | null) => {
    if (!selectedId || selected.size === 0) return
    try {
      const cells = [...selected].map((k) => ({ staffId: k.split('|')[0], date: k.split('|')[1] }))
      const res = await rosterApi.setEntries(selectedId, cells, shiftTypeId)
      message.success(t('roster.applied', { count: res.changed }))
      setSelected(new Set())
      await loadEntries()
      rosterApi.my(15).then(setMy).catch(() => undefined)
    } catch (e) {
      message.error(apiError(e, t('roster.failed')))
    }
  }

  const rosterTab = (
    <>
      <Space wrap style={{ marginBottom: 8 }}>
        <DatePicker picker="month" allowClear={false} value={dayjs(`${month}-01`)} onChange={(v) => v && setMonth(v.format('YYYY-MM'))} />
        <Typography.Text type="secondary">{t('roster.selectedCount', { count: selected.size })}</Typography.Text>
        <Button disabled={selected.size === 0} onClick={() => setSelected(new Set())}>
          {t('roster.clearSelection')}
        </Button>
        <Button icon={<DownloadOutlined />} disabled={!selectedId} onClick={() => selectedId && rosterApi.exportMonth(selectedId, department, month)}>
          {t('roster.export')}
        </Button>
        {!isAdmin && (
          <Button icon={<QrcodeOutlined />} disabled={!selectedId} onClick={() => setQrOpen(true)}>
            {t('share.qrButton')}
          </Button>
        )}
        <Link to={staffPath}>
          <Button icon={<UserOutlined />}>{t(isAdmin ? 'roster.manageAdminStaff' : 'roster.manageMaintenanceStaff')}</Button>
        </Link>
      </Space>
      <Space wrap style={{ marginBottom: 12 }}>
        {shifts
          .filter((s) => s.isActive)
          .map((s) => (
            <Tag key={s.id} color={s.color} style={{ cursor: selected.size ? 'pointer' : 'not-allowed', color: readableTextColor(s.color), opacity: selected.size ? 1 : 0.5 }} onClick={() => applyShift(s.id)}>
              {shiftLabel(s)} {timeText(s)}
            </Tag>
          ))}
        <Button size="small" danger disabled={selected.size === 0} onClick={() => applyShift(null)}>
          {t('roster.clearShift')}
        </Button>
      </Space>
      <Typography.Paragraph type="secondary">{t('roster.gridHint')}</Typography.Paragraph>
      {staff.length === 0 ? (
        <Empty description={t(isAdmin ? 'roster.noAdminStaff' : 'roster.noMaintenanceStaff')}>
          <Link to={staffPath}>
            <Button type="primary">{t('roster.goAddStaff')}</Button>
          </Link>
        </Empty>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ minWidth: 70 }}>{t('roster.group')}</th>
                <th style={{ minWidth: 90, textAlign: 'left' }}>{t('roster.person')}</th>
                {days.map((d) => (
                  <th
                    key={d}
                    onClick={() => toggleCells(staff.map((m) => key(m.id, d)))}
                    style={{ width: 32, minWidth: 32, fontSize: 12, cursor: 'pointer', fontWeight: d === today ? 700 : 400, background: d === today ? '#e6f4ff' : undefined }}
                  >
                    <div>{d.slice(8)}</div>
                    <div style={{ fontSize: 10 }}>{weekdayLabel(d, i18n.language)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontSize: 12, color: '#888', padding: '0 6px', whiteSpace: 'nowrap' }}>{m.groupName ?? ''}</td>
                  <td onClick={() => toggleCells(days.map((d) => key(m.id, d)))} style={{ cursor: 'pointer', whiteSpace: 'nowrap', padding: '0 8px', fontWeight: 600 }} title={m.position ?? undefined}>
                    {m.name}
                  </td>
                  {days.map((d) => {
                    const shift = shiftById.get(entryMap.get(key(m.id, d)) ?? '')
                    const isSelected = selected.has(key(m.id, d))
                    return (
                      <td
                        key={d}
                        title={shift ? `${shiftLabel(shift)} ${timeText(shift)}` : undefined}
                        onClick={() => toggleCells([key(m.id, d)])}
                        style={{
                          width: 32,
                          height: 30,
                          textAlign: 'center',
                          fontSize: 12,
                          cursor: 'pointer',
                          border: '1px solid #f0f0f0',
                          background: shift ? shift.color : d === today ? '#f0f8ff' : '#fff',
                          color: shift ? readableTextColor(shift.color) : undefined,
                          outline: isSelected ? '2px solid #1677ff' : undefined,
                          outlineOffset: -2,
                        }}
                      >
                        {shift?.code}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )

  // ---------------- 班次配置 ----------------
  const [shiftModal, setShiftModal] = useState<{ open: boolean; editing?: ShiftType }>({ open: false })
  const [form] = Form.useForm()
  const category = Form.useWatch('category', form) as ShiftCategory | undefined

  const openShift = (editing?: ShiftType) => {
    form.resetFields()
    form.setFieldsValue(
      editing
        ? { ...editing, time: editing.startTime && editing.endTime ? [dayjs(editing.startTime, 'HH:mm'), dayjs(editing.endTime, 'HH:mm')] : undefined }
        : { category: 'WORK', color: '#1677ff', endsNextDay: false, restMinutes: 0, generatesMaintenanceTasks: false, isActive: true },
    )
    setShiftModal({ open: true, editing })
  }

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn()
      if (ok) message.success(ok)
      await reloadBase()
    } catch (e) {
      message.error(apiError(e, t('roster.failed')))
    }
  }

  const saveShift = async () => {
    const v = await form.validateFields()
    const color = typeof v.color === 'string' ? v.color : v.color.toHexString()
    const isWork = v.category === 'WORK'
    const data = {
      name: v.name,
      category: v.category,
      startTime: isWork ? v.time?.[0]?.format('HH:mm') : undefined,
      endTime: isWork ? v.time?.[1]?.format('HH:mm') : undefined,
      endsNextDay: isWork ? !!v.endsNextDay : false,
      restMinutes: isWork ? (v.restMinutes ?? 0) : 0,
      color,
      // "是否生成维护任务"只对维护部门有意义 (航前/航后应做清单), 行政综合不使用
      generatesMaintenanceTasks: isAdmin ? false : !!v.generatesMaintenanceTasks,
      description: v.description || undefined,
      sortOrder: v.sortOrder ?? undefined,
    }
    if (!selectedId) return
    await run(
      () => (shiftModal.editing ? rosterApi.updateShiftType(shiftModal.editing.id, { ...data, isActive: !!v.isActive }) : rosterApi.createShiftType(selectedId, department, { ...data, code: v.code })).then(() => setShiftModal({ open: false })),
      t('roster.saved'),
    )
  }

  const shiftColumns: ColumnsType<ShiftType> = [
    { title: t('roster.code'), render: (_, s) => <Tag color={s.color} style={{ color: readableTextColor(s.color) }}>{s.code}</Tag> },
    { title: t('roster.shiftName'), dataIndex: 'name' },
    { title: t('roster.category'), render: (_, s) => t(`roster.cat.${s.category}`) },
    { title: t('roster.time'), render: (_, s) => timeText(s) || '-' },
    { title: t('roster.rest'), render: (_, s) => (s.category === 'WORK' ? `${s.restMinutes} min` : '-') },
    ...(isAdmin ? [] : [{ title: t('roster.genTasks'), render: (_: unknown, s: ShiftType) => (s.generatesMaintenanceTasks ? t('roster.yes') : '-') }]),
    { title: t('roster.active'), render: (_, s) => (s.isActive ? t('roster.yes') : <Tag>{t('roster.disabled')}</Tag>) },
    { title: '', render: (_, s) => <Button size="small" onClick={() => openShift(s)}>{t('roster.edit')}</Button> },
  ]

  const shiftsTab = (
    <>
      <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => openShift()}>
        {t('roster.addShift')}
      </Button>
      <Table rowKey="id" size="small" dataSource={shifts} columns={shiftColumns} pagination={false} />
      <Modal title={shiftModal.editing ? t('roster.editShift') : t('roster.addShift')} open={shiftModal.open} onCancel={() => setShiftModal({ open: false })} onOk={saveShift} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="code" label={t('roster.code')} rules={[{ required: true, pattern: /^[A-Za-z0-9]{1,8}$/, message: t('roster.codeRule') }]}>
            <Input disabled={!!shiftModal.editing} maxLength={8} />
          </Form.Item>
          <Form.Item name="name" label={t('roster.shiftName')} rules={[{ required: true }]}>
            <Input maxLength={50} />
          </Form.Item>
          <Form.Item name="category" label={t('roster.category')} rules={[{ required: true }]}>
            <Select options={CATEGORIES.map((c) => ({ value: c, label: t(`roster.cat.${c}`) }))} />
          </Form.Item>
          {category === 'WORK' && (
            <>
              <Form.Item name="time" label={t('roster.time')} rules={[{ required: true }]}>
                <TimePicker.RangePicker format="HH:mm" minuteStep={5} />
              </Form.Item>
              <Form.Item name="endsNextDay" valuePropName="checked">
                <Checkbox>{t('roster.endsNextDay')}</Checkbox>
              </Form.Item>
              <Form.Item name="restMinutes" label={t('roster.rest')}>
                <InputNumber min={0} max={720} addonAfter="min" />
              </Form.Item>
            </>
          )}
          <Form.Item name="color" label={t('roster.color')} rules={[{ required: true }]}>
            <ColorPicker format="hex" />
          </Form.Item>
          {!isAdmin && (
            <Form.Item name="generatesMaintenanceTasks" label={t('roster.genTasks')} valuePropName="checked" extra={t('roster.genTasksHint')}>
              <Switch />
            </Form.Item>
          )}
          <Form.Item name="description" label={t('roster.description')}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item name="sortOrder" label={t('roster.sortOrder')}>
            <InputNumber min={0} max={1000} />
          </Form.Item>
          {shiftModal.editing && (
            <Form.Item name="isActive" label={t('roster.active')} valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  )

  // ---------------- 工时统计 ----------------
  const [hoursRange, setHoursRange] = useState<[string, string]>([`${today.slice(0, 7)}-01`, today])
  const [hoursGroup, setHoursGroup] = useState<string>()
  const [hours, setHours] = useState<{ shiftTypes: { id: string; code: string; name: string; category: ShiftCategory }[]; rows: HoursRow[] }>()

  useEffect(() => {
    if (!selectedId) return
    rosterApi.hours(selectedId, department, hoursRange[0], hoursRange[1], hoursGroup).then(setHours).catch((e) => message.error(apiError(e, t('roster.failed'))))
  }, [selectedId, department, hoursRange, hoursGroup, entries, message, t])

  const hoursColumns: ColumnsType<HoursRow> = [
    { title: t('roster.group'), render: (_, r) => r.groupName ?? '-' },
    { title: t('roster.person'), render: (_, r) => (r.isActive ? r.name : <span style={{ color: '#999' }}>{r.name}（{t('roster.inactive')}）</span>) },
    { title: t('roster.position'), render: (_, r) => r.position ?? '-' },
    { title: t('roster.workDays'), dataIndex: 'workDays' },
    { title: t('roster.totalHours'), render: (_, r) => <b>{r.totalHours}</b> },
    ...(hours?.shiftTypes ?? []).map((s) => ({
      title: s.category === 'WORK' ? `${s.code} ${t('roster.daysHours')}` : `${s.code} ${s.name}`,
      render: (_: unknown, r: HoursRow) => {
        const v = r.byShift[s.code]
        if (!v) return '-'
        return s.category === 'WORK' ? `${v.days} / ${v.hours}h` : v.days
      },
    })),
  ]

  const hoursTab = (
    <>
      <Space wrap style={{ marginBottom: 8 }}>
        <RangePicker allowClear={false} value={[dayjs(hoursRange[0]), dayjs(hoursRange[1])]} onChange={(v) => v?.[0] && v[1] && setHoursRange([v[0].format('YYYY-MM-DD'), v[1].format('YYYY-MM-DD')])} />
        <Select allowClear style={{ width: 160 }} placeholder={t('roster.allGroups')} value={hoursGroup} onChange={setHoursGroup} options={groups.map((g) => ({ value: g.id, label: g.name }))} />
        <Button icon={<DownloadOutlined />} disabled={!selectedId} onClick={() => selectedId && rosterApi.exportHours(selectedId, department, hoursRange[0], hoursRange[1], hoursGroup)}>
          {t('roster.export')}
        </Button>
      </Space>
      <Alert type="info" showIcon style={{ marginBottom: 8 }} message={t('roster.hoursNote')} />
      <Table rowKey="staffId" size="small" dataSource={hours?.rows ?? []} columns={hoursColumns} pagination={false} scroll={{ x: 'max-content' }} locale={{ emptyText: t('roster.noData') }} />
    </>
  )

  // ---------------- 修改历史 ----------------
  const [historyRange, setHistoryRange] = useState<[string, string]>([`${today.slice(0, 7)}-01`, today.slice(0, 7) + '-31'])
  const [historyPerson, setHistoryPerson] = useState<string>()
  const [history, setHistory] = useState<RosterHistoryRow[]>([])

  const codeText = (v: string | null) => v ?? t('roster.none')
  useEffect(() => {
    if (!selectedId) return
    rosterApi.history(selectedId, department, historyRange[0], historyRange[1], historyPerson).then(setHistory).catch(() => setHistory([]))
  }, [selectedId, department, historyRange, historyPerson, entries])

  const historyTab = (
    <>
      <Space wrap style={{ marginBottom: 8 }}>
        <RangePicker allowClear={false} value={[dayjs(historyRange[0]), dayjs(historyRange[1])]} onChange={(v) => v?.[0] && v[1] && setHistoryRange([v[0].format('YYYY-MM-DD'), v[1].format('YYYY-MM-DD')])} />
        <Select allowClear showSearch optionFilterProp="label" style={{ width: 180 }} placeholder={t('roster.person')} value={historyPerson} onChange={setHistoryPerson} options={staff.map((m) => ({ value: m.id, label: m.name }))} />
      </Space>
      <Typography.Paragraph type="secondary">{t('roster.historyNote')}</Typography.Paragraph>
      <Table
        rowKey={(r) => `${r.at}-${r.staffId}-${r.date}`}
        size="small"
        dataSource={history}
        locale={{ emptyText: t('roster.noData') }}
        pagination={{ pageSize: 20 }}
        columns={[
          { title: t('roster.changedAt'), render: (_, r) => cnDateTimeLabel(r.at) },
          { title: t('roster.changedBy'), render: (_, r) => r.by ?? '-' },
          { title: t('roster.person'), dataIndex: 'name' },
          { title: t('roster.date'), dataIndex: 'date' },
          { title: t('roster.change'), render: (_, r) => `${codeText(r.before)} → ${codeText(r.after)}` },
        ]}
      />
    </>
  )

  const myCard =
    my?.linked && my.days.length > 0 ? (
      <Card size="small" title={t('roster.myTitle')} style={{ marginBottom: 12 }}>
        <Space wrap size={[8, 8]}>
          {my.days.map((d) => (
            <Tag key={`${d.date}-${d.organizationName}`} color={d.shift.color} style={{ color: readableTextColor(d.shift.color) }}>
              {d.date.slice(5)} {weekdayLabel(d.date, i18n.language)} {d.shift.code} {timeText(d.shift)}
            </Tag>
          ))}
        </Space>
      </Card>
    ) : null

  return (
    <div>
      <OrganizationSelector organizations={organizations} selectedId={selectedId} onChange={select} />
      <ShareQrModal open={qrOpen} onClose={() => setQrOpen(false)} organizationId={selectedId} type="ROSTER" />
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        {t(isAdmin ? 'roster.adminTitle' : 'roster.maintenanceTitle')}
      </Typography.Title>
      <Typography.Paragraph type="secondary">{t(isAdmin ? 'roster.adminIntro' : 'roster.intro')}</Typography.Paragraph>
      {myCard}
      {!selectedId ? (
        <Empty description={t('common.selectOrganizationPlaceholder')} />
      ) : (
        <Tabs
          items={[
            { key: 'roster', label: t('roster.tabRoster'), children: rosterTab },
            { key: 'shifts', label: t('roster.tabShifts'), children: shiftsTab },
            { key: 'hours', label: t('roster.tabHours'), children: hoursTab },
            { key: 'history', label: t('roster.tabHistory'), children: historyTab },
          ]}
        />
      )}
    </div>
  )
}
