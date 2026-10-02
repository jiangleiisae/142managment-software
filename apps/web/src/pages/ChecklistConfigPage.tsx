import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Alert, App, Button, Checkbox, Empty, Input, Modal, Select, Space, Table, Tabs, Typography } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChecklistItem, ChecklistType } from '../api/checklists'
import { checklistsApi } from '../api/checklists'
import { fstdsApi } from '../api/fstds'
import type { Fstd } from '../api/types'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'

const apiError = (e: unknown, fallback: string) => {
  const msg = (e as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
  return (Array.isArray(msg) ? msg.join('; ') : msg) ?? fallback
}

/// 检查单配置: 选设备 → 航前/航后各一套检查项 (编号、内容、SOP 链接), 可从其他设备克隆。
export function ChecklistConfigPage() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { organizations, selectedId, select } = useSelectedOrganization()
  const [fstds, setFstds] = useState<Fstd[]>([])
  const [fstdId, setFstdId] = useState<string>()
  const [type, setType] = useState<ChecklistType>('PRE_FLIGHT')
  const [drafts, setDrafts] = useState<Record<ChecklistType, ChecklistItem[]>>({ PRE_FLIGHT: [], POST_FLIGHT: [] })
  const [dirty, setDirty] = useState(false)
  const [cloneOpen, setCloneOpen] = useState(false)
  const [cloneTargets, setCloneTargets] = useState<string[]>([])
  const [overwrite, setOverwrite] = useState(false)

  useEffect(() => {
    if (!selectedId) return
    fstdsApi.list(selectedId).then((list) => {
      setFstds(list)
      setFstdId((cur) => (cur && list.some((f) => f.id === cur) ? cur : list[0]?.id))
    })
  }, [selectedId])

  const load = useCallback(async () => {
    if (!selectedId || !fstdId) return
    const rows = await checklistsApi.listTemplates(selectedId, fstdId)
    setDrafts({
      PRE_FLIGHT: rows.find((r) => r.type === 'PRE_FLIGHT')?.items ?? [],
      POST_FLIGHT: rows.find((r) => r.type === 'POST_FLIGHT')?.items ?? [],
    })
    setDirty(false)
  }, [selectedId, fstdId])

  useEffect(() => {
    load()
  }, [load])

  const items = drafts[type]
  const setItems = (next: ChecklistItem[]) => {
    setDrafts((d) => ({ ...d, [type]: next }))
    setDirty(true)
  }
  const update = (index: number, patch: Partial<ChecklistItem>) => setItems(items.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    setItems(next)
  }
  const add = () => setItems([...items, { no: String(items.length + 1), text: '' }])

  const loadCaac = async () => {
    const texts = await fstdsApi.listPreFlightCheckItems()
    setItems(texts.map((text, i) => ({ no: String(i + 1), text })))
  }

  const save = async () => {
    if (!selectedId || !fstdId) return
    const cleaned = items.map((i) => ({ no: i.no.trim(), text: i.text.trim(), ...(i.sopUrl?.trim() ? { sopUrl: i.sopUrl.trim() } : {}) }))
    try {
      await checklistsApi.setTemplate(selectedId, fstdId, type, cleaned)
      message.success(t('checklist.saved'))
      await load()
    } catch (e) {
      message.error(apiError(e, t('checklist.failed')))
    }
  }

  const doClone = async () => {
    if (!selectedId || !fstdId) return
    try {
      const r = await checklistsApi.cloneTemplates(selectedId, fstdId, cloneTargets, overwrite)
      message.success(t('checklist.cloned', r))
      setCloneOpen(false)
    } catch (e) {
      message.error(apiError(e, t('checklist.failed')))
    }
  }

  const editor = (
    <>
      <Space style={{ marginBottom: 8 }} wrap>
        <Button icon={<PlusOutlined />} onClick={add}>
          {t('checklist.addItem')}
        </Button>
        {type === 'PRE_FLIGHT' && <Button onClick={loadCaac}>{t('checklist.loadCaac')}</Button>}
        <Button type="primary" disabled={!dirty || items.length === 0} onClick={save}>
          {t('checklist.saveTemplate')}
        </Button>
        {dirty && <Typography.Text type="warning">{t('checklist.unsaved')}</Typography.Text>}
      </Space>
      <Table
        rowKey={(_, i) => String(i)}
        size="small"
        pagination={false}
        dataSource={items}
        locale={{ emptyText: t('checklist.emptyTemplate') }}
        columns={[
          { title: t('checklist.itemNo'), width: 90, render: (_, it, i) => <Input size="small" maxLength={20} value={it.no} onChange={(e) => update(i, { no: e.target.value })} /> },
          { title: t('checklist.item'), render: (_, it, i) => <Input size="small" maxLength={300} value={it.text} onChange={(e) => update(i, { text: e.target.value })} /> },
          { title: t('checklist.sop'), width: 260, render: (_, it, i) => <Input size="small" maxLength={500} placeholder="https://" value={it.sopUrl ?? ''} onChange={(e) => update(i, { sopUrl: e.target.value })} /> },
          {
            title: '',
            width: 120,
            render: (_, __, i) => (
              <Space size={4}>
                <Button size="small" icon={<ArrowUpOutlined />} disabled={i === 0} onClick={() => move(i, -1)} />
                <Button size="small" icon={<ArrowDownOutlined />} disabled={i === items.length - 1} onClick={() => move(i, 1)} />
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setItems(items.filter((_x, idx) => idx !== i))} />
              </Space>
            ),
          },
        ]}
      />
    </>
  )

  return (
    <div>
      <OrganizationSelector organizations={organizations} selectedId={selectedId} onChange={select} />
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        {t('checklist.configTitle')}
      </Typography.Title>
      <Alert style={{ marginBottom: 12 }} type="info" showIcon message={t('checklist.configNote')} />
      {!selectedId ? (
        <Empty description={t('common.selectOrganizationPlaceholder')} />
      ) : fstds.length === 0 ? (
        <Empty description={t('checklist.noDevices')} />
      ) : (
        <>
          <Space style={{ marginBottom: 12 }} wrap>
            <Select
              style={{ width: 220 }}
              value={fstdId}
              onChange={(v) => {
                if (dirty && !window.confirm(t('checklist.discardConfirm'))) return
                setFstdId(v)
              }}
              options={fstds.map((f) => ({ value: f.id, label: `${f.deviceCode} ${f.representedAircraft}` }))}
            />
            <Button
              onClick={() => {
                setCloneTargets([])
                setOverwrite(false)
                setCloneOpen(true)
              }}
              disabled={dirty}
            >
              {t('checklist.cloneTo')}
            </Button>
          </Space>
          <Tabs
            activeKey={type}
            onChange={(k) => setType(k as ChecklistType)}
            items={[
              { key: 'PRE_FLIGHT', label: t('checklist.preFlight'), children: type === 'PRE_FLIGHT' ? editor : null },
              { key: 'POST_FLIGHT', label: t('checklist.postFlight'), children: type === 'POST_FLIGHT' ? editor : null },
            ]}
          />
        </>
      )}
      <Modal open={cloneOpen} title={t('checklist.cloneTo')} onCancel={() => setCloneOpen(false)} onOk={doClone} okButtonProps={{ disabled: cloneTargets.length === 0 }} destroyOnHidden>
        <Typography.Paragraph type="secondary">{t('checklist.cloneNote')}</Typography.Paragraph>
        <Select mode="multiple" style={{ width: '100%', marginBottom: 12 }} placeholder={t('checklist.cloneTargets')} value={cloneTargets} onChange={setCloneTargets} options={fstds.filter((f) => f.id !== fstdId).map((f) => ({ value: f.id, label: `${f.deviceCode} ${f.representedAircraft}` }))} />
        <Checkbox checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)}>
          {t('checklist.overwrite')}
        </Checkbox>
      </Modal>
    </div>
  )
}
