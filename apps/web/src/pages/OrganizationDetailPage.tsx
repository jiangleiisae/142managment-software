import { PlusOutlined } from '@ant-design/icons'
import { Alert, App, Button, Card, DatePicker, Descriptions, Form, Input, InputNumber, List, Modal, Popconfirm, Select, Space, Switch, Table, Tag } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const { message } = App.useApp()
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
    message.success(t('organizations.detail.certificateAdded'))
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
      message.success(t('organizations.detail.statusUpdated'))
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('organizations.detail.operationFailed'))
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
    message.success(t('organizations.detail.selfReviewRecorded'))
    setReviewModalOpen(false)
    load()
  }

  const handleNotifySelfReview = async (reviewId: string) => {
    await organizationsApi.notifySelfReview(reviewId)
    message.success(t('organizations.detail.markedNotified'))
    load()
  }

  const handleCreateApplicationRecord = async () => {
    if (!id) return
    const values = await applicationForm.validateFields()
    await organizationsApi.createApplicationRecord(id, {
      ...values,
      proposedStartDate: values.proposedStartDate?.format('YYYY-MM-DD'),
    })
    message.success(t('organizations.detail.applicationRecorded'))
    setApplicationModalOpen(false)
    applicationForm.resetFields()
    load()
  }

  if (!org) return <Card loading={loading} />

  return (
    <div>
      <Button style={{ marginBottom: 16 }} onClick={() => navigate('/organizations')}>
        {t('organizations.detail.back')}
      </Button>

      <Card title={org.name} style={{ marginBottom: 16 }}>
        <Descriptions column={2}>
          <Descriptions.Item label={t('organizations.detail.authority')}>{org.competentAuthority || '-'}</Descriptions.Item>
          <Descriptions.Item label={t('organizations.detail.address')}>{org.address || '-'}</Descriptions.Item>
          <Descriptions.Item label={t('organizations.detail.complexDetermination')}>
            {org.isComplexOrg ? (
              <Tag color="orange">{t('organizations.list.complexTag')}</Tag>
            ) : (
              <Tag>{t('organizations.list.nonComplexTag')}</Tag>
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title={t('organizations.detail.certificatesTitle')}
        extra={
          <Button icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            {t('organizations.detail.addCertificate')}
          </Button>
        }
      >
        <Table
          rowKey="id"
          dataSource={org.certificates ?? []}
          columns={[
            { title: t('organizations.detail.columnCertNo'), dataIndex: 'certificateNo' },
            { title: t('organizations.detail.columnIssuedAuthority'), dataIndex: 'issuedAuthority' },
            { title: t('organizations.detail.columnScope'), dataIndex: 'approvalScope' },
            {
              title: t('organizations.detail.columnStatus'),
              dataIndex: 'status',
              render: (status: CertificateStatus) => <Tag color={STATUS_COLOR[status]}>{status}</Tag>,
            },
            {
              title: t('organizations.detail.columnActions'),
              render: (_, cert) => (
                <Space>
                  {cert.status === 'ACTIVE' && (
                    <Popconfirm title={t('organizations.detail.confirmSuspend')} onConfirm={() => doTransition('suspend', cert.id)}>
                      <Button size="small" danger>
                        {t('organizations.detail.suspend')}
                      </Button>
                    </Popconfirm>
                  )}
                  {cert.status === 'SUSPENDED' && (
                    <>
                      <Button size="small" type="primary" onClick={() => doTransition('restore', cert.id)}>
                        {t('organizations.detail.restore')}
                      </Button>
                      <Popconfirm title={t('organizations.detail.confirmRevoke')} onConfirm={() => doTransition('revoke', cert.id)}>
                        <Button size="small" danger>
                          {t('organizations.detail.revoke')}
                        </Button>
                      </Popconfirm>
                    </>
                  )}
                  {(cert.status === 'ACTIVE' || cert.status === 'SUSPENDED') && (
                    <Popconfirm title={t('organizations.detail.confirmTerminate')} onConfirm={() => doTransition('terminate', cert.id)}>
                      <Button size="small">{t('organizations.detail.terminate')}</Button>
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Card title={t('organizations.detail.changeManagementTitle')} style={{ marginTop: 16 }}>
        {id && <ChangeRequestPanel entityType="Organization" entityId={id} />}
      </Card>

      <Card
        title={t('organizations.detail.selfReviewTitle')}
        style={{ marginTop: 16 }}
        extra={
          <Button icon={<PlusOutlined />} onClick={openReviewModal}>
            {t('organizations.detail.recordSelfReview')}
          </Button>
        }
      >
        {org.isComplexOrg && (
          <Alert
            style={{ marginBottom: 12 }}
            type="warning"
            showIcon
            message={t('organizations.detail.complexOrgWarning')}
          />
        )}
        <List
          size="small"
          dataSource={selfReviews}
          locale={{ emptyText: t('organizations.detail.noSelfReviews') }}
          renderItem={(review) => (
            <List.Item
              actions={
                !review.notifiedAuthorityAt
                  ? [
                      <Button key="notify" size="small" onClick={() => handleNotifySelfReview(review.id)}>
                        {t('organizations.detail.markNotified')}
                      </Button>,
                    ]
                  : []
              }
            >
              <Space direction="vertical" size={0} style={{ width: '100%' }}>
                <Space wrap>
                  <Tag>{t('organizations.detail.yearTag', { year: review.year })}</Tag>
                  <Tag color={review.overallResult === 'compliant' ? 'green' : 'red'}>
                    {review.overallResult === 'compliant' ? t('organizations.detail.compliant') : t('organizations.detail.nonCompliant')}
                  </Tag>
                  <Tag color={review.notifiedAuthorityAt ? 'green' : 'orange'}>
                    {review.notifiedAuthorityAt ? t('organizations.detail.notified') : t('organizations.detail.pendingNotify')}
                  </Tag>
                </Space>
                <Space wrap>
                  {review.itemsJson
                    .filter((i) => !i.compliant)
                    .map((i) => (
                      <Tag key={i.item} color="red">
                        {i.item}: {i.notes || t('organizations.detail.nonCompliantNote')}
                      </Tag>
                    ))}
                </Space>
                <span style={{ color: '#888', fontSize: 12 }}>
                  {t('organizations.detail.reviewedAtLabel')} {new Date(review.reviewedAt).toLocaleDateString()}
                  {review.notifiedAuthorityAt && ` | ${t('organizations.detail.notifiedAtLabel')} ${new Date(review.notifiedAuthorityAt).toLocaleString()}`}
                </span>
              </Space>
            </List.Item>
          )}
        />
      </Card>

      <Card
        title={t('organizations.detail.applicationRecordsTitle')}
        style={{ marginTop: 16 }}
        extra={
          <Button icon={<PlusOutlined />} onClick={() => setApplicationModalOpen(true)}>
            {t('organizations.detail.recordApplication')}
          </Button>
        }
      >
        <List
          size="small"
          dataSource={applicationRecords}
          locale={{ emptyText: t('organizations.detail.noApplicationRecords') }}
          renderItem={(rec) => (
            <List.Item>
              <Space direction="vertical" size={0} style={{ width: '100%' }}>
                <Space wrap>
                  <Tag color={rec.isChangeApplication ? 'blue' : 'green'}>
                    {rec.isChangeApplication ? t('organizations.detail.changeApplication') : t('organizations.detail.initialApplication')}
                  </Tag>
                  {rec.proposedStartDate && (
                    <span>
                      {t('organizations.detail.proposedStartDate')}: {new Date(rec.proposedStartDate).toLocaleDateString()}
                    </span>
                  )}
                </Space>
                <Space wrap>
                  {(rec.courseTypesJson ?? []).map((c, i) => (
                    <Tag key={i}>{describeListEntry(c)}</Tag>
                  ))}
                </Space>
                <span style={{ color: '#888', fontSize: 12 }}>
                  {t('organizations.detail.submittedAt')} {new Date(rec.submittedAt).toLocaleString()}
                  {rec.trainingSitesJson?.length
                    ? ` | ${t('organizations.detail.trainingSites')}: ${rec.trainingSitesJson.map(describeListEntry).join(', ')}`
                    : ''}
                  {rec.aircraftListJson?.length
                    ? ` | ${t('organizations.detail.aircraft')}: ${rec.aircraftListJson.map(describeListEntry).join(', ')}`
                    : ''}
                  {rec.fstdListJson?.length ? ` | ${t('organizations.detail.fstdList')}: ${rec.fstdListJson.map(describeListEntry).join(', ')}` : ''}
                </span>
              </Space>
            </List.Item>
          )}
        />
      </Card>

      <Modal title={t('organizations.detail.addCertModalTitle')} open={modalOpen} onOk={handleAddCertificate} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical" initialValues={{ issuedAt: dayjs() }}>
          <Form.Item name="certificateNo" label={t('organizations.detail.certNoLabel')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="issuedAuthority" label={t('organizations.detail.issuedAuthorityLabel')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="approvalScope" label={t('organizations.detail.scopeLabel')} rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="issuedAt" label={t('organizations.detail.issuedAtLabel')} rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('organizations.detail.selfReviewModalTitle')}
        open={reviewModalOpen}
        onOk={handleRecordSelfReview}
        onCancel={() => setReviewModalOpen(false)}
        width={600}
      >
        <Form form={reviewForm} layout="vertical" initialValues={{ year: dayjs().year(), reviewedAt: dayjs() }}>
          <Space>
            <Form.Item name="year" label={t('organizations.detail.yearLabel')} rules={[{ required: true }]}>
              <InputNumber style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="reviewedAt" label={t('organizations.detail.reviewedAtLabel')} rules={[{ required: true }]}>
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
                checkedChildren={t('organizations.detail.checklistCompliant')}
                unCheckedChildren={t('organizations.detail.checklistNonCompliant')}
                onChange={(checked) =>
                  setReviewItemState((s) => ({ ...s, [item]: { ...s[item], compliant: checked } }))
                }
              />
            </Space>
            {!reviewItemState[item]?.compliant && (
              <Input
                placeholder={t('organizations.detail.nonComplianceNotePlaceholder')}
                value={reviewItemState[item]?.notes}
                onChange={(e) => setReviewItemState((s) => ({ ...s, [item]: { ...s[item], notes: e.target.value } }))}
                style={{ marginTop: 4 }}
              />
            )}
          </div>
        ))}
      </Modal>

      <Modal
        title={t('organizations.detail.applicationModalTitle')}
        open={applicationModalOpen}
        onOk={handleCreateApplicationRecord}
        onCancel={() => setApplicationModalOpen(false)}
      >
        <Form form={applicationForm} layout="vertical" initialValues={{ isChangeApplication: false }}>
          <Form.Item name="isChangeApplication" label={t('organizations.detail.applicationTypeLabel')} rules={[{ required: true }]}>
            <Select
              options={[
                { value: false, label: t('organizations.detail.initialApplication') },
                { value: true, label: t('organizations.detail.changeApplicationOption') },
              ]}
            />
          </Form.Item>
          <Form.Item name="proposedStartDate" label={t('organizations.detail.proposedStartDate')}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="courseTypesJson" label={t('organizations.detail.courseTypesLabel')}>
            <Select mode="tags" placeholder={t('organizations.detail.courseTypesPlaceholder')} />
          </Form.Item>
          <Form.Item name="trainingSitesJson" label={t('organizations.detail.trainingSitesLabel')}>
            <Select mode="tags" placeholder={t('organizations.detail.trainingSitesPlaceholder')} />
          </Form.Item>
          <Form.Item name="aircraftListJson" label={t('organizations.detail.aircraftLabel')}>
            <Select mode="tags" placeholder={t('organizations.detail.aircraftPlaceholder')} />
          </Form.Item>
          <Form.Item name="fstdListJson" label={t('organizations.detail.fstdListLabel')}>
            <Select mode="tags" placeholder={t('organizations.detail.fstdListPlaceholder')} />
          </Form.Item>
          <Form.Item name="operationsManualRef" label={t('organizations.detail.opsManualRefLabel')}>
            <Input />
          </Form.Item>
          <Form.Item name="trainingManualRef" label={t('organizations.detail.trainingManualRefLabel')}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
