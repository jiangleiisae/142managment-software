import { Button, Form, Input, InputNumber, List, Modal, Select, Space, Tag, message } from 'antd'
import { useEffect, useState } from 'react'
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

const DETAIL_FIELD_LABELS: Record<string, string> = {
  newLevelOrBasis: '升级后的等级/FCS基础',
  impactAssessment: '影响评估',
  revisedTestPlan: '修订测试方案',
  verificationTestPercentComplete: '验证测试完成百分比 (恢复前须≥34%)',
  storagePlan: '存储/复活计划',
  newOperatorName: '新运营人名称',
}

/// 通用变更管理面板 (ORA.GEN.130), 供机构详情页(entityType=Organization)与FSTD页面(entityType=Fstd)共用
export function ChangeRequestPanel({ entityType, entityId }: { entityType: ChangeEntityType; entityId: string }) {
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
      message.success('变更申请已创建')
      setModalOpen(false)
      form.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '创建失败')
    }
  }

  const handleAction = async (action: 'submit' | 'notify' | 'approve' | 'reject', id: string) => {
    try {
      const fn = { submit: changeRequestsApi.submit, notify: changeRequestsApi.notify, approve: changeRequestsApi.approve, reject: changeRequestsApi.reject }[action]
      await fn(id)
      message.success('状态已更新')
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '操作失败')
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
          发起变更申请
        </Button>
      </Space>
      <List
        size="small"
        dataSource={changeRequests}
        locale={{ emptyText: '暂无变更申请' }}
        renderItem={(cr) => {
          const config = configFor(cr.changeType)
          return (
            <List.Item
              actions={[
                cr.status === 'DRAFT' && (
                  <Button key="submit" size="small" onClick={() => handleAction('submit', cr.id)}>
                    提交(通知主管机关)
                  </Button>
                ),
                cr.status === 'LOGGED' && (
                  <Button key="notify" size="small" onClick={() => handleAction('notify', cr.id)}>
                    确认已通知当局
                  </Button>
                ),
                (cr.status === 'SUBMITTED' || cr.status === 'UNDER_REVIEW') && (
                  <Button key="approve" size="small" type="primary" onClick={() => handleAction('approve', cr.id)}>
                    批准
                  </Button>
                ),
                (cr.status === 'SUBMITTED' || cr.status === 'UNDER_REVIEW' || cr.status === 'DRAFT') && (
                  <Button key="reject" size="small" danger onClick={() => handleAction('reject', cr.id)}>
                    驳回
                  </Button>
                ),
              ].filter(Boolean)}
            >
              <Space direction="vertical" size={0} style={{ width: '100%' }}>
                <Space wrap>
                  <Tag color={STATUS_COLOR[cr.status]}>{cr.status}</Tag>
                  <Tag color={cr.approvalType === 'PRIOR_APPROVAL' ? 'purple' : 'blue'}>
                    {cr.approvalType === 'PRIOR_APPROVAL' ? `事先批准(提前${cr.minNoticeDays}天)` : '仅需通知'}
                  </Tag>
                  <span>{config?.label ?? cr.changeType}</span>
                </Space>
                {cr.description && <span style={{ color: '#888' }}>{cr.description}</span>}
                <span style={{ color: '#888', fontSize: 12 }}>
                  {cr.earliestEffectiveDate && `最早生效日期: ${new Date(cr.earliestEffectiveDate).toLocaleDateString()} `}
                  {cr.effectiveAt && `生效于: ${new Date(cr.effectiveAt).toLocaleString()} `}
                  {cr.authorityReply && `驳回原因: ${cr.authorityReply}`}
                </span>
              </Space>
            </List.Item>
          )
        }}
      />

      <Modal title="发起变更申请 (ORA.GEN.130)" open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="changeType" label="变更类型" rules={[{ required: true }]}>
            <Select
              options={types.map((t) => ({
                value: t.changeType,
                label: `${t.label}${t.approvalType === 'PRIOR_APPROVAL' ? ` (提前${t.minNoticeDays}天)` : ' (仅需通知)'}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.changeType !== cur.changeType}>
            {({ getFieldValue }) =>
              (configFor(getFieldValue('changeType'))?.requiredDetailFields ?? []).map((field) => (
                <Form.Item key={field} name={field} label={DETAIL_FIELD_LABELS[field] ?? field} rules={[{ required: true }]}>
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
