import { DownloadOutlined, PrinterOutlined } from '@ant-design/icons'
import { Alert, App, Button, DatePicker, Empty, Space, Statistic, Switch, Table, Tabs, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FaultDetail, FaultRow, OperationalEfficiencyRow, PartRow, PmRow, ReportKind } from '../api/reports'
import { reportsApi } from '../api/reports'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { useAuth } from '../auth/AuthContext'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'
import { cnDateTimeLabel, cnTodayString } from '../utils/trainingPlanTime'

const { RangePicker } = DatePicker

const pct = (v: number | null) => (v == null ? '-' : `${v.toFixed(2)}%`)
const PM_LEVELS = ['WEEKLY', 'MONTHLY', 'SEMI_ANNUAL', 'ANNUAL'] as const

export function ReportsPage() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { hasPermission } = useAuth()
  const { organizations, selectedId, select } = useSelectedOrganization()
  const today = cnTodayString()
  const [range, setRange] = useState<[string, string]>([`${today.slice(0, 7)}-01`, today])
  const [active, setActive] = useState<ReportKind>(hasPermission('FSTD') ? 'operational-efficiency' : 'parts')
  const [minutes, setMinutes] = useState(false)
  const [loading, setLoading] = useState(false)

  const [efficiency, setEfficiency] = useState<OperationalEfficiencyRow[]>([])
  const [faults, setFaults] = useState<{ rows: FaultRow[]; people: { personnelId: string; name: string; corrected: number }[]; details: FaultDetail[]; detailsTruncated: boolean }>()
  const [pm, setPm] = useState<{ rows: PmRow[]; people: { personnelId: string; name: string; count: number }[] }>()
  const [parts, setParts] = useState<Awaited<ReturnType<typeof reportsApi.parts>>>()

  const [from, to] = range

  const load = useCallback(async () => {
    if (!selectedId) return
    setLoading(true)
    try {
      if (active === 'operational-efficiency') setEfficiency((await reportsApi.operationalEfficiency(selectedId, from, to)).rows)
      else if (active === 'faults') setFaults(await reportsApi.faults(selectedId, from, to))
      else if (active === 'pm') setPm(await reportsApi.pm(selectedId, from, to))
      else setParts(await reportsApi.parts(selectedId, from, to))
    } catch (e) {
      const err = e as { response?: { data?: { message?: string | string[] } } }
      const msg = err.response?.data?.message
      message.error((Array.isArray(msg) ? msg.join('; ') : msg) ?? t('reports.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [selectedId, active, from, to, message, t])

  useEffect(() => {
    load()
  }, [load])

  const doExport = async () => {
    if (!selectedId) return
    try {
      await reportsApi.exportReport(active, selectedId, from, to)
    } catch {
      message.error(t('reports.exportFailed'))
    }
  }

  const hours = (v: number) => (minutes ? `${Math.round(v * 60)} min` : `${v} h`)

  const efficiencyColumns: ColumnsType<OperationalEfficiencyRow> = [
    { title: t('reports.device'), render: (_, r) => `${r.deviceCode} ${r.representedAircraft}`, fixed: 'left' },
    {
      title: t('reports.monthsData'),
      render: (_, r) => (r.monthsWithData < r.monthsExpected ? <Tag color="orange">{`${r.monthsWithData}/${r.monthsExpected}`}</Tag> : `${r.monthsWithData}/${r.monthsExpected}`),
    },
    { title: t('reports.plannedAvailable'), render: (_, r) => hours(r.plannedAvailableHours) },
    { title: t('reports.support'), render: (_, r) => hours(r.supportHours) },
    { title: t('reports.interruptionHours'), render: (_, r) => hours(r.interruptionHours) },
    { title: t('reports.interruptionCount'), dataIndex: 'interruptionCount' },
    { title: t('reports.discrepancyCount'), dataIndex: 'discrepancyCount' },
    { title: t('reports.interruptionRate'), render: (_, r) => pct(r.interruptionRatePercent) },
    { title: t('reports.onTimeRate'), render: (_, r) => pct(r.onTimeClosureRatePercent) },
    { title: t('reports.openCount'), dataIndex: 'openDiscrepancyCount' },
    { title: t('reports.efficiency'), render: (_, r) => pct(r.operatingEfficiencyPercent) },
    { title: t('reports.availability'), render: (_, r) => pct(r.availabilityPercent) },
  ]

  const faultColumns: ColumnsType<FaultRow> = [
    { title: t('reports.device'), render: (_, r) => `${r.deviceCode} ${r.representedAircraft}` },
    { title: t('reports.faultTotal'), dataIndex: 'total' },
    { title: t('reports.faultCorrected'), dataIndex: 'corrected' },
    { title: t('reports.faultOpen'), dataIndex: 'open' },
    { title: t('reports.faultOverdue'), render: (_, r) => (r.overdueOpen > 0 ? <Tag color="red">{r.overdueOpen}</Tag> : 0) },
    { title: t('reports.faultMmi'), dataIndex: 'mmi' },
    { title: t('reports.faultDeferred'), dataIndex: 'deferred' },
    { title: t('reports.faultLost'), dataIndex: 'trainingTimeLostMinutes' },
    { title: t('reports.faultSeverity'), render: (_, r) => r.averageSeverity ?? '-' },
    { title: t('reports.faultRepairDays'), render: (_, r) => r.averageRepairDays ?? '-' },
    { title: t('reports.onTimeRate'), render: (_, r) => pct(r.onTimeClosureRatePercent) },
  ]

  const faultDetailColumns: ColumnsType<FaultDetail> = [
    { title: t('reports.device'), dataIndex: 'deviceCode' },
    { title: t('reports.reportedAt'), render: (_, r) => cnDateTimeLabel(r.reportedAt) },
    { title: t('reports.description'), dataIndex: 'description', ellipsis: true },
    { title: t('reports.faultMmi'), render: (_, r) => (r.isMmi ? <Tag color="red">MMI</Tag> : '') },
    { title: t('reports.status'), render: (_, r) => (r.status === 'corrected' ? t('reports.statusCorrected') : <Tag color="orange">{t('reports.statusOpen')}</Tag>) },
    { title: t('reports.correctedAt'), render: (_, r) => (r.correctedAt ? cnDateTimeLabel(r.correctedAt) : '-') },
    { title: t('reports.correctedBy'), render: (_, r) => r.correctedBy ?? '-' },
    { title: t('reports.dueDate'), render: (_, r) => (r.dueDate ? cnDateTimeLabel(r.dueDate).slice(0, 10) : '-') },
  ]

  const pmColumns: ColumnsType<PmRow> = [
    { title: t('reports.device'), render: (_, r) => `${r.deviceCode} ${r.representedAircraft}` },
    { title: t('reports.pmTotal'), dataIndex: 'total' },
    ...PM_LEVELS.map((level) => ({
      title: t(`reports.${level}`),
      render: (_: unknown, r: PmRow) => {
        const v = r.byLevel[level]
        return v.total === 0 ? '-' : `${v.approved}/${v.total}`
      },
    })),
  ]

  const partColumns: ColumnsType<PartRow> = [
    { title: t('reports.partNumber'), dataIndex: 'partNumber' },
    { title: t('reports.partName'), dataIndex: 'name' },
    { title: t('reports.stock'), render: (_, r) => (r.belowMinimum ? <Tag color="red">{r.currentQuantity}</Tag> : r.currentQuantity) },
    { title: t('reports.minStock'), dataIndex: 'minQuantity' },
    { title: t('reports.received'), dataIndex: 'received' },
    { title: t('reports.used'), dataIndex: 'used' },
    { title: t('reports.adjustment'), dataIndex: 'adjustment' },
    { title: t('reports.loanedOut'), dataIndex: 'loanedOutQuantity' },
    { title: t('reports.returned'), dataIndex: 'returnedQuantity' },
    { title: t('reports.outstanding'), dataIndex: 'outstandingLoanQuantity' },
    { title: t('reports.overdueLoans'), render: (_, r) => (r.overdueLoanCount > 0 ? <Tag color="red">{r.overdueLoanCount}</Tag> : 0) },
    { title: t('reports.faultyRecords'), dataIndex: 'faultyRecordCount' },
    { title: t('reports.faultyQty'), dataIndex: 'faultyQuantity' },
  ]

  const tabs = [
    hasPermission('FSTD') && {
      key: 'operational-efficiency',
      label: t('reports.tabOperational'),
      children: (
        <>
          <Alert type="info" showIcon style={{ marginBottom: 8 }} message={t('reports.monthsNote')} description={t('reports.operationalFormula')} />
          <Table rowKey="fstdId" size="small" loading={loading} dataSource={efficiency} columns={efficiencyColumns} pagination={false} scroll={{ x: 'max-content' }} locale={{ emptyText: <Empty description={t('reports.noData')} /> }} />
        </>
      ),
    },
    hasPermission('FSTD') && {
      key: 'faults',
      label: t('reports.tabFaults'),
      children: (
        <>
          <Table rowKey="fstdId" size="small" loading={loading} dataSource={faults?.rows ?? []} columns={faultColumns} pagination={false} scroll={{ x: 'max-content' }} locale={{ emptyText: <Empty description={t('reports.noData')} /> }} />
          <Typography.Title level={5} style={{ marginTop: 16 }}>{t('reports.faultPeople')}</Typography.Title>
          <Table
            rowKey="personnelId"
            size="small"
            dataSource={faults?.people ?? []}
            locale={{ emptyText: t('reports.noData') }}
            pagination={false}
            columns={[
              { title: t('reports.person'), dataIndex: 'name' },
              { title: t('reports.count'), dataIndex: 'corrected' },
            ]}
          />
          <Typography.Title level={5} style={{ marginTop: 16 }}>{t('reports.faultDetails')}</Typography.Title>
          {faults?.detailsTruncated && <Alert type="warning" showIcon style={{ marginBottom: 8 }} message={t('reports.detailsTruncated')} />}
          <Table rowKey="id" size="small" dataSource={faults?.details ?? []} locale={{ emptyText: t('reports.noData') }} columns={faultDetailColumns} pagination={{ pageSize: 20 }} scroll={{ x: 'max-content' }} />
        </>
      ),
    },
    hasPermission('FSTD') && {
      key: 'pm',
      label: t('reports.tabPm'),
      children: (
        <>
          <Alert type="info" showIcon style={{ marginBottom: 8 }} message={t('reports.pmNote')} />
          <Table rowKey="fstdId" size="small" loading={loading} dataSource={pm?.rows ?? []} columns={pmColumns} pagination={false} locale={{ emptyText: <Empty description={t('reports.noData')} /> }} />
          <Typography.Title level={5} style={{ marginTop: 16 }}>{t('reports.pmPeople')}</Typography.Title>
          <Table
            rowKey="personnelId"
            size="small"
            dataSource={pm?.people ?? []}
            locale={{ emptyText: t('reports.noData') }}
            pagination={false}
            columns={[
              { title: t('reports.person'), dataIndex: 'name' },
              { title: t('reports.count'), dataIndex: 'count' },
            ]}
          />
        </>
      ),
    },
    hasPermission('INVENTORY') && {
      key: 'parts',
      label: t('reports.tabParts'),
      children: (
        <>
          <Alert type="info" showIcon style={{ marginBottom: 8 }} message={t('reports.partsNote')} />
          {parts && (
            <Space size={32} style={{ marginBottom: 12 }} wrap>
              <Statistic title={t('reports.totalsParts')} value={parts.totals.partKinds} />
              <Statistic title={t('reports.totalsReceived')} value={parts.totals.receivedQuantity} />
              <Statistic title={t('reports.totalsUsed')} value={parts.totals.usedQuantity} />
              <Statistic title={t('reports.totalsBelowMin')} value={parts.totals.belowMinimumCount} />
            </Space>
          )}
          <Table rowKey="sparePartId" size="small" loading={loading} dataSource={parts?.rows ?? []} columns={partColumns} pagination={{ pageSize: 20 }} scroll={{ x: 'max-content' }} locale={{ emptyText: <Empty description={t('reports.noData')} /> }} />
        </>
      ),
    },
  ].filter(Boolean) as { key: string; label: string; children: React.ReactNode }[]

  return (
    <div>
      <OrganizationSelector organizations={organizations} selectedId={selectedId} onChange={select} />
      <Typography.Paragraph type="secondary">{t('reports.intro')}</Typography.Paragraph>
      <Space wrap style={{ marginBottom: 12 }}>
        <RangePicker
          allowClear={false}
          value={[dayjs(from), dayjs(to)]}
          onChange={(v) => v?.[0] && v[1] && setRange([v[0].format('YYYY-MM-DD'), v[1].format('YYYY-MM-DD')])}
        />
        {active === 'operational-efficiency' && (
          <Space>
            <Switch checked={minutes} onChange={setMinutes} />
            {t('reports.showMinutes')}
          </Space>
        )}
        <Button icon={<DownloadOutlined />} onClick={doExport} disabled={!selectedId}>
          {t('reports.export')}
        </Button>
        <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
          {t('reports.print')}
        </Button>
      </Space>
      {!selectedId ? <Empty description={t('common.selectOrganizationPlaceholder')} /> : <Tabs activeKey={active} onChange={(k) => setActive(k as ReportKind)} items={tabs} />}
    </div>
  )
}
