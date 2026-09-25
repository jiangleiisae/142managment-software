import { PlusOutlined } from '@ant-design/icons'
import { Button, Card, DatePicker, Descriptions, Form, Input, Modal, Popconfirm, Space, Table, Tag, message } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { organizationsApi } from '../api/organizations'
import type { CertificateStatus, Organization } from '../api/types'

const STATUS_COLOR: Record<CertificateStatus, string> = {
  ACTIVE: 'green',
  SUSPENDED: 'orange',
  REVOKED: 'red',
  TERMINATED: 'default',
}

export function OrganizationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [org, setOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  const load = () => {
    if (!id) return
    setLoading(true)
    organizationsApi
      .get(id)
      .then(setOrg)
      .finally(() => setLoading(false))
  }

  useEffect(load, [id])

  const handleAddCertificate = async () => {
    if (!id) return
    const values = await form.validateFields()
    await organizationsApi.addCertificate(id, {
      ...values,
      issuedAt: values.issuedAt.format('YYYY-MM-DD'),
    })
    message.success('证书已添加 (状态: ACTIVE)')
    setModalOpen(false)
    form.resetFields()
    load()
  }

  // 需求清单 3.1 证书状态机: ACTIVE <-> SUSPENDED -> REVOKED / TERMINATED
  const doTransition = async (action: 'suspend' | 'restore' | 'revoke' | 'terminate', certId: string) => {
    try {
      const fn = {
        suspend: organizationsApi.suspendCertificate,
        restore: organizationsApi.restoreCertificate,
        revoke: organizationsApi.revokeCertificate,
        terminate: organizationsApi.terminateCertificate,
      }[action]
      await fn(certId)
      message.success('状态已更新')
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '操作失败')
    }
  }

  if (!org) return <Card loading={loading} />

  return (
    <div>
      <Button style={{ marginBottom: 16 }} onClick={() => navigate('/organizations')}>
        ← 返回机构列表
      </Button>

      <Card title={org.name} style={{ marginBottom: 16 }}>
        <Descriptions column={2}>
          <Descriptions.Item label="主管当局">{org.competentAuthority || '-'}</Descriptions.Item>
          <Descriptions.Item label="地址">{org.address || '-'}</Descriptions.Item>
          <Descriptions.Item label="复杂机构判定">
            {org.isComplexOrg ? <Tag color="orange">复杂机构</Tag> : <Tag>非复杂</Tag>}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title="ATO 批准证书 (EASA Form 143)"
        extra={
          <Button icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            新增证书
          </Button>
        }
      >
        <Table
          rowKey="id"
          dataSource={org.certificates ?? []}
          columns={[
            { title: '证书编号', dataIndex: 'certificateNo' },
            { title: '颁发机构', dataIndex: 'issuedAuthority' },
            { title: '批准范围', dataIndex: 'approvalScope' },
            {
              title: '状态 (ORA.GEN.135 持续有效)',
              dataIndex: 'status',
              render: (status: CertificateStatus) => <Tag color={STATUS_COLOR[status]}>{status}</Tag>,
            },
            {
              title: '操作',
              render: (_, cert) => (
                <Space>
                  {cert.status === 'ACTIVE' && (
                    <Popconfirm title="确认暂停该证书?" onConfirm={() => doTransition('suspend', cert.id)}>
                      <Button size="small" danger>
                        暂停
                      </Button>
                    </Popconfirm>
                  )}
                  {cert.status === 'SUSPENDED' && (
                    <>
                      <Button size="small" type="primary" onClick={() => doTransition('restore', cert.id)}>
                        恢复
                      </Button>
                      <Popconfirm title="确认吊销该证书? 此操作不可逆" onConfirm={() => doTransition('revoke', cert.id)}>
                        <Button size="small" danger>
                          吊销
                        </Button>
                      </Popconfirm>
                    </>
                  )}
                  {(cert.status === 'ACTIVE' || cert.status === 'SUSPENDED') && (
                    <Popconfirm title="确认终止该证书 (机构主动交回)?" onConfirm={() => doTransition('terminate', cert.id)}>
                      <Button size="small">终止</Button>
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal title="新增证书" open={modalOpen} onOk={handleAddCertificate} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical" initialValues={{ issuedAt: dayjs() }}>
          <Form.Item name="certificateNo" label="证书编号" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="issuedAuthority" label="颁发机构" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="approvalScope" label="批准范围声明" rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="issuedAt" label="颁发日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
