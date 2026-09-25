import { PlusOutlined } from '@ant-design/icons'
import { Alert, Button, Card, DatePicker, Empty, Form, Input, Modal, Select, Space, Table, Tag, message } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { personnelApi } from '../api/personnel'
import type { ManagementRoleType, OccurrenceReport, RoleAssignment } from '../api/managementSystem'
import { managementSystemApi } from '../api/managementSystem'
import type { Personnel } from '../api/types'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'

const ROLES: ManagementRoleType[] = [
  'ACCOUNTABLE_MANAGER',
  'NOMINATED_PERSON_COMPLIANCE',
  'SAFETY_MANAGER',
  'COMPLIANCE_MONITORING_MANAGER',
  'HEAD_OF_TRAINING',
  'CFI',
  'CTKI',
]

export function ManagementSystemPage() {
  const { organizations, selectedId, select } = useSelectedOrganization()
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>([])
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [overdueOccurrences, setOverdueOccurrences] = useState<OccurrenceReport[]>([])
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [occurrenceModalOpen, setOccurrenceModalOpen] = useState(false)
  const [roleForm] = Form.useForm()
  const [occurrenceForm] = Form.useForm()

  const load = () => {
    if (!selectedId) return
    managementSystemApi.listRoleAssignments(selectedId).then(setRoleAssignments)
    managementSystemApi.listOverdueOccurrences().then(setOverdueOccurrences)
  }

  useEffect(load, [selectedId])
  useEffect(() => {
    personnelApi.list().then(setPersonnel)
  }, [])

  const handleAssignRole = async () => {
    if (!selectedId) return
    const values = await roleForm.validateFields()
    await managementSystemApi.assignRole({
      organizationId: selectedId,
      ...values,
      startDate: values.startDate.format('YYYY-MM-DD'),
    })
    message.success('角色任命成功')
    setRoleModalOpen(false)
    roleForm.resetFields()
    load()
  }

  const handleReportOccurrence = async () => {
    if (!selectedId) return
    const values = await occurrenceForm.validateFields()
    await managementSystemApi.reportOccurrence({
      organizationId: selectedId,
      ...values,
      discoveredAt: values.discoveredAt.toISOString(),
    })
    message.success('事件已登记, 72小时上报倒计时已启动 (ORA.GEN.160)')
    setOccurrenceModalOpen(false)
    occurrenceForm.resetFields()
    load()
  }

  return (
    <div>
      <OrganizationSelector organizations={organizations} selectedId={selectedId} onChange={select} />

      {!selectedId ? (
        <Empty description="请先创建并选择一个机构" />
      ) : (
        <>
          {overdueOccurrences.length > 0 && (
            <Alert
              style={{ marginBottom: 16 }}
              type="error"
              showIcon
              message={`有 ${overdueOccurrences.length} 起事件已超过72小时强制上报时限 (ORA.GEN.160), 请立即处理`}
            />
          )}

          <Card
            title="组织角色任命 (ORA.GEN.210 / ORA.ATO.110/210)"
            extra={
              <Button icon={<PlusOutlined />} onClick={() => setRoleModalOpen(true)}>
                任命角色
              </Button>
            }
            style={{ marginBottom: 16 }}
          >
            <Table<RoleAssignment>
              rowKey="id"
              dataSource={roleAssignments}
              columns={[
                { title: '角色', dataIndex: 'role', render: (v: string) => <Tag color="blue">{v}</Tag> },
                {
                  title: '人员',
                  dataIndex: 'personnel',
                  render: (p: RoleAssignment['personnel']) => (p ? `${p.lastName}${p.firstName}` : '-'),
                },
                { title: '任职起始日期', dataIndex: 'startDate', render: (v: string) => new Date(v).toLocaleDateString() },
              ]}
            />
          </Card>

          <Card
            title="事件报告 (ORA.GEN.160, 强制事件72小时上报)"
            extra={
              <Button icon={<PlusOutlined />} onClick={() => setOccurrenceModalOpen(true)}>
                登记事件
              </Button>
            }
          >
            <p style={{ color: '#888' }}>下方展示全租户范围内已超时未上报的强制性事件, 需要立即跟进。</p>
          </Card>
        </>
      )}

      <Modal title="任命组织角色" open={roleModalOpen} onOk={handleAssignRole} onCancel={() => setRoleModalOpen(false)}>
        <Form form={roleForm} layout="vertical">
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select options={ROLES.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="personnelId" label="人员" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={personnel.map((p) => ({ value: p.id, label: `${p.lastName}${p.firstName}` }))}
            />
          </Form.Item>
          <Form.Item name="startDate" label="任职起始日期" rules={[{ required: true }]} initialValue={dayjs()}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="登记事件报告"
        open={occurrenceModalOpen}
        onOk={handleReportOccurrence}
        onCancel={() => setOccurrenceModalOpen(false)}
      >
        <Form form={occurrenceForm} layout="vertical" initialValues={{ discoveredAt: dayjs(), isMandatory: true }}>
          <Form.Item name="occurrenceType" label="事件类型" rules={[{ required: true }]}>
            <Input placeholder="如: FSTD故障 / 训练不安全事件" />
          </Form.Item>
          <Form.Item name="discoveredAt" label="发现时间 (72小时倒计时起点)" rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
