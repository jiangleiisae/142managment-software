import { App, Button, Empty, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { personnelApi } from '../api/personnel'
import type { Personnel } from '../api/types'
import type { QtgQuarterStatus, QtgScheduleRow } from '../api/upgrades'
import { upgradesApi } from '../api/upgrades'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'
import { cnTodayString } from '../utils/trainingPlanTime'

const apiError = (e: unknown, fallback: string) => {
  const msg = (e as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
  return (Array.isArray(msg) ? msg.join('; ') : msg) ?? fallback
}
const STATUS_COLOR: Record<QtgQuarterStatus, string> = { DONE: 'green', DONE_OUTSIDE: 'orange', UPCOMING: 'default', PENDING: 'blue', OVERDUE: 'red' }
const MMDD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

/// QTG 设置: 每台设备每个季度的计划执行时段(每年重复, MM-DD)和责任人, 并对照实际完成情况显示状态。
export function QtgPlanPage() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { organizations, selectedId, select } = useSelectedOrganization()
  const thisYear = Number(cnTodayString().slice(0, 4))
  const [year, setYear] = useState(thisYear)
  const [rows, setRows] = useState<QtgScheduleRow[]>([])
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<{ row: QtgScheduleRow; quarter: number }>()
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    if (!selectedId) return
    setLoading(true)
    try {
      setRows(await upgradesApi.qtgSchedule(selectedId, year))
    } catch (e) {
      message.error(apiError(e, t('qtgPlan.failed')))
    } finally {
      setLoading(false)
    }
  }, [selectedId, year, message, t])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    personnelApi.list().then(setPersonnel)
  }, [])

  const openEdit = (row: QtgScheduleRow, quarter: number) => {
    const q = row.quarters.find((x) => x.quarter === quarter)
    form.resetFields()
    form.setFieldsValue({ windowStart: q?.windowStart, windowEnd: q?.windowEnd, responsibleIds: q?.responsibleIds ?? [] })
    setEditing({ row, quarter })
  }

  const save = async () => {
    const v = await form.validateFields()
    if (!selectedId || !editing) return
    try {
      await upgradesApi.setQtgPlan({ organizationId: selectedId, fstdId: editing.row.fstdId, quarter: editing.quarter, windowStart: v.windowStart, windowEnd: v.windowEnd, responsibleIds: v.responsibleIds ?? [] })
      message.success(t('qtgPlan.saved'))
      setEditing(undefined)
      await load()
    } catch (e) {
      message.error(apiError(e, t('qtgPlan.failed')))
    }
  }

  const clear = async () => {
    if (!selectedId || !editing) return
    try {
      await upgradesApi.clearQtgPlan(selectedId, editing.row.fstdId, editing.quarter)
      message.success(t('qtgPlan.cleared'))
      setEditing(undefined)
      await load()
    } catch (e) {
      message.error(apiError(e, t('qtgPlan.failed')))
    }
  }

  const statusText: Record<QtgQuarterStatus, string> = {
    DONE: t('qtgPlan.statusDone'),
    DONE_OUTSIDE: t('qtgPlan.statusDoneOutside'),
    UPCOMING: t('qtgPlan.statusUpcoming'),
    PENDING: t('qtgPlan.statusPending'),
    OVERDUE: t('qtgPlan.statusOverdue'),
  }

  const columns: ColumnsType<QtgScheduleRow> = [
    { title: t('qtgPlan.device'), render: (_, r) => `${r.deviceCode} ${r.representedAircraft}`, fixed: 'left' },
    ...[1, 2, 3, 4].map((quarter) => ({
      title: `Q${quarter}`,
      render: (_: unknown, r: QtgScheduleRow) => {
        const q = r.quarters.find((x) => x.quarter === quarter)
        if (!q) return null
        return (
          <Space direction="vertical" size={2}>
            <Tag color={STATUS_COLOR[q.status]}>{statusText[q.status]}</Tag>
            <Typography.Text type={q.configured ? undefined : 'secondary'}>
              {q.windowStart} ~ {q.windowEnd}
              {!q.configured && ` (${t('qtgPlan.default')})`}
            </Typography.Text>
            <Typography.Text type="secondary">{q.responsible.length ? q.responsible.join('、') : t('qtgPlan.noResponsible')}</Typography.Text>
            {q.completedOn && (
              <Typography.Text type="secondary">
                {t('qtgPlan.completedOn', { date: q.completedOn })}
                {q.result ? ` · ${q.result}` : ''}
              </Typography.Text>
            )}
            <Button size="small" onClick={() => openEdit(r, quarter)}>
              {t('qtgPlan.edit')}
            </Button>
          </Space>
        )
      },
    })),
  ]

  return (
    <div>
      <OrganizationSelector organizations={organizations} selectedId={selectedId} onChange={select} />
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        {t('qtgPlan.title')}
      </Typography.Title>
      <Typography.Paragraph type="secondary">{t('qtgPlan.intro')}</Typography.Paragraph>
      <Space style={{ marginBottom: 12 }}>
        <Select value={year} onChange={setYear} style={{ width: 120 }} options={Array.from({ length: 7 }, (_, i) => thisYear - 3 + i).map((y) => ({ value: y, label: String(y) }))} />
      </Space>
      {!selectedId ? <Empty description={t('common.selectOrganizationPlaceholder')} /> : <Table rowKey="fstdId" size="small" loading={loading} dataSource={rows} columns={columns} pagination={false} scroll={{ x: 'max-content' }} locale={{ emptyText: t('qtgPlan.noDevices') }} />}

      <Modal
        title={editing ? `${editing.row.deviceCode} · Q${editing.quarter}` : ''}
        open={!!editing}
        onCancel={() => setEditing(undefined)}
        onOk={save}
        footer={(_, { OkBtn, CancelBtn }) => (
          <Space>
            {editing?.row.quarters.find((x) => x.quarter === editing.quarter)?.configured && (
              <Button danger onClick={clear}>
                {t('qtgPlan.restoreDefault')}
              </Button>
            )}
            <CancelBtn />
            <OkBtn />
          </Space>
        )}
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary">{t('qtgPlan.formHint')}</Typography.Paragraph>
        <Form form={form} layout="vertical">
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="windowStart" label={t('qtgPlan.windowStart')} rules={[{ required: true, pattern: MMDD, message: t('qtgPlan.mmdd') }]}>
              <Input placeholder="MM-DD" maxLength={5} />
            </Form.Item>
            <Form.Item name="windowEnd" label={t('qtgPlan.windowEnd')} rules={[{ required: true, pattern: MMDD, message: t('qtgPlan.mmdd') }]}>
              <Input placeholder="MM-DD" maxLength={5} />
            </Form.Item>
          </Space>
          <Form.Item name="responsibleIds" label={t('qtgPlan.responsible')}>
            <Select mode="multiple" showSearch optionFilterProp="label" options={personnel.map((p) => ({ value: p.id, label: `${p.lastName}${p.firstName}` }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
