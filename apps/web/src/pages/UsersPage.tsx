import { PlusOutlined } from '@ant-design/icons'
import { Button, Checkbox, Form, Input, Modal, Select, Space, Switch, Table, Tag, message } from 'antd'
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { personnelApi } from '../api/personnel'
import type { Personnel } from '../api/types'
import type { ManagedUser, Permission } from '../api/users'
import { usersApi } from '../api/users'

const PERMISSION_LABELS: Record<Permission, string> = {
  ORGANIZATION: '机构与证书',
  MANAGEMENT_SYSTEM: '管理体系 SMS/QMS',
  FSTD: '模拟机(FSTD)',
  INVENTORY: '备件/工具管理',
  PERSONNEL: '人员资质',
  COURSES: '课程管理',
  STUDENTS: '学员记录',
  SCHEDULING: '排班预订',
  ISMS: '信息安全 ISMS',
}
const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as Permission[]

/// 仅OWNER/ADMIN可见 (见 App.tsx 的 AdminOnlyRoute)。OWNER账户本身不可在此编辑/停用 (后端强制)。
export function UsersPage() {
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
      message.success('账户已创建')
      setCreateModalOpen(false)
      createForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '创建失败')
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
      message.success('账户已更新')
      setEditUserId(undefined)
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '更新失败')
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
      message.success('已关联人员档案')
      setLinkPersonnelUserId(undefined)
      load()
      personnelApi.list().then(setPersonnel)
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '关联失败')
    }
  }

  const handleUnlinkPersonnel = async (userId: string) => {
    await usersApi.unlinkPersonnel(userId)
    message.success('已解除关联')
    load()
    personnelApi.list().then(setPersonnel)
  }

  const handleResetPassword = async () => {
    if (!resetPwdUserId) return
    const values = await resetPwdForm.validateFields()
    try {
      await usersApi.resetPassword(resetPwdUserId, values.newPassword)
      message.success('密码已重置')
      setResetPwdUserId(undefined)
      resetPwdForm.resetFields()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '重置失败')
    }
  }

  /// 与后端一致的编辑权限规则: OWNER账户不可编辑; ADMIN账户仅OWNER可编辑; STAFF账户OWNER/ADMIN均可编辑
  const canManage = (u: ManagedUser) => u.role !== 'OWNER' && (u.role !== 'ADMIN' || isOwner)

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
          新增账户
        </Button>
      </Space>

      <Table<ManagedUser>
        rowKey="id"
        loading={loading}
        dataSource={users}
        columns={[
          { title: '邮箱', dataIndex: 'email' },
          {
            title: '角色',
            dataIndex: 'role',
            render: (v: ManagedUser['role']) => (
              <Tag color={v === 'OWNER' ? 'gold' : v === 'ADMIN' ? 'purple' : 'default'}>{v}</Tag>
            ),
          },
          {
            title: '模块权限',
            dataIndex: 'permissions',
            render: (perms: Permission[], u) =>
              u.role === 'OWNER' || u.role === 'ADMIN' ? (
                <Tag color="green">全部模块(管理账户)</Tag>
              ) : perms.length === 0 ? (
                <Tag>无</Tag>
              ) : (
                perms.map((p) => <Tag key={p}>{PERMISSION_LABELS[p]}</Tag>)
              ),
          },
          {
            title: '状态',
            dataIndex: 'isActive',
            render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '已停用'}</Tag>,
          },
          {
            title: '关联人员档案',
            dataIndex: 'personnelId',
            render: (personnelId: string | null | undefined) => {
              const linked = personnel.find((p) => p.id === personnelId)
              return linked ? <Tag color="blue">{`${linked.lastName}${linked.firstName}`}</Tag> : <Tag>未关联</Tag>
            },
          },
          { title: '创建时间', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
          {
            title: '操作',
            render: (_, u) => (
              <Space>
                {canManage(u) && (
                  <>
                    <Button size="small" onClick={() => openEditModal(u)}>
                      编辑权限
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        resetPwdForm.resetFields()
                        setResetPwdUserId(u.id)
                      }}
                    >
                      重置密码
                    </Button>
                  </>
                )}
                <Button size="small" onClick={() => openLinkPersonnelModal(u)}>
                  {u.personnelId ? '更换关联' : '关联人员'}
                </Button>
                {u.personnelId && (
                  <Button size="small" danger onClick={() => handleUnlinkPersonnel(u.id)}>
                    解除关联
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title="新增账户"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => setCreateModalOpen(false)}
      >
        <Form form={createForm} layout="vertical" initialValues={{ role: 'STAFF', permissions: [] }}>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="初始密码" rules={[{ required: true, min: 8, message: '密码至少8位' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'STAFF', label: 'STAFF (按模块权限访问)' },
                ...(isOwner ? [{ value: 'ADMIN', label: 'ADMIN (管理账户, 全部模块权限 + 可管理其他账户)' }] : []),
              ]}
            />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.role !== cur.role}
          >
            {({ getFieldValue }) =>
              getFieldValue('role') === 'STAFF' && (
                <Form.Item name="permissions" label="模块权限">
                  <Checkbox.Group options={ALL_PERMISSIONS.map((p) => ({ value: p, label: PERMISSION_LABELS[p] }))} />
                </Form.Item>
              )
            }
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="编辑账户权限" open={!!editUserId} onOk={handleEdit} onCancel={() => setEditUserId(undefined)}>
        <Form form={editForm} layout="vertical">
          {isOwner && (
            <Form.Item name="role" label="角色" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'STAFF', label: 'STAFF (按模块权限访问)' },
                  { value: 'ADMIN', label: 'ADMIN (管理账户, 全部模块权限 + 可管理其他账户)' },
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
                <Form.Item name="permissions" label="模块权限">
                  <Checkbox.Group options={ALL_PERMISSIONS.map((p) => ({ value: p, label: PERMISSION_LABELS[p] }))} />
                </Form.Item>
              )
            }
          </Form.Item>
          <Form.Item name="isActive" label="账户状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="重置密码"
        open={!!resetPwdUserId}
        onOk={handleResetPassword}
        onCancel={() => setResetPwdUserId(undefined)}
      >
        <Form form={resetPwdForm} layout="vertical">
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, min: 8, message: '密码至少8位' }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="关联人员档案"
        open={!!linkPersonnelUserId}
        onOk={handleLinkPersonnel}
        onCancel={() => setLinkPersonnelUserId(undefined)}
      >
        <Form form={linkPersonnelForm} layout="vertical">
          <Form.Item name="personnelId" label="人员档案" rules={[{ required: true, message: '请选择人员档案' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="选择要关联的人员档案 (已被其他账户关联的不可选)"
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
