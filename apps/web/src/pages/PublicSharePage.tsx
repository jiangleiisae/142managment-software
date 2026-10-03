import { LeftOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons'
import { Button, Card, Empty, Result, Segmented, Space, Spin, Tag, Typography } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import type { PublicShareData } from '../api/shares'
import { publicShareApi } from '../api/shares'
import { cnHourMinute, readableTextColor, shiftDay, weekdayLabel } from '../utils/trainingPlanTime'

const REFRESH_MS = 60_000
const CN_OFFSET_MS = 8 * 60 * 60 * 1000
const dayOf = (iso: string) => new Date(Date.parse(iso) + CN_OFFSET_MS).toISOString().slice(0, 10)
const monthShift = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7)
}

/// 扫码打开的公开只读页 (无需登录): 训练计划(按日分组)或人员班表(月视图)。每分钟自动刷新。
export function PublicSharePage() {
  const { token = '' } = useParams()
  const { t, i18n } = useTranslation()
  const [data, setData] = useState<PublicShareData>()
  const [error, setError] = useState<'invalid' | 'failed'>()
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState<string>()
  const [days, setDays] = useState(7)
  const [month, setMonth] = useState<string>()

  // 不让搜索引擎收录
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => {
      document.head.removeChild(meta)
    }
  }, [])

  const load = useCallback(async () => {
    try {
      setData(await publicShareApi.view(token, { date, days, month }))
      setError(undefined)
    } catch (e) {
      const status = (e as { response?: { status?: number } }).response?.status
      setError(status === 404 ? 'invalid' : 'failed')
    } finally {
      setLoading(false)
    }
  }, [token, date, days, month])

  useEffect(() => {
    setLoading(true)
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  useEffect(() => {
    if (data) document.title = `${data.organizationName} · ${t(data.type === 'TRAINING_PLAN' ? 'share.pageTrainingTitle' : 'share.pageRosterTitle')}`
  }, [data, t])

  if (error === 'invalid') return <Result status="404" title={t('share.invalidTitle')} subTitle={t('share.invalidHint')} />
  if (!data) return <div style={{ textAlign: 'center', padding: 60 }}>{error ? <Result status="error" title={t('share.failed')} extra={<Button onClick={load}>{t('share.retry')}</Button>} /> : <Spin />}</div>

  const updated = `${data.today} ${cnHourMinute(Date.parse(data.generatedAt))}`

  const header = (
    <div style={{ marginBottom: 12 }}>
      <Typography.Title level={4} style={{ marginBottom: 0 }}>
        {data.organizationName}
      </Typography.Title>
      <Typography.Text type="secondary">
        {data.type === 'TRAINING_PLAN' && data.device ? `${data.device.code} ${data.device.aircraft} · ${t('share.pageDeviceTitle')}` : t(data.type === 'TRAINING_PLAN' ? 'share.pageTrainingTitle' : 'share.pageRosterTitle')} · {t('share.updatedAt', { time: updated })}
      </Typography.Text>
    </div>
  )

  let body: React.ReactNode
  if (data.type === 'TRAINING_PLAN') {
    const from = data.from
    const rangeDays = Array.from({ length: data.days }, (_, i) => shiftDay(from, i))
    body = (
      <>
        <Space wrap style={{ marginBottom: 12 }}>
          <Button icon={<LeftOutlined />} onClick={() => setDate(shiftDay(from, -days))} />
          <Button onClick={() => setDate(undefined)}>{t('share.today')}</Button>
          <Button icon={<RightOutlined />} onClick={() => setDate(shiftDay(from, days))} />
          <Segmented
            value={days}
            onChange={(v) => setDays(Number(v))}
            options={[
              { value: 1, label: t('share.oneDay') },
              { value: 3, label: t('share.threeDays') },
              { value: 7, label: t('share.sevenDays') },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading} />
        </Space>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          {from} ~ {rangeDays[rangeDays.length - 1]}
        </Typography.Paragraph>
        {rangeDays.map((d) => {
          // 跨午夜的场次在开始和结束两天都显示
          const items = data.items.filter((i) => dayOf(i.startAt) === d || dayOf(new Date(Date.parse(i.endAt) - 1).toISOString()) === d)
          return (
            <Card key={d} size="small" style={{ marginBottom: 8 }} title={<span style={{ color: d === data.today ? '#1677ff' : undefined, fontWeight: d === data.today ? 700 : 600 }}>{`${d} ${weekdayLabel(d, i18n.language)}${d === data.today ? ` · ${t('share.today')}` : ''}`}</span>} extra={data.groundedDates.includes(d) ? <Tag color="red">{t('share.grounded')}</Tag> : undefined}>
              {items.length === 0 ? (
                <Typography.Text type="secondary">{t('share.noSessions')}</Typography.Text>
              ) : (
                items.map((i, idx) => {
                  const startsToday = dayOf(i.startAt) === d
                  const endsToday = dayOf(new Date(Date.parse(i.endAt) - 1).toISOString()) === d
                  return (
                    <div key={idx} style={{ padding: '6px 0', borderTop: idx ? '1px solid #f0f0f0' : undefined }}>
                      <Space wrap size={6}>
                        <Typography.Text strong>
                          {startsToday ? cnHourMinute(Date.parse(i.startAt)) : '00:00'}-{endsToday ? cnHourMinute(Date.parse(i.endAt)) : '24:00'}
                        </Typography.Text>
                        {!data.device && <Tag color="blue">{i.deviceCode}</Tag>}
                        {i.trainingType && <Tag>{i.trainingType}</Tag>}
                        {!startsToday && <Tag color="orange">{t('share.fromPrevDay')}</Tag>}
                        {!endsToday && <Tag color="orange">{t('share.toNextDay')}</Tag>}
                      </Space>
                      <div style={{ color: '#595959', fontSize: 13 }}>
                        {[i.customerName, i.pilotName && `${t('share.trainee')}: ${i.pilotName}`, i.instructorName && `${t('share.instructor')}: ${i.instructorName}`, i.examinerName && `${t('share.examiner')}: ${i.examinerName}`].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  )
                })
              )}
            </Card>
          )
        })}
      </>
    )
  } else {
    const shiftByCode = new Map(data.shifts.map((s) => [s.code, s]))
    const todayIn = data.today.slice(0, 7) === data.month
    const onDuty = todayIn
      ? data.shifts
          .filter((s) => s.category === 'WORK')
          .map((s) => ({ shift: s, names: data.rows.filter((r) => r.cells[data.today] === s.code).map((r) => r.name) }))
          .filter((x) => x.names.length > 0)
      : []
    body = (
      <>
        <Space wrap style={{ marginBottom: 12 }}>
          <Button icon={<LeftOutlined />} onClick={() => setMonth(monthShift(data.month, -1))} />
          <Typography.Text strong>{data.month}</Typography.Text>
          <Button icon={<RightOutlined />} onClick={() => setMonth(monthShift(data.month, 1))} />
          <Button onClick={() => setMonth(undefined)}>{t('share.thisMonth')}</Button>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading} />
        </Space>
        {todayIn && (
          <Card size="small" style={{ marginBottom: 12 }} title={`${t('share.todayDuty')} ${data.today}`}>
            {onDuty.length === 0 ? (
              <Typography.Text type="secondary">{t('share.noDutyToday')}</Typography.Text>
            ) : (
              onDuty.map(({ shift, names }) => (
                <div key={shift.code} style={{ marginBottom: 4 }}>
                  <Tag color={shift.color} style={{ color: readableTextColor(shift.color) }}>
                    {shift.code} {shift.name}
                  </Tag>
                  {names.join('、')}
                </div>
              ))
            )}
          </Card>
        )}
        {data.rows.length === 0 ? (
          <Empty description={t('share.noRoster')} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: '#fff', textAlign: 'left', padding: '0 8px', minWidth: 80 }}>{t('share.person')}</th>
                  {data.days.map((d) => (
                    <th key={d} style={{ width: 30, minWidth: 30, fontSize: 12, fontWeight: d === data.today ? 700 : 400, background: d === data.today ? '#e6f4ff' : undefined }}>
                      <div>{d.slice(8)}</div>
                      <div style={{ fontSize: 10 }}>{weekdayLabel(d, i18n.language)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ position: 'sticky', left: 0, background: '#fff', padding: '0 8px', whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {r.name}
                      {r.groupName && <div style={{ fontSize: 10, color: '#999', fontWeight: 400 }}>{r.groupName}</div>}
                    </td>
                    {data.days.map((d) => {
                      const code = r.cells[d]
                      const s = code ? shiftByCode.get(code) : undefined
                      return (
                        <td key={d} style={{ height: 30, textAlign: 'center', fontSize: 12, border: '1px solid #f0f0f0', background: s ? s.color : d === data.today ? '#f0f8ff' : '#fff', color: s ? readableTextColor(s.color) : undefined }}>
                          {code}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Space wrap style={{ marginTop: 12 }}>
          {data.shifts.map((s) => (
            <Tag key={s.code} color={s.color} style={{ color: readableTextColor(s.color) }}>
              {s.code} {s.name}
              {s.startTime && s.endTime ? ` ${s.startTime}-${s.endTime}${s.endsNextDay ? '(+1)' : ''}` : ''}
            </Tag>
          ))}
        </Space>
      </>
    )
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      {header}
      {body}
    </div>
  )
}
