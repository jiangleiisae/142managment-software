import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Alert, App, Button, DatePicker, Empty, Form, Input, Modal, Radio, Select, Space, Table, Tabs, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { personnelApi } from '../api/personnel'
import type { InspectionItem, InspectionRecord } from '../api/quality'
import { qualityApi } from '../api/quality'
import type { Personnel } from '../api/types'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'
import { cnTodayString, shiftDay } from '../utils/trainingPlanTime'

const { RangePicker } = DatePicker
const apiError = (e: unknown, fallback: string) => {
  const msg = (e as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
  return (Array.isArray(msg) ? msg.join('; ') : msg) ?? fallback
}

/// 其他检查: 检查项设置(名称自行配置) + 检查记录(逐项通过/不通过, 保存的是名称快照)。
export function QualityInspectionsPage() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { organizations, selectedId, select } = useSelectedOrganization()
  const today = cnTodayString()
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  useEffect(() => {
    personnelApi.list().then(setPersonnel)
  }, [])

  // ---------------- 检查项设置 ----------------
  const [items, setItems] = useState<InspectionItem[]>([])
  const [draftNames, setDraftNames] = useState<string[]>([])
  const [dirty, setDirty] = useState(false)

  const loadItems = useCallback(async () => {
    if (!selectedId) return
    const list = await qualityApi.listInspectionItems(selectedId)
    setItems(list)
    setDraftNames(list.filter((i) => i.isActive).map((i) => i.name))
    setDirty(false)
  }, [selectedId])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const saveItems = async () => {
    if (!selectedId) return
    try {
      await qualityApi.setInspectionItems(selectedId, draftNames)
      message.success(t('quality.saved'))
      await loadItems()
    } catch (e) {
      message.error(apiError(e, t('quality.failed')))
    }
  }

  const editDraft = (next: string[]) => {
    setDraftNames(next)
    setDirty(true)
  }

  const itemsTab = (
    <>
      <Alert type="info" showIcon style={{ marginBottom: 8 }} message={t('quality.itemsNote')} />
      <Space style={{ marginBottom: 8 }}>
        <Button icon={<PlusOutlined />} onClick={() => editDraft([...draftNames, ''])}>
          {t('quality.addItem')}
        </Button>
        <Button type="primary" disabled={!dirty} onClick={saveItems}>
          {t('quality.save')}
        </Button>
        {dirty && <Typography.Text type="warning">{t('quality.unsaved')}</Typography.Text>}
      </Space>
      <Space direction="vertical" style={{ width: '100%', maxWidth: 520 }}>
        {draftNames.map((name, i) => (
          <Space.Compact key={i} style={{ width: '100%' }}>
            <Input value={name} maxLength={200} onChange={(e) => editDraft(draftNames.map((n, idx) => (idx === i ? e.target.value : n)))} />
            <Button icon={<DeleteOutlined />} onClick={() => editDraft(draftNames.filter((_, idx) => idx !== i))} />
          </Space.Compact>
        ))}
      </Space>
      {items.some((i) => !i.isActive) && (
        <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
          {t('quality.disabledItems')}：{items.filter((i) => !i.isActive).map((i) => i.name).join('、')}
        </Typography.Paragraph>
      )}
    </>
  )

  // ---------------- 检查记录 ----------------
  const [range, setRange] = useState<[string, string]>([shiftDay(today, -90), today])
  const [result, setResult] = useState<string>()
  const [records, setRecords] = useState<InspectionRecord[]>([])
  const [viewing, setViewing] = useState<InspectionRecord>()
  const [createOpen, setCreateOpen] = useState(false)
  const [marks, setMarks] = useState<Record<string, { passed: boolean; notes: string }>>({})
  const [form] = Form.useForm()

  const loadRecords = useCallback(async () => {
    if (!selectedId) return
    try {
      setRecords(await qualityApi.listInspections(selectedId, { from: range[0], to: range[1], result }))
    } catch (e) {
      message.error(apiError(e, t('quality.failed')))
    }
  }, [selectedId, range, result, message, t])

  useEffect(() => {
    loadRecords()
  }, [loadRecords])

  const activeItems = items.filter((i) => i.isActive)
  const openCreate = () => {
    form.resetFields()
    form.setFieldsValue({ inspectedOn: dayjs(today) })
    setMarks(Object.fromEntries(activeItems.map((i) => [i.name, { passed: true, notes: '' }])))
    setCreateOpen(true)
  }

  const submit = async () => {
    const v = await form.validateFields()
    if (!selectedId) return
    try {
      await qualityApi.createInspection({
        organizationId: selectedId,
        inspectedOn: (v.inspectedOn as dayjs.Dayjs).format('YYYY-MM-DD'),
        title: v.title.trim(),
        performedByPersonnelId: v.performedByPersonnelId || undefined,
        results: activeItems.map((i) => ({ name: i.name, passed: marks[i.name]?.passed ?? true, notes: marks[i.name]?.notes || undefined })),
        notes: v.notes?.trim() || undefined,
      })
      message.success(t('quality.saved'))
      setCreateOpen(false)
      await loadRecords()
    } catch (e) {
      message.error(apiError(e, t('quality.failed')))
    }
  }

  const recordsTab = (
    <>
      <Space wrap style={{ marginBottom: 8 }}>
        <RangePicker allowClear={false} value={[dayjs(range[0]), dayjs(range[1])]} onChange={(v) => v?.[0] && v[1] && setRange([v[0].format('YYYY-MM-DD'), v[1].format('YYYY-MM-DD')])} />
        <Select allowClear style={{ width: 120 }} placeholder={t('quality.result')} value={result} onChange={setResult} options={[{ value: 'pass', label: t('quality.pass') }, { value: 'issues_found', label: t('quality.issues') }]} />
        <Button type="primary" icon={<PlusOutlined />} disabled={activeItems.length === 0} onClick={openCreate}>
          {t('quality.addInspection')}
        </Button>
        {activeItems.length === 0 && <Typography.Text type="secondary">{t('quality.noItemsYet')}</Typography.Text>}
      </Space>
      <Table
        rowKey="id"
        size="small"
        dataSource={records}
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: t('quality.noData') }}
        columns={[
          { title: t('quality.inspectedOn'), dataIndex: 'inspectedOn' },
          { title: t('quality.subject'), dataIndex: 'title' },
          { title: t('quality.performedBy'), render: (_, r) => r.performedBy ?? '-' },
          { title: t('quality.result'), render: (_, r) => (r.overallResult === 'pass' ? <Tag color="green">{t('quality.pass')}</Tag> : <Tag color="orange">{t('quality.issues')}</Tag>) },
          { title: '', render: (_, r) => <Button size="small" onClick={() => setViewing(r)}>{t('quality.view')}</Button> },
        ]}
      />
      <Modal title={t('quality.addInspection')} open={createOpen} onCancel={() => setCreateOpen(false)} onOk={submit} width={680} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="inspectedOn" label={t('quality.inspectedOn')} rules={[{ required: true }]}>
              <DatePicker allowClear={false} />
            </Form.Item>
            <Form.Item name="title" label={t('quality.subject')} rules={[{ required: true }]} style={{ minWidth: 280 }}>
              <Input maxLength={200} />
            </Form.Item>
            <Form.Item name="performedByPersonnelId" label={t('quality.performedBy')} style={{ minWidth: 160 }}>
              <Select allowClear showSearch optionFilterProp="label" options={personnel.map((p) => ({ value: p.id, label: `${p.lastName}${p.firstName}` }))} />
            </Form.Item>
          </Space>
          <Table
            rowKey="name"
            size="small"
            pagination={false}
            dataSource={activeItems}
            columns={[
              { title: t('quality.item'), dataIndex: 'name' },
              {
                title: t('quality.result'),
                width: 150,
                render: (_, i) => (
                  <Radio.Group
                    size="small"
                    optionType="button"
                    value={marks[i.name]?.passed ? 'pass' : 'fail'}
                    onChange={(e) => setMarks((m) => ({ ...m, [i.name]: { passed: e.target.value === 'pass', notes: m[i.name]?.notes ?? '' } }))}
                    options={[{ value: 'pass', label: t('quality.pass') }, { value: 'fail', label: t('quality.fail') }]}
                  />
                ),
              },
              { title: t('quality.notes'), render: (_, i) => <Input size="small" maxLength={500} value={marks[i.name]?.notes ?? ''} onChange={(e) => setMarks((m) => ({ ...m, [i.name]: { passed: m[i.name]?.passed ?? true, notes: e.target.value } }))} /> },
            ]}
          />
          <Form.Item name="notes" label={t('quality.notes')} style={{ marginTop: 12 }}>
            <Input.TextArea rows={2} maxLength={1000} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal open={!!viewing} title={viewing ? `${viewing.inspectedOn} · ${viewing.title}` : ''} footer={null} onCancel={() => setViewing(undefined)} width={640}>
        {viewing && (
          <>
            <Typography.Paragraph>
              {t('quality.performedBy')}：{viewing.performedBy ?? '-'}　{viewing.overallResult === 'pass' ? <Tag color="green">{t('quality.pass')}</Tag> : <Tag color="orange">{t('quality.issues')}</Tag>}
            </Typography.Paragraph>
            <Table
              rowKey="name"
              size="small"
              pagination={false}
              dataSource={viewing.items}
              columns={[
                { title: t('quality.item'), dataIndex: 'name' },
                { title: t('quality.result'), width: 90, render: (_, i) => (i.passed ? <Tag color="green">{t('quality.pass')}</Tag> : <Tag color="red">{t('quality.fail')}</Tag>) },
                { title: t('quality.notes'), render: (_, i) => i.notes ?? '' },
              ]}
            />
            {viewing.notes && <Typography.Paragraph style={{ marginTop: 8 }}>{viewing.notes}</Typography.Paragraph>}
          </>
        )}
      </Modal>
    </>
  )

  return (
    <div>
      <OrganizationSelector organizations={organizations} selectedId={selectedId} onChange={select} />
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        {t('quality.inspectionsTitle')}
      </Typography.Title>
      <Typography.Paragraph type="secondary">{t('quality.inspectionsIntro')}</Typography.Paragraph>
      {!selectedId ? <Empty description={t('common.selectOrganizationPlaceholder')} /> : <Tabs items={[{ key: 'records', label: t('quality.tabRecords'), children: recordsTab }, { key: 'items', label: t('quality.tabItems'), children: itemsTab }]} />}
    </div>
  )
}
