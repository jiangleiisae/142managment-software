import { App, Button, Form, Input, InputNumber, List, Modal, Select, Space, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChangeEntityType, ChangeRequest, ChangeRequestStatus, ChangeTypeConfig } from '../api/changeRequests'
import { changeRequestsApi } from '../api/changeRequests'

const STATUS_COLOR: Record<ChangeRequestStatus, string> = {
  DRAFT: 'default',
  SUBMITTED: 'processing',
  UNDER_REVIEW: 'processing',
  APPROVED: 'green',
  REJECTED: 'red',
  LOGGED: 'blue',
  NOTIFIED: 'green',
}

const DETAIL_FIELD_LABEL_KEYS: Record<string, string> = {
  newLevelOrBasis: 'changeRequests.fieldNewLevelOrBasis',
  impactAssessment: 'changeRequests.fieldImpactAssessment',
  revisedTestPlan: 'changeRequests.fieldRevisedTestPlan',
  verificationTestPercentComplete: 'changeRequests.fieldVerificationTestPercentComplete',
  storagePlan: 'changeRequests.fieldStoragePlan',
  newOperatorName: 'changeRequests.fieldNewOperatorName',
}

/// 通用变更管理面板 (ORA.GEN.130), 供机构详情页(entityType=Organization)与FSTD页面(entityType=Fstd)共用
export function ChangeRequestPanel({ entityType, entityId }: { entityType: ChangeEntityType; entityId: string }) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([])
  const [types, setTypes] = useState<ChangeTypeConfig[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  const load = () => {
    changeRequestsApi.list(entityType, entityId).then(setChangeRequests)
  }

  useEffect(() => {
    changeRequestsApi.listTypes(entityType).then(setTypes)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId])

  const configFor = (changeType?: string) => types.find((t) => t.changeType === changeType)

  const handleCreate = async () => {
    const values = await form.validateFields()
    const { changeType, description, ...rest } = values
    const config = configFor(changeType)
    const detailsJson = Object.fromEntries((config?.requiredDetailFields ?? []).map((f) => [f, rest[f]]))
    try {
      await changeRequestsApi.create({
        entityType,
        entityId,
        changeType,
        description,
        detailsJson: Object.keys(detailsJson).length > 0 ? detailsJson : undefined,
      })
      message.success(t('changeRequests.createSuccess'))
      setModalOpen(false)
      form.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('changeRequests.createFailed'))
    }
  }

  const handleAction = async (action: 'submit' | 'notify' | 'approve' | 'reject', id: string) => {
    try {
      const fn = { submit: changeRequestsApi.submit, notify: changeRequestsApi.notify, approve: changeRequestsApi.approve, reject: changeRequestsApi.reject }[action]
      await fn(id)
      message.success(t('changeRequests.statusUpdated'))
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('changeRequests.operationFailed'))
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 8 }}>
        <Button
          size="small"
          onClick={() => {
            form.resetFields()
            setModalOpen(true)
          }}
        >
          {t('changeRequests.initiateButton')}
        </Button>
      </Space>
      <List
        size="small"
        dataSource={changeRequests}
        locale={{ emptyText: t('changeRequests.emptyText') }}
        renderItem={(cr) => {
          const config = configFor(cr.changeType)
          return (
            <List.Item
              actions={[
                cr.status === 'DRAFT' && (
                  <Button key="submit" size="small" onClick={() => handleAction('submit', cr.id)}>
                    {t('changeRequests.submit')}
                  </Button>
                ),
                cr.status === 'LOGGED' && (
                  <Button key="notify" size="small" onClick={() => handleAction('notify', cr.id)}>
                    {t('changeRequests.confirmNotified')}
                  </Button>
                ),
                (cr.status === 'SUBMITTED' || cr.status === 'UNDER_REVIEW') && (
                  <Button key="approve" size="small" type="primary" onClick={() => handleAction('approve', cr.id)}>
                    {t('changeRequests.approve')}
                  </Button>
                ),
                (cr.status === 'SUBMITTED' || cr.status === 'UNDER_REVIEW' || cr.status === 'DRAFT') && (
                  <Button key="reject" size="small" danger onClick={() => handleAction('reject', cr.id)}>
                    {t('changeRequests.reject')}
                  </Button>
                ),
              ].filter(Boolean)}
            >
              <Space direction="vertical" size={0} style={{ width: '100%' }}>
                <Space wrap>
                  <Tag color={STATUS_COLOR[cr.status]}>{cr.status}</Tag>
                  <Tag color={cr.approvalType === 'PRIOR_APPROVAL' ? 'purple' : 'blue'}>
                    {cr.approvalType === 'PRIOR_APPROVAL'
                      ? t('changeRequests.priorApprovalTag', { days: cr.minNoticeDays })
                      : t('changeRequests.notifyOnlyTag')}
                  </Tag>
                  <span>{config?.label ?? cr.changeType}</span>
                </Space>
                {cr.description && <span style={{ color: '#888' }}>{cr.description}</span>}
                <span style={{ color: '#888', fontSize: 12 }}>
                  {cr.earliestEffectiveDate &&
                    t('changeRequests.earliestEffectiveDate', { date: new Date(cr.earliestEffectiveDate).toLocaleDateString() })}
                  {cr.effectiveAt && t('changeRequests.effectiveAt', { date: new Date(cr.effectiveAt).toLocaleString() })}
                  {cr.authorityReply && t('changeRequests.rejectReason', { reason: cr.authorityReply })}
                </span>
              </Space>
            </List.Item>
          )
        }}
      />

      <Modal title={t('changeRequests.createModalTitle')} open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="changeType" label={t('changeRequests.fieldChangeType')} rules={[{ required: true }]}>
            <Select
              options={types.map((ct) => ({
                value: ct.changeType,
                label:
                  ct.approvalType === 'PRIOR_APPROVAL'
                    ? t('changeRequests.changeTypePriorApprovalOption', { label: ct.label, days: ct.minNoticeDays })
                    : t('changeRequests.changeTypeNotifyOnlyOption', { label: ct.label }),
              }))}
            />
          </Form.Item>
          <Form.Item name="description" label={t('changeRequests.fieldDescription')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.changeType !== cur.changeType}>
            {({ getFieldValue }) =>
              (configFor(getFieldValue('changeType'))?.requiredDetailFields ?? []).map((field) => (
                <Form.Item key={field} name={field} label={DETAIL_FIELD_LABEL_KEYS[field] ? t(DETAIL_FIELD_LABEL_KEYS[field]) : field} rules={[{ required: true }]}>
                  {field === 'verificationTestPercentComplete' ? (
                    <InputNumber min={0} max={100} style={{ width: '100%' }} />
                  ) : (
                    <Input.TextArea rows={2} />
                  )}
                </Form.Item>
              ))
            }
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
