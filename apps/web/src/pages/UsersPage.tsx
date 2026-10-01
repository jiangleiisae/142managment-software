import { PlusOutlined } from '@ant-design/icons'
import { App, Button, Checkbox, Form, Input, Modal, Select, Space, Switch, Table, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { personnelApi } from '../api/personnel'
import type { Personnel } from '../api/types'
import type { ManagedUser, Permission } from '../api/users'
import { usersApi } from '../api/users'

const PERMISSION_LABEL_KEYS: Record<Permission, string> = {
  ORGANIZATION: 'menu.organizations',
  MANAGEMENT_SYSTEM: 'menu.managementSystem',
  FSTD: 'menu.fstds',
  INVENTORY: 'menu.inventory',
  PERSONNEL: 'menu.personnel',
  COURSES: 'menu.courses',
  STUDENTS: 'menu.students',
  SCHEDULING: 'menu.bookings',
  ISMS: 'menu.isms',
}
const ALL_PERMISSIONS = Object.keys(PERMISSION_LABEL_KEYS) as Permission[]

/// 仅OWNER/ADMIN可见 (见 App.tsx 的 AdminOnlyRoute)。OWNER账户本身不可在此编辑/停用 (后端强制)。
export function UsersPage() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { user: currentUser } = useAuth()
  const isOwner = currentUser?.role === 'OWNER'

  const [users, setUsers] = useState<ManagedUser[]>([])
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [loading, setLoading] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editUserId, setEditUserId] = useState<string>()
  const [resetPwdUserId, setResetPwdUserId] = useState<string>()
  const [linkPersonnelUserId, setLinkPersonnelUserId] = useState<string>()

  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [resetPwdForm] = Form.useForm()
  const [linkPersonnelForm] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      setUsers(await usersApi.list())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    personnelApi.list().then(setPersonnel)
  }, [])

  const handleCreate = async () => {
    const values = await createForm.validateFields()
    try {
      await usersApi.create(values)
      message.success(t('users.createSuccess'))
      setCreateModalOpen(false)
      createForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('users.createFailed'))
    }
  }

  const openEditModal = (u: ManagedUser) => {
    editForm.setFieldsValue({ role: u.role, permissions: u.permissions, isActive: u.isActive })
    setEditUserId(u.id)
  }

  const handleEdit = async () => {
    if (!editUserId) return
    const values = await editForm.validateFields()
    try {
      await usersApi.update(editUserId, values)
      message.success(t('users.updateSuccess'))
      setEditUserId(undefined)
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('users.updateFailed'))
    }
  }

  const openLinkPersonnelModal = (u: ManagedUser) => {
    linkPersonnelForm.setFieldsValue({ personnelId: u.personnelId ?? undefined })
    setLinkPersonnelUserId(u.id)
  }

  const handleLinkPersonnel = async () => {
    if (!linkPersonnelUserId) return
    const values = await linkPersonnelForm.validateFields()
    try {
      await usersApi.linkPersonnel(linkPersonnelUserId, values.personnelId)
      message.success(t('users.linkSuccess'))
      setLinkPersonnelUserId(undefined)
      load()
      personnelApi.list().then(setPersonnel)
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('users.linkFailed'))
    }
  }

  const handleUnlinkPersonnel = async (userId: string) => {
    await usersApi.unlinkPersonnel(userId)
    message.success(t('users.unlinkSuccess'))
    load()
    personnelApi.list().then(setPersonnel)
  }

  const handleResetPassword = async () => {
    if (!resetPwdUserId) return
    const values = await resetPwdForm.validateFields()
    try {
      await usersApi.resetPassword(resetPwdUserId, values.newPassword)
      message.success(t('users.resetSuccess'))
      setResetPwdUserId(undefined)
      resetPwdForm.resetFields()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('users.resetFailed'))
    }
  }

  /// 与后端一致的编辑权限规则: OWNER账户不可编辑; ADMIN账户仅OWNER可编辑; STAFF账户OWNER/ADMIN均可编辑
  const canManage = (u: ManagedUser) => u.role !== 'OWNER' && (u.role !== 'ADMIN' || isOwner)

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
          {t('users.addButton')}
        </Button>
      </Space>

      <Table<ManagedUser>
        rowKey="id"
        loading={loading}
        dataSource={users}
        columns={[
          { title: t('users.columnEmail'), dataIndex: 'email' },
          {
            title: t('users.columnRole'),
            dataIndex: 'role',
            render: (v: ManagedUser['role']) => (
              <Tag color={v === 'OWNER' ? 'gold' : v === 'ADMIN' ? 'purple' : 'default'}>{v}</Tag>
            ),
          },
          {
            title: t('users.columnPermissions'),
            dataIndex: 'permissions',
            render: (perms: Permission[], u) =>
              u.role === 'OWNER' || u.role === 'ADMIN' ? (
                <Tag color="green">{t('users.allModulesTag')}</Tag>
              ) : perms.length === 0 ? (
                <Tag>{t('users.noneTag')}</Tag>
              ) : (
                perms.map((p) => <Tag key={p}>{t(PERMISSION_LABEL_KEYS[p])}</Tag>)
              ),
          },
          {
            title: t('users.columnStatus'),
            dataIndex: 'isActive',
            render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? t('users.activeTag') : t('users.disabledTag')}</Tag>,
          },
          {
            title: t('users.columnLinkedPersonnel'),
            dataIndex: 'personnelId',
            render: (personnelId: string | null | undefined) => {
              const linked = personnel.find((p) => p.id === personnelId)
              return linked ? <Tag color="blue">{`${linked.lastName}${linked.firstName}`}</Tag> : <Tag>{t('users.notLinkedTag')}</Tag>
            },
          },
          { title: t('users.columnCreatedAt'), dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
          {
            title: t('users.columnActions'),
            render: (_, u) => (
              <Space>
                {canManage(u) && (
                  <>
                    <Button size="small" onClick={() => openEditModal(u)}>
                      {t('users.editPermissions')}
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        resetPwdForm.resetFields()
                        setResetPwdUserId(u.id)
                      }}
                    >
                      {t('users.resetPassword')}
                    </Button>
                  </>
                )}
                <Button size="small" onClick={() => openLinkPersonnelModal(u)}>
                  {u.personnelId ? t('users.relink') : t('users.linkPersonnel')}
                </Button>
                {u.personnelId && (
                  <Button size="small" danger onClick={() => handleUnlinkPersonnel(u.id)}>
                    {t('users.unlink')}
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={t('users.createModalTitle')}
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => setCreateModalOpen(false)}
      >
        <Form form={createForm} layout="vertical" initialValues={{ role: 'STAFF', permissions: [] }}>
          <Form.Item name="email" label={t('users.fieldEmail')} rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label={t('users.fieldInitialPassword')} rules={[{ required: true, min: 8, message: t('users.passwordMinLength') }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="role" label={t('users.fieldRole')} rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'STAFF', label: t('users.roleStaffOption') },
                ...(isOwner ? [{ value: 'ADMIN', label: t('users.roleAdminOption') }] : []),
              ]}
            />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.role !== cur.role}
          >
            {({ getFieldValue }) =>
              getFieldValue('role') === 'STAFF' && (
                <Form.Item name="permissions" label={t('users.fieldPermissions')}>
                  <Checkbox.Group options={ALL_PERMISSIONS.map((p) => ({ value: p, label: t(PERMISSION_LABEL_KEYS[p]) }))} />
                </Form.Item>
              )
            }
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('users.editModalTitle')} open={!!editUserId} onOk={handleEdit} onCancel={() => setEditUserId(undefined)}>
        <Form form={editForm} layout="vertical">
          {isOwner && (
            <Form.Item name="role" label={t('users.fieldRole')} rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'STAFF', label: t('users.roleStaffOption') },
                  { value: 'ADMIN', label: t('users.roleAdminOption') },
                ]}
              />
            </Form.Item>
          )}
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.role !== cur.role}
          >
            {({ getFieldValue }) =>
              getFieldValue('role') === 'STAFF' && (
                <Form.Item name="permissions" label={t('users.fieldPermissions')}>
                  <Checkbox.Group options={ALL_PERMISSIONS.map((p) => ({ value: p, label: t(PERMISSION_LABEL_KEYS[p]) }))} />
                </Form.Item>
              )
            }
          </Form.Item>
          <Form.Item name="isActive" label={t('users.fieldAccountStatus')} valuePropName="checked">
            <Switch checkedChildren={t('users.enabledSwitch')} unCheckedChildren={t('users.disabledSwitch')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('users.resetModalTitle')}
        open={!!resetPwdUserId}
        onOk={handleResetPassword}
        onCancel={() => setResetPwdUserId(undefined)}
      >
        <Form form={resetPwdForm} layout="vertical">
          <Form.Item name="newPassword" label={t('users.fieldNewPassword')} rules={[{ required: true, min: 8, message: t('users.passwordMinLength') }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('users.linkModalTitle')}
        open={!!linkPersonnelUserId}
        onOk={handleLinkPersonnel}
        onCancel={() => setLinkPersonnelUserId(undefined)}
      >
        <Form form={linkPersonnelForm} layout="vertical">
          <Form.Item name="personnelId" label={t('users.fieldPersonnel')} rules={[{ required: true, message: t('users.fieldPersonnelRequired') }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={t('users.fieldPersonnelPlaceholder')}
              options={personnel.map((p) => ({
                value: p.id,
                label: `${p.lastName}${p.firstName}`,
                disabled: !!p.user && p.user.id !== linkPersonnelUserId,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
