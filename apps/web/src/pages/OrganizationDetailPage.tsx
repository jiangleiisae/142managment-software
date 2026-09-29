import { PlusOutlined } from '@ant-design/icons'
import { Alert, Button, Card, DatePicker, Descriptions, Form, Input, InputNumber, List, Modal, Popconfirm, Select, Space, Switch, Table, Tag, message } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ApplicationRecord, OrganisationalSelfReview } from '../api/organizations'
import { organizationsApi } from '../api/organizations'
import type { CertificateStatus, Organization } from '../api/types'
import { ChangeRequestPanel } from '../components/ChangeRequestPanel'

const STATUS_COLOR: Record<CertificateStatus, string> = {
  ACTIVE: 'green',
  SUSPENDED: 'orange',
  REVOKED: 'red',
  TERMINATED: 'default',
}

/// application-records 的清单字段是宽松的Json列, 早期数据可能是对象数组而非字符串数组, 展示时兜底转成可读文本
const describeListEntry = (v: unknown): string => (typeof v === 'string' ? v : JSON.stringify(v))

export function OrganizationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [org, setOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [checklist, setChecklist] = useState<string[]>([])
  const [selfReviews, setSelfReviews] = useState<OrganisationalSelfReview[]>([])
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewItemState, setReviewItemState] = useState<Record<string, { compliant: boolean; notes: string }>>({})
  const [reviewForm] = Form.useForm()
  const [applicationRecords, setApplicationRecords] = useState<ApplicationRecord[]>([])
  const [applicationModalOpen, setApplicationModalOpen] = useState(false)
  const [applicationForm] = Form.useForm()

  const load = () => {
    if (!id) return
    setLoading(true)
    organizationsApi
      .get(id)
      .then(setOrg)
      .finally(() => setLoading(false))
    organizationsApi.listSelfReviews(id).then(setSelfReviews)
    organizationsApi.listApplicationRecords(id).then(setApplicationRecords)
  }

  useEffect(load, [id])
  useEffect(() => {
    organizationsApi.listSelfReviewChecklist().then(setChecklist)
  }, [])

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

  const openReviewModal = () => {
    setReviewItemState(Object.fromEntries(checklist.map((item) => [item, { compliant: true, notes: '' }])))
    reviewForm.resetFields()
    setReviewModalOpen(true)
  }

  const handleRecordSelfReview = async () => {
    if (!id) return
    const values = await reviewForm.validateFields()
    await organizationsApi.recordSelfReview(id, {
      year: values.year,
      reviewedAt: values.reviewedAt.format('YYYY-MM-DD'),
      items: checklist.map((item) => ({ item, ...reviewItemState[item] })),
    })
    message.success('年度自查已登记 (GM2 ORA.GEN.200(c)), 请及时通报当局')
    setReviewModalOpen(false)
    load()
  }

  const handleNotifySelfReview = async (reviewId: string) => {
    await organizationsApi.notifySelfReview(reviewId)
    message.success('已标记为通报当局')
    load()
  }

  const handleCreateApplicationRecord = async () => {
    if (!id) return
    const values = await applicationForm.validateFields()
    await organizationsApi.createApplicationRecord(id, {
      ...values,
      proposedStartDate: values.proposedStartDate?.format('YYYY-MM-DD'),
    })
    message.success('申请材料已登记 (ORA.ATO.105)')
    setApplicationModalOpen(false)
    applicationForm.resetFields()
    load()
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

      <Card title="机构变更管理 (3.1, ORA.GEN.130)" style={{ marginTop: 16 }}>
        {id && <ChangeRequestPanel entityType="Organization" entityId={id} />}
      </Card>

      <Card
        title="年度机构自查 (3.2.2 非复杂机构简化路径, GM2 ORA.GEN.200(c))"
        style={{ marginTop: 16 }}
        extra={
          <Button icon={<PlusOutlined />} onClick={openReviewModal}>
            登记本年度自查
          </Button>
        }
      >
        {org.isComplexOrg && (
          <Alert
            style={{ marginBottom: 12 }}
            type="warning"
            showIcon
            message="该机构为复杂机构, 应使用完整SMS+合规监督流程 (管理体系页面); 年度自查简化路径仅适用于非复杂机构"
          />
        )}
        <List
          size="small"
          dataSource={selfReviews}
          locale={{ emptyText: '尚未登记任何年度自查' }}
          renderItem={(review) => (
            <List.Item
              actions={
                !review.notifiedAuthorityAt
                  ? [
                      <Button key="notify" size="small" onClick={() => handleNotifySelfReview(review.id)}>
                        标记已通报当局
                      </Button>,
                    ]
                  : []
              }
            >
              <Space direction="vertical" size={0} style={{ width: '100%' }}>
                <Space wrap>
                  <Tag>{review.year}年度</Tag>
                  <Tag color={review.overallResult === 'compliant' ? 'green' : 'red'}>
                    {review.overallResult === 'compliant' ? '合规' : '发现问题'}
                  </Tag>
                  <Tag color={review.notifiedAuthorityAt ? 'green' : 'orange'}>
                    {review.notifiedAuthorityAt ? '已通报当局' : '待通报当局'}
                  </Tag>
                </Space>
                <Space wrap>
                  {review.itemsJson
                    .filter((i) => !i.compliant)
                    .map((i) => (
                      <Tag key={i.item} color="red">
                        {i.item}: {i.notes || '不合规'}
                      </Tag>
                    ))}
                </Space>
                <span style={{ color: '#888', fontSize: 12 }}>
                  自查日期 {new Date(review.reviewedAt).toLocaleDateString()}
                  {review.notifiedAuthorityAt && ` | 通报于 ${new Date(review.notifiedAuthorityAt).toLocaleString()}`}
                </span>
              </Space>
            </List.Item>
          )}
        />
      </Card>

      <Card
        title="申请材料 (ORA.ATO.105)"
        style={{ marginTop: 16 }}
        extra={
          <Button icon={<PlusOutlined />} onClick={() => setApplicationModalOpen(true)}>
            登记申请材料
          </Button>
        }
      >
        <List
          size="small"
          dataSource={applicationRecords}
          locale={{ emptyText: '尚未登记任何申请材料' }}
          renderItem={(rec) => (
            <List.Item>
              <Space direction="vertical" size={0} style={{ width: '100%' }}>
                <Space wrap>
                  <Tag color={rec.isChangeApplication ? 'blue' : 'green'}>
                    {rec.isChangeApplication ? '变更申请' : '首次申请'}
                  </Tag>
                  {rec.proposedStartDate && <span>拟运营日期: {new Date(rec.proposedStartDate).toLocaleDateString()}</span>}
                </Space>
                <Space wrap>
                  {(rec.courseTypesJson ?? []).map((c, i) => (
                    <Tag key={i}>{describeListEntry(c)}</Tag>
                  ))}
                </Space>
                <span style={{ color: '#888', fontSize: 12 }}>
                  提交于 {new Date(rec.submittedAt).toLocaleString()}
                  {rec.trainingSitesJson?.length ? ` | 训练场地: ${rec.trainingSitesJson.map(describeListEntry).join(', ')}` : ''}
                  {rec.aircraftListJson?.length ? ` | 航空器: ${rec.aircraftListJson.map(describeListEntry).join(', ')}` : ''}
                  {rec.fstdListJson?.length ? ` | FSTD: ${rec.fstdListJson.map(describeListEntry).join(', ')}` : ''}
                </span>
              </Space>
            </List.Item>
          )}
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

      <Modal
        title="登记年度机构自查 (GM2 ORA.GEN.200(c))"
        open={reviewModalOpen}
        onOk={handleRecordSelfReview}
        onCancel={() => setReviewModalOpen(false)}
        width={600}
      >
        <Form form={reviewForm} layout="vertical" initialValues={{ year: dayjs().year(), reviewedAt: dayjs() }}>
          <Space>
            <Form.Item name="year" label="年度" rules={[{ required: true }]}>
              <InputNumber style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="reviewedAt" label="自查日期" rules={[{ required: true }]}>
              <DatePicker />
            </Form.Item>
          </Space>
        </Form>
        {checklist.map((item) => (
          <div key={item} style={{ marginBottom: 12 }}>
            <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
              <span>{item}</span>
              <Switch
                checked={reviewItemState[item]?.compliant ?? true}
                checkedChildren="合规"
                unCheckedChildren="不合规"
                onChange={(checked) =>
                  setReviewItemState((s) => ({ ...s, [item]: { ...s[item], compliant: checked } }))
                }
              />
            </Space>
            {!reviewItemState[item]?.compliant && (
              <Input
                placeholder="不合规说明"
                value={reviewItemState[item]?.notes}
                onChange={(e) => setReviewItemState((s) => ({ ...s, [item]: { ...s[item], notes: e.target.value } }))}
                style={{ marginTop: 4 }}
              />
            )}
          </div>
        ))}
      </Modal>

      <Modal
        title="登记申请材料 (ORA.ATO.105)"
        open={applicationModalOpen}
        onOk={handleCreateApplicationRecord}
        onCancel={() => setApplicationModalOpen(false)}
      >
        <Form form={applicationForm} layout="vertical" initialValues={{ isChangeApplication: false }}>
          <Form.Item name="isChangeApplication" label="申请类型" rules={[{ required: true }]}>
            <Select
              options={[
                { value: false, label: '首次申请' },
                { value: true, label: '变更申请 (仅需提交变更相关部分)' },
              ]}
            />
          </Form.Item>
          <Form.Item name="proposedStartDate" label="拟运营日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="courseTypesJson" label="课程类型">
            <Select mode="tags" placeholder="如 PPL, CPL" />
          </Form.Item>
          <Form.Item name="trainingSitesJson" label="训练场地清单">
            <Select mode="tags" placeholder="逐个输入场地名称后回车" />
          </Form.Item>
          <Form.Item name="aircraftListJson" label="航空器清单">
            <Select mode="tags" placeholder="如 A320/B-1234" />
          </Form.Item>
          <Form.Item name="fstdListJson" label="FSTD清单">
            <Select mode="tags" placeholder="设备编号" />
          </Form.Item>
          <Form.Item name="operationsManualRef" label="运行手册引用">
            <Input />
          </Form.Item>
          <Form.Item name="trainingManualRef" label="训练手册引用">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
