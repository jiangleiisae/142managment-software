import { App, Button, DatePicker, Empty, Input, Space, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GroundingConflict, GroundingRecord } from '../api/fstds'
import { fstdsApi } from '../api/fstds'
import type { Fstd } from '../api/types'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'
import { cnDateTimeLabel, cnMonthRange, cnTodayString, weekdayLabel } from '../utils/trainingPlanTime'

const key = (fstdId: string, date: string) => `${fstdId}|${date}`

export function GroundingPage() {
  const { t, i18n } = useTranslation()
  const { message, modal } = App.useApp()
  const { organizations, selectedId, select } = useSelectedOrganization()
  const [fstds, setFstds] = useState<Fstd[]>([])
  const [month, setMonth] = useState(cnTodayString().slice(0, 7))
  const [records, setRecords] = useState<GroundingRecord[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const today = cnTodayString()
  const days = useMemo(() => cnMonthRange(month).days, [month])
  const grounded = useMemo(() => new Map(records.map((r) => [key(r.fstdId, r.date), r])), [records])

  const load = useCallback(async () => {
    if (!selectedId) return
    setRecords(await fstdsApi.listGroundings(selectedId, month))
  }, [selectedId, month])

  useEffect(() => {
    if (!selectedId) return
    fstdsApi.list(selectedId).then(setFstds)
  }, [selectedId])

  useEffect(() => {
    setSelected(new Set())
    load()
  }, [load])

  const editable = (date: string) => date >= today

  const toggle = (fstdId: string, date: string) => {
    if (!editable(date)) return
    setSelected((cur) => {
      const next = new Set(cur)
      const k = key(fstdId, date)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  // 点击设备名选中/取消该设备本月所有可编辑日期; 点击日期表头选中/取消该日所有设备
  const toggleGroup = (cells: string[]) => {
    setSelected((cur) => {
      const next = new Set(cur)
      const allSelected = cells.every((c) => next.has(c))
      cells.forEach((c) => (allSelected ? next.delete(c) : next.add(c)))
      return next
    })
  }

  const entries = () => [...selected].map((k) => ({ fstdId: k.split('|')[0], date: k.split('|')[1] }))

  const showConflicts = (conflicts: GroundingConflict[]) => {
    const nameOf = (id: string) => fstds.find((f) => f.id === id)?.deviceCode ?? id
    modal.warning({
      title: t('grounding.conflictTitle', { count: conflicts.length }),
      width: 560,
      content: (
        <div>
          <Typography.Paragraph>{t('grounding.conflictHint')}</Typography.Paragraph>
          {conflicts.map((c) => (
            <div key={`${c.bookingId}-${c.date}`}>
              {nameOf(c.fstdId)} · {cnDateTimeLabel(c.startAt)} ~ {cnDateTimeLabel(c.endAt)}
              {c.trainingType ? ` · ${c.trainingType}` : ''}
            </div>
          ))}
        </div>
      ),
    })
  }

  const run = async (action: 'mark' | 'cancel') => {
    if (!selectedId || selected.size === 0) return
    setBusy(true)
    try {
      if (action === 'mark') {
        const res = await fstdsApi.markGroundings(selectedId, entries(), note.trim() || undefined)
        message.success(t('grounding.marked', { count: res.created }))
        if (res.conflictingBookings.length > 0) showConflicts(res.conflictingBookings)
      } else {
        const res = await fstdsApi.cancelGroundings(selectedId, entries())
        message.success(t('grounding.cancelled', { count: res.removed }))
      }
      setSelected(new Set())
      await load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string | string[] } } }
      const msg = err.response?.data?.message
      message.error((Array.isArray(msg) ? msg.join('; ') : msg) ?? t('grounding.failed'))
    } finally {
      setBusy(false)
    }
  }

  const cellStyle = (fstdId: string, date: string): React.CSSProperties => {
    const isGrounded = grounded.has(key(fstdId, date))
    const isSelected = selected.has(key(fstdId, date))
    return {
      width: 34,
      minWidth: 34,
      height: 34,
      textAlign: 'center',
      border: '1px solid #f0f0f0',
      cursor: editable(date) ? 'pointer' : 'not-allowed',
      background: isSelected ? '#bae0ff' : isGrounded ? (editable(date) ? '#ff7875' : '#d9a5a5') : editable(date) ? '#fff' : '#f5f5f5',
      outline: isSelected ? '2px solid #1677ff' : undefined,
      outlineOffset: -2,
      color: '#fff',
      fontSize: 12,
    }
  }

  return (
    <div>
      <OrganizationSelector organizations={organizations} selectedId={selectedId} onChange={select} />
      <Typography.Paragraph type="secondary">{t('grounding.intro')}</Typography.Paragraph>

      {!selectedId ? (
        <Empty description={t('common.selectOrganizationPlaceholder')} />
      ) : fstds.length === 0 ? (
        <Empty description={t('grounding.noDevices')} />
      ) : (
        <>
          <Space wrap style={{ marginBottom: 12 }}>
            <DatePicker picker="month" allowClear={false} value={dayjs(`${month}-01`)} onChange={(v) => v && setMonth(v.format('YYYY-MM'))} />
            <Input style={{ width: 220 }} maxLength={200} placeholder={t('grounding.notePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} />
            <Button type="primary" danger disabled={selected.size === 0} loading={busy} onClick={() => run('mark')}>
              {t('grounding.mark')}
            </Button>
            <Button disabled={selected.size === 0} loading={busy} onClick={() => run('cancel')}>
              {t('grounding.cancel')}
            </Button>
            <Button disabled={selected.size === 0} onClick={() => setSelected(new Set())}>
              {t('grounding.clearSelection')}
            </Button>
            <Typography.Text type="secondary">{t('grounding.selectedCount', { count: selected.size })}</Typography.Text>
          </Space>
          <Space style={{ marginBottom: 12 }}>
            <Tag color="#ff7875">{t('grounding.legendGrounded')}</Tag>
            <Tag color="#d9a5a5">{t('grounding.legendPast')}</Tag>
            <Tag color="#bae0ff" style={{ color: '#1f1f1f' }}>
              {t('grounding.legendSelected')}
            </Tag>
          </Space>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 150, textAlign: 'left', padding: '0 8px' }}>{t('grounding.device')}</th>
                  {days.map((d) => {
                    const cells = editable(d) ? fstds.map((f) => key(f.id, d)) : []
                    return (
                      <th
                        key={d}
                        onClick={() => cells.length > 0 && toggleGroup(cells)}
                        style={{ width: 34, minWidth: 34, fontSize: 12, fontWeight: d === today ? 700 : 400, color: editable(d) ? '#1f1f1f' : '#aaa', background: d === today ? '#e6f4ff' : undefined, cursor: editable(d) ? 'pointer' : 'default' }}
                      >
                        <div>{d.slice(8)}</div>
                        <div style={{ fontSize: 10 }}>{weekdayLabel(d, i18n.language)}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {fstds.map((f) => (
                  <tr key={f.id}>
                    <td
                      onClick={() => toggleGroup(days.filter(editable).map((d) => key(f.id, d)))}
                      style={{ padding: '0 8px', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 }}
                      title={t('grounding.rowHint')}
                    >
                      {f.deviceCode} {f.representedAircraft}
                    </td>
                    {days.map((d) => {
                      const rec = grounded.get(key(f.id, d))
                      return (
                        <td key={d} style={cellStyle(f.id, d)} title={rec?.note ?? undefined} onClick={() => toggle(f.id, d)}>
                          {rec ? t('grounding.cellMark') : ''}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
