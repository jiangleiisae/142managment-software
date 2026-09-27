import { PlusOutlined } from '@ant-design/icons'
import { Alert, Button, Card, DatePicker, Empty, Form, Input, InputNumber, List, Modal, Select, Space, Table, Tag, message } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { personnelApi } from '../api/personnel'
import type { HazardRegisterEntry, ManagementRoleType, OccurrenceReport, RoleAssignment } from '../api/managementSystem'
import { managementSystemApi } from '../api/managementSystem'
import type { RetentionStatusItem } from '../api/retention'
import { retentionApi } from '../api/retention'
import type { Personnel } from '../api/types'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'

const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  default_fallback: '默认兜底 (未明确规定期限的记录)',
  student_training_record: '学员训练记录',
  personnel_qualification_record: '人员资质/经验记录',
  fstd_initial_qualification: 'FSTD初始鉴定文件',
  fstd_periodic_documentation: 'FSTD周期性复检文档',
  fstd_safety_facility_check: 'FSTD安全设施年检记录',
  compliance_monitoring_finding: '合规监督记录 (发现项/纠正措施)',
}

const ROLES: ManagementRoleType[] = [
  'ACCOUNTABLE_MANAGER',
  'NOMINATED_PERSON_COMPLIANCE',
  'SAFETY_MANAGER',
  'COMPLIANCE_MONITORING_MANAGER',
  'HEAD_OF_TRAINING',
  'CFI',
  'CTKI',
]

/// 风险矩阵配色: riskScore = probabilityLevel x severityLevel (1-25)
function riskColor(score: number) {
  if (score >= 15) return 'red'
  if (score >= 8) return 'orange'
  return 'green'
}

