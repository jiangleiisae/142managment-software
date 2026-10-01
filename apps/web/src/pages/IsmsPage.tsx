import { PlusOutlined } from '@ant-design/icons'
import { Alert, App, Button, DatePicker, Empty, Form, Input, InputNumber, List, Modal, Select, Space, Table, Tag } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  InfoAssetCriticality,
  InformationAsset,
  InfoSecurityIncident,
  InfoSecurityRiskAssessment,
} from '../api/isms'
import { ismsApi } from '../api/isms'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'

const CRITICALITY_OPTIONS: InfoAssetCriticality[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const CRITICALITY_COLOR: Record<InfoAssetCriticality, string> = {
  LOW: 'default',
  MEDIUM: 'blue',
  HIGH: 'orange',
  CRITICAL: 'red',
}

const INCIDENT_STATUS_COLOR: Record<InfoSecurityIncident['status'], string> = {
  OPEN: 'red',
  CONTAINED: 'orange',
  RESOLVED: 'green',
}

function riskColor(score: number) {
  if (score >= 15) return 'red'
  if (score >= 8) return 'orange'
  return 'green'
}

/// 3.2.4 ISMS ((EU) 2023/203, 2026-02-22起适用): 信息资产清单/风险评估/事件响应, 独立于Part-ORA的SMS但复用同样的风险矩阵体验
export function IsmsPage() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { organizations, selectedId, select } = useSelectedOrganization()
  const [assets, setAssets] = useState<InformationAsset[]>([])
  const [incidents, setIncidents] = useState<InfoSecurityIncident[]>([])
  const [openHighRiskCount, setOpenHighRiskCount] = useState(0)
  const [openIncidentCount, setOpenIncidentCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const [assetModalOpen, setAssetModalOpen] = useState(false)
  const [riskModalAssetId, setRiskModalAssetId] = useState<string>()
  const [mitigationModalRiskId, setMitigationModalRiskId] = useState<string>()
  const [incidentModalOpen, setIncidentModalOpen] = useState(false)
  const [containModalIncidentId, setContainModalIncidentId] = useState<string>()

  const [assetForm] = Form.useForm()
  const [riskForm] = Form.useForm()
  const [mitigationForm] = Form.useForm()
  const [incidentForm] = Form.useForm()
  const [containForm] = Form.useForm()

  const load = async () => {
    if (!selectedId) return
    setLoading(true)
    try {
      setAssets(await ismsApi.listAssets(selectedId))
      setIncidents(await ismsApi.listIncidents(selectedId))
    } finally {
      setLoading(false)
    }
    ismsApi.listOpenHighRisks().then((r) => setOpenHighRiskCount(r.length))
    ismsApi.listOpenIncidents().then((i) => setOpenIncidentCount(i.length))
  }

  useEffect(() => {
    load()
  }, [selectedId])

  const handleCreateAsset = async () => {
    if (!selectedId) return
    const values = await assetForm.validateFields()
    await ismsApi.createAsset({ organizationId: selectedId, ...values })
    message.success(t('isms.assetCreated'))
    setAssetModalOpen(false)
    assetForm.resetFields()
    load()
  }

  const handleAssessRisk = async () => {
    if (!riskModalAssetId) return
    const values = await riskForm.validateFields()
    await ismsApi.assessRisk(riskModalAssetId, values)
    message.success(t('isms.riskAssessed'))
    setRiskModalAssetId(undefined)
    riskForm.resetFields()
    load()
  }

  const handleAddMitigation = async () => {
    if (!mitigationModalRiskId) return
    const values = await mitigationForm.validateFields()
    await ismsApi.addMitigationAction(mitigationModalRiskId, {
      ...values,
      dueDate: values.dueDate ? values.dueDate.format('YYYY-MM-DD') : undefined,
    })
    message.success(t('isms.mitigationAdded'))
    setMitigationModalRiskId(undefined)
    mitigationForm.resetFields()
    load()
  }

  const closeMitigation = async (id: string) => {
    await ismsApi.closeMitigationAction(id)
    message.success(t('isms.mitigationClosed'))
    load()
  }

  const handleReportIncident = async () => {
    if (!selectedId) return
    const values = await incidentForm.validateFields()
    await ismsApi.reportIncident({
      organizationId: selectedId,
      ...values,
      discoveredAt: values.discoveredAt.toISOString(),
    })
    message.success(t('isms.incidentReported'))
    setIncidentModalOpen(false)
    incidentForm.resetFields()
    load()
  }

  const handleContainIncident = async () => {
    if (!containModalIncidentId) return
    const values = await containForm.validateFields()
    try {
      await ismsApi.containIncident(containModalIncidentId, values.responseActions)
      message.success(t('isms.incidentContained'))
      setContainModalIncidentId(undefined)
      containForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('isms.operationFailed'))
    }
  }

  const resolveIncident = async (id: string) => {
    try {
      await ismsApi.resolveIncident(id)
      message.success(t('isms.incidentResolved'))
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('isms.resolveFailedMustContainFirst'))
    }
  }

  return (
    <div>
      <OrganizationSelector organizations={organizations} selectedId={selectedId} onChange={select} />

      {!selectedId ? (
        <Empty description={t('isms.selectOrgFirst')} />
      ) : (
        <>
          <Alert
            style={{ marginBottom: 16 }}
            type="info"
            showIcon
            message={t('isms.introMessage')}
            description={t('isms.introDescription')}
          />
          {openHighRiskCount > 0 && (
            <Alert
              style={{ marginBottom: 16 }}
              type="warning"
              showIcon
              message={t('isms.highRiskWarning', { count: openHighRiskCount })}
            />
          )}
          {openIncidentCount > 0 && (
            <Alert
              style={{ marginBottom: 16 }}
              type="error"
              showIcon
              message={t('isms.openIncidentWarning', { count: openIncidentCount })}
            />
          )}

          <Space style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAssetModalOpen(true)}>
              {t('isms.registerAsset')}
            </Button>
            <Button icon={<PlusOutlined />} onClick={() => setIncidentModalOpen(true)}>
              {t('isms.reportIncident')}
            </Button>
          </Space>

          <Table<InformationAsset>
            rowKey="id"
            loading={loading}
            dataSource={assets}
            title={() => t('isms.assetsTableTitle')}
            columns={[
              { title: t('isms.columnAssetName'), dataIndex: 'name' },
              { title: t('isms.columnCategory'), dataIndex: 'category' },
              {
                title: t('isms.columnCriticality'),
                dataIndex: 'criticality',
                render: (v: InfoAssetCriticality) => <Tag color={CRITICALITY_COLOR[v]}>{v}</Tag>,
              },
              {
                title: t('isms.columnActions'),
                render: (_, asset) => (
                  <Button size="small" onClick={() => setRiskModalAssetId(asset.id)}>
                    {t('isms.assessRisk')}
                  </Button>
                ),
              },
            ]}
            expandable={{
              expandedRowRender: (asset) => (
                <List
                  size="small"
                  dataSource={asset.riskAssessments ?? []}
                  locale={{ emptyText: t('isms.noRiskAssessments') }}
                  renderItem={(risk: InfoSecurityRiskAssessment) => (
                    <List.Item
                      actions={[
                        <Button key="add" size="small" onClick={() => setMitigationModalRiskId(risk.id)}>
                          {t('isms.addMitigation')}
                        </Button>,
                      ]}
                    >
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Tag color={riskColor(risk.riskScore)}>
                          {t('isms.riskScoreTag', { score: risk.riskScore, likelihood: risk.likelihoodLevel, impact: risk.impactLevel })}
                        </Tag>
                        <Space wrap>
                          {(risk.mitigations ?? []).map((m) => (
                            <Tag
                              key={m.id}
                              color={m.status === 'closed' ? 'default' : 'processing'}
                              onClick={() => m.status !== 'closed' && closeMitigation(m.id)}
                              style={{ cursor: m.status !== 'closed' ? 'pointer' : 'default' }}
                            >
                              {m.description} [{m.status === 'closed' ? t('isms.mitigationClosedTag') : t('isms.mitigationClickToClose')}]
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

          <Table<InfoSecurityIncident>
            rowKey="id"
            style={{ marginTop: 16 }}
            dataSource={incidents}
            title={() => t('isms.incidentsTableTitle')}
            columns={[
              { title: t('isms.columnDiscoveredAt'), dataIndex: 'discoveredAt', render: (v: string) => new Date(v).toLocaleString() },
              { title: t('isms.columnIncidentType'), dataIndex: 'incidentType' },
              { title: t('isms.columnDescription'), dataIndex: 'description' },
              { title: t('isms.columnSeverity'), dataIndex: 'severity', render: (v: number) => `${v}/5` },
              {
                title: t('isms.columnStatus'),
                dataIndex: 'status',
                render: (v: InfoSecurityIncident['status']) => <Tag color={INCIDENT_STATUS_COLOR[v]}>{v}</Tag>,
              },
              {
                title: t('isms.columnActions'),
                render: (_, incident) => (
                  <Space>
                    {incident.status === 'OPEN' && (
                      <Button size="small" onClick={() => setContainModalIncidentId(incident.id)}>
                        {t('isms.contain')}
                      </Button>
                    )}
                    {incident.status === 'CONTAINED' && (
                      <Button size="small" type="primary" onClick={() => resolveIncident(incident.id)}>
                        {t('isms.markResolved')}
                      </Button>
                    )}
                  </Space>
                ),
              },
            ]}
          />
        </>
      )}

      <Modal title={t('isms.assetModalTitle')} open={assetModalOpen} onOk={handleCreateAsset} onCancel={() => setAssetModalOpen(false)}>
        <Form form={assetForm} layout="vertical" initialValues={{ criticality: 'MEDIUM' }}>
          <Form.Item name="name" label={t('isms.fieldAssetName')} rules={[{ required: true }]}>
            <Input placeholder={t('isms.fieldAssetNamePlaceholder')} />
          </Form.Item>
          <Form.Item name="category" label={t('isms.fieldCategory')} rules={[{ required: true }]}>
            <Input placeholder={t('isms.fieldCategoryPlaceholder')} />
          </Form.Item>
          <Form.Item name="criticality" label={t('isms.fieldCriticality')} rules={[{ required: true }]}>
            <Select options={CRITICALITY_OPTIONS.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="description" label={t('isms.fieldDescription')}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('isms.riskModalTitle')}
        open={!!riskModalAssetId}
        onOk={handleAssessRisk}
        onCancel={() => setRiskModalAssetId(undefined)}
      >
        <Form form={riskForm} layout="vertical">
          <Form.Item name="likelihoodLevel" label={t('isms.fieldLikelihoodLevel')} rules={[{ required: true }]}>
            <InputNumber min={1} max={5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="impactLevel" label={t('isms.fieldImpactLevel')} rules={[{ required: true }]}>
            <InputNumber min={1} max={5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="existingControls" label={t('isms.fieldExistingControls')}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('isms.mitigationModalTitle')}
        open={!!mitigationModalRiskId}
        onOk={handleAddMitigation}
        onCancel={() => setMitigationModalRiskId(undefined)}
      >
        <Form form={mitigationForm} layout="vertical">
          <Form.Item name="description" label={t('isms.fieldMitigationDescription')} rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="dueDate" label={t('isms.fieldDueDate')}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('isms.incidentModalTitle')}
        open={incidentModalOpen}
        onOk={handleReportIncident}
        onCancel={() => setIncidentModalOpen(false)}
      >
        <Form form={incidentForm} layout="vertical" initialValues={{ discoveredAt: dayjs(), severity: 3 }}>
          <Form.Item name="incidentType" label={t('isms.fieldIncidentType')} rules={[{ required: true }]}>
            <Input placeholder={t('isms.fieldIncidentTypePlaceholder')} />
          </Form.Item>
          <Form.Item name="description" label={t('isms.fieldIncidentDescription')} rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="affectedAssetId" label={t('isms.fieldAffectedAsset')}>
            <Select
              allowClear
              options={assets.map((a) => ({ value: a.id, label: a.name }))}
            />
          </Form.Item>
          <Form.Item name="severity" label={t('isms.fieldSeverity')} rules={[{ required: true }]}>
            <InputNumber min={1} max={5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="discoveredAt" label={t('isms.fieldDiscoveredAt')} rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('isms.containModalTitle')}
        open={!!containModalIncidentId}
        onOk={handleContainIncident}
        onCancel={() => setContainModalIncidentId(undefined)}
      >
        <Form form={containForm} layout="vertical">
          <Form.Item name="responseActions" label={t('isms.fieldResponseActions')} rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder={t('isms.fieldResponseActionsPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
