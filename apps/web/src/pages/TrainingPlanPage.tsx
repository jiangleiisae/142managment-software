import { DeleteOutlined, DownloadOutlined, LeftOutlined, PlusOutlined, QrcodeOutlined, RightOutlined } from '@ant-design/icons'
import { App, Button, ColorPicker, DatePicker, Descriptions, Empty, Input, Modal, Select, Space, Table, Tabs, Tag, Tooltip, Typography } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { bookingsApi } from '../api/bookings'
import type { BookingCustomer } from '../api/bookings'
import { fstdsApi } from '../api/fstds'
import type { Booking, Fstd } from '../api/types'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { ShareQrModal } from '../components/ShareQrModal'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'
import {
  cnDateTimeLabel,
  cnDayRange,
  cnHourMinute,
  cnMonthRange,
  cnTodayString,
  fallbackColor,
  readableTextColor,
  shiftDay,
  weekdayLabel,
} from '../utils/trainingPlanTime'

const ROW_HEIGHT = 44 // 每小时的像素高度
const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`)

const deviceLabel = (f: Pick<Fstd, 'deviceCode' | 'representedAircraft'>) => `${f.deviceCode} ${f.representedAircraft}`

export function TrainingPlanPage() {
  const { t, i18n } = useTranslation()
  const { message } = App.useApp()
  const { organizations, selectedId, select } = useSelectedOrganization()
  const [fstds, setFstds] = useState<Fstd[]>([])
  const [customers, setCustomers] = useState<BookingCustomer[]>([])
  const [detail, setDetail] = useState<Booking>()
  const [qrOpen, setQrOpen] = useState(false)
  const [deviceQrOpen, setDeviceQrOpen] = useState(false)

  const [day, setDay] = useState(cnTodayString())
  const [instructorInput, setInstructorInput] = useState('')
  const [instructor, setInstructor] = useState('')
  const [dayBookings, setDayBookings] = useState<Booking[]>([])
  const [dayLoading, setDayLoading] = useState(false)

  const [month, setMonth] = useState(cnTodayString().slice(0, 7))
  const [deviceId, setDeviceId] = useState<string>()
  const [monthBookings, setMonthBookings] = useState<Booking[]>([])
  const [monthLoading, setMonthLoading] = useState(false)

  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [customerRows, setCustomerRows] = useState<{ name: string; color: string }[]>([])

  const colorByCustomer = useMemo(() => new Map(customers.map((c) => [c.name, c.color])), [customers])
  const colorOf = (name?: string | null) => (name && colorByCustomer.get(name)) || fallbackColor(name)
  const deviceById = useMemo(() => new Map(fstds.map((f) => [f.id, f])), [fstds])

  useEffect(() => {
    if (!selectedId) return
    fstdsApi.list(selectedId).then((list) => {
      setFstds(list)
      setDeviceId((cur) => (cur && list.some((f) => f.id === cur) ? cur : list[0]?.id))
    })
    bookingsApi.listCustomers(selectedId).then(setCustomers)
  }, [selectedId])

  useEffect(() => {
    if (!selectedId) return
    const { fromIso, toIso } = cnDayRange(day)
    setDayLoading(true)
    bookingsApi
      .listPlan(selectedId, fromIso, toIso, { instructor: instructor || undefined })
      .then(setDayBookings)
      .finally(() => setDayLoading(false))
  }, [selectedId, day, instructor])

  useEffect(() => {
    if (!selectedId || !deviceId) {
      setMonthBookings([])
      return
    }
    const { fromIso, toIso } = cnMonthRange(month)
    setMonthLoading(true)
    bookingsApi
      .listPlan(selectedId, fromIso, toIso, { resourceId: deviceId })
      .then(setMonthBookings)
      .finally(() => setMonthLoading(false))
  }, [selectedId, month, deviceId])

  const dayRange = cnDayRange(day)

  const bookingTitle = (b: Booking) => b.trainingType || t('trainingPlan.noTrainingType')
  const people = (b: Booking) => [b.instructorName && `${t('trainingPlan.instructor')}: ${b.instructorName}`, b.examinerName && `${t('trainingPlan.examiner')}: ${b.examinerName}`].filter(Boolean).join('  ')

  const handleExport = async (kind: 'day' | 'month') => {
    if (!selectedId) return
    try {
      if (kind === 'day') {
        await bookingsApi.exportPlan(selectedId, dayRange.fromIso, dayRange.toIso, { instructor: instructor || undefined })
      } else {
        const range = cnMonthRange(month)
        await bookingsApi.exportPlan(selectedId, range.fromIso, range.toIso, { resourceId: deviceId })
      }
    } catch {
      message.error(t('trainingPlan.exportFailed'))
    }
  }

  const openCustomerModal = () => {
    const configured = new Map(customers.map((c) => [c.name, c.color]))
    const rows = customers.map((c) => ({ name: c.name, color: c.color }))
    // 当前视图里出现过但还没配置颜色的客户, 预先列出, 省得手输
    for (const b of [...dayBookings, ...monthBookings]) {
      if (b.customerName && !configured.has(b.customerName) && !rows.some((r) => r.name === b.customerName)) {
        rows.push({ name: b.customerName, color: fallbackColor(b.customerName) })
      }
    }
    setCustomerRows(rows)
    setCustomerModalOpen(true)
  }

  const saveCustomers = async () => {
    if (!selectedId) return
    const rows = customerRows.filter((r) => r.name.trim())
    try {
      setCustomers(await bookingsApi.setCustomers(selectedId, rows))
      setCustomerModalOpen(false)
      message.success(t('trainingPlan.customerSaved'))
    } catch (e) {
      const err = e as { response?: { data?: { message?: string | string[] } } }
      const msg = err.response?.data?.message
      message.error((Array.isArray(msg) ? msg.join('; ') : msg) ?? t('trainingPlan.customerSaveFailed'))
    }
  }

  const renderBlockText = (b: Booking) => (
    <>
      <div style={{ fontWeight: 600 }}>
        {cnHourMinute(Date.parse(b.startAt))}-{cnHourMinute(Date.parse(b.endAt))} {bookingTitle(b)}
      </div>
      {b.pilotName && <div>{b.pilotName}</div>}
      <div>{people(b)}</div>
    </>
  )

  const dayGrid = (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', minWidth: 56 + Math.max(fstds.length, 1) * 170 }}>
        <div style={{ width: 56, flexShrink: 0 }}>
          <div style={{ height: 36 }} />
          {HOUR_LABELS.map((label) => (
            <div key={label} style={{ height: ROW_HEIGHT, fontSize: 12, color: '#888', textAlign: 'right', paddingRight: 6, boxSizing: 'border-box' }}>
              {label}
            </div>
          ))}
        </div>
        {fstds.map((f) => {
          const items = dayBookings.filter((b) => b.resourceId === f.id)
          return (
            <div key={f.id} style={{ flex: 1, minWidth: 170, borderLeft: '1px solid #f0f0f0' }}>
              <div style={{ height: 36, lineHeight: '36px', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
                {deviceLabel(f)}
              </div>
              <div
                style={{
                  position: 'relative',
                  height: ROW_HEIGHT * 24,
                  backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${ROW_HEIGHT - 1}px, #f0f0f0 ${ROW_HEIGHT - 1}px, #f0f0f0 ${ROW_HEIGHT}px)`,
                }}
              >
                {items.map((b) => {
                  const startMs = Math.max(Date.parse(b.startAt), dayRange.startMs)
                  const endMs = Math.min(Date.parse(b.endAt), dayRange.startMs + 24 * 3600 * 1000)
                  const top = ((startMs - dayRange.startMs) / 3600000) * ROW_HEIGHT
                  const height = Math.max(((endMs - startMs) / 3600000) * ROW_HEIGHT - 2, 20)
                  const bg = colorOf(b.customerName)
                  return (
                    <Tooltip key={b.id} title={t('trainingPlan.clickForDetail')}>
                      <div
                        onClick={() => setDetail(b)}
                        style={{
                          position: 'absolute',
                          left: 3,
                          right: 3,
                          top,
                          height,
                          background: bg,
                          color: readableTextColor(bg),
                          borderRadius: 4,
                          padding: '2px 6px',
                          fontSize: 12,
                          lineHeight: 1.35,
                          textAlign: 'left',
                          overflow: 'hidden',
                          cursor: 'pointer',
                        }}
                      >
                        {Date.parse(b.startAt) < dayRange.startMs && '◀ '}
                        {renderBlockText(b)}
                        {Date.parse(b.endAt) > dayRange.startMs + 24 * 3600 * 1000 && ' ▶'}
                      </div>
                    </Tooltip>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  const monthRange = cnMonthRange(month)
  const monthRows = monthRange.days.map((d) => {
    const { startMs } = cnDayRange(d)
    const items = monthBookings.filter((b) => Date.parse(b.startAt) < startMs + 24 * 3600 * 1000 && Date.parse(b.endAt) > startMs)
    return { day: d, startMs, items }
  })

  const totalToolbar = (
    <Space wrap style={{ marginBottom: 12 }}>
      <Input
        allowClear
        style={{ width: 200 }}
        placeholder={t('trainingPlan.instructorPlaceholder')}
        value={instructorInput}
        onChange={(e) => setInstructorInput(e.target.value)}
        onPressEnter={() => setInstructor(instructorInput.trim())}
      />
      <Button type="primary" onClick={() => setInstructor(instructorInput.trim())}>
        {t('trainingPlan.search')}
      </Button>
      <Button
        onClick={() => {
          setInstructorInput('')
          setInstructor('')
        }}
      >
        {t('trainingPlan.reset')}
      </Button>
      <Button icon={<LeftOutlined />} onClick={() => setDay(shiftDay(day, -1))} />
      <DatePicker allowClear={false} value={dayjs(day)} onChange={(v) => v && setDay(v.format('YYYY-MM-DD'))} />
      <Button icon={<RightOutlined />} onClick={() => setDay(shiftDay(day, 1))} />
      <Button onClick={() => setDay(cnTodayString())}>{t('trainingPlan.today')}</Button>
      <Typography.Text type="secondary">{weekdayLabel(day, i18n.language)}</Typography.Text>
      <Button icon={<DownloadOutlined />} onClick={() => handleExport('day')}>
        {t('trainingPlan.exportDay')}
      </Button>
      <Button onClick={openCustomerModal}>{t('trainingPlan.customerConfig')}</Button>
      <Button icon={<QrcodeOutlined />} disabled={!selectedId} onClick={() => setQrOpen(true)}>
        {t('share.qrButton')}
      </Button>
    </Space>
  )

  return (
    <div>
      <OrganizationSelector organizations={organizations} selectedId={selectedId} onChange={select} />
      <ShareQrModal open={qrOpen} onClose={() => setQrOpen(false)} organizationId={selectedId} type="TRAINING_PLAN" />
      <ShareQrModal open={deviceQrOpen} onClose={() => setDeviceQrOpen(false)} organizationId={selectedId} type="TRAINING_PLAN" fstd={fstds.find((f) => f.id === deviceId)} />
      <Typography.Paragraph type="secondary">{t('trainingPlan.timezoneNote')}</Typography.Paragraph>

      {!selectedId ? (
        <Empty description={t('common.selectOrganizationPlaceholder')} />
      ) : (
        <Tabs
          items={[
            {
              key: 'total',
              label: t('trainingPlan.tabTotal'),
              children: (
                <>
                  {totalToolbar}
                  {fstds.length === 0 ? <Empty description={t('trainingPlan.noDevices')} /> : <div style={{ opacity: dayLoading ? 0.6 : 1 }}>{dayGrid}</div>}
                </>
              ),
            },
            {
              key: 'device',
              label: t('trainingPlan.tabDevice'),
              children: (
                <>
                  <Space wrap style={{ marginBottom: 12 }}>
                    <Select
                      style={{ width: 240 }}
                      placeholder={t('trainingPlan.selectDevice')}
                      value={deviceId}
                      onChange={setDeviceId}
                      options={fstds.map((f) => ({ value: f.id, label: deviceLabel(f) }))}
                    />
                    <DatePicker picker="month" allowClear={false} value={dayjs(`${month}-01`)} onChange={(v) => v && setMonth(v.format('YYYY-MM'))} />
                    <Button icon={<QrcodeOutlined />} disabled={!deviceId} onClick={() => setDeviceQrOpen(true)}>
                      {t('share.deviceQrButton')}
                    </Button>
                    <Button icon={<DownloadOutlined />} disabled={!deviceId} onClick={() => handleExport('month')}>
                      {t('trainingPlan.exportMonth')}
                    </Button>
                    <Button onClick={openCustomerModal}>{t('trainingPlan.customerConfig')}</Button>
                  </Space>
                  <Table
                    rowKey="day"
                    size="small"
                    loading={monthLoading}
                    pagination={false}
                    dataSource={monthRows}
                    columns={[
                      {
                        title: t('trainingPlan.columnDate'),
                        width: 130,
                        render: (_, r) => `${r.day.slice(5)} ${weekdayLabel(r.day, i18n.language)}`,
                      },
                      {
                        title: t('trainingPlan.columnSessions'),
                        render: (_, r) =>
                          r.items.length === 0 ? (
                            '-'
                          ) : (
                            <Space wrap>
                              {r.items.map((b) => {
                                const bg = colorOf(b.customerName)
                                return (
                                  <Tag key={b.id} color={bg} style={{ color: readableTextColor(bg), cursor: 'pointer', margin: 0 }} onClick={() => setDetail(b)}>
                                    {Date.parse(b.startAt) < r.startMs && '◀ '}
                                    {cnHourMinute(Date.parse(b.startAt))}-{cnHourMinute(Date.parse(b.endAt))} {bookingTitle(b)}
                                    {b.instructorName ? ` · ${b.instructorName}` : ''}
                                    {Date.parse(b.endAt) > r.startMs + 24 * 3600 * 1000 && ' ▶'}
                                  </Tag>
                                )
                              })}
                            </Space>
                          ),
                      },
                    ]}
                  />
                </>
              ),
            },
          ]}
        />
      )}

      <Modal open={!!detail} title={t('trainingPlan.detailTitle')} onCancel={() => setDetail(undefined)} footer={null}>
        {detail && (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label={t('trainingPlan.device')}>
              {deviceById.get(detail.resourceId) ? deviceLabel(deviceById.get(detail.resourceId)!) : detail.resourceId}
            </Descriptions.Item>
            <Descriptions.Item label={t('trainingPlan.trainingType')}>{detail.trainingType ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('trainingPlan.time')}>
              {cnDateTimeLabel(detail.startAt)} ~ {cnDateTimeLabel(detail.endAt)}
            </Descriptions.Item>
            <Descriptions.Item label={t('trainingPlan.customer')}>
              {detail.customerName ? (
                <Tag color={colorOf(detail.customerName)} style={{ color: readableTextColor(colorOf(detail.customerName)) }}>
                  {detail.customerName}
                </Tag>
              ) : (
                '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('trainingPlan.trainees')}>{detail.pilotName ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('trainingPlan.instructor')}>{detail.instructorName ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('trainingPlan.examiner')}>{detail.examinerName ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('trainingPlan.notes')}>{detail.notes ?? '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <Modal
        open={customerModalOpen}
        title={t('trainingPlan.customerConfig')}
        onCancel={() => setCustomerModalOpen(false)}
        onOk={saveCustomers}
        okText={t('trainingPlan.save')}
        cancelText={t('trainingPlan.cancel')}
        width={560}
      >
        <Typography.Paragraph type="secondary">{t('trainingPlan.customerHint')}</Typography.Paragraph>
        <Space direction="vertical" style={{ width: '100%' }}>
          {customerRows.map((row, i) => (
            <Space key={i} style={{ width: '100%' }}>
              <Input
                style={{ width: 300 }}
                placeholder={t('trainingPlan.customerName')}
                value={row.name}
                onChange={(e) => setCustomerRows((rows) => rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
              />
              <ColorPicker
                value={row.color}
                disabledAlpha
                onChange={(c) => setCustomerRows((rows) => rows.map((r, j) => (j === i ? { ...r, color: c.toHexString() } : r)))}
              />
              <Button danger icon={<DeleteOutlined />} onClick={() => setCustomerRows((rows) => rows.filter((_, j) => j !== i))} />
            </Space>
          ))}
          <Button icon={<PlusOutlined />} onClick={() => setCustomerRows((rows) => [...rows, { name: '', color: '#4096ff' }])}>
            {t('trainingPlan.addCustomer')}
          </Button>
        </Space>
      </Modal>
    </div>
  )
}
