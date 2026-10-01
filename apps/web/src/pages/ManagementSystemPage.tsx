import { PlusOutlined } from '@ant-design/icons'
import { Alert, App, Button, Card, DatePicker, Empty, Form, Input, InputNumber, List, Modal, Select, Space, Table, Tag } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const { message } = App.useApp()
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
    message.success(t('managementSystemPage.roleAssignSuccess'))
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
    message.success(t('managementSystemPage.occurrenceReportSuccess'))
    setOccurrenceModalOpen(false)
    occurrenceForm.resetFields()
    load()
  }

  const handleReportHazard = async () => {
    if (!selectedId) return
    const values = await hazardForm.validateFields()
    await managementSystemApi.reportHazard({ organizationId: selectedId, ...values })
    message.success(t('managementSystemPage.hazardReportSuccess'))
    setHazardModalOpen(false)
    hazardForm.resetFields()
    load()
  }

  const handleAssessRisk = async () => {
    if (!riskModalHazardId) return
    const values = await riskForm.validateFields()
    await managementSystemApi.assessRisk(riskModalHazardId, values)
    message.success(t('managementSystemPage.riskAssessSuccess'))
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
    message.success(t('managementSystemPage.mitigationAddSuccess'))
    setMitigationModalRiskId(undefined)
    mitigationForm.resetFields()
    load()
  }

  const closeMitigation = async (id: string) => {
    await managementSystemApi.closeMitigationAction(id)
    message.success(t('managementSystemPage.mitigationCloseSuccess'))
    load()
  }

  const allRiskAssessments = hazards.flatMap((h) =>
    (h.riskAssessments ?? []).map((r) => ({
      id: r.id,
      label: t('managementSystemPage.riskAssessmentOptionLabel', { description: h.description, score: r.riskScore }),
    })),
  )

  const handleAddPolicy = async () => {
    if (!selectedId) return
    const values = await policyForm.validateFields()
    await managementSystemApi.addSafetyPolicy({
      organizationId: selectedId,
      ...values,
      effectiveDate: values.effectiveDate.format('YYYY-MM-DD'),
    })
    message.success(t('managementSystemPage.policyAddSuccess'))
    setPolicyModalOpen(false)
    policyForm.resetFields()
    load()
  }

  const handleSignPolicy = async () => {
    if (!signPolicyModalId) return
    const values = await signPolicyForm.validateFields()
    try {
      await managementSystemApi.signSafetyPolicy(signPolicyModalId, values.personnelId)
      message.success(t('managementSystemPage.policySignSuccess'))
      setSignPolicyModalId(undefined)
      signPolicyForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('managementSystemPage.policySignFailed'))
    }
  }

  const handleCreateMoc = async () => {
    if (!selectedId) return
    const values = await mocForm.validateFields()
    await managementSystemApi.createMoc({ organizationId: selectedId, ...values })
    message.success(t('managementSystemPage.mocCreateSuccess'))
    setMocModalOpen(false)
    mocForm.resetFields()
    load()
  }

  const handleAttachMocRisk = async () => {
    if (!mocRiskModalId) return
    const values = await mocRiskForm.validateFields()
    try {
      await managementSystemApi.attachRiskAssessmentToMoc(mocRiskModalId, values.riskAssessmentId)
      message.success(t('managementSystemPage.mocAttachRiskSuccess'))
      setMocRiskModalId(undefined)
      mocRiskForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('managementSystemPage.operationFailed'))
    }
  }

  const handleImplementMoc = async () => {
    if (!mocImplementModalId) return
    const values = await mocImplementForm.validateFields()
    try {
      await managementSystemApi.implementMoc(mocImplementModalId, values.implementationPlan)
      message.success(t('managementSystemPage.mocImplementSuccess'))
      setMocImplementModalId(undefined)
      mocImplementForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('managementSystemPage.operationFailed'))
    }
  }

  const handleVerifyMoc = async () => {
    if (!mocVerifyModalId) return
    const values = await mocVerifyForm.validateFields()
    try {
      await managementSystemApi.verifyMoc(mocVerifyModalId, values.verificationNotes)
      message.success(t('managementSystemPage.mocVerifySuccess'))
      setMocVerifyModalId(undefined)
      mocVerifyForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('managementSystemPage.operationFailed'))
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
    message.success(t('managementSystemPage.erpAddSuccess'))
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
    message.success(t('managementSystemPage.drillRecordSuccess'))
    setDrillModalErpId(undefined)
    drillForm.resetFields()
    load()
  }

  const handleCreateIndicator = async () => {
    if (!selectedId) return
    const values = await indicatorForm.validateFields()
    await managementSystemApi.createIndicator({ organizationId: selectedId, ...values })
    message.success(t('managementSystemPage.indicatorCreateSuccess'))
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
    message.success(t('managementSystemPage.measurementRecordSuccess'))
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
    message.success(t('managementSystemPage.srbCreateSuccess'))
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
    message.success(t('managementSystemPage.srbActionAddSuccess'))
    setSrbActionModalId(undefined)
    srbActionForm.resetFields()
    load()
  }

  const closeSrbAction = async (id: string) => {
    await managementSystemApi.closeSrbAction(id)
    message.success(t('managementSystemPage.srbActionCloseSuccess'))
    load()
  }

  const handleCreateContract = async () => {
    if (!selectedId) return
    const values = await contractForm.validateFields()
    await managementSystemApi.createContract({ organizationId: selectedId, ...values })
    message.success(t('managementSystemPage.contractCreateSuccess'))
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
        title={t('managementSystemPage.retentionCardTitle')}
        style={{ marginBottom: 16 }}
      >
        <p style={{ color: '#888' }}>{t('managementSystemPage.retentionCardNote')}</p>
        <Table<RetentionStatusItem>
          rowKey="documentType"
          size="small"
          dataSource={retentionStatus}
          pagination={false}
          columns={[
            {
              title: t('managementSystemPage.columnDocumentType'),
              dataIndex: 'documentType',
              render: (v: string) => t(`managementSystemPage.documentTypes.${v}`, { defaultValue: v }),
            },
            { title: t('managementSystemPage.columnBasisRegulation'), dataIndex: 'basisRegulation' },
            {
              title: t('managementSystemPage.columnRetentionPeriod'),
              dataIndex: 'retentionMonths',
              render: (v?: number | null) =>
                v == null ? t('managementSystemPage.retentionLifetime') : t('managementSystemPage.retentionYears', { years: (v / 12).toFixed(1) }),
            },
            { title: t('managementSystemPage.columnTotalCount'), dataIndex: 'totalCount' },
            {
              title: t('managementSystemPage.columnProtectedCount'),
              dataIndex: 'protectedCount',
              render: (v: number) => <Tag color={v > 0 ? 'blue' : 'default'}>{v}</Tag>,
            },
            {
              title: t('managementSystemPage.columnEligibleCount'),
              dataIndex: 'eligibleForArchivalCount',
              render: (v: number) => <Tag color={v > 0 ? 'orange' : 'default'}>{v}</Tag>,
            },
          ]}
        />
      </Card>

      {!selectedId ? (
        <Empty description={t('managementSystemPage.selectOrgFirst')} />
      ) : (
        <>
          {overdueOccurrences.length > 0 && (
            <Alert
              style={{ marginBottom: 16 }}
              type="error"
              showIcon
              message={t('managementSystemPage.overdueOccurrenceWarning', { count: overdueOccurrences.length })}
            />
          )}
          {openHighRiskCount > 0 && (
            <Alert
              style={{ marginBottom: 16 }}
              type="warning"
              showIcon
              message={t('managementSystemPage.highRiskWarning', { count: openHighRiskCount })}
            />
          )}
          {erpDrillsDueSoon.length > 0 && (
            <Alert
              style={{ marginBottom: 16 }}
              type="warning"
              showIcon
              message={t('managementSystemPage.erpDrillsDueSoonWarning', { count: erpDrillsDueSoon.length })}
              description={erpDrillsDueSoon.map((d) => d.organizationName).join('、')}
            />
          )}
          {indicators.some((i) => i.breached) && (
            <Alert
              style={{ marginBottom: 16 }}
              type="error"
              showIcon
              message={t('managementSystemPage.spiBreachedWarning', { count: indicators.filter((i) => i.breached).length })}
              description={indicators
                .filter((i) => i.breached)
                .map((i) => t('managementSystemPage.spiBreachedItem', { name: i.name, latest: i.latestValue, target: i.targetValue }))
                .join('; ')}
            />
          )}

          <Card
            title={t('managementSystemPage.roleAssignmentsCardTitle')}
            extra={
              <Button icon={<PlusOutlined />} onClick={() => setRoleModalOpen(true)}>
                {t('managementSystemPage.assignRole')}
              </Button>
            }
            style={{ marginBottom: 16 }}
          >
            <Table<RoleAssignment>
              rowKey="id"
              dataSource={roleAssignments}
              columns={[
                { title: t('managementSystemPage.columnRole'), dataIndex: 'role', render: (v: string) => <Tag color="blue">{v}</Tag> },
                {
                  title: t('managementSystemPage.columnPersonnel'),
                  dataIndex: 'personnel',
                  render: (p: RoleAssignment['personnel']) => (p ? `${p.lastName}${p.firstName}` : '-'),
                },
                { title: t('managementSystemPage.columnStartDate'), dataIndex: 'startDate', render: (v: string) => new Date(v).toLocaleDateString() },
              ]}
            />
          </Card>

          <Card
            title={t('managementSystemPage.occurrenceCardTitle')}
            extra={
              <Button icon={<PlusOutlined />} onClick={() => setOccurrenceModalOpen(true)}>
                {t('managementSystemPage.reportOccurrence')}
              </Button>
            }
            style={{ marginBottom: 16 }}
          >
            <p style={{ color: '#888' }}>{t('managementSystemPage.occurrenceCardNote')}</p>
          </Card>

          <Card
            title={t('managementSystemPage.riskCardTitle')}
            extra={
              <Button icon={<PlusOutlined />} onClick={() => setHazardModalOpen(true)}>
                {t('managementSystemPage.reportHazard')}
              </Button>
            }
          >
            <Table<HazardRegisterEntry>
              rowKey="id"
              dataSource={hazards}
              columns={[
                { title: t('managementSystemPage.columnSource'), dataIndex: 'source' },
                { title: t('managementSystemPage.columnHazardDescription'), dataIndex: 'description' },
                { title: t('managementSystemPage.columnAffectedArea'), dataIndex: 'affectedArea' },
                {
                  title: t('managementSystemPage.columnActions'),
                  render: (_, hazard) => (
                    <Button size="small" onClick={() => setRiskModalHazardId(hazard.id)}>
                      {t('managementSystemPage.assessRisk')}
                    </Button>
                  ),
                },
              ]}
              expandable={{
                expandedRowRender: (hazard) => (
                  <List
                    size="small"
                    dataSource={hazard.riskAssessments ?? []}
                    locale={{ emptyText: t('managementSystemPage.noRiskAssessments') }}
                    renderItem={(risk) => (
                      <List.Item
                        actions={[
                          <Button key="add" size="small" onClick={() => setMitigationModalRiskId(risk.id)}>
                            {t('managementSystemPage.addMitigation')}
                          </Button>,
                        ]}
                      >
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <Space>
                            <Tag color={riskColor(risk.riskScore)}>
                              {t('managementSystemPage.riskScoreTag', { score: risk.riskScore, probability: risk.probabilityLevel, severity: risk.severityLevel })}
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
                                {m.description} [{m.status === 'closed' ? t('managementSystemPage.mitigationClosedTag') : t('managementSystemPage.mitigationClickToClose')}]
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
            title={t('managementSystemPage.policyCardTitle')}
            extra={
              <Button icon={<PlusOutlined />} onClick={() => setPolicyModalOpen(true)}>
                {t('managementSystemPage.registerNewVersion')}
              </Button>
            }
            style={{ marginTop: 16, marginBottom: 16 }}
          >
            <List
              size="small"
              dataSource={safetyPolicies}
              locale={{ emptyText: t('managementSystemPage.noPolicies') }}
              renderItem={(p) => (
                <List.Item
                  actions={
                    !p.signedAt
                      ? [
                          <Button key="sign" size="small" onClick={() => setSignPolicyModalId(p.id)}>
                            {t('managementSystemPage.sign')}
                          </Button>,
                        ]
                      : []
                  }
                >
                  <Tag color={p.supersededAt ? 'default' : 'green'}>
                    {p.supersededAt ? t('managementSystemPage.historicalVersionTag') : t('managementSystemPage.currentVersionTag')}
                  </Tag>
                  {p.version}
                  <Tag color={p.signedAt ? 'blue' : 'orange'} style={{ marginLeft: 8 }}>
                    {p.signedAt
                      ? t('managementSystemPage.signedByAccountableManager', { date: new Date(p.signedAt).toLocaleDateString() })
                      : t('managementSystemPage.pendingSignature')}
                  </Tag>
                  <span style={{ color: '#888', marginLeft: 8 }}>
                    {t('managementSystemPage.effectiveDateLabel', { date: new Date(p.effectiveDate).toLocaleDateString() })}
                  </span>
                </List.Item>
              )}
            />
          </Card>

          <Card
            title={t('managementSystemPage.mocCardTitle')}
            extra={
              <Button icon={<PlusOutlined />} onClick={() => setMocModalOpen(true)}>
                {t('managementSystemPage.initiateChange')}
              </Button>
            }
            style={{ marginBottom: 16 }}
          >
            <List
              size="small"
              dataSource={mocs}
              locale={{ emptyText: t('managementSystemPage.noMocRecords') }}
              renderItem={(m) => (
                <List.Item
                  actions={[
                    m.status === 'DRAFT' && (
                      <Button key="risk" size="small" onClick={() => setMocRiskModalId(m.id)}>
                        {t('managementSystemPage.attachRiskAssessment')}
                      </Button>
                    ),
                    m.status === 'RISK_ASSESSED' && (
                      <Button key="impl" size="small" type="primary" onClick={() => setMocImplementModalId(m.id)}>
                        {t('managementSystemPage.markImplemented')}
                      </Button>
                    ),
                    m.status === 'IMPLEMENTED' && (
                      <Button key="verify" size="small" type="primary" onClick={() => setMocVerifyModalId(m.id)}>
                        {t('managementSystemPage.verifyAfterChange')}
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
            title={t('managementSystemPage.erpCardTitle')}
            extra={
              <Button icon={<PlusOutlined />} onClick={() => setErpModalOpen(true)}>
                {t('managementSystemPage.registerNewVersion')}
              </Button>
            }
            style={{ marginBottom: 16 }}
          >
            <List
              size="small"
              dataSource={erpPlans}
              locale={{ emptyText: t('managementSystemPage.noErpPlans') }}
              renderItem={(e) => (
                <List.Item
                  actions={
                    !e.supersededAt
                      ? [
                          <Button key="drill" size="small" onClick={() => setDrillModalErpId(e.id)}>
                            {t('managementSystemPage.recordDrill')}
                          </Button>,
                        ]
                      : []
                  }
                >
                  <div style={{ width: '100%' }}>
                    <Tag color={e.supersededAt ? 'default' : 'green'}>
                      {e.supersededAt ? t('managementSystemPage.historicalVersionTag') : t('managementSystemPage.currentVersionTag')}
                    </Tag>
                    {e.version}
                    <span style={{ color: '#888', marginLeft: 8 }}>
                      {t('managementSystemPage.effectiveDateLabel', { date: new Date(e.effectiveDate).toLocaleDateString() })}
                    </span>
                    <div style={{ marginTop: 4 }}>
                      {(e.drills ?? []).map((d) => (
                        <Tag key={d.id} style={{ marginBottom: 4 }}>
                          {t('managementSystemPage.drillTag', {
                            date: new Date(d.drilledAt).toLocaleDateString(),
                            scenario: d.scenario,
                            outcome: d.outcome ?? '-',
                            nextDue: new Date(d.nextDueDate).toLocaleDateString(),
                          })}
                        </Tag>
                      ))}
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </Card>

          <Card
            title={t('managementSystemPage.spiCardTitle')}
            extra={
              <Button icon={<PlusOutlined />} onClick={() => setIndicatorModalOpen(true)}>
                {t('managementSystemPage.addIndicator')}
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
                { title: t('managementSystemPage.columnIndicatorName'), dataIndex: 'name' },
                {
                  title: t('managementSystemPage.columnDirection'),
                  dataIndex: 'direction',
                  render: (v: SpiDirection) =>
                    v === 'LOWER_IS_BETTER' ? t('managementSystemPage.directionLowerIsBetter') : t('managementSystemPage.directionHigherIsBetter'),
                },
                { title: t('managementSystemPage.columnTargetValue'), dataIndex: 'targetValue' },
                { title: t('managementSystemPage.columnLatestValue'), dataIndex: 'latestValue', render: (v?: number | null) => v ?? '-' },
                {
                  title: t('managementSystemPage.columnStatus'),
                  render: (_, i) =>
                    i.latestValue == null ? (
                      <Tag>{t('managementSystemPage.noMeasurementsYet')}</Tag>
                    ) : (
                      <Tag color={i.breached ? 'red' : 'green'}>{i.breached ? t('managementSystemPage.breachedTag') : t('managementSystemPage.metTag')}</Tag>
                    ),
                },
                {
                  title: t('managementSystemPage.columnActions'),
                  render: (_, i) => (
                    <Button size="small" onClick={() => setMeasurementModalIndicatorId(i.id)}>
                      {t('managementSystemPage.recordMeasurement')}
                    </Button>
                  ),
                },
              ]}
            />
          </Card>

          <Card
            title={t('managementSystemPage.srbCardTitle')}
            extra={
              <Button icon={<PlusOutlined />} onClick={() => setSrbModalOpen(true)}>
                {t('managementSystemPage.addMeeting')}
              </Button>
            }
          >
            <List
              size="small"
              dataSource={srbMeetings}
              locale={{ emptyText: t('managementSystemPage.noMeetings') }}
              renderItem={(m) => (
                <List.Item
                  actions={[
                    <Button key="action" size="small" onClick={() => setSrbActionModalId(m.id)}>
                      {t('managementSystemPage.addActionItem')}
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
                          {a.description} [{a.status === 'closed' ? t('managementSystemPage.actionClosedTag') : t('managementSystemPage.actionClickToClose')}]
                        </Tag>
                      ))}
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </Card>

          <Card
            title={t('managementSystemPage.contractCardTitle')}
            extra={
              <Button icon={<PlusOutlined />} onClick={() => setContractModalOpen(true)}>
                {t('managementSystemPage.addContract')}
              </Button>
            }
          >
            <List
              size="small"
              dataSource={contracts}
              locale={{ emptyText: t('managementSystemPage.noContracts') }}
              renderItem={(c) => (
                <List.Item
                  actions={[
                    <Button key="toggle" size="small" onClick={() => toggleContractAuditFlag(c)}>
                      {c.includedInAudit ? t('managementSystemPage.removeFromAudit') : t('managementSystemPage.includeInAudit')}
                    </Button>,
                  ]}
                >
                  <Space direction="vertical" size={0} style={{ width: '100%' }}>
                    <Space wrap>
                      <span style={{ fontWeight: 600 }}>{c.contractorName}</span>
                      <Tag color={c.includedInAudit ? 'green' : 'default'}>
                        {c.includedInAudit ? t('managementSystemPage.includedInAuditTag') : t('managementSystemPage.notIncludedInAuditTag')}
                      </Tag>
                    </Space>
                    <span>{c.scope}</span>
                    {c.agreementRef && (
                      <span style={{ color: '#888', fontSize: 12 }}>{t('managementSystemPage.agreementRefLabel', { ref: c.agreementRef })}</span>
                    )}
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </>
      )}

      <Modal title={t('managementSystemPage.assignRoleModalTitle')} open={roleModalOpen} onOk={handleAssignRole} onCancel={() => setRoleModalOpen(false)}>
        <Form form={roleForm} layout="vertical">
          <Form.Item name="role" label={t('managementSystemPage.fieldRole')} rules={[{ required: true }]}>
            <Select options={ROLES.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="personnelId" label={t('managementSystemPage.fieldPersonnel')} rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={personnel.map((p) => ({ value: p.id, label: `${p.lastName}${p.firstName}` }))}
            />
          </Form.Item>
          <Form.Item name="startDate" label={t('managementSystemPage.fieldStartDate')} rules={[{ required: true }]} initialValue={dayjs()}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('managementSystemPage.reportOccurrenceModalTitle')}
        open={occurrenceModalOpen}
        onOk={handleReportOccurrence}
        onCancel={() => setOccurrenceModalOpen(false)}
      >
        <Form form={occurrenceForm} layout="vertical" initialValues={{ discoveredAt: dayjs(), isMandatory: true }}>
          <Form.Item name="occurrenceType" label={t('managementSystemPage.fieldOccurrenceType')} rules={[{ required: true }]}>
            <Input placeholder={t('managementSystemPage.fieldOccurrenceTypePlaceholder')} />
          </Form.Item>
          <Form.Item name="discoveredAt" label={t('managementSystemPage.fieldDiscoveredAt')} rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('managementSystemPage.reportHazardModalTitle')} open={hazardModalOpen} onOk={handleReportHazard} onCancel={() => setHazardModalOpen(false)}>
        <Form form={hazardForm} layout="vertical" initialValues={{ source: 'internal_report' }}>
          <Form.Item name="source" label={t('managementSystemPage.fieldSource')} rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'internal_report', label: t('managementSystemPage.sourceInternalReport') },
                { value: 'audit', label: t('managementSystemPage.sourceAudit') },
                { value: 'occurrence', label: t('managementSystemPage.sourceOccurrence') },
              ]}
            />
          </Form.Item>
          <Form.Item name="description" label={t('managementSystemPage.fieldHazardDescription')} rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="affectedArea" label={t('managementSystemPage.fieldAffectedArea')}>
            <Input placeholder={t('managementSystemPage.fieldAffectedAreaPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('managementSystemPage.riskModalTitle')}
        open={!!riskModalHazardId}
        onOk={handleAssessRisk}
        onCancel={() => setRiskModalHazardId(undefined)}
      >
        <Form form={riskForm} layout="vertical">
          <Form.Item name="probabilityLevel" label={t('managementSystemPage.fieldProbabilityLevel')} rules={[{ required: true }]}>
            <InputNumber min={1} max={5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="severityLevel" label={t('managementSystemPage.fieldSeverityLevel')} rules={[{ required: true }]}>
            <InputNumber min={1} max={5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="existingMitigation" label={t('managementSystemPage.fieldExistingMitigation')}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('managementSystemPage.mitigationModalTitle')}
        open={!!mitigationModalRiskId}
        onOk={handleAddMitigation}
        onCancel={() => setMitigationModalRiskId(undefined)}
      >
        <Form form={mitigationForm} layout="vertical">
          <Form.Item name="description" label={t('managementSystemPage.fieldMitigationDescription')} rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="dueDate" label={t('managementSystemPage.fieldDueDate')}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('managementSystemPage.policyModalTitle')} open={policyModalOpen} onOk={handleAddPolicy} onCancel={() => setPolicyModalOpen(false)}>
        <Form form={policyForm} layout="vertical" initialValues={{ effectiveDate: dayjs() }}>
          <Form.Item name="version" label={t('managementSystemPage.fieldVersion')} rules={[{ required: true }]}>
            <Input placeholder={t('managementSystemPage.fieldVersionPlaceholder')} />
          </Form.Item>
          <Form.Item name="policyText" label={t('managementSystemPage.fieldPolicyText')} rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="effectiveDate" label={t('managementSystemPage.fieldEffectiveDate')} rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('managementSystemPage.signPolicyModalTitle')}
        open={!!signPolicyModalId}
        onOk={handleSignPolicy}
        onCancel={() => setSignPolicyModalId(undefined)}
      >
        <Form form={signPolicyForm} layout="vertical">
          <Form.Item name="personnelId" label={t('managementSystemPage.fieldSigner')} rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={personnel.map((p) => ({ value: p.id, label: `${p.lastName}${p.firstName}` }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('managementSystemPage.mocModalTitle')} open={mocModalOpen} onOk={handleCreateMoc} onCancel={() => setMocModalOpen(false)}>
        <Form form={mocForm} layout="vertical">
          <Form.Item name="changeDescription" label={t('managementSystemPage.fieldChangeDescription')} rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder={t('managementSystemPage.fieldChangeDescriptionPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('managementSystemPage.attachMocRiskModalTitle')}
        open={!!mocRiskModalId}
        onOk={handleAttachMocRisk}
        onCancel={() => setMocRiskModalId(undefined)}
      >
        <Form form={mocRiskForm} layout="vertical">
          <Form.Item name="riskAssessmentId" label={t('managementSystemPage.fieldRiskAssessment')} rules={[{ required: true }]}>
            <Select
              placeholder={allRiskAssessments.length === 0 ? t('managementSystemPage.fieldRiskAssessmentPlaceholder') : undefined}
              options={allRiskAssessments.map((r) => ({ value: r.id, label: r.label }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('managementSystemPage.implementMocModalTitle')}
        open={!!mocImplementModalId}
        onOk={handleImplementMoc}
        onCancel={() => setMocImplementModalId(undefined)}
      >
        <Form form={mocImplementForm} layout="vertical">
          <Form.Item name="implementationPlan" label={t('managementSystemPage.fieldImplementationPlan')} rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('managementSystemPage.verifyMocModalTitle')} open={!!mocVerifyModalId} onOk={handleVerifyMoc} onCancel={() => setMocVerifyModalId(undefined)}>
        <Form form={mocVerifyForm} layout="vertical">
          <Form.Item name="verificationNotes" label={t('managementSystemPage.fieldVerificationNotes')} rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder={t('managementSystemPage.fieldVerificationNotesPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('managementSystemPage.erpModalTitle')}
        open={erpModalOpen}
        onOk={handleAddErpPlan}
        onCancel={() => setErpModalOpen(false)}
      >
        <Form form={erpForm} layout="vertical" initialValues={{ effectiveDate: dayjs() }}>
          <Form.Item name="version" label={t('managementSystemPage.fieldVersion')} rules={[{ required: true }]}>
            <Input placeholder={t('managementSystemPage.fieldVersionPlaceholder')} />
          </Form.Item>
          <Form.Item name="planText" label={t('managementSystemPage.fieldPlanText')} rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="effectiveDate" label={t('managementSystemPage.fieldEffectiveDate')} rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('managementSystemPage.drillModalTitle')} open={!!drillModalErpId} onOk={handleRecordDrill} onCancel={() => setDrillModalErpId(undefined)}>
        <Form form={drillForm} layout="vertical" initialValues={{ drilledAt: dayjs() }}>
          <Form.Item name="drilledAt" label={t('managementSystemPage.fieldDrilledAt')} rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="scenario" label={t('managementSystemPage.fieldScenario')} rules={[{ required: true }]}>
            <Input placeholder={t('managementSystemPage.fieldScenarioPlaceholder')} />
          </Form.Item>
          <Form.Item name="outcome" label={t('managementSystemPage.fieldOutcome')}>
            <Input placeholder={t('managementSystemPage.fieldOutcomePlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('managementSystemPage.indicatorModalTitle')}
        open={indicatorModalOpen}
        onOk={handleCreateIndicator}
        onCancel={() => setIndicatorModalOpen(false)}
      >
        <Form form={indicatorForm} layout="vertical" initialValues={{ direction: 'LOWER_IS_BETTER' }}>
          <Form.Item name="name" label={t('managementSystemPage.fieldIndicatorName')} rules={[{ required: true }]}>
            <Input placeholder={t('managementSystemPage.fieldIndicatorNamePlaceholder')} />
          </Form.Item>
          <Form.Item name="direction" label={t('managementSystemPage.fieldDirection')} rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'LOWER_IS_BETTER', label: t('managementSystemPage.directionLowerOption') },
                { value: 'HIGHER_IS_BETTER', label: t('managementSystemPage.directionHigherOption') },
              ]}
            />
          </Form.Item>
          <Form.Item name="targetValue" label={t('managementSystemPage.fieldTargetValue')} rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label={t('managementSystemPage.fieldIndicatorDescription')}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('managementSystemPage.measurementModalTitle')}
        open={!!measurementModalIndicatorId}
        onOk={handleRecordMeasurement}
        onCancel={() => setMeasurementModalIndicatorId(undefined)}
      >
        <Form form={measurementForm} layout="vertical">
          <Form.Item name="range" label={t('managementSystemPage.fieldPeriod')} rules={[{ required: true }]}>
            <DatePicker.RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="value" label={t('managementSystemPage.fieldMeasurementValue')} rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('managementSystemPage.srbModalTitle')}
        open={srbModalOpen}
        onOk={handleCreateSrbMeeting}
        onCancel={() => setSrbModalOpen(false)}
      >
        <Form form={srbForm} layout="vertical" initialValues={{ meetingDate: dayjs() }}>
          <Form.Item name="meetingDate" label={t('managementSystemPage.fieldMeetingDate')} rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="attendeeRoles" label={t('managementSystemPage.fieldAttendeeRoles')} rules={[{ required: true }]}>
            <Select mode="multiple" options={ROLES.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="agenda" label={t('managementSystemPage.fieldAgenda')} rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="decisions" label={t('managementSystemPage.fieldDecisions')}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('managementSystemPage.srbActionModalTitle')}
        open={!!srbActionModalId}
        onOk={handleAddSrbAction}
        onCancel={() => setSrbActionModalId(undefined)}
      >
        <Form form={srbActionForm} layout="vertical">
          <Form.Item name="description" label={t('managementSystemPage.fieldActionDescription')} rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="dueDate" label={t('managementSystemPage.fieldDueDate')}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('managementSystemPage.contractModalTitle')}
        open={contractModalOpen}
        onOk={handleCreateContract}
        onCancel={() => setContractModalOpen(false)}
      >
        <Form form={contractForm} layout="vertical">
          <Form.Item name="contractorName" label={t('managementSystemPage.fieldContractorName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="scope" label={t('managementSystemPage.fieldScope')} rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="agreementRef" label={t('managementSystemPage.fieldAgreementRef')}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