export function ManagementSystemPage() {
  const { organizations, selectedId, select } = useSelectedOrganization()
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>([])
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [overdueOccurrences, setOverdueOccurrences] = useState<OccurrenceReport[]>([])
  const [hazards, setHazards] = useState<HazardRegisterEntry[]>([])
  const [openHighRiskCount, setOpenHighRiskCount] = useState(0)
  const [retentionStatus, setRetentionStatus] = useState<RetentionStatusItem[]>([])

  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [occurrenceModalOpen, setOccurrenceModalOpen] = useState(false)
  const [hazardModalOpen, setHazardModalOpen] = useState(false)
  const [riskModalHazardId, setRiskModalHazardId] = useState<string>()
  const [mitigationModalRiskId, setMitigationModalRiskId] = useState<string>()

  const [roleForm] = Form.useForm()
  const [occurrenceForm] = Form.useForm()
  const [hazardForm] = Form.useForm()
  const [riskForm] = Form.useForm()
  const [mitigationForm] = Form.useForm()

  const load = () => {
    if (!selectedId) return
    managementSystemApi.listRoleAssignments(selectedId).then(setRoleAssignments)
    managementSystemApi.listOverdueOccurrences().then(setOverdueOccurrences)
    managementSystemApi.listHazards(selectedId).then(setHazards)
    managementSystemApi.listOpenHighRisks().then((risks) => setOpenHighRiskCount(risks.length))
  }

  useEffect(load, [selectedId])
  useEffect(() => {
    personnelApi.list().then(setPersonnel)
    retentionApi.getComplianceStatus().then(setRetentionStatus)
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

  const handleReportHazard = async () => {
    if (!selectedId) return
    const values = await hazardForm.validateFields()
    await managementSystemApi.reportHazard({ organizationId: selectedId, ...values })
    message.success('危险源已登记')
    setHazardModalOpen(false)
    hazardForm.resetFields()
    load()
  }

  const handleAssessRisk = async () => {
    if (!riskModalHazardId) return
    const values = await riskForm.validateFields()
    await managementSystemApi.assessRisk(riskModalHazardId, values)
    message.success('风险评估已提交')
    setRiskModalHazardId(undefined)
    riskForm.resetFields()
    load()
  }

  const handleAddMitigation = async () => {
    if (!mitigationModalRiskId) return
    const values = await mitigationForm.validateFields()
    await managementSystemApi.addMitigationAction(mitigationModalRiskId, {
      ...values,
      dueDate: values.dueDate ? values.dueDate.format('YYYY-MM-DD') : undefined,
    })
    message.success('缓解措施已添加')
    setMitigationModalRiskId(undefined)
    mitigationForm.resetFields()
    load()
  }

  const closeMitigation = async (id: string) => {
    await managementSystemApi.closeMitigationAction(id)
    message.success('缓解措施已关闭')
    load()
  }

  return (
    <div>
      <OrganizationSelector organizations={organizations} selectedId={selectedId} onChange={select} />

      <Card
        title="记录保存策略 (3.9 跨模块基础设施, 全租户范围)"
        style={{ marginBottom: 16 }}
      >
        <p style={{ color: '#888' }}>
          保存期限来自配置表而非硬编码; 满足最低保存期限前禁止物理删除, 到期后也仅表示"可归档"而非自动删除。
        </p>
        <Table<RetentionStatusItem>
          rowKey="documentType"
          size="small"
          dataSource={retentionStatus}
          pagination={false}
          columns={[
            { title: '记录类型', dataIndex: 'documentType', render: (v: string) => DOCUMENT_TYPE_LABEL[v] ?? v },
            { title: '法规依据', dataIndex: 'basisRegulation' },
            {
              title: '保存期限',
              dataIndex: 'retentionMonths',
              render: (v?: number | null) => (v == null ? '设备/记录全生命周期' : `${(v / 12).toFixed(1)} 年`),
            },
            { title: '总数', dataIndex: 'totalCount' },
            {
              title: '强制保存中',
              dataIndex: 'protectedCount',
              render: (v: number) => <Tag color={v > 0 ? 'blue' : 'default'}>{v}</Tag>,
            },
            {
              title: '已满期可归档',
              dataIndex: 'eligibleForArchivalCount',
              render: (v: number) => <Tag color={v > 0 ? 'orange' : 'default'}>{v}</Tag>,
            },
          ]}
        />
      </Card>

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
          {openHighRiskCount > 0 && (
            <Alert
              style={{ marginBottom: 16 }}
              type="warning"
              showIcon
              message={`有 ${openHighRiskCount} 项高风险(评分≥12)尚未完成缓解措施, 建议优先处理`}
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
            style={{ marginBottom: 16 }}
          >
            <p style={{ color: '#888' }}>上方红色提示展示全租户范围内已超时未上报的强制性事件, 需要立即跟进。</p>
          </Card>

          <Card
            title="风险管理: 危险源 → 风险评估 → 缓解措施 (ORA.GEN.200(a)(3) SMS核心)"
            extra={
              <Button icon={<PlusOutlined />} onClick={() => setHazardModalOpen(true)}>
                登记危险源
              </Button>
            }
          >
            <Table<HazardRegisterEntry>
              rowKey="id"
              dataSource={hazards}
              columns={[
                { title: '来源', dataIndex: 'source' },
                { title: '危险源描述', dataIndex: 'description' },
                { title: '涉及环节', dataIndex: 'affectedArea' },
                {
                  title: '操作',
                  render: (_, hazard) => (
                    <Button size="small" onClick={() => setRiskModalHazardId(hazard.id)}>
                      做风险评估
                    </Button>
                  ),
                },
              ]}
              expandable={{
                expandedRowRender: (hazard) => (
                  <List
                    size="small"
                    dataSource={hazard.riskAssessments ?? []}
                    locale={{ emptyText: '尚未做风险评估' }}
                    renderItem={(risk) => (
                      <List.Item
                        actions={[
                          <Button key="add" size="small" onClick={() => setMitigationModalRiskId(risk.id)}>
                            添加缓解措施
                          </Button>,
                        ]}
                      >
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <Space>
                            <Tag color={riskColor(risk.riskScore)}>
                              风险评分 {risk.riskScore} (概率{risk.probabilityLevel} × 严重度{risk.severityLevel})
                            </Tag>
                          </Space>
                          <Space wrap>
                            {(risk.mitigations ?? []).map((m) => (
                              <Tag
                                key={m.id}
                                color={m.status === 'closed' ? 'default' : 'processing'}
                                onClick={() => m.status !== 'closed' && closeMitigation(m.id)}
                                style={{ cursor: m.status !== 'closed' ? 'pointer' : 'default' }}
                              >
                                {m.description} [{m.status === 'closed' ? '已关闭' : '点击关闭'}]
                              </Tag>
                            ))}
                          </Space>
                        </Space>
                      </List.Item>
                    )}
                  />
                ),
              }}
            />
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

      <Modal title="登记危险源" open={hazardModalOpen} onOk={handleReportHazard} onCancel={() => setHazardModalOpen(false)}>
        <Form form={hazardForm} layout="vertical" initialValues={{ source: 'internal_report' }}>
          <Form.Item name="source" label="来源" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'internal_report', label: '内部报告' },
                { value: 'audit', label: '审计发现' },
                { value: 'occurrence', label: '来自事件报告' },
              ]}
            />
          </Form.Item>
          <Form.Item name="description" label="危险源描述" rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="affectedArea" label="涉及运行环节">
            <Input placeholder="如: 某型FSTD训练 / 某训练科目 / 某场地" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="风险评估 (概率 x 严重度矩阵)"
        open={!!riskModalHazardId}
        onOk={handleAssessRisk}
        onCancel={() => setRiskModalHazardId(undefined)}
      >
        <Form form={riskForm} layout="vertical">
          <Form.Item name="probabilityLevel" label="概率等级 (1-5, 5为最高)" rules={[{ required: true }]}>
            <InputNumber min={1} max={5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="severityLevel" label="严重度等级 (1-5, 5为最高)" rules={[{ required: true }]}>
            <InputNumber min={1} max={5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="existingMitigation" label="现有缓解措施说明">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加缓解措施"
        open={!!mitigationModalRiskId}
        onOk={handleAddMitigation}
        onCancel={() => setMitigationModalRiskId(undefined)}
      >
        <Form form={mitigationForm} layout="vertical">
          <Form.Item name="description" label="措施描述" rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="dueDate" label="计划完成日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
