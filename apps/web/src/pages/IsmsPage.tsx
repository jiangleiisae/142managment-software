import { PlusOutlined } from '@ant-design/icons'
import { Alert, App, Button, DatePicker, Empty, Form, Input, InputNumber, List, Modal, Select, Space, Table, Tag } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
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
    message.success('信息资产已登记')
    setAssetModalOpen(false)
    assetForm.resetFields()
    load()
  }

  const handleAssessRisk = async () => {
    if (!riskModalAssetId) return
    const values = await riskForm.validateFields()
    await ismsApi.assessRisk(riskModalAssetId, values)
    message.success('风险评估已提交')
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
    message.success('缓解措施已添加')
    setMitigationModalRiskId(undefined)
    mitigationForm.resetFields()
    load()
  }

  const closeMitigation = async (id: string) => {
    await ismsApi.closeMitigationAction(id)
    message.success('缓解措施已关闭')
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
    message.success('信息安全事件已登记')
    setIncidentModalOpen(false)
    incidentForm.resetFields()
    load()
  }

  const handleContainIncident = async () => {
    if (!containModalIncidentId) return
    const values = await containForm.validateFields()
    try {
      await ismsApi.containIncident(containModalIncidentId, values.responseActions)
      message.success('事件已遏制')
      setContainModalIncidentId(undefined)
      containForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '操作失败')
    }
  }

  const resolveIncident = async (id: string) => {
    try {
      await ismsApi.resolveIncident(id)
      message.success('事件已解决')
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '操作失败, 须先完成遏制')
    }
  }

  return (
    <div>
      <OrganizationSelector organizations={organizations} selectedId={selectedId} onChange={select} />

      {!selectedId ? (
        <Empty description="请先创建并选择一个机构" />
      ) : (
        <>
          <Alert
            style={{ marginBottom: 16 }}
            type="info"
            showIcon
            message="信息安全管理体系 ISMS ((EU) 2023/203, 2026-02-22起适用)"
            description="独立于Part-ORA的SMS/合规监督体系, 管理可能影响航空训练安全的信息安全风险: 信息资产清单 → 风险评估 → 事件响应。"
          />
          {openHighRiskCount > 0 && (
            <Alert
              style={{ marginBottom: 16 }}
              type="warning"
              showIcon
              message={`有 ${openHighRiskCount} 项高危信息安全风险(评分≥12)尚未完成缓解措施`}
            />
          )}
          {openIncidentCount > 0 && (
            <Alert
              style={{ marginBottom: 16 }}
              type="error"
              showIcon
              message={`有 ${openIncidentCount} 起信息安全事件尚未解决 (OPEN/CONTAINED)`}
            />
          )}

          <Space style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAssetModalOpen(true)}>
              登记信息资产
            </Button>
            <Button icon={<PlusOutlined />} onClick={() => setIncidentModalOpen(true)}>
              登记安全事件
            </Button>
          </Space>

          <Table<InformationAsset>
            rowKey="id"
            loading={loading}
            dataSource={assets}
            title={() => '信息资产清单'}
            columns={[
              { title: '资产名称', dataIndex: 'name' },
              { title: '类别', dataIndex: 'category' },
              {
                title: '关键程度',
                dataIndex: 'criticality',
                render: (v: InfoAssetCriticality) => <Tag color={CRITICALITY_COLOR[v]}>{v}</Tag>,
              },
              {
                title: '操作',
                render: (_, asset) => (
                  <Button size="small" onClick={() => setRiskModalAssetId(asset.id)}>
                    做风险评估
                  </Button>
                ),
              },
            ]}
            expandable={{
              expandedRowRender: (asset) => (
                <List
                  size="small"
                  dataSource={asset.riskAssessments ?? []}
                  locale={{ emptyText: '尚未做风险评估' }}
                  renderItem={(risk: InfoSecurityRiskAssessment) => (
                    <List.Item
                      actions={[
                        <Button key="add" size="small" onClick={() => setMitigationModalRiskId(risk.id)}>
                          添加缓解措施
                        </Button>,
                      ]}
                    >
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Tag color={riskColor(risk.riskScore)}>
                          风险评分 {risk.riskScore} (可能性{risk.likelihoodLevel} × 影响{risk.impactLevel})
                        </Tag>
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

          <Table<InfoSecurityIncident>
            rowKey="id"
            style={{ marginTop: 16 }}
            dataSource={incidents}
            title={() => '信息安全事件响应 (OPEN → CONTAINED → RESOLVED)'}
            columns={[
              { title: '发现时间', dataIndex: 'discoveredAt', render: (v: string) => new Date(v).toLocaleString() },
              { title: '事件类型', dataIndex: 'incidentType' },
              { title: '描述', dataIndex: 'description' },
              { title: '严重度', dataIndex: 'severity', render: (v: number) => `${v}/5` },
              {
                title: '状态',
                dataIndex: 'status',
                render: (v: InfoSecurityIncident['status']) => <Tag color={INCIDENT_STATUS_COLOR[v]}>{v}</Tag>,
              },
              {
                title: '操作',
                render: (_, incident) => (
                  <Space>
                    {incident.status === 'OPEN' && (
                      <Button size="small" onClick={() => setContainModalIncidentId(incident.id)}>
                        遏制
                      </Button>
                    )}
                    {incident.status === 'CONTAINED' && (
                      <Button size="small" type="primary" onClick={() => resolveIncident(incident.id)}>
                        标记已解决
                      </Button>
                    )}
                  </Space>
                ),
              },
            ]}
          />
        </>
      )}

      <Modal title="登记信息资产" open={assetModalOpen} onOk={handleCreateAsset} onCancel={() => setAssetModalOpen(false)}>
        <Form form={assetForm} layout="vertical" initialValues={{ criticality: 'MEDIUM' }}>
          <Form.Item name="name" label="资产名称" rules={[{ required: true }]}>
            <Input placeholder="如: 学员记录数据库" />
          </Form.Item>
          <Form.Item name="category" label="类别" rules={[{ required: true }]}>
            <Input placeholder="如: 数据库 / 网络设备 / 云服务 / 第三方系统" />
          </Form.Item>
          <Form.Item name="criticality" label="关键程度" rules={[{ required: true }]}>
            <Select options={CRITICALITY_OPTIONS.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="信息安全风险评估 (可能性 x 影响矩阵)"
        open={!!riskModalAssetId}
        onOk={handleAssessRisk}
        onCancel={() => setRiskModalAssetId(undefined)}
      >
        <Form form={riskForm} layout="vertical">
          <Form.Item name="likelihoodLevel" label="可能性等级 (1-5, 5为最高)" rules={[{ required: true }]}>
            <InputNumber min={1} max={5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="impactLevel" label="影响等级 (1-5, 5为最高)" rules={[{ required: true }]}>
            <InputNumber min={1} max={5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="existingControls" label="现有控制措施说明">
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

      <Modal
        title="登记信息安全事件"
        open={incidentModalOpen}
        onOk={handleReportIncident}
        onCancel={() => setIncidentModalOpen(false)}
      >
        <Form form={incidentForm} layout="vertical" initialValues={{ discoveredAt: dayjs(), severity: 3 }}>
          <Form.Item name="incidentType" label="事件类型" rules={[{ required: true }]}>
            <Input placeholder="如: 未授权访问 / 数据泄露 / 勒索软件 / 系统中断" />
          </Form.Item>
          <Form.Item name="description" label="描述" rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="affectedAssetId" label="受影响资产">
            <Select
              allowClear
              options={assets.map((a) => ({ value: a.id, label: a.name }))}
            />
          </Form.Item>
          <Form.Item name="severity" label="严重度 (1-5, 5为最高)" rules={[{ required: true }]}>
            <InputNumber min={1} max={5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="discoveredAt" label="发现时间" rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="遏制事件 (Contain)"
        open={!!containModalIncidentId}
        onOk={handleContainIncident}
        onCancel={() => setContainModalIncidentId(undefined)}
      >
        <Form form={containForm} layout="vertical">
          <Form.Item name="responseActions" label="已采取的响应措施" rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="如: 已撤销会话, 强制重置密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
