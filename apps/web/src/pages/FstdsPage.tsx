import { PlusOutlined } from '@ant-design/icons'
import { Alert, Button, DatePicker, Empty, Form, Input, InputNumber, List, Modal, Select, Space, Table, Tag, message } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import type { Discrepancy, EvaluationDueSoonItem, FstdChangeRequest, RecurrentEvaluation } from '../api/fstds'
import { fstdsApi } from '../api/fstds'
import type { Fstd, FstdDeviceType, LegacyLevel } from '../api/types'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'

const DEVICE_TYPES: FstdDeviceType[] = ['FFS', 'FTD', 'FNPT', 'BITD']
const LEGACY_LEVELS: LegacyLevel[] = [
  'FFS_A', 'FFS_B', 'FFS_C', 'FFS_D', 'FTD_1', 'FTD_2', 'FNPT_I', 'FNPT_II', 'FNPT_II_MCC', 'BITD',
]
const CHANGE_TYPES = ['update', 'upgrade', 'major_modification', 'relocation', 'deactivation', 'transfer']

const CR_STATUS_COLOR: Record<FstdChangeRequest['status'], string> = {
  draft: 'default',
  submitted: 'processing',
  approved: 'green',
  rejected: 'red',
}

interface FstdDetail extends Fstd {
  evaluations?: RecurrentEvaluation[]
  changeRequests?: FstdChangeRequest[]
  discrepancies?: Discrepancy[]
}

