import { PlusOutlined } from '@ant-design/icons'
import { Alert, App, Button, Empty, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RosterGroup, Staff, StaffDepartment } from '../api/roster'
import { rosterApi } from '../api/roster'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'

const apiError = (e: unknown, fallback: string) => {
  const msg = (e as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
  return (Array.isArray(msg) ? msg.join('; ') : msg) ?? fallback
}

/// 维护人员 (排班管理) / 行政综合人员 (前台、行政、司机、保洁等): 录入排班人员的信息和班组。
/// 这些人员独立于「人员资质」的人员档案, 班表里选人时用的就是这里的人员。
export function StaffPage({ department }: { department: StaffDepartment }) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { organizations, selectedId, select } = useSelectedOrganization()
  const isAdmin = department === 'ADMIN'
  const [staff, setStaff] = useState<Staff[]>([])
  const [groups, setGroups] = useState<RosterGroup[]>([])
  const [users, setUsers] = useState<{ id: string; email: string }[]>([])
  const [showInactive, setShowInactive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState<{ open: boolean; editing?: Staff }>({ open: false })
  const [newGroup, setNewGroup] = useState('')
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    if (!selectedId) return
    setLoading(true)
    try {
      const [s, g] = await Promise.all([rosterApi.listStaff(selectedId, department, showInactive), rosterApi.listGroups(selectedId, department)])
      setStaff(s)
      setGroups(g)
    } catch (e) {
      message.error(apiError(e, t('staff.failed')))
    } finally {
      setLoading(false)
    }
  }, [selectedId, department, showInactive, message, t])

  useEffect(() => {
    load()
  }, [load])

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn()
      if (ok) message.success(ok)
      await load()
      return true
    } catch (e) {
      message.error(apiError(e, t('staff.failed')))
      return false
    }
  }

  const openModal = async (editing?: Staff) => {
    // 可关联的登录账号: 还没关联排班人员的启用账号, 加上这个人当前已关联的那个
    try {
      setUsers(await rosterApi.userOptions())
    } catch {
      setUsers([])
    }
    form.resetFields()
    form.setFieldsValue(editing ? { ...editing, groupId: editing.groupId ?? undefined, userId: editing.userId ?? undefined } : {})
    setModal({ open: true, editing })
  }

  const save = async () => {
    const v = await form.validateFields()
    if (!selectedId) return
    const text = (x?: string) => (x && x.trim() ? x.trim() : '')
    const ok = await run(
      () =>
        modal.editing
          ? rosterApi.updateStaff(modal.editing.id, { name: v.name, employeeNo: text(v.employeeNo), position: text(v.position), phone: text(v.phone), notes: text(v.notes), groupId: v.groupId ?? null, userId: v.userId ?? null })
          : rosterApi.createStaff(selectedId, department, { name: v.name, employeeNo: text(v.employeeNo) || undefined, position: text(v.position) || undefined, phone: text(v.phone) || undefined, notes: text(v.notes) || undefined, groupId: v.groupId, userId: v.userId }),
      t('staff.saved'),
    )
    if (ok) setModal({ open: false })
  }

  const columns: ColumnsType<Staff> = [
    { title: t('staff.name'), render: (_, s) => (s.isActive ? s.name : <span style={{ color: '#999' }}>{s.name}</span>) },
    { title: t('staff.employeeNo'), render: (_, s) => s.employeeNo ?? '-' },
    { title: t('staff.position'), render: (_, s) => s.position ?? '-' },
    { title: t('staff.phone'), render: (_, s) => s.phone ?? '-' },
    { title: t('staff.group'), render: (_, s) => s.groupName ?? '-' },
    { title: t('staff.account'), render: (_, s) => s.userEmail ?? '-' },
    { title: t('staff.status'), render: (_, s) => (s.isActive ? <Tag color="green">{t('staff.active')}</Tag> : <Tag>{t('staff.inactive')}</Tag>) },
    {
      title: '',
      render: (_, s) => (
        <Space size={4} wrap>
          <Button size="small" onClick={() => openModal(s)}>
            {t('staff.edit')}
          </Button>
          <Button size="small" onClick={() => run(() => rosterApi.updateStaff(s.id, { isActive: !s.isActive }), t('staff.saved'))}>
            {s.isActive ? t('staff.deactivate') : t('staff.activate')}
          </Button>
          <Popconfirm title={t('staff.deleteConfirm')} onConfirm={() => run(() => rosterApi.deleteStaff(s.id), t('staff.deleted'))}>
            <Button size="small" danger>
              {t('staff.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <OrganizationSelector organizations={organizations} selectedId={selectedId} onChange={select} />
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        {t(isAdmin ? 'staff.adminTitle' : 'staff.maintenanceTitle')}
      </Typography.Title>
      <Typography.Paragraph type="secondary">{t(isAdmin ? 'staff.adminIntro' : 'staff.maintenanceIntro')}</Typography.Paragraph>
      {!selectedId ? (
        <Empty description={t('common.selectOrganizationPlaceholder')} />
      ) : (
        <>
          <Space wrap style={{ marginBottom: 12 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
              {t('staff.add')}
            </Button>
            <Space>
              <Switch checked={showInactive} onChange={setShowInactive} />
              {t('staff.showInactive')}
            </Space>
          </Space>
          <Table rowKey="id" size="small" loading={loading} dataSource={staff} columns={columns} pagination={{ pageSize: 20 }} scroll={{ x: 'max-content' }} locale={{ emptyText: t('staff.noData') }} />

          <Typography.Title level={5} style={{ marginTop: 24 }}>
            {t('staff.groups')}
          </Typography.Title>
          <Alert type="info" showIcon style={{ marginBottom: 8 }} message={t(isAdmin ? 'staff.groupsNoteAdmin' : 'staff.groupsNote')} />
          <Space wrap style={{ marginBottom: 8 }}>
            <Input style={{ width: 200 }} placeholder={t('staff.newGroupPlaceholder')} value={newGroup} maxLength={50} onChange={(e) => setNewGroup(e.target.value)} />
            <Button
              disabled={!newGroup.trim()}
              onClick={async () => {
                if (selectedId && (await run(() => rosterApi.createGroup(selectedId, department, newGroup), t('staff.groupCreated')))) setNewGroup('')
              }}
            >
              {t('staff.addGroup')}
            </Button>
          </Space>
          <div>
            <Space wrap>
              {groups.map((g) => (
                <Tag
                  key={g.id}
                  closable
                  onClose={(e) => {
                    e.preventDefault()
                    Modal.confirm({ title: t('staff.deleteGroupConfirm', { name: g.name }), onOk: () => run(() => rosterApi.deleteGroup(g.id)) })
                  }}
                >
                  {g.name}
                </Tag>
              ))}
              {groups.length === 0 && <Typography.Text type="secondary">{t('staff.noGroups')}</Typography.Text>}
            </Space>
          </div>
        </>
      )}

      <Modal title={modal.editing ? t('staff.edit') : t('staff.add')} open={modal.open} onCancel={() => setModal({ open: false })} onOk={save} width={560} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t('staff.name')} rules={[{ required: true, whitespace: true }]}>
            <Input maxLength={100} />
          </Form.Item>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="employeeNo" label={t('staff.employeeNo')}>
              <Input maxLength={50} style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="position" label={t('staff.position')} extra={t(isAdmin ? 'staff.positionHintAdmin' : 'staff.positionHint')}>
              <Input maxLength={100} style={{ width: 240 }} />
            </Form.Item>
          </Space>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="phone" label={t('staff.phone')}>
              <Input maxLength={50} style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="groupId" label={t('staff.group')}>
              <Select allowClear style={{ width: 240 }} placeholder={t('staff.noGroup')} options={groups.map((g) => ({ value: g.id, label: g.name }))} />
            </Form.Item>
          </Space>
          <Form.Item name="userId" label={t('staff.account')} extra={t('staff.accountHint')}>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder={t('staff.noAccount')}
              options={[...(modal.editing?.userId ? [{ value: modal.editing.userId, label: modal.editing.userEmail ?? modal.editing.userId }] : []), ...users.map((u) => ({ value: u.id, label: u.email }))]}
            />
          </Form.Item>
          <Form.Item name="notes" label={t('staff.notes')}>
            <Input.TextArea rows={2} maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
