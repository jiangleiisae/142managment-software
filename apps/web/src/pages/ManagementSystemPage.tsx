import { PlusOutlined } from '@ant-design/icons'
import { Alert, Button, Card, DatePicker, Empty, Form, Input, InputNumber, List, Modal, Select, Space, Table, Tag, message } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { personnelApi } from '../api/personnel'
import type {
  ContractRecord,
  EmergencyResponsePlan,
  ErpDrillDueSoonItem,
  HazardRegisterEntry,
  ManagementOfChange,
  ManagementRoleType,
  OccurrenceReport,
  RoleAssignment,
  SafetyIndicatorWithStatus,
  SafetyPolicy,
  SpiDirection,
  SrbMeeting,
} from '../api/managementSystem'
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

const MOC_STATUS_COLOR: Record<ManagementOfChange['status'], string> = {
  DRAFT: 'default',
  RISK_ASSESSED: 'processing',
  IMPLEMENTED: 'orange',
  VERIFIED: 'green',
}

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
  const [safetyPolicies, setSafetyPolicies] = useState<SafetyPolicy[]>([])
  const [mocs, setMocs] = useState<ManagementOfChange[]>([])
  const [erpPlans, setErpPlans] = useState<EmergencyResponsePlan[]>([])
  const [erpDrillsDueSoon, setErpDrillsDueSoon] = useState<ErpDrillDueSoonItem[]>([])
  const [indicators, setIndicators] = useState<SafetyIndicatorWithStatus[]>([])
  const [srbMeetings, setSrbMeetings] = useState<SrbMeeting[]>([])
  const [contracts, setContracts] = useState<ContractRecord[]>([])

  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [occurrenceModalOpen, setOccurrenceModalOpen] = useState(false)
  const [hazardModalOpen, setHazardModalOpen] = useState(false)
  const [riskModalHazardId, setRiskModalHazardId] = useState<string>()
  const [mitigationModalRiskId, setMitigationModalRiskId] = useState<string>()
  const [policyModalOpen, setPolicyModalOpen] = useState(false)
  const [signPolicyModalId, setSignPolicyModalId] = useState<string>()
  const [mocModalOpen, setMocModalOpen] = useState(false)
  const [mocRiskModalId, setMocRiskModalId] = useState<string>()
  const [mocImplementModalId, setMocImplementModalId] = useState<string>()
  const [mocVerifyModalId, setMocVerifyModalId] = useState<string>()
  const [erpModalOpen, setErpModalOpen] = useState(false)
  const [drillModalErpId, setDrillModalErpId] = useState<string>()
  const [indicatorModalOpen, setIndicatorModalOpen] = useState(false)
  const [measurementModalIndicatorId, setMeasurementModalIndicatorId] = useState<string>()
  const [srbModalOpen, setSrbModalOpen] = useState(false)
  const [srbActionModalId, setSrbActionModalId] = useState<string>()
  const [contractModalOpen, setContractModalOpen] = useState(false)

  const [roleForm] = Form.useForm()
  const [occurrenceForm] = Form.useForm()
  const [hazardForm] = Form.useForm()
  const [riskForm] = Form.useForm()
  const [mitigationForm] = Form.useForm()
  const [policyForm] = Form.useForm()
  const [signPolicyForm] = Form.useForm()
  const [mocForm] = Form.useForm()
  const [mocRiskForm] = Form.useForm()
  const [mocImplementForm] = Form.useForm()
  const [mocVerifyForm] = Form.useForm()
  const [erpForm] = Form.useForm()
  const [drillForm] = Form.useForm()
  const [indicatorForm] = Form.useForm()
  const [measurementForm] = Form.useForm()
  const [srbForm] = Form.useForm()
  const [srbActionForm] = Form.useForm()
  const [contractForm] = Form.useForm()

  const load = () => {
    if (!selectedId) return
    managementSystemApi.listRoleAssignments(selectedId).then(setRoleAssignments)
    managementSystemApi.listOverdueOccurrences().then(setOverdueOccurrences)
    managementSystemApi.listHazards(selectedId).then(setHazards)
    managementSystemApi.listOpenHighRisks().then((risks) => setOpenHighRiskCount(risks.length))
    managementSystemApi.listSafetyPolicies(selectedId).then(setSafetyPolicies)
    managementSystemApi.listMocs(selectedId).then(setMocs)
    managementSystemApi.listErpPlans(selectedId).then(setErpPlans)
    managementSystemApi.findErpDrillsDueSoon().then(setErpDrillsDueSoon)
    managementSystemApi.listIndicatorsWithStatus(selectedId).then(setIndicators)
    managementSystemApi.listSrbMeetings(selectedId).then(setSrbMeetings)
    managementSystemApi.listContracts(selectedId).then(setContracts)
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

  const allRiskAssessments = hazards.flatMap((h) =>
    (h.riskAssessments ?? []).map((r) => ({ id: r.id, label: `${h.description} - 风险评分${r.riskScore}` })),
  )

  const handleAddPolicy = async () => {
    if (!selectedId) return
    const values = await policyForm.validateFields()
    await managementSystemApi.addSafetyPolicy({
      organizationId: selectedId,
      ...values,
      effectiveDate: values.effectiveDate.format('YYYY-MM-DD'),
    })
    message.success('安全政策版本已登记, 旧版本已自动标记为已替代')
    setPolicyModalOpen(false)
    policyForm.resetFields()
    load()
  }

  const handleSignPolicy = async () => {
    if (!signPolicyModalId) return
    const values = await signPolicyForm.validateFields()
    try {
      await managementSystemApi.signSafetyPolicy(signPolicyModalId, values.personnelId)
      message.success('安全政策已签署')
      setSignPolicyModalId(undefined)
      signPolicyForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '签署失败, 该人员可能未持有负责人(Accountable Manager)角色')
    }
  }

  const handleCreateMoc = async () => {
    if (!selectedId) return
    const values = await mocForm.validateFields()
    await managementSystemApi.createMoc({ organizationId: selectedId, ...values })
    message.success('变更管理(MOC)记录已创建, 需先完成变更前风险评估')
    setMocModalOpen(false)
    mocForm.resetFields()
    load()
  }

  const handleAttachMocRisk = async () => {
    if (!mocRiskModalId) return
    const values = await mocRiskForm.validateFields()
    try {
      await managementSystemApi.attachRiskAssessmentToMoc(mocRiskModalId, values.riskAssessmentId)
      message.success('已关联变更前风险评估, MOC进入风险已评估阶段')
      setMocRiskModalId(undefined)
      mocRiskForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '操作失败')
    }
  }

  const handleImplementMoc = async () => {
    if (!mocImplementModalId) return
    const values = await mocImplementForm.validateFields()
    try {
      await managementSystemApi.implementMoc(mocImplementModalId, values.implementationPlan)
      message.success('MOC已标记为实施完成')
      setMocImplementModalId(undefined)
      mocImplementForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '操作失败')
    }
  }

  const handleVerifyMoc = async () => {
    if (!mocVerifyModalId) return
    const values = await mocVerifyForm.validateFields()
    try {
      await managementSystemApi.verifyMoc(mocVerifyModalId, values.verificationNotes)
      message.success('MOC变更后验证已完成')
      setMocVerifyModalId(undefined)
      mocVerifyForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '操作失败')
    }
  }

  const handleAddErpPlan = async () => {
    if (!selectedId) return
    const values = await erpForm.validateFields()
    await managementSystemApi.addErpPlan({
      organizationId: selectedId,
      ...values,
      effectiveDate: values.effectiveDate.format('YYYY-MM-DD'),
    })
    message.success('应急响应计划版本已登记')
    setErpModalOpen(false)
    erpForm.resetFields()
    load()
  }

  const handleRecordDrill = async () => {
    if (!drillModalErpId) return
    const values = await drillForm.validateFields()
    await managementSystemApi.recordErpDrill(drillModalErpId, {
      ...values,
      drilledAt: values.drilledAt.format('YYYY-MM-DD'),
    })
    message.success('演练记录已保存, 下次到期日已自动计算(12个月)')
    setDrillModalErpId(undefined)
    drillForm.resetFields()
    load()
  }

  const handleCreateIndicator = async () => {
    if (!selectedId) return
    const values = await indicatorForm.validateFields()
    await managementSystemApi.createIndicator({ organizationId: selectedId, ...values })
    message.success('安全绩效指标已创建')
    setIndicatorModalOpen(false)
    indicatorForm.resetFields()
    load()
  }

  const handleRecordMeasurement = async () => {
    if (!measurementModalIndicatorId) return
    const values = await measurementForm.validateFields()
    await managementSystemApi.recordMeasurement(measurementModalIndicatorId, {
      periodStart: values.range[0].format('YYYY-MM-DD'),
      periodEnd: values.range[1].format('YYYY-MM-DD'),
      value: values.value,
    })
    message.success('采集值已记录')
    setMeasurementModalIndicatorId(undefined)
    measurementForm.resetFields()
    load()
  }

  const handleCreateSrbMeeting = async () => {
    if (!selectedId) return
    const values = await srbForm.validateFields()
    await managementSystemApi.createSrbMeeting({
      organizationId: selectedId,
      ...values,
      meetingDate: values.meetingDate.format('YYYY-MM-DD'),
    })
    message.success('安全评审委员会会议记录已创建')
    setSrbModalOpen(false)
    srbForm.resetFields()
    load()
  }

  const handleAddSrbAction = async () => {
    if (!srbActionModalId) return
    const values = await srbActionForm.validateFields()
    await managementSystemApi.addSrbAction(srbActionModalId, {
      ...values,
      dueDate: values.dueDate ? values.dueDate.format('YYYY-MM-DD') : undefined,
    })
    message.success('行动项已添加')
    setSrbActionModalId(undefined)
    srbActionForm.resetFields()
    load()
  }

  const closeSrbAction = async (id: string) => {
    await managementSystemApi.closeSrbAction(id)
    message.success('行动项已关闭')
    load()
  }

  const handleCreateContract = async () => {
    if (!selectedId) return
    const values = await contractForm.validateFields()
    await managementSystemApi.createContract({ organizationId: selectedId, ...values })
    message.success('承包记录已创建')
    setContractModalOpen(false)
    contractForm.resetFields()
    load()
  }

  const toggleContractAuditFlag = async (contract: ContractRecord) => {
    await managementSystemApi.updateContract(contract.id, { includedInAudit: !contract.includedInAudit })
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
          {erpDrillsDueSoon.length > 0 && (
            <Alert
              style={{ marginBottom: 16 }}
              type="warning"
              showIcon
              message={`有 ${erpDrillsDueSoon.length} 个机构的应急响应演练即将到期或从未演练过 (3.2.2 ERP)`}
              description={erpDrillsDueSoon.map((d) => d.organizationName).join('、')}
            />
          )}
          {indicators.some((i) => i.breached) && (
            <Alert
              style={{ marginBottom: 16 }}
              type="error"
              showIcon
              message={`有 ${indicators.filter((i) => i.breached).length} 项安全绩效指标(SPI)最新采集值未达标 (3.2.2 SPI/SPT)`}
              description={indicators
                .filter((i) => i.breached)
                .map((i) => `${i.name}: 最新值${i.latestValue} vs 目标${i.targetValue}`)
                .join('; ')}
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

          <Card
            title="安全政策 Safety Policy (3.2.2 SMS核心要素2)"
            extra={
              <Button icon={<PlusOutlined />} onClick={() => setPolicyModalOpen(true)}>
                登记新版本
              </Button>
            }
            style={{ marginTop: 16, marginBottom: 16 }}
          >
            <List
              size="small"
              dataSource={safetyPolicies}
              locale={{ emptyText: '尚未登记安全政策' }}
              renderItem={(p) => (
                <List.Item
                  actions={
                    !p.signedAt
                      ? [
                          <Button key="sign" size="small" onClick={() => setSignPolicyModalId(p.id)}>
                            签署
                          </Button>,
                        ]
                      : []
                  }
                >
                  <Tag color={p.supersededAt ? 'default' : 'green'}>{p.supersededAt ? '历史版本' : '当前版本'}</Tag>
                  {p.version}
                  <Tag color={p.signedAt ? 'blue' : 'orange'} style={{ marginLeft: 8 }}>
                    {p.signedAt ? `已由负责人签署 ${new Date(p.signedAt).toLocaleDateString()}` : '待负责人签署'}
                  </Tag>
                  <span style={{ color: '#888', marginLeft: 8 }}>生效日期 {new Date(p.effectiveDate).toLocaleDateString()}</span>
                </List.Item>
              )}
            />
          </Card>

          <Card
            title="变更管理 MOC (3.2.2): draft → risk_assessed → implemented → verified"
            extra={
              <Button icon={<PlusOutlined />} onClick={() => setMocModalOpen(true)}>
                发起变更
              </Button>
            }
            style={{ marginBottom: 16 }}
          >
            <List
              size="small"
              dataSource={mocs}
              locale={{ emptyText: '暂无变更管理记录' }}
              renderItem={(m) => (
                <List.Item
                  actions={[
                    m.status === 'DRAFT' && (
                      <Button key="risk" size="small" onClick={() => setMocRiskModalId(m.id)}>
                        关联风险评估
                      </Button>
                    ),
                    m.status === 'RISK_ASSESSED' && (
                      <Button key="impl" size="small" type="primary" onClick={() => setMocImplementModalId(m.id)}>
                        标记已实施
                      </Button>
                    ),
                    m.status === 'IMPLEMENTED' && (
                      <Button key="verify" size="small" type="primary" onClick={() => setMocVerifyModalId(m.id)}>
                        变更后验证
                      </Button>
                    ),
                  ].filter(Boolean)}
                >
                  <Tag color={MOC_STATUS_COLOR[m.status]}>{m.status}</Tag>
                  {m.changeDescription}
                </List.Item>
              )}
            />
          </Card>

          <Card
            title="应急响应计划 ERP (3.2.2, 标准演练周期12个月)"
            extra={
              <Button icon={<PlusOutlined />} onClick={() => setErpModalOpen(true)}>
                登记新版本
              </Button>
            }
            style={{ marginBottom: 16 }}
          >
            <List
              size="small"
              dataSource={erpPlans}
              locale={{ emptyText: '尚未登记应急响应计划' }}
              renderItem={(e) => (
                <List.Item
                  actions={
                    !e.supersededAt
                      ? [
                          <Button key="drill" size="small" onClick={() => setDrillModalErpId(e.id)}>
                            记录演练
                          </Button>,
                        ]
                      : []
                  }
                >
                  <div style={{ width: '100%' }}>
                    <Tag color={e.supersededAt ? 'default' : 'green'}>{e.supersededAt ? '历史版本' : '当前版本'}</Tag>
                    {e.version}
                    <span style={{ color: '#888', marginLeft: 8 }}>生效日期 {new Date(e.effectiveDate).toLocaleDateString()}</span>
                    <div style={{ marginTop: 4 }}>
                      {(e.drills ?? []).map((d) => (
                        <Tag key={d.id} style={{ marginBottom: 4 }}>
                          {new Date(d.drilledAt).toLocaleDateString()} {d.scenario} ({d.outcome ?? '-'}) 下次到期{' '}
                          {new Date(d.nextDueDate).toLocaleDateString()}
                        </Tag>
                      ))}
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </Card>

          <Card
            title="安全绩效指标 SPI/SPT (3.2.2)"
            extra={
              <Button icon={<PlusOutlined />} onClick={() => setIndicatorModalOpen(true)}>
                新增指标
              </Button>
            }
            style={{ marginBottom: 16 }}
          >
            <Table<SafetyIndicatorWithStatus>
              rowKey="id"
              size="small"
              dataSource={indicators}
              pagination={false}
              columns={[
                { title: '指标名称', dataIndex: 'name' },
                {
                  title: '方向',
                  dataIndex: 'direction',
                  render: (v: SpiDirection) => (v === 'LOWER_IS_BETTER' ? '越低越好' : '越高越好'),
                },
                { title: '目标值 (SPT)', dataIndex: 'targetValue' },
                { title: '最新采集值', dataIndex: 'latestValue', render: (v?: number | null) => v ?? '-' },
                {
                  title: '状态',
                  render: (_, i) =>
                    i.latestValue == null ? (
                      <Tag>尚无采集值</Tag>
                    ) : (
                      <Tag color={i.breached ? 'red' : 'green'}>{i.breached ? '未达标' : '达标'}</Tag>
                    ),
                },
                {
                  title: '操作',
                  render: (_, i) => (
                    <Button size="small" onClick={() => setMeasurementModalIndicatorId(i.id)}>
                      录入采集值
                    </Button>
                  ),
                },
              ]}
            />
          </Card>

          <Card
            title="安全评审委员会 Safety Review Board (3.2.2, 复杂机构)"
            extra={
              <Button icon={<PlusOutlined />} onClick={() => setSrbModalOpen(true)}>
                新增会议
              </Button>
            }
          >
            <List
              size="small"
              dataSource={srbMeetings}
              locale={{ emptyText: '暂无会议记录' }}
              renderItem={(m) => (
                <List.Item
                  actions={[
                    <Button key="action" size="small" onClick={() => setSrbActionModalId(m.id)}>
                      添加行动项
                    </Button>,
                  ]}
                >
                  <div style={{ width: '100%' }}>
                    <span>
                      {new Date(m.meetingDate).toLocaleDateString()} - {m.agenda}
                    </span>
                    <Space wrap style={{ marginLeft: 8 }}>
                      {m.attendeeRoles.map((r) => (
                        <Tag key={r}>{r}</Tag>
                      ))}
                    </Space>
                    <div style={{ marginTop: 4 }}>
                      {(m.actions ?? []).map((a) => (
                        <Tag
                          key={a.id}
                          color={a.status === 'closed' ? 'default' : 'processing'}
                          onClick={() => a.status !== 'closed' && closeSrbAction(a.id)}
                          style={{ cursor: a.status !== 'closed' ? 'pointer' : 'default', marginBottom: 4 }}
                        >
                          {a.description} [{a.status === 'closed' ? '已关闭' : '点击关闭'}]
                        </Tag>
                      ))}
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </Card>

          <Card
            title="承包活动管理 Contracted Activities (3.2.5, ORA.GEN.205)"
            extra={
              <Button icon={<PlusOutlined />} onClick={() => setContractModalOpen(true)}>
                新增承包记录
              </Button>
            }
          >
            <List
              size="small"
              dataSource={contracts}
              locale={{ emptyText: '暂无承包记录' }}
              renderItem={(c) => (
                <List.Item
                  actions={[
                    <Button key="toggle" size="small" onClick={() => toggleContractAuditFlag(c)}>
                      {c.includedInAudit ? '移出审计计划' : '纳入审计计划'}
                    </Button>,
                  ]}
                >
                  <Space direction="vertical" size={0} style={{ width: '100%' }}>
                    <Space wrap>
                      <span style={{ fontWeight: 600 }}>{c.contractorName}</span>
                      <Tag color={c.includedInAudit ? 'green' : 'default'}>
                        {c.includedInAudit ? '已纳入审计计划' : '未纳入审计计划'}
                      </Tag>
                    </Space>
                    <span>{c.scope}</span>
                    {c.agreementRef && <span style={{ color: '#888', fontSize: 12 }}>协议编号: {c.agreementRef}</span>}
                  </Space>
                </List.Item>
              )}
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

      <Modal title="登记安全政策新版本" open={policyModalOpen} onOk={handleAddPolicy} onCancel={() => setPolicyModalOpen(false)}>
        <Form form={policyForm} layout="vertical" initialValues={{ effectiveDate: dayjs() }}>
          <Form.Item name="version" label="版本号" rules={[{ required: true }]}>
            <Input placeholder="如 v2.0" />
          </Form.Item>
          <Form.Item name="policyText" label="政策文本" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="effectiveDate" label="生效日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="签署安全政策 (须为负责人 Accountable Manager)"
        open={!!signPolicyModalId}
        onOk={handleSignPolicy}
        onCancel={() => setSignPolicyModalId(undefined)}
      >
        <Form form={signPolicyForm} layout="vertical">
          <Form.Item name="personnelId" label="签署人" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={personnel.map((p) => ({ value: p.id, label: `${p.lastName}${p.firstName}` }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="发起变更管理 (MOC)" open={mocModalOpen} onOk={handleCreateMoc} onCancel={() => setMocModalOpen(false)}>
        <Form form={mocForm} layout="vertical">
          <Form.Item name="changeDescription" label="变更描述" rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="如: 引进新型A320 FTD设备" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="关联变更前风险评估"
        open={!!mocRiskModalId}
        onOk={handleAttachMocRisk}
        onCancel={() => setMocRiskModalId(undefined)}
      >
        <Form form={mocRiskForm} layout="vertical">
          <Form.Item name="riskAssessmentId" label="风险评估" rules={[{ required: true }]}>
            <Select
              placeholder={allRiskAssessments.length === 0 ? '请先在风险管理中完成一次风险评估' : undefined}
              options={allRiskAssessments.map((r) => ({ value: r.id, label: r.label }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="标记MOC已实施"
        open={!!mocImplementModalId}
        onOk={handleImplementMoc}
        onCancel={() => setMocImplementModalId(undefined)}
      >
        <Form form={mocImplementForm} layout="vertical">
          <Form.Item name="implementationPlan" label="实施计划/说明" rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="MOC变更后验证" open={!!mocVerifyModalId} onOk={handleVerifyMoc} onCancel={() => setMocVerifyModalId(undefined)}>
        <Form form={mocVerifyForm} layout="vertical">
          <Form.Item name="verificationNotes" label="验证结论" rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="如: 已运行两周, 各项指标正常" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="登记应急响应计划新版本"
        open={erpModalOpen}
        onOk={handleAddErpPlan}
        onCancel={() => setErpModalOpen(false)}
      >
        <Form form={erpForm} layout="vertical" initialValues={{ effectiveDate: dayjs() }}>
          <Form.Item name="version" label="版本号" rules={[{ required: true }]}>
            <Input placeholder="如 v2.0" />
          </Form.Item>
          <Form.Item name="planText" label="预案文本" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="effectiveDate" label="生效日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="记录应急演练" open={!!drillModalErpId} onOk={handleRecordDrill} onCancel={() => setDrillModalErpId(undefined)}>
        <Form form={drillForm} layout="vertical" initialValues={{ drilledAt: dayjs() }}>
          <Form.Item name="drilledAt" label="演练日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="scenario" label="演练场景" rules={[{ required: true }]}>
            <Input placeholder="如: 火灾疏散演练" />
          </Form.Item>
          <Form.Item name="outcome" label="演练结果">
            <Input placeholder="如: 通过 / 发现问题" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新增安全绩效指标 (SPI/SPT)"
        open={indicatorModalOpen}
        onOk={handleCreateIndicator}
        onCancel={() => setIndicatorModalOpen(false)}
      >
        <Form form={indicatorForm} layout="vertical" initialValues={{ direction: 'LOWER_IS_BETTER' }}>
          <Form.Item name="name" label="指标名称" rules={[{ required: true }]}>
            <Input placeholder="如: 每千小时事件率" />
          </Form.Item>
          <Form.Item name="direction" label="方向" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'LOWER_IS_BETTER', label: '越低越好 (如事件率)' },
                { value: 'HIGHER_IS_BETTER', label: '越高越好 (如培训完成率)' },
              ]}
            />
          </Form.Item>
          <Form.Item name="targetValue" label="目标值 (SPT)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="指标说明">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="录入采集值"
        open={!!measurementModalIndicatorId}
        onOk={handleRecordMeasurement}
        onCancel={() => setMeasurementModalIndicatorId(undefined)}
      >
        <Form form={measurementForm} layout="vertical">
          <Form.Item name="range" label="统计周期" rules={[{ required: true }]}>
            <DatePicker.RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="value" label="采集值" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新增安全评审委员会会议"
        open={srbModalOpen}
        onOk={handleCreateSrbMeeting}
        onCancel={() => setSrbModalOpen(false)}
      >
        <Form form={srbForm} layout="vertical" initialValues={{ meetingDate: dayjs() }}>
          <Form.Item name="meetingDate" label="会议日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="attendeeRoles" label="参会角色" rules={[{ required: true }]}>
            <Select mode="multiple" options={ROLES.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="agenda" label="议题" rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="decisions" label="决议">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加行动项"
        open={!!srbActionModalId}
        onOk={handleAddSrbAction}
        onCancel={() => setSrbActionModalId(undefined)}
      >
        <Form form={srbActionForm} layout="vertical">
          <Form.Item name="description" label="行动描述" rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="dueDate" label="计划完成日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新增承包记录 (3.2.5)"
        open={contractModalOpen}
        onOk={handleCreateContract}
        onCancel={() => setContractModalOpen(false)}
      >
        <Form form={contractForm} layout="vertical">
          <Form.Item name="contractorName" label="承包方名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="scope" label="承包范围" rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="agreementRef" label="书面协议编号">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