export function FstdsPage() {
  const { organizations, selectedId, select } = useSelectedOrganization()
  const [fstds, setFstds] = useState<FstdDetail[]>([])
  const [dueSoon, setDueSoon] = useState<EvaluationDueSoonItem[]>([])
  const [overdueDiscrepancies, setOverdueDiscrepancies] = useState<Discrepancy[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [evalModalFstdId, setEvalModalFstdId] = useState<string>()
  const [crModalFstdId, setCrModalFstdId] = useState<string>()
  const [discrepancyModalFstdId, setDiscrepancyModalFstdId] = useState<string>()
  const [correctModalDiscrepancyId, setCorrectModalDiscrepancyId] = useState<string>()

  const [form] = Form.useForm()
  const [evalForm] = Form.useForm()
  const [crForm] = Form.useForm()
  const [discrepancyForm] = Form.useForm()
  const [correctForm] = Form.useForm()

  const load = async () => {
    if (!selectedId) return
    setLoading(true)
    try {
      const list = await fstdsApi.list(selectedId)
      const detailed = await Promise.all(
        list.map(async (f) => ({
          ...f,
          evaluations: await fstdsApi.listRecurrentEvaluations(f.id),
          changeRequests: await fstdsApi.listChangeRequests(f.id),
          discrepancies: await fstdsApi.listDiscrepancies(f.id),
        })),
      )
      setFstds(detailed)
    } finally {
      setLoading(false)
    }
    fstdsApi.listEvaluationsDueSoon().then(setDueSoon)
    fstdsApi.findOverdueDiscrepancies().then(setOverdueDiscrepancies)
  }

  useEffect(() => {
    load()
  }, [selectedId])

  const handleCreate = async () => {
    if (!selectedId) return
    const values = await form.validateFields()
    await fstdsApi.create({ organizationId: selectedId, ...values })
    message.success('模拟机创建成功')
    setModalOpen(false)
    form.resetFields()
    load()
  }

  const handleRecordEvaluation = async () => {
    if (!evalModalFstdId) return
    const values = await evalForm.validateFields()
    await fstdsApi.recordRecurrentEvaluation(evalModalFstdId, {
      periodStart: values.range[0].format('YYYY-MM-DD'),
      periodEnd: values.range[1].format('YYYY-MM-DD'),
      result: values.result,
    })
    message.success('周期性评估记录已保存, 下次到期日已自动计算')
    setEvalModalFstdId(undefined)
    evalForm.resetFields()
    load()
  }

  const handleCreateChangeRequest = async () => {
    if (!crModalFstdId) return
    const values = await crForm.validateFields()
    await fstdsApi.createChangeRequest(crModalFstdId, values)
    message.success('变更请求已创建 (草稿), 请提交以通知主管机关')
    setCrModalFstdId(undefined)
    crForm.resetFields()
    load()
  }

  const transitionChangeRequest = async (action: 'submit' | 'approve' | 'reject', crId: string) => {
    const fn = { submit: fstdsApi.submitChangeRequest, approve: fstdsApi.approveChangeRequest, reject: fstdsApi.rejectChangeRequest }[
      action
    ]
    await fn(crId)
    message.success('状态已更新')
    load()
  }

  const handleReportDiscrepancy = async () => {
    if (!discrepancyModalFstdId) return
    const values = await discrepancyForm.validateFields()
    await fstdsApi.reportDiscrepancy(discrepancyModalFstdId, values)
    message.success('缺陷已登记, 30天修复时限倒计时已启动 (3.3.7)')
    setDiscrepancyModalFstdId(undefined)
    discrepancyForm.resetFields()
    load()
  }

  const handleCorrectDiscrepancy = async () => {
    if (!correctModalDiscrepancyId) return
    const values = await correctForm.validateFields()
    await fstdsApi.correctDiscrepancy(correctModalDiscrepancyId, values)
    message.success('缺陷已标记为已纠正')
    setCorrectModalDiscrepancyId(undefined)
    correctForm.resetFields()
    load()
  }

  return (
    <div>
      <OrganizationSelector organizations={organizations} selectedId={selectedId} onChange={select} />

      {!selectedId ? (
        <Empty description="请先创建并选择一个机构" />
      ) : (
        <>
          {dueSoon.length > 0 && (
            <Alert
              style={{ marginBottom: 16 }}
              type="warning"
              showIcon
              message={`有 ${dueSoon.length} 台设备的周期性评估即将到期或从未评估过, 请尽快安排 (需求清单3.3.5)`}
              description={dueSoon.map((d) => d.deviceCode).join('、')}
            />
          )}
          {overdueDiscrepancies.length > 0 && (
            <Alert
              style={{ marginBottom: 16 }}
              type="error"
              showIcon
              message={`有 ${overdueDiscrepancies.length} 项缺陷已超过30天修复时限仍未纠正 (3.3.7, 吸收FAA §60.25规则)`}
              description={overdueDiscrepancies.map((d) => `${d.fstd?.deviceCode ?? d.fstdId}: ${d.description}`).join('; ')}
            />
          )}

          <Space style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              新增模拟机
            </Button>
          </Space>

          <Table<FstdDetail>
            rowKey="id"
            loading={loading}
            dataSource={fstds}
            columns={[
              { title: '设备编号', dataIndex: 'deviceCode' },
              { title: '代表机型', dataIndex: 'representedAircraft' },
              { title: '设备类型', dataIndex: 'deviceType' },
              {
                title: 'EASA 等级 (legacy)',
                dataIndex: 'legacyLevel',
                render: (v: Fstd['legacyLevel']) => (v ? <Tag color="blue">{v.level}</Tag> : '-'),
              },
              {
                title: '操作',
                render: (_, fstd) => (
                  <Space>
                    <Button size="small" onClick={() => setEvalModalFstdId(fstd.id)}>
                      记录周期评估
                    </Button>
                    <Button size="small" onClick={() => setCrModalFstdId(fstd.id)}>
                      发起变更
                    </Button>
                    <Button size="small" danger onClick={() => setDiscrepancyModalFstdId(fstd.id)}>
                      报告缺陷
                    </Button>
                  </Space>
                ),
              },
            ]}
            expandable={{
              expandedRowRender: (fstd) => (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <List
                    header="周期性评估记录 (标准周期12个月, BITD为3年)"
                    size="small"
                    dataSource={fstd.evaluations ?? []}
                    locale={{ emptyText: '尚未记录任何周期性评估' }}
                    renderItem={(e) => (
                      <List.Item>
                        {new Date(e.periodStart).toLocaleDateString()} ~ {new Date(e.periodEnd).toLocaleDateString()}
                        , 结果: {e.result ?? '-'}, 下次到期:{' '}
                        <Tag color={e.nextDueDate && new Date(e.nextDueDate) < new Date() ? 'red' : 'default'}>
                          {e.nextDueDate ? new Date(e.nextDueDate).toLocaleDateString() : '-'}
                        </Tag>
                      </List.Item>
                    )}
                  />
                  <List
                    header="变更请求 (draft → submitted → approved/rejected)"
                    size="small"
                    dataSource={fstd.changeRequests ?? []}
                    locale={{ emptyText: '暂无变更请求' }}
                    renderItem={(cr) => (
                      <List.Item
                        actions={[
                          cr.status === 'draft' && (
                            <Button key="submit" size="small" onClick={() => transitionChangeRequest('submit', cr.id)}>
                              提交(通知主管机关)
                            </Button>
                          ),
                          cr.status === 'submitted' && (
                            <Button key="approve" size="small" type="primary" onClick={() => transitionChangeRequest('approve', cr.id)}>
                              批准
                            </Button>
                          ),
                          cr.status === 'submitted' && (
                            <Button key="reject" size="small" danger onClick={() => transitionChangeRequest('reject', cr.id)}>
                              驳回
                            </Button>
                          ),
                        ].filter(Boolean)}
                      >
                        <Tag color={CR_STATUS_COLOR[cr.status]}>{cr.status}</Tag> {cr.changeType}: {cr.description}
                      </List.Item>
                    )}
                  />
                  <List
                    header="缺陷/故障处理 (3.3.7, 30天修复时限)"
                    size="small"
                    dataSource={fstd.discrepancies ?? []}
                    locale={{ emptyText: '暂无缺陷记录' }}
                    renderItem={(d) => (
                      <List.Item
                        actions={
                          d.status === 'open'
                            ? [
                                <Button key="correct" size="small" onClick={() => setCorrectModalDiscrepancyId(d.id)}>
                                  标记已纠正
                                </Button>,
                              ]
                            : []
                        }
                      >
                        <Space direction="vertical" size={0} style={{ width: '100%' }}>
                          <Space wrap>
                            <Tag color={d.status === 'open' ? (d.dueDate && new Date(d.dueDate) < new Date() ? 'red' : 'orange') : 'green'}>
                              {d.status === 'open' ? (d.dueDate && new Date(d.dueDate) < new Date() ? '已逾期' : '处理中') : '已纠正'}
                            </Tag>
                            {d.isMmi && <Tag color="red">MMI</Tag>}
                            {d.severityRating != null && <Tag>严重度 {d.severityRating}/5</Tag>}
                            {d.trainingTimeLostMinutes != null && <Tag>损失培训时间 {d.trainingTimeLostMinutes}分钟</Tag>}
                            <span>{d.description}</span>
                          </Space>
                          <span style={{ color: '#888', fontSize: 12 }}>
                            报告于 {new Date(d.reportedAt).toLocaleString()}, 修复时限:{' '}
                            {d.dueDate ? new Date(d.dueDate).toLocaleDateString() : '-'}
                            {d.correctiveAction ? ` | 纠正措施: ${d.correctiveAction}` : ''}
                          </span>
                        </Space>
                      </List.Item>
                    )}
                  />
                </Space>
              ),
            }}
          />
        </>
      )}

      <Modal title="新增模拟机" open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="deviceCode" label="设备编号" rules={[{ required: true }]}>
            <Input placeholder="如 FFS-01" />
          </Form.Item>
          <Form.Item name="representedAircraft" label="代表机型" rules={[{ required: true }]}>
            <Input placeholder="如 A320" />
          </Form.Item>
          <Form.Item name="deviceType" label="设备类型" rules={[{ required: true }]}>
            <Select options={DEVICE_TYPES.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="legacyLevel" label="EASA 等级 (CS-FSTD(A) Issue 2)">
            <Select allowClear options={LEGACY_LEVELS.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="记录周期性评估"
        open={!!evalModalFstdId}
        onOk={handleRecordEvaluation}
        onCancel={() => setEvalModalFstdId(undefined)}
      >
        <Form form={evalForm} layout="vertical" initialValues={{ range: [dayjs().subtract(5, 'day'), dayjs()], result: 'pass' }}>
          <Form.Item name="range" label="评估周期" rules={[{ required: true }]}>
            <DatePicker.RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="result" label="结果" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'pass', label: '通过' },
                { value: 'partial', label: '部分通过' },
                { value: 'fail', label: '未通过' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="发起变更请求"
        open={!!crModalFstdId}
        onOk={handleCreateChangeRequest}
        onCancel={() => setCrModalFstdId(undefined)}
      >
        <Form form={crForm} layout="vertical">
          <Form.Item name="changeType" label="变更类型" rules={[{ required: true }]}>
            <Select options={CHANGE_TYPES.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="description" label="变更说明">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="报告缺陷 (3.3.7)"
        open={!!discrepancyModalFstdId}
        onOk={handleReportDiscrepancy}
        onCancel={() => setDiscrepancyModalFstdId(undefined)}
      >
        <Form form={discrepancyForm} layout="vertical">
          <Form.Item name="description" label="问题描述" rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="如: 视景系统左侧显示花屏" />
          </Form.Item>
          <Form.Item name="isMmi" label="是否MMI (缺失/故障/失效, 影响设备可用性)" initialValue={false}>
            <Select
              options={[
                { value: false, label: '否' },
                { value: true, label: '是' },
              ]}
            />
          </Form.Item>
          <Form.Item name="severityRating" label="严重度打分 (1-5, 5为最严重)">
            <InputNumber min={1} max={5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="trainingTimeLostMinutes" label="导致培训损失时间 (分钟)">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="标记缺陷已纠正"
        open={!!correctModalDiscrepancyId}
        onOk={handleCorrectDiscrepancy}
        onCancel={() => setCorrectModalDiscrepancyId(undefined)}
      >
        <Form form={correctForm} layout="vertical">
          <Form.Item name="correctiveAction" label="纠正措施" rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
