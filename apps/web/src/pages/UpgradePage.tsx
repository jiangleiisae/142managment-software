import { DownloadOutlined, PlusOutlined } from '@ant-design/icons'
import { Alert, App, Button, DatePicker, Empty, Form, Input, Modal, Radio, Select, Space, Switch, Table, Tabs, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fstdsApi } from '../api/fstds'
import { inventoryApi } from '../api/inventory'
import type { Tool, ToolCalibrationRecord } from '../api/inventory'
import { personnelApi } from '../api/personnel'
import type { Fstd, Personnel } from '../api/types'
import type { UpgradeCategory, UpgradeInput, UpgradeRecord } from '../api/upgrades'
import { upgradesApi } from '../api/upgrades'
import { useAuth } from '../auth/AuthContext'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { resolveStandard } from '../hooks/useRegulatoryStandard'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'
import { cnTodayString, shiftDay } from '../utils/trainingPlanTime'

const { RangePicker } = DatePicker
const CATEGORIES: UpgradeCategory[] = ['MODEL_UPGRADE', 'SUBSYSTEM_UPGRADE', 'INSTRUMENT_CALIBRATION', 'DATABASE_UPDATE']
const apiError = (e: unknown, fallback: string) => {
  const msg = (e as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
  return (Array.isArray(msg) ? msg.join('; ') : msg) ?? fallback
}

/// 升级校准: 模拟机升级 / 子系统升级 / 仪表校准 / 数据库更新 / 工具校准(沿用工具模块) / 升级历史。
export function UpgradePage() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { hasPermission } = useAuth()
  const { organizations, selectedId, select } = useSelectedOrganization()
  const isCaac = resolveStandard(organizations, selectedId) === 'CAAC'
  const today = cnTodayString()

  const [fstds, setFstds] = useState<Fstd[]>([])
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  useEffect(() => {
    if (!selectedId) return
    fstdsApi.list(selectedId).then(setFstds)
    personnelApi.list().then(setPersonnel)
  }, [selectedId])

  const [active, setActive] = useState<string>('MODEL_UPGRADE')
  const [range, setRange] = useState<[string, string]>([shiftDay(today, -365), today])
  const [fstdFilter, setFstdFilter] = useState<string>()
  const [rows, setRows] = useState<UpgradeRecord[]>([])
  const [loading, setLoading] = useState(false)

  const isCategoryTab = (CATEGORIES as string[]).includes(active)
  const loadRows = useCallback(async () => {
    if (!selectedId || (active !== 'HISTORY' && !isCategoryTab)) return
    setLoading(true)
    try {
      setRows(await upgradesApi.list(selectedId, { category: isCategoryTab ? (active as UpgradeCategory) : undefined, fstdId: fstdFilter, from: range[0], to: range[1] }))
    } catch (e) {
      message.error(apiError(e, t('upgrade.failed')))
    } finally {
      setLoading(false)
    }
  }, [selectedId, active, isCategoryTab, fstdFilter, range, message, t])

  useEffect(() => {
    loadRows()
  }, [loadRows])

  // ---------------- 新增 / 编辑 ----------------
  const [modal, setModal] = useState<{ open: boolean; editing?: UpgradeRecord }>({ open: false })
  const [form] = Form.useForm()
  const modalCategory = (modal.editing?.category ?? (isCategoryTab ? (active as UpgradeCategory) : 'MODEL_UPGRADE')) as UpgradeCategory
  const isMod = Form.useWatch('isModification', form) as boolean | undefined

  const openModal = (editing?: UpgradeRecord) => {
    form.resetFields()
    form.setFieldsValue(
      editing
        ? {
            ...editing,
            performedOn: dayjs(editing.performedOn),
            nextDueDate: editing.nextDueDate ? dayjs(editing.nextDueDate) : undefined,
            caacReportedOn: editing.caacReportedOn ? dayjs(editing.caacReportedOn) : undefined,
            performedByPersonnelId: editing.performedByPersonnelId ?? undefined,
          }
        : { fstdId: fstdFilter ?? fstds[0]?.id, performedOn: dayjs(today), result: 'pass', isModification: false },
    )
    setModal({ open: true, editing })
  }

  const day = (v?: dayjs.Dayjs) => (v ? v.format('YYYY-MM-DD') : undefined)
  const text = (v?: string) => (v && v.trim() ? v.trim() : undefined)

  const save = async () => {
    const v = await form.validateFields()
    if (!selectedId) return
    const data: UpgradeInput = {
      performedOn: day(v.performedOn) as string,
      title: v.title.trim(),
      description: text(v.description),
      subsystem: text(v.subsystem),
      versionFrom: text(v.versionFrom),
      versionTo: text(v.versionTo),
      performedByPersonnelId: v.performedByPersonnelId || undefined,
      performedByName: text(v.performedByName),
      result: v.result,
      nextDueDate: day(v.nextDueDate),
      isModification: !!v.isModification,
      caacReportRef: text(v.caacReportRef),
      caacReportedOn: day(v.caacReportedOn),
      notes: text(v.notes),
    }
    try {
      if (modal.editing) await upgradesApi.update(modal.editing.id, data)
      else await upgradesApi.create(selectedId, { ...data, fstdId: v.fstdId, category: modalCategory })
      message.success(t('upgrade.saved'))
      setModal({ open: false })
      await loadRows()
    } catch (e) {
      message.error(apiError(e, t('upgrade.failed')))
    }
  }

  const columns: ColumnsType<UpgradeRecord> = [
    { title: t('upgrade.performedOn'), dataIndex: 'performedOn' },
    { title: t('upgrade.device'), dataIndex: 'deviceCode' },
    ...(active === 'HISTORY' ? [{ title: t('upgrade.category'), render: (_: unknown, r: UpgradeRecord) => t(`upgrade.cat.${r.category}`) }] : []),
    {
      title: t('upgrade.titleField'),
      render: (_, r) => (
        <Space size={4} wrap>
          {r.title}
          {r.isModification && <Tag color="orange">{t('upgrade.modification')}</Tag>}
          {isCaac && r.needsCaacReport && <Tag color="red">{t('upgrade.needsReport')}</Tag>}
        </Space>
      ),
    },
    { title: t('upgrade.subsystem'), render: (_, r) => r.subsystem ?? '-' },
    { title: t('upgrade.version'), render: (_, r) => (r.versionFrom || r.versionTo ? `${r.versionFrom ?? '?'} → ${r.versionTo ?? '?'}` : '-') },
    { title: t('upgrade.performedBy'), render: (_, r) => r.performedBy ?? r.performedByName ?? '-' },
    { title: t('upgrade.result'), render: (_, r) => (r.result === 'pass' ? <Tag color="green">{t('upgrade.pass')}</Tag> : <Tag color="red">{t('upgrade.fail')}</Tag>) },
    { title: t('upgrade.nextDue'), render: (_, r) => (r.nextDueDate ? <span style={{ color: r.overdue ? '#cf1322' : undefined }}>{r.nextDueDate}</span> : '-') },
    ...(isCaac ? [{ title: t('upgrade.reportRef'), render: (_: unknown, r: UpgradeRecord) => r.caacReportRef ?? '-' }] : []),
    { title: '', render: (_, r) => <Button size="small" onClick={() => openModal(r)}>{t('upgrade.edit')}</Button> },
  ]

  const filters = (
    <Space wrap style={{ marginBottom: 8 }}>
      <RangePicker allowClear={false} value={[dayjs(range[0]), dayjs(range[1])]} onChange={(v) => v?.[0] && v[1] && setRange([v[0].format('YYYY-MM-DD'), v[1].format('YYYY-MM-DD')])} />
      <Select allowClear style={{ width: 180 }} placeholder={t('upgrade.device')} value={fstdFilter} onChange={setFstdFilter} options={fstds.map((f) => ({ value: f.id, label: f.deviceCode }))} />
      {active !== 'HISTORY' && (
        <Button type="primary" icon={<PlusOutlined />} disabled={fstds.length === 0} onClick={() => openModal()}>
          {t('upgrade.add')}
        </Button>
      )}
      <Button icon={<DownloadOutlined />} disabled={!selectedId} onClick={() => selectedId && upgradesApi.exportRecords(selectedId, { category: isCategoryTab ? (active as UpgradeCategory) : undefined, fstdId: fstdFilter, from: range[0], to: range[1] })}>
        {t('upgrade.export')}
      </Button>
    </Space>
  )

  const table = <Table rowKey="id" size="small" loading={loading} dataSource={rows} columns={columns} pagination={{ pageSize: 20 }} scroll={{ x: 'max-content' }} locale={{ emptyText: t('upgrade.noData') }} />

  // ---------------- 工具校准 (沿用工具模块) ----------------
  const [tools, setTools] = useState<Tool[]>([])
  const [toolRecords, setToolRecords] = useState<Record<string, ToolCalibrationRecord[]>>({})
  const [calibTool, setCalibTool] = useState<Tool>()
  const [calibForm] = Form.useForm()

  const loadTools = useCallback(async () => {
    if (!selectedId || active !== 'TOOL' || !hasPermission('INVENTORY')) return
    const list = await inventoryApi.listTools(selectedId)
    setTools(list)
    const entries = await Promise.all(list.map(async (tl) => [tl.id, await inventoryApi.listCalibrations(tl.id)] as const))
    setToolRecords(Object.fromEntries(entries))
  }, [selectedId, active, hasPermission])

  useEffect(() => {
    loadTools()
  }, [loadTools])

  const saveCalibration = async () => {
    const v = await calibForm.validateFields()
    if (!calibTool) return
    try {
      await inventoryApi.recordCalibration(calibTool.id, { calibratedAt: v.calibratedAt.format('YYYY-MM-DD'), result: v.result })
      message.success(t('upgrade.saved'))
      setCalibTool(undefined)
      await loadTools()
    } catch (e) {
      message.error(apiError(e, t('upgrade.failed')))
    }
  }

  const toolTab = (
    <>
      <Alert type="info" showIcon style={{ marginBottom: 8 }} message={t('upgrade.toolNote')} />
      <Table
        rowKey="id"
        size="small"
        dataSource={tools}
        pagination={false}
        locale={{ emptyText: t('upgrade.noData') }}
        columns={[
          { title: t('upgrade.toolCode'), dataIndex: 'toolCode' },
          { title: t('upgrade.toolName'), dataIndex: 'name' },
          { title: t('upgrade.interval'), render: (_, tl) => `${tl.calibrationIntervalMonths} ${t('upgrade.months')}` },
          { title: t('upgrade.lastCalibration'), render: (_, tl) => toolRecords[tl.id]?.[0]?.calibratedAt?.slice(0, 10) ?? '-' },
          { title: t('upgrade.nextDue'), render: (_, tl) => toolRecords[tl.id]?.[0]?.nextDueDate?.slice(0, 10) ?? '-' },
          { title: '', render: (_, tl) => <Button size="small" type="primary" onClick={() => { calibForm.resetFields(); calibForm.setFieldsValue({ calibratedAt: dayjs(today), result: 'pass' }); setCalibTool(tl) }}>{t('upgrade.recordCalibration')}</Button> },
        ]}
      />
      <Modal title={calibTool ? `${t('upgrade.recordCalibration')} · ${calibTool.toolCode}` : ''} open={!!calibTool} onCancel={() => setCalibTool(undefined)} onOk={saveCalibration} destroyOnHidden>
        <Form form={calibForm} layout="vertical">
          <Form.Item name="calibratedAt" label={t('upgrade.performedOn')} rules={[{ required: true }]}>
            <DatePicker allowClear={false} />
          </Form.Item>
          <Form.Item name="result" label={t('upgrade.result')}>
            <Radio.Group options={[{ value: 'pass', label: t('upgrade.pass') }, { value: 'fail', label: t('upgrade.fail') }]} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )

  // ---------------- 年度运行报告底稿 ----------------
  const [reportRange, setReportRange] = useState<[string, string]>([shiftDay(today, -364), today])

  const items = [
    ...CATEGORIES.map((c) => ({ key: c, label: t(`upgrade.cat.${c}`), children: active === c ? <>{filters}{table}</> : null })),
    ...(hasPermission('INVENTORY') ? [{ key: 'TOOL', label: t('upgrade.toolCalibration'), children: active === 'TOOL' ? toolTab : null }] : []),
    { key: 'HISTORY', label: t('upgrade.history'), children: active === 'HISTORY' ? <>{filters}{table}</> : null },
  ]

  return (
    <div>
      <OrganizationSelector organizations={organizations} selectedId={selectedId} onChange={select} />
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        {t('upgrade.title')}
      </Typography.Title>
      <Typography.Paragraph type="secondary">{t('upgrade.intro')}</Typography.Paragraph>
      {isCaac && (
        <Alert
          style={{ marginBottom: 12 }}
          type="info"
          showIcon
          message={t('upgrade.caacNote')}
          description={
            <Space wrap>
              <RangePicker allowClear={false} value={[dayjs(reportRange[0]), dayjs(reportRange[1])]} onChange={(v) => v?.[0] && v[1] && setReportRange([v[0].format('YYYY-MM-DD'), v[1].format('YYYY-MM-DD')])} />
              <Button icon={<DownloadOutlined />} disabled={!selectedId} onClick={() => selectedId && upgradesApi.exportAnnualReport(selectedId, reportRange[0], reportRange[1]).catch((e) => message.error(apiError(e, t('upgrade.failed'))))}>
                {t('upgrade.exportAnnual')}
              </Button>
            </Space>
          }
        />
      )}
      {!selectedId ? <Empty description={t('common.selectOrganizationPlaceholder')} /> : <Tabs activeKey={active} onChange={setActive} items={items} />}

      <Modal title={`${modal.editing ? t('upgrade.edit') : t('upgrade.add')} · ${t(`upgrade.cat.${modalCategory}`)}`} open={modal.open} onCancel={() => setModal({ open: false })} onOk={save} width={640} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="fstdId" label={t('upgrade.device')} rules={[{ required: true }]}>
            <Select disabled={!!modal.editing} options={fstds.map((f) => ({ value: f.id, label: `${f.deviceCode} ${f.representedAircraft}` }))} />
          </Form.Item>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="performedOn" label={t('upgrade.performedOn')} rules={[{ required: true }]}>
              <DatePicker allowClear={false} />
            </Form.Item>
            <Form.Item name="result" label={t('upgrade.result')}>
              <Radio.Group options={[{ value: 'pass', label: t('upgrade.pass') }, { value: 'fail', label: t('upgrade.fail') }]} />
            </Form.Item>
          </Space>
          <Form.Item name="title" label={t('upgrade.titleField')} rules={[{ required: true }]}>
            <Input maxLength={200} />
          </Form.Item>
          {modalCategory === 'SUBSYSTEM_UPGRADE' && (
            <Form.Item name="subsystem" label={t('upgrade.subsystem')} rules={[{ required: true }]} extra={t('upgrade.subsystemHint')}>
              <Input maxLength={100} />
            </Form.Item>
          )}
          {(modalCategory === 'MODEL_UPGRADE' || modalCategory === 'SUBSYSTEM_UPGRADE' || modalCategory === 'DATABASE_UPDATE') && (
            <Space style={{ display: 'flex' }}>
              <Form.Item name="versionFrom" label={t('upgrade.versionFrom')}>
                <Input maxLength={100} />
              </Form.Item>
              <Form.Item name="versionTo" label={t('upgrade.versionTo')}>
                <Input maxLength={100} />
              </Form.Item>
            </Space>
          )}
          {modalCategory === 'INSTRUMENT_CALIBRATION' && (
            <Form.Item name="nextDueDate" label={t('upgrade.nextDue')}>
              <DatePicker />
            </Form.Item>
          )}
          <Form.Item name="description" label={t('upgrade.description')}>
            <Input.TextArea rows={2} maxLength={2000} />
          </Form.Item>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="performedByPersonnelId" label={t('upgrade.performedBy')} style={{ minWidth: 200 }}>
              <Select allowClear showSearch optionFilterProp="label" options={personnel.map((p) => ({ value: p.id, label: `${p.lastName}${p.firstName}` }))} />
            </Form.Item>
            <Form.Item name="performedByName" label={t('upgrade.performedByName')} style={{ minWidth: 200 }}>
              <Input maxLength={100} />
            </Form.Item>
          </Space>
          {(modalCategory === 'MODEL_UPGRADE' || modalCategory === 'SUBSYSTEM_UPGRADE') && (
            <Form.Item name="isModification" label={t('upgrade.isModification')} valuePropName="checked" extra={isCaac ? t('upgrade.isModificationHintCaac') : undefined}>
              <Switch />
            </Form.Item>
          )}
          {isCaac && isMod && (
            <Space style={{ display: 'flex' }} align="start">
              <Form.Item name="caacReportRef" label={t('upgrade.reportRef')}>
                <Input maxLength={100} />
              </Form.Item>
              <Form.Item name="caacReportedOn" label={t('upgrade.reportedOn')}>
                <DatePicker />
              </Form.Item>
            </Space>
          )}
          <Form.Item name="notes" label={t('upgrade.notes')}>
            <Input.TextArea rows={2} maxLength={1000} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
