import { DeleteOutlined, DownloadOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { Alert, Button, DatePicker, Empty, Form, Input, InputNumber, List, Modal, Select, Space, Switch, Table, Tag, Upload, message } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import type {
  Discrepancy,
  EquipmentSpecificationList,
  EvaluationDueSoonItem,
  ExtensionEligibility,
  FcsCharacteristic,
  FcsFidelityLevel,
  FstdFcsCapability,
  PerformanceMetricsSummary,
  PmChecklistTemplate,
  PmCheckLevel,
  PmTask,
  PmTaskDueSoonItem,
  QtgDocument,
  QtgDocumentType,
  QuarterlyQtgIssue,
  QuarterlyQtgRun,
  RecurrentEvaluation,
  RetentionCategory,
  SafetyCheckDueSoonItem,
  SafetyFacilityCheck,
  TaskCapabilityResult,
  TrainingMatrixEntry,
} from '../api/fstds'
import { fstdsApi } from '../api/fstds'
import type { PartMovement } from '../api/inventory'
import { inventoryApi } from '../api/inventory'
import { personnelApi } from '../api/personnel'
import type { Fstd, FstdDeviceType, FstdQualificationBasisType, LegacyLevel, Personnel } from '../api/types'
import { ChangeRequestPanel } from '../components/ChangeRequestPanel'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'

const RETENTION_CATEGORY_LABEL: Record<RetentionCategory, { text: string; color: string }> = {
  CATEGORY_I: { text: 'Category I (需在下次飞行前修复)', color: 'red' },
  CATEGORY_II: { text: 'Category II (限期内修复, 可带故障运行)', color: 'orange' },
  CATEGORY_III: { text: 'Category III (可长期保留)', color: 'gold' },
}

const PM_CHECK_LEVELS: PmCheckLevel[] = ['WEEKLY', 'MONTHLY', 'SEMI_ANNUAL', 'ANNUAL']
const PM_CHECK_LEVEL_LABEL: Record<PmCheckLevel, string> = {
  WEEKLY: '周检',
  MONTHLY: '月检',
  SEMI_ANNUAL: '半年检',
  ANNUAL: '年检',
}
const PM_TASK_STATUS_LABEL: Record<PmTask['status'], { text: string; color: string }> = {
  PENDING_REVIEW: { text: '待审核', color: 'orange' },
  APPROVED: { text: '审核通过', color: 'green' },
  REJECTED: { text: '审核不通过', color: 'red' },
}

const DEVICE_TYPES: FstdDeviceType[] = ['FFS', 'FTD', 'FNPT', 'BITD']
const SAFETY_CHECK_ITEMS = ['急停按钮', '应急照明', '灭火器', '舱内通讯系统']
const QTG_DOCUMENT_TYPES: QtgDocumentType[] = ['SOC', 'VDR', 'MQTG']
const LEGACY_LEVELS: LegacyLevel[] = [
  'FFS_A', 'FFS_B', 'FFS_C', 'FFS_D', 'FTD_1', 'FTD_2', 'FNPT_I', 'FNPT_II', 'FNPT_II_MCC', 'BITD',
]
const QUALIFICATION_BASIS_TYPES: FstdQualificationBasisType[] = ['EASA_LEGACY_LEVEL', 'EASA_FCS']
const FCS_CHARACTERISTICS: FcsCharacteristic[] = [
  'FDK', 'CLH', 'CLO', 'SYS', 'GND', 'IGE', 'OGE', 'SND', 'VIB', 'MTN', 'VIS', 'NAV', 'ATM', 'OST',
]
const FCS_FIDELITY_LEVELS: FcsFidelityLevel[] = ['N', 'G', 'R', 'S']
const FIDELITY_COLOR: Record<FcsFidelityLevel, string> = { N: 'default', G: 'blue', R: 'orange', S: 'purple' }

interface FstdDetail extends Fstd {
  evaluations?: RecurrentEvaluation[]
  discrepancies?: Discrepancy[]
  safetyChecks?: SafetyFacilityCheck[]
  qtgDocuments?: QtgDocument[]
  qtgRuns?: QuarterlyQtgRun[]
  fcsCapabilities?: FstdFcsCapability[]
  eslLists?: EquipmentSpecificationList[]
  performanceMetrics?: PerformanceMetricsSummary
  pmTasks?: PmTask[]
}

type EslEntryState = Record<FcsCharacteristic, { fidelityLevel?: FcsFidelityLevel; equipmentDescription: string; limitations: string }>

const emptyEslEntryState = (): EslEntryState =>
  Object.fromEntries(FCS_CHARACTERISTICS.map((c) => [c, { fidelityLevel: undefined, equipmentDescription: '', limitations: '' }])) as EslEntryState

export function FstdsPage() {
  const { organizations, selectedId, select } = useSelectedOrganization()
  const [fstds, setFstds] = useState<FstdDetail[]>([])
  const [dueSoon, setDueSoon] = useState<EvaluationDueSoonItem[]>([])
  const [overdueDiscrepancies, setOverdueDiscrepancies] = useState<Discrepancy[]>([])
  const [safetyCheckDueSoon, setSafetyCheckDueSoon] = useState<SafetyCheckDueSoonItem[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [evalModalFstdId, setEvalModalFstdId] = useState<string>()
  const [extensionEligibility, setExtensionEligibility] = useState<ExtensionEligibility>()
  const [discrepancyModalFstdId, setDiscrepancyModalFstdId] = useState<string>()
  const [correctModalDiscrepancyId, setCorrectModalDiscrepancyId] = useState<string>()
  const [retentionModalDiscrepancyId, setRetentionModalDiscrepancyId] = useState<string>()
  const [discrepancyMovements, setDiscrepancyMovements] = useState<Record<string, PartMovement[]>>({})
  const [safetyCheckModalFstdId, setSafetyCheckModalFstdId] = useState<string>()
  const [safetyCheckItemState, setSafetyCheckItemState] = useState<Record<string, boolean>>(
    () => Object.fromEntries(SAFETY_CHECK_ITEMS.map((item) => [item, true])),
  )
  const [qtgIssues, setQtgIssues] = useState<QuarterlyQtgIssue[]>([])
  const [qtgDocModalFstdId, setQtgDocModalFstdId] = useState<string>()
  const [qtgRunModalFstdId, setQtgRunModalFstdId] = useState<string>()
  const [fcsCapModalFstdId, setFcsCapModalFstdId] = useState<string>()
  const [checkTaskModalFstdId, setCheckTaskModalFstdId] = useState<string>()
  const [checkTaskResult, setCheckTaskResult] = useState<TaskCapabilityResult>()
  const [trainingMatrixEntries, setTrainingMatrixEntries] = useState<TrainingMatrixEntry[]>([])
  const [trainingMatrixModalOpen, setTrainingMatrixModalOpen] = useState(false)
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [eslModalFstdId, setEslModalFstdId] = useState<string>()
  const [eslEntryState, setEslEntryState] = useState<EslEntryState>(emptyEslEntryState())
  const [eslDeclareModalId, setEslDeclareModalId] = useState<string>()
  const [perfMetricModalFstdId, setPerfMetricModalFstdId] = useState<string>()
  const [pmTemplates, setPmTemplates] = useState<PmChecklistTemplate[]>([])
  const [pmDueSoon, setPmDueSoon] = useState<PmTaskDueSoonItem[]>([])
  const [pmTemplateModalOpen, setPmTemplateModalOpen] = useState(false)
  const [pmTaskModalFstdId, setPmTaskModalFstdId] = useState<string>()
  const [pmTaskLevel, setPmTaskLevel] = useState<PmCheckLevel>()
  const [pmReviewModal, setPmReviewModal] = useState<PmTask>()

  const [form] = Form.useForm()
  const [evalForm] = Form.useForm()
  const [discrepancyForm] = Form.useForm()
  const [correctForm] = Form.useForm()
  const [retentionForm] = Form.useForm()
  const [safetyCheckForm] = Form.useForm()
  const [qtgDocForm] = Form.useForm()
  const [qtgRunForm] = Form.useForm()
  const [fcsCapForm] = Form.useForm()
  const [checkTaskForm] = Form.useForm()
  const [trainingMatrixForm] = Form.useForm()
  const [eslForm] = Form.useForm()
  const [eslDeclareForm] = Form.useForm()
  const [perfMetricForm] = Form.useForm()
  const [pmTemplateForm] = Form.useForm()
  const [pmTaskForm] = Form.useForm()
  const [pmReviewForm] = Form.useForm()

  const load = async () => {
    if (!selectedId) return
    setLoading(true)
    try {
      const list = await fstdsApi.list(selectedId)
      const detailed = await Promise.all(
        list.map(async (f) => ({
          ...f,
          evaluations: await fstdsApi.listRecurrentEvaluations(f.id),
          discrepancies: await fstdsApi.listDiscrepancies(f.id),
          safetyChecks: await fstdsApi.listSafetyFacilityChecks(f.id),
          qtgDocuments: await fstdsApi.listQtgDocuments(f.id),
          qtgRuns: await fstdsApi.listQuarterlyQtgRuns(f.id),
          fcsCapabilities: await fstdsApi.listFcsCapabilities(f.id),
          eslLists: await fstdsApi.listEsls(f.id),
          performanceMetrics: await fstdsApi.getPerformanceMetrics(f.id),
          pmTasks: await fstdsApi.listPmTasks(f.id),
        })),
      )
      setFstds(detailed)
    } finally {
      setLoading(false)
    }
    fstdsApi.listEvaluationsDueSoon().then(setDueSoon)
    fstdsApi.findOverdueDiscrepancies().then(setOverdueDiscrepancies)
    fstdsApi.findSafetyChecksDueSoon().then(setSafetyCheckDueSoon)
    fstdsApi.findQuarterlyQtgIssues().then(setQtgIssues)
    fstdsApi.listPmChecklistTemplates(selectedId).then(setPmTemplates)
    fstdsApi.findPmTasksDueSoon().then(setPmDueSoon)
  }

  useEffect(() => {
    load()
  }, [selectedId])

  useEffect(() => {
    fstdsApi.listTrainingMatrixEntries().then(setTrainingMatrixEntries)
    personnelApi.list().then(setPersonnel)
  }, [])

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
    const result = await fstdsApi.recordRecurrentEvaluation(evalModalFstdId, {
      periodStart: values.range[0].format('YYYY-MM-DD'),
      periodEnd: values.range[1].format('YYYY-MM-DD'),
      result: values.result,
      evaluationType: values.useExtension ? 'extended' : 'standard',
      extensionMonths: values.useExtension ? values.extensionMonths : undefined,
    })
    message.success(
      result.isWithinWindow === false
        ? '周期性评估记录已保存, 下次到期日已自动计算 (注意: 本次评估晚于评估窗口, 不视为按时完成)'
        : '周期性评估记录已保存, 下次到期日已自动计算',
    )
    setEvalModalFstdId(undefined)
    evalForm.resetFields()
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

  const handleSetRetention = async () => {
    if (!retentionModalDiscrepancyId) return
    const values = await retentionForm.validateFields()
    await fstdsApi.setDiscrepancyRetention(retentionModalDiscrepancyId, {
      ...values,
      expiresAt: values.expiresAt ? values.expiresAt.format('YYYY-MM-DD') : undefined,
    })
    message.success('故障保留分级已设置, 该缺陷暂不再阻断相关科目排课')
    setRetentionModalDiscrepancyId(undefined)
    retentionForm.resetFields()
    load()
  }

  const handleClearRetention = async (discrepancyId: string) => {
    await fstdsApi.clearDiscrepancyRetention(discrepancyId)
    message.success('故障保留分级已取消')
    load()
  }

  const loadDiscrepancyMovements = async (discrepancyId: string) => {
    const list = await inventoryApi.listMovementsByDiscrepancy(discrepancyId)
    setDiscrepancyMovements((prev) => ({ ...prev, [discrepancyId]: list }))
  }

  const openSafetyCheckModal = (fstdId: string) => {
    setSafetyCheckItemState(Object.fromEntries(SAFETY_CHECK_ITEMS.map((item) => [item, true])))
    safetyCheckForm.resetFields()
    setSafetyCheckModalFstdId(fstdId)
  }

  const handleRecordSafetyCheck = async () => {
    if (!safetyCheckModalFstdId) return
    const values = await safetyCheckForm.validateFields()
    await fstdsApi.recordSafetyFacilityCheck(safetyCheckModalFstdId, {
      checkedAt: values.checkedAt.format('YYYY-MM-DD'),
      items: SAFETY_CHECK_ITEMS.map((item) => ({
        item,
        passed: safetyCheckItemState[item],
        notes: !safetyCheckItemState[item] ? values.notes : undefined,
      })),
    })
    message.success('安全设施年检记录已保存 (3.3.8)')
    setSafetyCheckModalFstdId(undefined)
    load()
  }

  const handleAddQtgDocument = async () => {
    if (!qtgDocModalFstdId) return
    const values = await qtgDocForm.validateFields()
    const { fileList, ...rest } = values
    await fstdsApi.addQtgDocument(qtgDocModalFstdId, {
      ...rest,
      effectiveDate: values.effectiveDate.format('YYYY-MM-DD'),
      file: fileList?.[0]?.originFileObj,
    })
    message.success('QTG文档版本已登记, 同类型旧版本已自动标记为已替代')
    setQtgDocModalFstdId(undefined)
    qtgDocForm.resetFields()
    load()
  }

  const handleDownloadQtgDocument = async (doc: QtgDocument) => {
    try {
      await fstdsApi.downloadQtgDocumentFile(doc)
    } catch {
      message.error('下载失败, 该记录可能没有已上传的文件 (仅登记了外部引用链接)')
    }
  }

  const handleRecordQuarterlyRun = async () => {
    if (!qtgRunModalFstdId) return
    const values = await qtgRunForm.validateFields()
    await fstdsApi.recordQuarterlyQtgRun(qtgRunModalFstdId, {
      ...values,
      completedAt: values.completedAt.format('YYYY-MM-DD'),
    })
    message.success('季度QTG运行记录已保存')
    setQtgRunModalFstdId(undefined)
    qtgRunForm.resetFields()
    load()
  }

  const handleSetFcsCapability = async () => {
    if (!fcsCapModalFstdId) return
    const values = await fcsCapForm.validateFields()
    try {
      await fstdsApi.setFcsCapability(fcsCapModalFstdId, values)
      message.success('FCS能力已登记')
      setFcsCapModalFstdId(undefined)
      fcsCapForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '操作失败')
    }
  }

  const handleCheckTask = async () => {
    if (!checkTaskModalFstdId) return
    const values = await checkTaskForm.validateFields()
    const result = await fstdsApi.canPerformTask(checkTaskModalFstdId, values.taskCode)
    setCheckTaskResult(result)
  }

  const handleAddTrainingMatrixEntry = async () => {
    const values = await trainingMatrixForm.validateFields()
    await fstdsApi.addTrainingMatrixEntry(values)
    message.success('训练矩阵条目已登记')
    trainingMatrixForm.resetFields()
    fstdsApi.listTrainingMatrixEntries().then(setTrainingMatrixEntries)
  }

  const handleSetPmTemplate = async () => {
    if (!selectedId) return
    const values = await pmTemplateForm.validateFields()
    const itemsJson = (values.items as { item: string }[]).filter((i) => i?.item)
    await fstdsApi.setPmChecklistTemplate({ organizationId: selectedId, level: values.level, itemsJson })
    message.success('检查单模板已保存')
    setPmTemplateModalOpen(false)
    pmTemplateForm.resetFields()
    load()
  }

  const openPmTaskModal = (fstdId: string) => {
    pmTaskForm.resetFields()
    setPmTaskLevel(undefined)
    setPmTaskModalFstdId(fstdId)
  }

  const handleCreatePmTask = async () => {
    if (!pmTaskModalFstdId) return
    const values = await pmTaskForm.validateFields()
    try {
      await fstdsApi.createPmTask(pmTaskModalFstdId, {
        level: values.level,
        taskDate: values.taskDate.format('YYYY-MM-DD'),
        performedById: values.performedById,
        responsibleIds: values.responsibleIds ?? [],
        itemResultsJson: (values.items as { item: string; passed: boolean; notes?: string }[]) ?? [],
      })
      message.success('PM任务已登记, 待审核')
      setPmTaskModalFstdId(undefined)
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '操作失败')
    }
  }

  const handleReviewPmTask = async (approve: boolean) => {
    if (!pmReviewModal) return
    const values = await pmReviewForm.validateFields()
    try {
      await fstdsApi.reviewPmTask(pmReviewModal.id, { approve, reviewedById: values.reviewedById, reviewNotes: values.reviewNotes })
      message.success(approve ? '已审核通过' : '已标记为审核不通过')
      setPmReviewModal(undefined)
      pmReviewForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '操作失败')
    }
  }

  const openEslModal = (fstd: FstdDetail) => {
    const state = emptyEslEntryState()
    if (fstd.qualificationBasisType === 'EASA_FCS') {
      for (const cap of fstd.fcsCapabilities ?? []) {
        if (!state[cap.characteristic].fidelityLevel) {
          state[cap.characteristic] = { ...state[cap.characteristic], fidelityLevel: cap.fidelityLevel }
        }
      }
    }
    setEslEntryState(state)
    eslForm.resetFields()
    setEslModalFstdId(fstd.id)
  }

  const handleCreateEslRevision = async () => {
    if (!eslModalFstdId) return
    const values = await eslForm.validateFields()
    const entries = FCS_CHARACTERISTICS.map((c) => ({
      characteristic: c,
      fidelityLevel: eslEntryState[c].fidelityLevel,
      equipmentDescription: eslEntryState[c].equipmentDescription || undefined,
      limitations: eslEntryState[c].limitations || undefined,
    }))
    await fstdsApi.createEslRevision(eslModalFstdId, {
      revisionNumber: values.revisionNumber,
      revisionDate: values.revisionDate.format('YYYY-MM-DD'),
      entries,
    })
    message.success('ESL装备规格清单版本已登记, 旧版本已自动标记为已替代')
    setEslModalFstdId(undefined)
    load()
  }

  const handleDeclareEsl = async () => {
    if (!eslDeclareModalId) return
    const values = await eslDeclareForm.validateFields()
    try {
      await fstdsApi.declareEsl(eslDeclareModalId, values.personnelId)
      message.success('ESL已声明确认')
      setEslDeclareModalId(undefined)
      eslDeclareForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '声明失败 (须为组织指定的合规负责人 NOMINATED_PERSON_COMPLIANCE)')
    }
  }

  const handleRecordPerformanceMetric = async () => {
    if (!perfMetricModalFstdId) return
    const values = await perfMetricForm.validateFields()
    await fstdsApi.recordPerformanceMetric(perfMetricModalFstdId, {
      ...values,
      year: values.period.year(),
      month: values.period.month() + 1,
      period: undefined,
    })
    message.success('FSTD性能指标已登记 (同年月已存在记录将被更新)')
    setPerfMetricModalFstdId(undefined)
    perfMetricForm.resetFields()
    load()
  }

  return (
    <div>
      <OrganizationSelector organizations={organizations} selectedId={selectedId} onChange={select} />

      <div style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 8 }}>
          <span style={{ fontWeight: 600 }}>训练矩阵 (3.3.3, Part-FCL Appendix 9训练科目 x 14特征, 全局配置, 非机构范围)</span>
          <Button size="small" icon={<PlusOutlined />} onClick={() => setTrainingMatrixModalOpen(true)}>
            登记条目
          </Button>
        </Space>
        <Table<TrainingMatrixEntry>
          rowKey="id"
          size="small"
          dataSource={trainingMatrixEntries}
          pagination={false}
          locale={{ emptyText: '尚未登记训练矩阵条目 (官方Part-FCL Appendix 9完整清单未随需求分析获取, 按需登记)' }}
          columns={[
            { title: '科目编号', dataIndex: 'taskCode' },
            { title: '科目名称', dataIndex: 'taskName' },
            { title: '特征', dataIndex: 'characteristic', render: (v: FcsCharacteristic) => <Tag>{v}</Tag> },
            { title: 'T阈值(可开始训练)', dataIndex: 'thresholdT', render: (v: FcsFidelityLevel) => <Tag color={FIDELITY_COLOR[v]}>{v}</Tag> },
            { title: 'TP阈值(完成训练)', dataIndex: 'thresholdTP', render: (v: FcsFidelityLevel) => <Tag color={FIDELITY_COLOR[v]}>{v}</Tag> },
          ]}
        />
      </div>

      {!selectedId ? (
        <Empty description="请先创建并选择一个机构" />
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <Space style={{ marginBottom: 8 }}>
              <span style={{ fontWeight: 600 }}>常规维护(PM)检查单模板 (3.3.10, AMC1 ORA.FSTD.105(a)(1), 机构范围配置)</span>
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() => {
                  pmTemplateForm.resetFields()
                  setPmTemplateModalOpen(true)
                }}
              >
                配置模板
              </Button>
            </Space>
            <Table<PmChecklistTemplate>
              rowKey="id"
              size="small"
              dataSource={pmTemplates}
              pagination={false}
              locale={{ emptyText: '尚未配置任何层级的检查单模板' }}
              columns={[
                { title: '层级', dataIndex: 'level', render: (v: PmCheckLevel) => <Tag>{PM_CHECK_LEVEL_LABEL[v]}</Tag> },
                { title: '检查项', render: (_, t) => t.itemsJson.map((i) => i.item).join('、') },
                { title: '更新时间', dataIndex: 'updatedAt', render: (v: string) => new Date(v).toLocaleString() },
              ]}
            />
          </div>

          {pmDueSoon.length > 0 && (
            <Alert
              style={{ marginBottom: 16 }}
              type="warning"
              showIcon
              message={`有 ${pmDueSoon.length} 项常规维护(PM)任务即将到期或从未执行过 (3.3.10)`}
              description={pmDueSoon.map((d) => `${d.deviceCode}(${PM_CHECK_LEVEL_LABEL[d.level]})`).join('、')}
            />
          )}
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
          {safetyCheckDueSoon.length > 0 && (
            <Alert
              style={{ marginBottom: 16 }}
              type="warning"
              showIcon
              message={`有 ${safetyCheckDueSoon.length} 台设备的安全设施年检即将到期或从未检查过 (3.3.8, ORA.FSTD.115(b))`}
              description={safetyCheckDueSoon.map((d) => d.deviceCode).join('、')}
            />
          )}
          {qtgIssues.length > 0 && (
            <Alert
              style={{ marginBottom: 16 }}
              type="error"
              showIcon
              message={`有 ${qtgIssues.length} 项季度QTG运行问题 (3.3.4, 不允许年检前突击补测)`}
              description={qtgIssues
                .map((i) => `${i.deviceCode} ${i.year}Q${i.quarter}: ${i.issueType === 'overdue' ? '逾期未测' : '完成日期不在所属季度内(疑似突击补测)'}`)
                .join('; ')}
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
                title: '鉴定基础',
                dataIndex: 'qualificationBasisType',
                render: (v: FstdQualificationBasisType) => <Tag color={v === 'EASA_FCS' ? 'purple' : 'blue'}>{v}</Tag>,
              },
              {
                title: 'EASA 等级 (legacy)',
                dataIndex: 'legacyLevel',
                render: (v: Fstd['legacyLevel']) => (v ? <Tag color="blue">{v.level}</Tag> : '-'),
              },
              {
                title: '操作',
                render: (_, fstd) => (
                  <Space>
                    <Button
                      size="small"
                      onClick={() => {
                        evalForm.resetFields()
                        setExtensionEligibility(undefined)
                        fstdsApi.checkExtensionEligibility(fstd.id).then(setExtensionEligibility)
                        setEvalModalFstdId(fstd.id)
                      }}
                    >
                      记录周期评估
                    </Button>
                    <Button size="small" danger onClick={() => setDiscrepancyModalFstdId(fstd.id)}>
                      报告缺陷
                    </Button>
                    <Button size="small" onClick={() => openSafetyCheckModal(fstd.id)}>
                      记录年检
                    </Button>
                    <Button size="small" onClick={() => setQtgDocModalFstdId(fstd.id)}>
                      QTG文档
                    </Button>
                    <Button size="small" onClick={() => setQtgRunModalFstdId(fstd.id)}>
                      季度QTG记录
                    </Button>
                    <Button size="small" onClick={() => openEslModal(fstd)}>
                      ESL装备规格清单
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        perfMetricForm.resetFields()
                        setPerfMetricModalFstdId(fstd.id)
                      }}
                    >
                      性能指标
                    </Button>
                    {fstd.qualificationBasisType === 'EASA_FCS' && (
                      <Button size="small" onClick={() => setFcsCapModalFstdId(fstd.id)}>
                        登记FCS能力
                      </Button>
                    )}
                    <Button
                      size="small"
                      onClick={() => {
                        setCheckTaskResult(undefined)
                        checkTaskForm.resetFields()
                        setCheckTaskModalFstdId(fstd.id)
                      }}
                    >
                      科目能力检查
                    </Button>
                  </Space>
                ),
              },
            ]}
            expandable={{
              expandedRowRender: (fstd) => (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {fstd.qualificationBasisType === 'EASA_FCS' && (
                    <List
                      header="FCS能力矩阵 (3.3.2, 14特征 x 4保真度: N < G < R < S)"
                      size="small"
                      dataSource={fstd.fcsCapabilities ?? []}
                      locale={{ emptyText: '尚未登记任何FCS能力' }}
                      renderItem={(c) => (
                        <List.Item>
                          <Tag>{c.characteristic}</Tag>
                          {c.subsystem && <Tag color="cyan">{c.subsystem}</Tag>}
                          <Tag color={FIDELITY_COLOR[c.fidelityLevel]}>{c.fidelityLevel}</Tag>
                          {c.isAssigned && <Tag color="gold">assigned FCS</Tag>}
                        </List.Item>
                      )}
                    />
                  )}
                  <List
                    header="ESL 装备规格清单 (AMC1/AMC2 ORA.FSTD.120, 存量设备BITD除外均需提供)"
                    size="small"
                    dataSource={fstd.eslLists ?? []}
                    locale={{ emptyText: '尚未登记任何ESL版本' }}
                    renderItem={(esl) => (
                      <List.Item
                        actions={
                          !esl.declaredAt
                            ? [
                                <Button
                                  key="declare"
                                  size="small"
                                  onClick={() => {
                                    eslDeclareForm.resetFields()
                                    setEslDeclareModalId(esl.id)
                                  }}
                                >
                                  声明确认
                                </Button>,
                              ]
                            : []
                        }
                      >
                        <Space direction="vertical" size={0} style={{ width: '100%' }}>
                          <Space wrap>
                            <Tag color={esl.supersededAt ? 'default' : 'green'}>{esl.supersededAt ? '历史版本' : '当前版本'}</Tag>
                            <span>修订版 {esl.revisionNumber}</span>
                            <Tag color={esl.declaredAt ? 'green' : 'orange'}>{esl.declaredAt ? '已声明确认' : '待声明确认'}</Tag>
                          </Space>
                          <span style={{ color: '#888', fontSize: 12 }}>
                            修订日期 {new Date(esl.revisionDate).toLocaleDateString()}
                            {esl.declaredAt ? ` | 声明于 ${new Date(esl.declaredAt).toLocaleString()}` : ''}
                          </span>
                          <Space wrap style={{ marginTop: 4 }}>
                            {esl.entries
                              .filter((e) => e.fidelityLevel)
                              .map((e) => (
                                <Tag key={e.characteristic} color={FIDELITY_COLOR[e.fidelityLevel!]}>
                                  {e.characteristic}: {e.fidelityLevel}
                                </Tag>
                              ))}
                          </Space>
                        </Space>
                      </List.Item>
                    )}
                  />
                  {fstd.performanceMetrics && fstd.performanceMetrics.monthly.length > 0 && (
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        FSTD性能指标 (AMC1 ORA.FSTD.100(d), 近12个月汇总: 共{fstd.performanceMetrics.last12Months.monthCount}个月)
                      </div>
                      <Space wrap style={{ marginBottom: 8 }}>
                        <Tag color={fstd.performanceMetrics.last12Months.availabilityPercent != null && fstd.performanceMetrics.last12Months.availabilityPercent < 90 ? 'red' : 'green'}>
                          可用率 {fstd.performanceMetrics.last12Months.availabilityPercent?.toFixed(1) ?? '-'}%
                        </Tag>
                        <Tag color={fstd.performanceMetrics.last12Months.reliabilityPercent != null && fstd.performanceMetrics.last12Months.reliabilityPercent < 90 ? 'red' : 'green'}>
                          可靠率 {fstd.performanceMetrics.last12Months.reliabilityPercent?.toFixed(1) ?? '-'}%
                        </Tag>
                        <Tag>计划可用 {fstd.performanceMetrics.last12Months.plannedAvailableHours}h</Tag>
                        <Tag>排期训练 {fstd.performanceMetrics.last12Months.scheduledTrainingHours}h</Tag>
                        <Tag>停机 {fstd.performanceMetrics.last12Months.downtimeHours}h</Tag>
                        <Tag>损失训练时间 {fstd.performanceMetrics.last12Months.lostTrainingHours}h</Tag>
                        <Tag>缺陷 {fstd.performanceMetrics.last12Months.discrepancyCount}次</Tag>
                        <Tag>中断 {fstd.performanceMetrics.last12Months.interruptionCount}次</Tag>
                      </Space>
                      <Table
                        size="small"
                        rowKey="id"
                        pagination={false}
                        dataSource={fstd.performanceMetrics.monthly}
                        columns={[
                          { title: '年月', render: (_, m) => `${m.year}-${String(m.month).padStart(2, '0')}` },
                          { title: '计划可用(h)', dataIndex: 'plannedAvailableHours' },
                          { title: '排期训练(h)', dataIndex: 'scheduledTrainingHours' },
                          { title: '支持时间(h)', dataIndex: 'supportHours' },
                          { title: '设备故障(h)', dataIndex: 'fstdFailureHours' },
                          { title: '外部因素(h)', dataIndex: 'externalFailureHours' },
                          { title: '损失训练(h)', dataIndex: 'lostTrainingHours' },
                          { title: '缺陷数', dataIndex: 'discrepancyCount' },
                          { title: '中断数', dataIndex: 'interruptionCount' },
                          {
                            title: '可用率',
                            render: (_, m) => (m.availabilityPercent != null ? `${m.availabilityPercent.toFixed(1)}%` : '-'),
                          },
                          {
                            title: '可靠率',
                            render: (_, m) => (m.reliabilityPercent != null ? `${m.reliabilityPercent.toFixed(1)}%` : '-'),
                          },
                        ]}
                      />
                    </div>
                  )}
                  <List
                    header="周期性评估记录 (标准周期12个月, BITD为3年)"
                    size="small"
                    dataSource={fstd.evaluations ?? []}
                    locale={{ emptyText: '尚未记录任何周期性评估' }}
                    renderItem={(e) => (
                      <List.Item>
                        {new Date(e.periodStart).toLocaleDateString()} ~ {new Date(e.periodEnd).toLocaleDateString()}
                        , 结果: {e.result ?? '-'}
                        {e.evaluationType === 'extended' && <Tag color="purple" style={{ marginLeft: 8 }}>延长周期</Tag>}
                        {e.isWithinWindow === false && (
                          <Tag color="red" style={{ marginLeft: 8 }}>
                            超出评估窗口
                          </Tag>
                        )}
                        , 下次到期:{' '}
                        <Tag color={e.nextDueDate && new Date(e.nextDueDate) < new Date() ? 'red' : 'default'}>
                          {e.nextDueDate ? new Date(e.nextDueDate).toLocaleDateString() : '-'}
                        </Tag>
                      </List.Item>
                    )}
                  />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>变更管理 (3.3.6, ORA.GEN.130)</div>
                    <ChangeRequestPanel entityType="Fstd" entityId={fstd.id} />
                  </div>
                  <List
                    header="缺陷/故障处理 (3.3.7, 30天修复时限)"
                    size="small"
                    dataSource={fstd.discrepancies ?? []}
                    locale={{ emptyText: '暂无缺陷记录' }}
                    renderItem={(d) => {
                      const retentionExpired = d.retentionExpiresAt && new Date(d.retentionExpiresAt) < new Date()
                      const retentionActive = !!d.retentionCategory && !retentionExpired
                      return (
                      <List.Item
                        actions={
                          d.status === 'open'
                            ? [
                                <Button key="correct" size="small" onClick={() => setCorrectModalDiscrepancyId(d.id)}>
                                  标记已纠正
                                </Button>,
                                retentionActive ? (
                                  <Button key="clear-retention" size="small" onClick={() => handleClearRetention(d.id)}>
                                    取消保留分级
                                  </Button>
                                ) : (
                                  <Button key="set-retention" size="small" onClick={() => setRetentionModalDiscrepancyId(d.id)}>
                                    设置保留分级
                                  </Button>
                                ),
                                <Button key="movements" size="small" onClick={() => loadDiscrepancyMovements(d.id)}>
                                  查看关联备件领用记录
                                </Button>,
                              ]
                            : [
                                <Button key="movements" size="small" onClick={() => loadDiscrepancyMovements(d.id)}>
                                  查看关联备件领用记录
                                </Button>,
                              ]
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
                            {d.retentionCategory && (
                              <Tag color={retentionExpired ? 'default' : RETENTION_CATEGORY_LABEL[d.retentionCategory].color}>
                                {retentionExpired ? '保留分级已过期: ' : '保留分级: '}
                                {RETENTION_CATEGORY_LABEL[d.retentionCategory].text}
                                {d.retentionExpiresAt ? ` (至${new Date(d.retentionExpiresAt).toLocaleDateString()})` : ''}
                              </Tag>
                            )}
                            <span>{d.description}</span>
                          </Space>
                          {d.retentionCategory && (
                            <span style={{ color: '#888', fontSize: 12 }}>保留理由: {d.retentionJustification}</span>
                          )}
                          {discrepancyMovements[d.id] && (
                            <div style={{ marginTop: 4 }}>
                              {discrepancyMovements[d.id].length === 0 ? (
                                <span style={{ color: '#888', fontSize: 12 }}>暂无关联的备件领用记录</span>
                              ) : (
                                discrepancyMovements[d.id].map((m) => (
                                  <Tag key={m.id} color="blue">
                                    {m.type} {m.quantity} ({new Date(m.performedAt).toLocaleDateString()})
                                  </Tag>
                                ))
                              )}
                            </div>
                          )}
                          <span style={{ color: '#888', fontSize: 12 }}>
                            报告于 {new Date(d.reportedAt).toLocaleString()}, 修复时限:{' '}
                            {d.dueDate ? new Date(d.dueDate).toLocaleDateString() : '-'}
                            {d.correctiveAction ? ` | 纠正措施: ${d.correctiveAction}` : ''}
                          </span>
                        </Space>
                      </List.Item>
                    )}}
                  />
                  <List
                    header={
                      <Space>
                        常规维护(PM)记录 (3.3.10, 执行→审核两阶段签署)
                        <Button size="small" onClick={() => openPmTaskModal(fstd.id)} disabled={pmTemplates.length === 0}>
                          登记PM任务
                        </Button>
                      </Space>
                    }
                    size="small"
                    dataSource={fstd.pmTasks ?? []}
                    locale={{ emptyText: pmTemplates.length === 0 ? '请先在上方配置检查单模板' : '尚未登记任何PM任务' }}
                    renderItem={(t) => (
                      <List.Item
                        actions={
                          t.status === 'PENDING_REVIEW'
                            ? [
                                <Button
                                  key="review"
                                  size="small"
                                  type="primary"
                                  onClick={() => {
                                    pmReviewForm.resetFields()
                                    setPmReviewModal(t)
                                  }}
                                >
                                  审核
                                </Button>,
                              ]
                            : []
                        }
                      >
                        <Space direction="vertical" size={0} style={{ width: '100%' }}>
                          <Space wrap>
                            <Tag>{PM_CHECK_LEVEL_LABEL[t.level]}</Tag>
                            <Tag color={PM_TASK_STATUS_LABEL[t.status].color}>{PM_TASK_STATUS_LABEL[t.status].text}</Tag>
                            {t.itemResultsJson
                              .filter((i) => !i.passed)
                              .map((i, idx) => (
                                <Tag key={idx} color="red">
                                  {i.item}: {i.notes || '不合格'}
                                </Tag>
                              ))}
                          </Space>
                          <span style={{ color: '#888', fontSize: 12 }}>
                            任务日期 {new Date(t.taskDate).toLocaleDateString()}
                            {t.reviewedAt ? ` | 审核于 ${new Date(t.reviewedAt).toLocaleString()}` : ''}
                            {t.reviewNotes ? ` | 审核意见: ${t.reviewNotes}` : ''}
                          </span>
                        </Space>
                      </List.Item>
                    )}
                  />
                  <List
                    header="安全设施年检记录 (3.3.8, 标准周期12个月)"
                    size="small"
                    dataSource={fstd.safetyChecks ?? []}
                    locale={{ emptyText: '尚未记录任何年检' }}
                    renderItem={(c) => (
                      <List.Item>
                        <Space direction="vertical" size={0} style={{ width: '100%' }}>
                          <Space wrap>
                            <Tag color={c.overallResult === 'pass' ? 'green' : 'red'}>
                              {c.overallResult === 'pass' ? '全部合格' : '发现问题'}
                            </Tag>
                            {c.itemsJson
                              .filter((i) => !i.passed)
                              .map((i) => (
                                <Tag key={i.item} color="red">
                                  {i.item}: {i.notes || '不合格'}
                                </Tag>
                              ))}
                          </Space>
                          <span style={{ color: '#888', fontSize: 12 }}>
                            检查日期 {new Date(c.checkedAt).toLocaleDateString()}, 下次到期{' '}
                            {new Date(c.nextDueDate).toLocaleDateString()}
                          </span>
                        </Space>
                      </List.Item>
                    )}
                  />
                  <List
                    header="QTG/MQTG文档版本 (3.3.4: SOC/VDR/MQTG)"
                    size="small"
                    dataSource={fstd.qtgDocuments ?? []}
                    locale={{ emptyText: '尚未登记任何QTG文档' }}
                    renderItem={(d) => (
                      <List.Item
                        actions={
                          d.originalFileName
                            ? [
                                <Button key="download" size="small" icon={<DownloadOutlined />} onClick={() => handleDownloadQtgDocument(d)}>
                                  下载
                                </Button>,
                              ]
                            : []
                        }
                      >
                        <Tag color={d.documentType === 'MQTG' ? 'purple' : 'blue'}>{d.documentType}</Tag>
                        {d.version}
                        <Tag color={d.supersededAt ? 'default' : 'green'} style={{ marginLeft: 8 }}>
                          {d.supersededAt ? '历史版本' : '当前版本'}
                        </Tag>
                        <span style={{ color: '#888', marginLeft: 8 }}>
                          生效日期 {new Date(d.effectiveDate).toLocaleDateString()}
                          {d.documentType === 'MQTG' ? ' (设备全生命周期保存)' : ''}
                          {d.originalFileName
                            ? ` | 已上传文件: ${d.originalFileName} (${((d.fileSize ?? 0) / 1024).toFixed(1)} KB)`
                            : d.pointerUrl
                              ? ` | 外部链接: ${d.pointerUrl}`
                              : ''}
                        </span>
                      </List.Item>
                    )}
                  />
                  <List
                    header="年度QTG季度滚动运行 (3.3.4, 不允许年检前突击补测)"
                    size="small"
                    dataSource={fstd.qtgRuns ?? []}
                    locale={{ emptyText: '尚未记录任何季度运行' }}
                    renderItem={(r) => (
                      <List.Item>
                        <Tag>{r.year} Q{r.quarter}</Tag>
                        {r.completedAt ? new Date(r.completedAt).toLocaleDateString() : '未完成'}
                        {r.result && <Tag style={{ marginLeft: 8 }}>{r.result}</Tag>}
                        {r.burstTested && (
                          <Tag color="red" style={{ marginLeft: 8 }}>
                            完成日期不在所属季度内 (疑似突击补测)
                          </Tag>
                        )}
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
        <Form form={form} layout="vertical" initialValues={{ qualificationBasisType: 'EASA_LEGACY_LEVEL' }}>
          <Form.Item name="deviceCode" label="设备编号" rules={[{ required: true }]}>
            <Input placeholder="如 FFS-01" />
          </Form.Item>
          <Form.Item name="representedAircraft" label="代表机型" rules={[{ required: true }]}>
            <Input placeholder="如 A320" />
          </Form.Item>
          <Form.Item name="deviceType" label="设备类型" rules={[{ required: true }]}>
            <Select options={DEVICE_TYPES.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="qualificationBasisType" label="鉴定基础 (3.3.1)" rules={[{ required: true }]}>
            <Select
              options={QUALIFICATION_BASIS_TYPES.map((v) => ({
                value: v,
                label: v === 'EASA_FCS' ? 'EASA_FCS (CS-FSTD Issue 1, 14特征矩阵)' : 'EASA_LEGACY_LEVEL (CS-FSTD(A) Issue 2)',
              }))}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.qualificationBasisType !== cur.qualificationBasisType}>
            {({ getFieldValue }) =>
              getFieldValue('qualificationBasisType') !== 'EASA_FCS' && (
                <Form.Item name="legacyLevel" label="EASA 等级 (CS-FSTD(A) Issue 2)">
                  <Select allowClear options={LEGACY_LEVELS.map((v) => ({ value: v, label: v }))} />
                </Form.Item>
              )
            }
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="记录周期性评估"
        open={!!evalModalFstdId}
        onOk={handleRecordEvaluation}
        onCancel={() => setEvalModalFstdId(undefined)}
      >
        <Form
          form={evalForm}
          layout="vertical"
          initialValues={{ range: [dayjs().subtract(5, 'day'), dayjs()], result: 'pass', useExtension: false, extensionMonths: 24 }}
        >
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
          <Form.Item name="useExtension" label="延长评估周期至24/36个月 (3.3.5)" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.useExtension !== cur.useExtension}>
            {({ getFieldValue }) =>
              getFieldValue('useExtension') && (
                <>
                  {extensionEligibility && (
                    <Alert
                      style={{ marginBottom: 12 }}
                      type={extensionEligibility.has36MonthsCompliantRecord && extensionEligibility.hasAnnualManagementAudit ? 'success' : 'warning'}
                      showIcon
                      message="延长资格系统可核实项 (仅供参考, 最终由主管机关判断)"
                      description={
                        <>
                          <div>{extensionEligibility.has36MonthsCompliantRecord ? '✓' : '✗'} 连续36个月合规评估记录</div>
                          <div>{extensionEligibility.hasAnnualManagementAudit ? '✓' : '✗'} 近12个月管理体系审计</div>
                          <div>⚠ 指定合格人员自评: 需人工确认 (见下方勾选)</div>
                        </>
                      }
                    />
                  )}
                  <Form.Item name="extensionMonths" label="延长周期" rules={[{ required: true }]}>
                    <Select
                      options={[
                        { value: 24, label: '24个月' },
                        { value: 36, label: '36个月' },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item
                    name="selfAssessmentConfirmed"
                    valuePropName="checked"
                    rules={[{ validator: (_, v) => (v ? Promise.resolve() : Promise.reject(new Error('须确认已完成指定合格人员自评'))) }]}
                  >
                    <Switch checkedChildren="已完成指定合格人员自评" unCheckedChildren="尚未确认" />
                  </Form.Item>
                </>
              )
            }
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

      <Modal
        title="设置故障保留分级"
        open={!!retentionModalDiscrepancyId}
        onOk={handleSetRetention}
        onCancel={() => setRetentionModalDiscrepancyId(undefined)}
      >
        <Form form={retentionForm} layout="vertical">
          <Form.Item name="category" label="保留分级" rules={[{ required: true }]}>
            <Select
              options={(Object.keys(RETENTION_CATEGORY_LABEL) as RetentionCategory[]).map((c) => ({
                value: c,
                label: RETENTION_CATEGORY_LABEL[c].text,
              }))}
            />
          </Form.Item>
          <Form.Item name="justification" label="保留理由" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="说明该缺陷不影响本次训练科目开展的依据" />
          </Form.Item>
          <Form.Item name="approvedById" label="批准人" rules={[{ required: true }]}>
            <Select options={personnel.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))} />
          </Form.Item>
          <Form.Item name="expiresAt" label="有效期至 (可选, 不填则长期有效直至手动取消)">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="配置常规维护(PM)检查单模板"
        open={pmTemplateModalOpen}
        onOk={handleSetPmTemplate}
        onCancel={() => setPmTemplateModalOpen(false)}
        width={600}
      >
        <Form form={pmTemplateForm} layout="vertical">
          <Form.Item name="level" label="层级" rules={[{ required: true }]}>
            <Select options={PM_CHECK_LEVELS.map((l) => ({ value: l, label: PM_CHECK_LEVEL_LABEL[l] }))} />
          </Form.Item>
          <Form.List name="items" initialValue={[{ item: '' }]}>
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                    <Form.Item name={[field.name, 'item']} rules={[{ required: true, message: '检查项内容' }]}>
                      <Input placeholder="如: 检查刹车片磨损" style={{ width: 400 }} />
                    </Form.Item>
                    <DeleteOutlined onClick={() => remove(field.name)} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />}>
                  添加检查项
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      <Modal
        title="登记PM任务"
        open={!!pmTaskModalFstdId}
        onOk={handleCreatePmTask}
        onCancel={() => setPmTaskModalFstdId(undefined)}
        width={600}
      >
        <Form form={pmTaskForm} layout="vertical" initialValues={{ taskDate: dayjs() }}>
          <Form.Item name="level" label="层级" rules={[{ required: true }]}>
            <Select
              options={pmTemplates.map((t) => ({ value: t.level, label: PM_CHECK_LEVEL_LABEL[t.level] }))}
              onChange={(level: PmCheckLevel) => {
                setPmTaskLevel(level)
                const template = pmTemplates.find((t) => t.level === level)
                pmTaskForm.setFieldsValue({
                  items: (template?.itemsJson ?? []).map((i) => ({ item: i.item, passed: true, notes: '' })),
                })
              }}
            />
          </Form.Item>
          <Form.Item name="taskDate" label="任务日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="performedById" label="执行人">
            <Select allowClear options={personnel.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))} />
          </Form.Item>
          <Form.Item name="responsibleIds" label="责任人 (可多选)">
            <Select mode="multiple" options={personnel.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))} />
          </Form.Item>
          {pmTaskLevel && (
            <Form.List name="items">
              {(fields) => (
                <>
                  {fields.map((field) => (
                    <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }} wrap>
                      <Form.Item noStyle shouldUpdate>
                        {({ getFieldValue }) => <span>{getFieldValue(['items', field.name, 'item'])}</span>}
                      </Form.Item>
                      <Form.Item name={[field.name, 'passed']} valuePropName="checked" noStyle>
                        <Switch checkedChildren="合格" unCheckedChildren="不合格" />
                      </Form.Item>
                      <Form.Item name={[field.name, 'notes']} noStyle>
                        <Input placeholder="备注(不合格时说明情况)" style={{ width: 220 }} />
                      </Form.Item>
                    </Space>
                  ))}
                </>
              )}
            </Form.List>
          )}
        </Form>
      </Modal>

      <Modal
        title="审核PM任务"
        open={!!pmReviewModal}
        onCancel={() => setPmReviewModal(undefined)}
        footer={
          <Space>
            <Button onClick={() => setPmReviewModal(undefined)}>Cancel</Button>
            <Button danger onClick={() => handleReviewPmTask(false)}>
              审核不通过
            </Button>
            <Button type="primary" onClick={() => handleReviewPmTask(true)}>
              审核通过
            </Button>
          </Space>
        }
      >
        <Form form={pmReviewForm} layout="vertical">
          <Form.Item name="reviewedById" label="审核人 (须与执行人不同)" rules={[{ required: true }]}>
            <Select options={personnel.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))} />
          </Form.Item>
          <Form.Item name="reviewNotes" label="审核意见">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="记录安全设施年检 (3.3.8, ORA.FSTD.115(b))"
        open={!!safetyCheckModalFstdId}
        onOk={handleRecordSafetyCheck}
        onCancel={() => setSafetyCheckModalFstdId(undefined)}
      >
        <Form form={safetyCheckForm} layout="vertical" initialValues={{ checkedAt: dayjs() }}>
          <Form.Item name="checkedAt" label="检查日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          {SAFETY_CHECK_ITEMS.map((item) => (
            <Form.Item key={item} label={item} style={{ marginBottom: 12 }}>
              <Switch
                checked={safetyCheckItemState[item]}
                checkedChildren="合格"
                unCheckedChildren="不合格"
                onChange={(checked) => setSafetyCheckItemState((s) => ({ ...s, [item]: checked }))}
              />
            </Form.Item>
          ))}
          {Object.values(safetyCheckItemState).some((v) => !v) && (
            <Form.Item name="notes" label="不合格项说明">
              <Input.TextArea rows={2} />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title="登记QTG文档版本 (3.3.4)"
        open={!!qtgDocModalFstdId}
        onOk={handleAddQtgDocument}
        onCancel={() => setQtgDocModalFstdId(undefined)}
      >
        <Form form={qtgDocForm} layout="vertical">
          <Form.Item name="documentType" label="文档类型" rules={[{ required: true }]}>
            <Select
              options={QTG_DOCUMENT_TYPES.map((v) => ({
                value: v,
                label: v === 'MQTG' ? 'MQTG (主鉴定测试指南, 设备全生命周期保存)' : v,
              }))}
            />
          </Form.Item>
          <Form.Item name="version" label="版本号" rules={[{ required: true }]}>
            <Input placeholder="如 v2.0" />
          </Form.Item>
          <Form.Item name="effectiveDate" label="生效日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="fileList"
            label="上传文件 (PDF/Word/Excel/图片, 最大25MB)"
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
          >
            <Upload beforeUpload={() => false} maxCount={1} accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg">
              <Button icon={<UploadOutlined />}>选择文件</Button>
            </Upload>
          </Form.Item>
          <Form.Item name="pointerUrl" label="或填写外部引用链接 (未上传文件时使用, 如内部文档系统地址)">
            <Input placeholder="如 https://docs.internal/mqtg-v2" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="记录季度QTG运行 (3.3.4)"
        open={!!qtgRunModalFstdId}
        onOk={handleRecordQuarterlyRun}
        onCancel={() => setQtgRunModalFstdId(undefined)}
      >
        <Form form={qtgRunForm} layout="vertical" initialValues={{ year: dayjs().year(), completedAt: dayjs() }}>
          <Form.Item name="year" label="年度" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="quarter" label="季度 (1-4)" rules={[{ required: true }]}>
            <Select
              options={[1, 2, 3, 4].map((q) => ({ value: q, label: `Q${q}` }))}
            />
          </Form.Item>
          <Form.Item name="completedAt" label="实际完成日期 (须落在所属季度内, 否则判定为突击补测)" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="result" label="结果">
            <Select
              options={[
                { value: 'pass', label: '通过' },
                { value: 'partial', label: '部分通过' },
                { value: 'fail', label: '未通过' },
              ]}
            />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="登记FCS能力 (3.3.2)"
        open={!!fcsCapModalFstdId}
        onOk={handleSetFcsCapability}
        onCancel={() => setFcsCapModalFstdId(undefined)}
      >
        <Form form={fcsCapForm} layout="vertical">
          <Form.Item name="characteristic" label="特征" rules={[{ required: true }]}>
            <Select options={FCS_CHARACTERISTICS.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="fidelityLevel" label="保真度 (N < G < R < S)" rules={[{ required: true }]}>
            <Select options={FCS_FIDELITY_LEVELS.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="subsystem" label="子系统 (仅SYS特征需要展开时填写)">
            <Input placeholder="如: autopilot / FMS / hydraulics" />
          </Form.Item>
          <Form.Item name="isAssigned" label="是否为assigned FCS (主管机关为存量设备指定)" initialValue={false}>
            <Select
              options={[
                { value: false, label: '否 (原生FCS鉴定)' },
                { value: true, label: '是 (assigned FCS)' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="科目能力检查 (can_device_perform_task)"
        open={!!checkTaskModalFstdId}
        onOk={handleCheckTask}
        onCancel={() => setCheckTaskModalFstdId(undefined)}
        okText="检查"
      >
        <Form form={checkTaskForm} layout="vertical">
          <Form.Item name="taskCode" label="训练科目编号" rules={[{ required: true }]}>
            <Input placeholder="如 CPL-01 (legacy) 或 FCS-APPR-01 (FCS)" />
          </Form.Item>
        </Form>
        {checkTaskResult && (
          <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
            <Alert
              type={checkTaskResult.canStartTraining ? 'success' : 'error'}
              showIcon
              message={`可开始训练 (T): ${checkTaskResult.canStartTraining ? '满足' : '不满足'} (判定依据: ${checkTaskResult.basis})`}
            />
            <Alert
              type={checkTaskResult.canCompleteTraining ? 'success' : 'warning'}
              showIcon
              message={`可完成训练并计入学时 (TP): ${checkTaskResult.canCompleteTraining ? '满足' : '不满足'}`}
              description={checkTaskResult.reason}
            />
          </Space>
        )}
      </Modal>

      <Modal
        title="登记训练矩阵条目 (3.3.3)"
        open={trainingMatrixModalOpen}
        onOk={handleAddTrainingMatrixEntry}
        onCancel={() => setTrainingMatrixModalOpen(false)}
      >
        <Form form={trainingMatrixForm} layout="vertical">
          <Form.Item name="taskCode" label="训练科目编号" rules={[{ required: true }]}>
            <Input placeholder="如 FCS-APPR-01" />
          </Form.Item>
          <Form.Item name="taskName" label="训练科目名称" rules={[{ required: true }]}>
            <Input placeholder="如 Visual approach" />
          </Form.Item>
          <Form.Item name="characteristic" label="特征" rules={[{ required: true }]}>
            <Select options={FCS_CHARACTERISTICS.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="thresholdT" label="T阈值 (可开始训练)" rules={[{ required: true }]}>
            <Select options={FCS_FIDELITY_LEVELS.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="thresholdTP" label="TP阈值 (完成训练)" rules={[{ required: true }]}>
            <Select options={FCS_FIDELITY_LEVELS.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="登记ESL装备规格清单新版本 (AMC1/AMC2 ORA.FSTD.120)"
        open={!!eslModalFstdId}
        onOk={handleCreateEslRevision}
        onCancel={() => setEslModalFstdId(undefined)}
        width={800}
      >
        <Form form={eslForm} layout="vertical" initialValues={{ revisionDate: dayjs() }}>
          <Space>
            <Form.Item name="revisionNumber" label="修订版本号" rules={[{ required: true }]}>
              <Input placeholder="如 R1" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="revisionDate" label="修订日期" rules={[{ required: true }]}>
              <DatePicker />
            </Form.Item>
          </Space>
        </Form>
        <Table<{ characteristic: FcsCharacteristic }>
          rowKey="characteristic"
          size="small"
          pagination={false}
          dataSource={FCS_CHARACTERISTICS.map((c) => ({ characteristic: c }))}
          columns={[
            { title: '特征', dataIndex: 'characteristic', width: 70, render: (v: FcsCharacteristic) => <Tag>{v}</Tag> },
            {
              title: '保真度 (存量设备可留空)',
              width: 150,
              render: (_, row) => (
                <Select
                  allowClear
                  size="small"
                  style={{ width: '100%' }}
                  value={eslEntryState[row.characteristic].fidelityLevel}
                  options={FCS_FIDELITY_LEVELS.map((v) => ({ value: v, label: v }))}
                  onChange={(v) =>
                    setEslEntryState((s) => ({ ...s, [row.characteristic]: { ...s[row.characteristic], fidelityLevel: v } }))
                  }
                />
              ),
            },
            {
              title: '设备描述',
              render: (_, row) => (
                <Input
                  size="small"
                  value={eslEntryState[row.characteristic].equipmentDescription}
                  onChange={(e) =>
                    setEslEntryState((s) => ({
                      ...s,
                      [row.characteristic]: { ...s[row.characteristic], equipmentDescription: e.target.value },
                    }))
                  }
                />
              ),
            },
            {
              title: '限制说明',
              render: (_, row) => (
                <Input
                  size="small"
                  value={eslEntryState[row.characteristic].limitations}
                  onChange={(e) =>
                    setEslEntryState((s) => ({ ...s, [row.characteristic]: { ...s[row.characteristic], limitations: e.target.value } }))
                  }
                />
              ),
            },
          ]}
        />
      </Modal>

      <Modal
        title="声明确认ESL (须由组织指定的合规负责人 ORA.GEN.210(b) 声明)"
        open={!!eslDeclareModalId}
        onOk={handleDeclareEsl}
        onCancel={() => setEslDeclareModalId(undefined)}
      >
        <Form form={eslDeclareForm} layout="vertical">
          <Form.Item name="personnelId" label="声明人" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={personnel.map((p) => ({ value: p.id, label: `${p.lastName}${p.firstName}` }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="登记FSTD性能指标 (AMC1 ORA.FSTD.100(d), 按月登记, 同年月重复登记将覆盖)"
        open={!!perfMetricModalFstdId}
        onOk={handleRecordPerformanceMetric}
        onCancel={() => setPerfMetricModalFstdId(undefined)}
        width={600}
      >
        <Form
          form={perfMetricForm}
          layout="vertical"
          initialValues={{
            period: dayjs(),
            plannedAvailableHours: 0,
            scheduledTrainingHours: 0,
            supportHours: 0,
            fstdFailureHours: 0,
            externalFailureHours: 0,
            lostTrainingHours: 0,
            discrepancyCount: 0,
            interruptionCount: 0,
          }}
        >
          <Form.Item name="period" label="年月" rules={[{ required: true }]}>
            <DatePicker picker="month" style={{ width: '100%' }} />
          </Form.Item>
          <Space wrap>
            <Form.Item name="plannedAvailableHours" label="计划可用时间(h)" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="scheduledTrainingHours" label="排期训练时间(h)" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="supportHours" label="支持时间(h, 计划性不可用)" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: 160 }} />
            </Form.Item>
          </Space>
          <Space wrap>
            <Form.Item name="fstdFailureHours" label="设备故障时间(h)" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="externalFailureHours" label="外部因素损失时间(h)" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="lostTrainingHours" label="损失训练时间(h)" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: 160 }} />
            </Form.Item>
          </Space>
          <Space wrap>
            <Form.Item name="discrepancyCount" label="缺陷次数" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="interruptionCount" label="中断次数" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: 160 }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}
