import { DeleteOutlined, DownloadOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { Alert, App, Button, DatePicker, Empty, Form, Input, InputNumber, List, Modal, Select, Space, Switch, Table, Tag, Upload } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  Discrepancy,
  EquipmentSpecificationList,
  EvaluationDueSoonItem,
  ExtensionEligibility,
  FcsCharacteristic,
  FcsFidelityLevel,
  FstdFcsCapability,
  FstdQms,
  PerformanceMetricsSummary,
  PmChecklistTemplate,
  PmCheckLevel,
  PmTask,
  PmTaskDueSoonItem,
  PreFlightCheck,
  PreFlightCheckDueSoonItem,
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
import { resolveStandard, useStandardText } from '../hooks/useRegulatoryStandard'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'

const RETENTION_CATEGORY_COLOR: Record<RetentionCategory, string> = {
  CATEGORY_I: 'red',
  CATEGORY_II: 'orange',
  CATEGORY_III: 'gold',
}

const PM_CHECK_LEVELS: PmCheckLevel[] = ['WEEKLY', 'MONTHLY', 'SEMI_ANNUAL', 'ANNUAL']
const PM_TASK_STATUS_COLOR: Record<PmTask['status'], string> = {
  PENDING_REVIEW: 'orange',
  APPROVED: 'green',
  REJECTED: 'red',
}

const DEVICE_TYPES: FstdDeviceType[] = ['FFS', 'FTD', 'FNPT', 'BITD']
// 注意: 这些是写入后端的实际数据值(item字段), 不是纯UI文案, 保持固定不随语言切换翻译, 以免新旧记录的item名称不一致
const SAFETY_CHECK_ITEMS = ['急停按钮', '应急照明', '灭火器', '舱内通讯系统']
const QTG_DOCUMENT_TYPES: QtgDocumentType[] = ['SOC', 'VDR', 'MQTG']
const LEGACY_LEVELS: LegacyLevel[] = [
  'FFS_A', 'FFS_B', 'FFS_C', 'FFS_D', 'FTD_1', 'FTD_2', 'FNPT_I', 'FNPT_II', 'FNPT_II_MCC', 'BITD',
]
// CCAR-60 第60.71条: FFS A-D, FTD 1-7
const CCAR_60_LEVELS: LegacyLevel[] = ['FFS_A', 'FFS_B', 'FFS_C', 'FFS_D', 'FTD_1', 'FTD_2', 'FTD_3', 'FTD_4', 'FTD_5', 'FTD_6', 'FTD_7']
const QUALIFICATION_BASIS_TYPES: FstdQualificationBasisType[] = ['EASA_LEGACY_LEVEL', 'EASA_FCS', 'CCAR_60']
const BASIS_TAG_COLOR: Record<FstdQualificationBasisType, string> = { EASA_LEGACY_LEVEL: 'blue', EASA_FCS: 'purple', CCAR_60: 'red' }
const FCS_CHARACTERISTICS: FcsCharacteristic[] = [
  'FDK', 'CLH', 'CLO', 'SYS', 'GND', 'IGE', 'OGE', 'SND', 'VIB', 'MTN', 'VIS', 'NAV', 'ATM', 'OST',
]
const FCS_FIDELITY_LEVELS: FcsFidelityLevel[] = ['N', 'G', 'R', 'S']
const FIDELITY_COLOR: Record<FcsFidelityLevel, string> = { N: 'default', G: 'blue', R: 'orange', S: 'purple' }

interface FstdDetail extends Fstd {
  evaluations?: RecurrentEvaluation[]
  discrepancies?: Discrepancy[]
  safetyChecks?: SafetyFacilityCheck[]
  preFlightChecks?: PreFlightCheck[]
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
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { organizations, selectedId, select } = useSelectedOrganization()
  const regulatoryStandard = resolveStandard(organizations, selectedId)
  const isCaac = regulatoryStandard === 'CAAC'
  const { ts } = useStandardText(regulatoryStandard)
  const [qms, setQms] = useState<FstdQms>()
  const [qmsChecklist, setQmsChecklist] = useState<string[]>([])
  const [qmsItemState, setQmsItemState] = useState<Record<string, { compliant: boolean; notes: string }>>({})
  const [qmsForm] = Form.useForm()
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
  const [preFlightCheckItems, setPreFlightCheckItems] = useState<string[]>([])
  const [preFlightCheckDueSoon, setPreFlightCheckDueSoon] = useState<PreFlightCheckDueSoonItem[]>([])
  const [preFlightCheckModalFstdId, setPreFlightCheckModalFstdId] = useState<string>()
  const [preFlightCheckItemState, setPreFlightCheckItemState] = useState<Record<string, boolean>>({})
  const [preFlightCheckForm] = Form.useForm()
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
          preFlightChecks: await fstdsApi.listPreFlightChecks(f.id),
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
    fstdsApi.findPreFlightChecksDueSoon().then(setPreFlightCheckDueSoon)
    fstdsApi.findQuarterlyQtgIssues().then(setQtgIssues)
    fstdsApi.listPmChecklistTemplates(selectedId).then(setPmTemplates)
    fstdsApi.findPmTasksDueSoon().then(setPmDueSoon)
    fstdsApi.getQms(selectedId).then((q) => {
      setQms(q)
      qmsForm.setFieldsValue({
        establishedAt: q.establishedAt ? dayjs(q.establishedAt) : undefined,
        designatedManagerName: q.designatedManagerName ?? undefined,
        lastInternalAuditAt: q.lastInternalAuditAt ? dayjs(q.lastInternalAuditAt) : undefined,
      })
      setQmsItemState(Object.fromEntries((q.itemsJson ?? []).map((i) => [i.item, { compliant: i.compliant, notes: i.notes ?? '' }])))
    })
  }

  useEffect(() => {
    load()
  }, [selectedId])

  useEffect(() => {
    fstdsApi.listTrainingMatrixEntries().then(setTrainingMatrixEntries)
    fstdsApi.listQmsChecklistItems().then(setQmsChecklist)
    fstdsApi.listPreFlightCheckItems().then(setPreFlightCheckItems)
    personnelApi.list().then(setPersonnel)
  }, [])

  const handleCreate = async () => {
    if (!selectedId) return
    const values = await form.validateFields()
    await fstdsApi.create({ organizationId: selectedId, ...values })
    message.success(t('fstdsPage.createSuccess'))
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
      result.isWithinWindow === false ? t('fstdsPage.evalRecordedLate') : t('fstdsPage.evalRecorded'),
    )
    setEvalModalFstdId(undefined)
    evalForm.resetFields()
    load()
  }

  const handleReportDiscrepancy = async () => {
    if (!discrepancyModalFstdId) return
    const values = await discrepancyForm.validateFields()
    await fstdsApi.reportDiscrepancy(discrepancyModalFstdId, values)
    message.success(t('fstdsPage.discrepancyReported'))
    setDiscrepancyModalFstdId(undefined)
    discrepancyForm.resetFields()
    load()
  }

  const handleCorrectDiscrepancy = async () => {
    if (!correctModalDiscrepancyId) return
    const values = await correctForm.validateFields()
    await fstdsApi.correctDiscrepancy(correctModalDiscrepancyId, values)
    message.success(t('fstdsPage.discrepancyCorrected'))
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
    message.success(t('fstdsPage.retentionSet'))
    setRetentionModalDiscrepancyId(undefined)
    retentionForm.resetFields()
    load()
  }

  const handleClearRetention = async (discrepancyId: string) => {
    await fstdsApi.clearDiscrepancyRetention(discrepancyId)
    message.success(t('fstdsPage.retentionCleared'))
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
    message.success(t('fstdsPage.safetyCheckRecorded'))
    setSafetyCheckModalFstdId(undefined)
    load()
  }

  const openPreFlightCheckModal = (fstdId: string) => {
    setPreFlightCheckItemState(Object.fromEntries(preFlightCheckItems.map((item) => [item, true])))
    preFlightCheckForm.resetFields()
    setPreFlightCheckModalFstdId(fstdId)
  }

  const handleRecordPreFlightCheck = async () => {
    if (!preFlightCheckModalFstdId) return
    const values = await preFlightCheckForm.validateFields()
    await fstdsApi.recordPreFlightCheck(preFlightCheckModalFstdId, {
      checkDate: values.checkDate.format('YYYY-MM-DD'),
      performedById: values.performedById,
      items: preFlightCheckItems.map((item) => ({
        item,
        passed: preFlightCheckItemState[item],
        notes: !preFlightCheckItemState[item] ? values.notes : undefined,
      })),
    })
    message.success(t('fstdsPage.preFlightCheckRecorded'))
    setPreFlightCheckModalFstdId(undefined)
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
    message.success(t('fstdsPage.qtgDocRegistered'))
    setQtgDocModalFstdId(undefined)
    qtgDocForm.resetFields()
    load()
  }

  const handleDownloadQtgDocument = async (doc: QtgDocument) => {
    try {
      await fstdsApi.downloadQtgDocumentFile(doc)
    } catch {
      message.error(t('fstdsPage.qtgDownloadFailed'))
    }
  }

  const handleRecordQuarterlyRun = async () => {
    if (!qtgRunModalFstdId) return
    const values = await qtgRunForm.validateFields()
    await fstdsApi.recordQuarterlyQtgRun(qtgRunModalFstdId, {
      ...values,
      completedAt: values.completedAt.format('YYYY-MM-DD'),
    })
    message.success(t('fstdsPage.qtgRunRecorded'))
    setQtgRunModalFstdId(undefined)
    qtgRunForm.resetFields()
    load()
  }

  const handleSetFcsCapability = async () => {
    if (!fcsCapModalFstdId) return
    const values = await fcsCapForm.validateFields()
    try {
      await fstdsApi.setFcsCapability(fcsCapModalFstdId, values)
      message.success(t('fstdsPage.fcsCapabilitySet'))
      setFcsCapModalFstdId(undefined)
      fcsCapForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('fstdsPage.operationFailed'))
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
    message.success(t('fstdsPage.trainingMatrixEntryAdded'))
    trainingMatrixForm.resetFields()
    fstdsApi.listTrainingMatrixEntries().then(setTrainingMatrixEntries)
  }

  const handleSetPmTemplate = async () => {
    if (!selectedId) return
    const values = await pmTemplateForm.validateFields()
    const itemsJson = (values.items as { item: string }[]).filter((i) => i?.item)
    await fstdsApi.setPmChecklistTemplate({ organizationId: selectedId, level: values.level, itemsJson })
    message.success(t('fstdsPage.pmTemplateSaved'))
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
      message.success(t('fstdsPage.pmTaskCreated'))
      setPmTaskModalFstdId(undefined)
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('fstdsPage.operationFailed'))
    }
  }

  const handleReviewPmTask = async (approve: boolean) => {
    if (!pmReviewModal) return
    const values = await pmReviewForm.validateFields()
    try {
      await fstdsApi.reviewPmTask(pmReviewModal.id, { approve, reviewedById: values.reviewedById, reviewNotes: values.reviewNotes })
      message.success(approve ? t('fstdsPage.pmReviewApproved') : t('fstdsPage.pmReviewRejected'))
      setPmReviewModal(undefined)
      pmReviewForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('fstdsPage.operationFailed'))
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
    message.success(t('fstdsPage.eslRevisionCreated'))
    setEslModalFstdId(undefined)
    load()
  }

  const handleDeclareEsl = async () => {
    if (!eslDeclareModalId) return
    const values = await eslDeclareForm.validateFields()
    try {
      await fstdsApi.declareEsl(eslDeclareModalId, values.personnelId)
      message.success(t('fstdsPage.eslDeclared'))
      setEslDeclareModalId(undefined)
      eslDeclareForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('fstdsPage.eslDeclareFailed'))
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
    message.success(t('fstdsPage.perfMetricRecorded'))
    setPerfMetricModalFstdId(undefined)
    perfMetricForm.resetFields()
    load()
  }

  const handleSaveQms = async () => {
    if (!selectedId) return
    const values = await qmsForm.validateFields()
    const items = qmsChecklist.map((item) => ({ item, ...(qmsItemState[item] ?? { compliant: true, notes: '' }) }))
    const updated = await fstdsApi.upsertQms({
      organizationId: selectedId,
      establishedAt: values.establishedAt ? values.establishedAt.format('YYYY-MM-DD') : undefined,
      designatedManagerName: values.designatedManagerName,
      items,
      lastInternalAuditAt: values.lastInternalAuditAt ? values.lastInternalAuditAt.format('YYYY-MM-DD') : undefined,
    })
    setQms(updated)
    message.success(t('fstdsPage.qmsSaved'))
  }

  const handleSetLargeAircraftFlag = async (fstdId: string, isLargeAircraftPublicTransport: boolean) => {
    await fstdsApi.update(fstdId, { isLargeAircraftPublicTransport })
    message.success(t('fstdsPage.largeAircraftFlagUpdated'))
    load()
  }

  // CCAR-60第60.19条: 有效期档位由QMS建立状态+设备档位决定, 供UI展示参考 (真正写库由后端recordRecurrentEvaluation统一计算)
  const computeCaacValidityMonths = (fstd: Fstd): number => {
    if (fstd.deviceType === 'FFS' && fstd.isLargeAircraftPublicTransport) return qms?.isEstablished ? 12 : 6
    if (fstd.deviceType === 'FFS') return qms?.isEstablished ? 24 : 12
    return qms?.isEstablished ? 36 : 18
  }

  return (
    <div>
      <OrganizationSelector organizations={organizations} selectedId={selectedId} onChange={select} />

      <div style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 8 }}>
          <span style={{ fontWeight: 600 }}>{t('fstdsPage.trainingMatrixTitle')}</span>
          <Button size="small" icon={<PlusOutlined />} onClick={() => setTrainingMatrixModalOpen(true)}>
            {t('fstdsPage.registerEntry')}
          </Button>
        </Space>
        <Table<TrainingMatrixEntry>
          rowKey="id"
          size="small"
          dataSource={trainingMatrixEntries}
          pagination={false}
          locale={{ emptyText: t('fstdsPage.noTrainingMatrixEntries') }}
          columns={[
            { title: t('fstdsPage.columnTaskCode'), dataIndex: 'taskCode' },
            { title: t('fstdsPage.columnTaskName'), dataIndex: 'taskName' },
            { title: t('fstdsPage.columnCharacteristic'), dataIndex: 'characteristic', render: (v: FcsCharacteristic) => <Tag>{v}</Tag> },
            { title: t('fstdsPage.columnThresholdT'), dataIndex: 'thresholdT', render: (v: FcsFidelityLevel) => <Tag color={FIDELITY_COLOR[v]}>{v}</Tag> },
            { title: t('fstdsPage.columnThresholdTP'), dataIndex: 'thresholdTP', render: (v: FcsFidelityLevel) => <Tag color={FIDELITY_COLOR[v]}>{v}</Tag> },
          ]}
        />
      </div>

      {!selectedId ? (
        <Empty description={t('fstdsPage.selectOrgFirst')} />
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <Space style={{ marginBottom: 8 }}>
              <span style={{ fontWeight: 600 }}>{t('fstdsPage.pmTemplateTitle')}</span>
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() => {
                  pmTemplateForm.resetFields()
                  setPmTemplateModalOpen(true)
                }}
              >
                {t('fstdsPage.configureTemplate')}
              </Button>
            </Space>
            <Table<PmChecklistTemplate>
              rowKey="id"
              size="small"
              dataSource={pmTemplates}
              pagination={false}
              locale={{ emptyText: t('fstdsPage.noPmTemplates') }}
              columns={[
                { title: t('fstdsPage.columnLevel'), dataIndex: 'level', render: (v: PmCheckLevel) => <Tag>{t(`fstdsPage.pmCheckLevels.${v}`)}</Tag> },
                { title: t('fstdsPage.columnCheckItems'), render: (_, tpl) => tpl.itemsJson.map((i) => i.item).join('、') },
                { title: t('fstdsPage.columnUpdatedAt'), dataIndex: 'updatedAt', render: (v: string) => new Date(v).toLocaleString() },
              ]}
            />
          </div>

          {isCaac && (
            <div style={{ marginBottom: 16, border: '1px solid #f0f0f0', borderRadius: 8, padding: 16 }}>
              <Space style={{ marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>{t('fstdsPage.qmsTitle')}</span>
                <Tag color={qms?.isEstablished ? 'green' : 'orange'}>
                  {qms?.isEstablished ? t('fstdsPage.qmsEstablished') : t('fstdsPage.qmsNotEstablished')}
                </Tag>
              </Space>
              <Alert style={{ marginBottom: 12 }} type="info" showIcon message={t('fstdsPage.qmsIntro')} />
              <Form form={qmsForm} layout="vertical">
                <Space size="large" wrap>
                  <Form.Item name="establishedAt" label={t('fstdsPage.qmsFieldEstablishedAt')}>
                    <DatePicker />
                  </Form.Item>
                  <Form.Item name="designatedManagerName" label={t('fstdsPage.qmsFieldManagerName')}>
                    <Input style={{ width: 200 }} />
                  </Form.Item>
                  <Form.Item name="lastInternalAuditAt" label={t('fstdsPage.qmsFieldLastAuditAt')}>
                    <DatePicker />
                  </Form.Item>
                </Space>
              </Form>
              <List
                size="small"
                dataSource={qmsChecklist}
                renderItem={(item) => (
                  <List.Item>
                    <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
                      <span>{item}</span>
                      <Switch
                        checked={qmsItemState[item]?.compliant ?? true}
                        checkedChildren={t('organizations.detail.checklistCompliant')}
                        unCheckedChildren={t('organizations.detail.checklistNonCompliant')}
                        onChange={(checked) => setQmsItemState((s) => ({ ...s, [item]: { ...s[item], compliant: checked } }))}
                      />
                    </Space>
                  </List.Item>
                )}
              />
              <Button type="primary" style={{ marginTop: 12 }} onClick={handleSaveQms}>
                {t('fstdsPage.qmsSave')}
              </Button>
            </div>
          )}

          {pmDueSoon.length > 0 && (
            <Alert
              style={{ marginBottom: 16 }}
              type="warning"
              showIcon
              message={t('fstdsPage.pmDueSoonWarning', { count: pmDueSoon.length })}
              description={pmDueSoon.map((d) => `${d.deviceCode}(${t(`fstdsPage.pmCheckLevels.${d.level}`)})`).join('、')}
            />
          )}
          {dueSoon.length > 0 && (
            <Alert
              style={{ marginBottom: 16 }}
              type="warning"
              showIcon
              message={t('fstdsPage.evalDueSoonWarning', { count: dueSoon.length })}
              description={dueSoon.map((d) => d.deviceCode).join('、')}
            />
          )}
          {overdueDiscrepancies.length > 0 && (
            <Alert
              style={{ marginBottom: 16 }}
              type="error"
              showIcon
              message={t('fstdsPage.overdueDiscrepancyWarning', { count: overdueDiscrepancies.length })}
              description={overdueDiscrepancies.map((d) => `${d.fstd?.deviceCode ?? d.fstdId}: ${d.description}`).join('; ')}
            />
          )}
          {safetyCheckDueSoon.length > 0 && (
            <Alert
              style={{ marginBottom: 16 }}
              type="warning"
              showIcon
              message={t('fstdsPage.safetyCheckDueSoonWarning', { count: safetyCheckDueSoon.length })}
              description={safetyCheckDueSoon.map((d) => d.deviceCode).join('、')}
            />
          )}
          {isCaac && preFlightCheckDueSoon.length > 0 && (
            <Alert
              style={{ marginBottom: 16 }}
              type="warning"
              showIcon
              message={t('fstdsPage.preFlightCheckDueSoonWarning', { count: preFlightCheckDueSoon.length })}
              description={preFlightCheckDueSoon.map((d) => d.deviceCode).join('、')}
            />
          )}
          {qtgIssues.length > 0 && (
            <Alert
              style={{ marginBottom: 16 }}
              type="error"
              showIcon
              message={t('fstdsPage.qtgIssuesWarning', { count: qtgIssues.length })}
              description={qtgIssues
                .map((i) => `${i.deviceCode} ${i.year}Q${i.quarter}: ${i.issueType === 'overdue' ? t('fstdsPage.qtgIssueOverdue') : t('fstdsPage.qtgIssueBurstTested')}`)
                .join('; ')}
            />
          )}

          <Space style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              {t('fstdsPage.addFstd')}
            </Button>
          </Space>

          <Table<FstdDetail>
            rowKey="id"
            loading={loading}
            dataSource={fstds}
            columns={[
              { title: t('fstdsPage.columnDeviceCode'), dataIndex: 'deviceCode' },
              { title: t('fstdsPage.columnRepresentedAircraft'), dataIndex: 'representedAircraft' },
              { title: t('fstdsPage.columnDeviceType'), dataIndex: 'deviceType' },
              {
                title: t('fstdsPage.columnQualificationBasis'),
                dataIndex: 'qualificationBasisType',
                render: (v: FstdQualificationBasisType) => <Tag color={BASIS_TAG_COLOR[v]}>{v}</Tag>,
              },
              {
                title: t('fstdsPage.columnLegacyLevel'),
                dataIndex: 'legacyLevel',
                render: (v: Fstd['legacyLevel']) => (v ? <Tag color="blue">{v.level}</Tag> : '-'),
              },
              ...(isCaac
                ? [
                    {
                      title: t('fstdsPage.columnCaacValidity'),
                      render: (_: unknown, fstd: FstdDetail) => (
                        <Space direction="vertical" size={0}>
                          {fstd.deviceType === 'FFS' && (
                            <Space size={4}>
                              <span style={{ fontSize: 12, color: '#888' }}>{t('fstdsPage.fieldIsLargeAircraft')}</span>
                              <Switch
                                size="small"
                                checked={fstd.isLargeAircraftPublicTransport}
                                onChange={(checked) => handleSetLargeAircraftFlag(fstd.id, checked)}
                              />
                            </Space>
                          )}
                          {fstd.deviceType !== 'BITD' && (
                            <Tag color={qms?.isEstablished ? 'green' : 'orange'}>
                              {t('fstdsPage.caacValidityMonths', { months: computeCaacValidityMonths(fstd) })}
                            </Tag>
                          )}
                        </Space>
                      ),
                    },
                  ]
                : []),
              {
                title: t('fstdsPage.columnActions'),
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
                      {t('fstdsPage.recordEvaluation')}
                    </Button>
                    <Button size="small" danger onClick={() => setDiscrepancyModalFstdId(fstd.id)}>
                      {t('fstdsPage.reportDiscrepancy')}
                    </Button>
                    <Button size="small" onClick={() => openSafetyCheckModal(fstd.id)}>
                      {t('fstdsPage.recordSafetyCheck')}
                    </Button>
                    {isCaac && (
                      <Button size="small" onClick={() => openPreFlightCheckModal(fstd.id)}>
                        {t('fstdsPage.recordPreFlightCheck')}
                      </Button>
                    )}
                    <Button size="small" onClick={() => setQtgDocModalFstdId(fstd.id)}>
                      {t('fstdsPage.qtgDocuments')}
                    </Button>
                    <Button size="small" onClick={() => setQtgRunModalFstdId(fstd.id)}>
                      {t('fstdsPage.qtgQuarterlyRecord')}
                    </Button>
                    <Button size="small" onClick={() => openEslModal(fstd)}>
                      {t('fstdsPage.eslList')}
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        perfMetricForm.resetFields()
                        setPerfMetricModalFstdId(fstd.id)
                      }}
                    >
                      {t('fstdsPage.performanceMetrics')}
                    </Button>
                    {fstd.qualificationBasisType === 'EASA_FCS' && (
                      <Button size="small" onClick={() => setFcsCapModalFstdId(fstd.id)}>
                        {t('fstdsPage.registerFcsCapability')}
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
                      {t('fstdsPage.taskCapabilityCheck')}
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
                      header={t('fstdsPage.fcsMatrixHeader')}
                      size="small"
                      dataSource={fstd.fcsCapabilities ?? []}
                      locale={{ emptyText: t('fstdsPage.noFcsCapabilities') }}
                      renderItem={(c) => (
                        <List.Item>
                          <Tag>{c.characteristic}</Tag>
                          {c.subsystem && <Tag color="cyan">{c.subsystem}</Tag>}
                          <Tag color={FIDELITY_COLOR[c.fidelityLevel]}>{c.fidelityLevel}</Tag>
                          {c.isAssigned && <Tag color="gold">{t('fstdsPage.assignedFcsTag')}</Tag>}
                        </List.Item>
                      )}
                    />
                  )}
                  <List
                    header={t('fstdsPage.eslHeader')}
                    size="small"
                    dataSource={fstd.eslLists ?? []}
                    locale={{ emptyText: t('fstdsPage.noEslVersions') }}
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
                                  {t('fstdsPage.declareConfirm')}
                                </Button>,
                              ]
                            : []
                        }
                      >
                        <Space direction="vertical" size={0} style={{ width: '100%' }}>
                          <Space wrap>
                            <Tag color={esl.supersededAt ? 'default' : 'green'}>
                              {esl.supersededAt ? t('fstdsPage.historicalVersionTag') : t('fstdsPage.currentVersionTag')}
                            </Tag>
                            <span>{t('fstdsPage.revisionLabel', { number: esl.revisionNumber })}</span>
                            <Tag color={esl.declaredAt ? 'green' : 'orange'}>{esl.declaredAt ? t('fstdsPage.declaredTag') : t('fstdsPage.pendingDeclareTag')}</Tag>
                          </Space>
                          <span style={{ color: '#888', fontSize: 12 }}>
                            {t('fstdsPage.revisionDateLabel', { date: new Date(esl.revisionDate).toLocaleDateString() })}
                            {esl.declaredAt ? t('fstdsPage.declaredAtLabel', { date: new Date(esl.declaredAt).toLocaleString() }) : ''}
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
                        {t('fstdsPage.performanceMetricsHeader', { count: fstd.performanceMetrics.last12Months.monthCount })}
                      </div>
                      <Space wrap style={{ marginBottom: 8 }}>
                        <Tag color={fstd.performanceMetrics.last12Months.availabilityPercent != null && fstd.performanceMetrics.last12Months.availabilityPercent < 90 ? 'red' : 'green'}>
                          {t('fstdsPage.availabilityTag', { percent: fstd.performanceMetrics.last12Months.availabilityPercent?.toFixed(1) ?? '-' })}
                        </Tag>
                        <Tag color={fstd.performanceMetrics.last12Months.reliabilityPercent != null && fstd.performanceMetrics.last12Months.reliabilityPercent < 90 ? 'red' : 'green'}>
                          {t('fstdsPage.reliabilityTag', { percent: fstd.performanceMetrics.last12Months.reliabilityPercent?.toFixed(1) ?? '-' })}
                        </Tag>
                        <Tag>{t('fstdsPage.plannedAvailableTag', { hours: fstd.performanceMetrics.last12Months.plannedAvailableHours })}</Tag>
                        <Tag>{t('fstdsPage.scheduledTrainingTag', { hours: fstd.performanceMetrics.last12Months.scheduledTrainingHours })}</Tag>
                        <Tag>{t('fstdsPage.downtimeTag', { hours: fstd.performanceMetrics.last12Months.downtimeHours })}</Tag>
                        <Tag>{t('fstdsPage.lostTrainingTag', { hours: fstd.performanceMetrics.last12Months.lostTrainingHours })}</Tag>
                        <Tag>{t('fstdsPage.discrepancyCountTag', { count: fstd.performanceMetrics.last12Months.discrepancyCount })}</Tag>
                        <Tag>{t('fstdsPage.interruptionCountTag', { count: fstd.performanceMetrics.last12Months.interruptionCount })}</Tag>
                      </Space>
                      <Table
                        size="small"
                        rowKey="id"
                        pagination={false}
                        dataSource={fstd.performanceMetrics.monthly}
                        columns={[
                          { title: t('fstdsPage.columnYearMonth'), render: (_, m) => `${m.year}-${String(m.month).padStart(2, '0')}` },
                          { title: t('fstdsPage.columnPlannedAvailable'), dataIndex: 'plannedAvailableHours' },
                          { title: t('fstdsPage.columnScheduledTraining'), dataIndex: 'scheduledTrainingHours' },
                          { title: t('fstdsPage.columnSupportHours'), dataIndex: 'supportHours' },
                          { title: t('fstdsPage.columnFstdFailureHours'), dataIndex: 'fstdFailureHours' },
                          { title: t('fstdsPage.columnExternalFailureHours'), dataIndex: 'externalFailureHours' },
                          { title: t('fstdsPage.columnLostTraining'), dataIndex: 'lostTrainingHours' },
                          { title: t('fstdsPage.columnDiscrepancyCount'), dataIndex: 'discrepancyCount' },
                          { title: t('fstdsPage.columnInterruptionCount'), dataIndex: 'interruptionCount' },
                          {
                            title: t('fstdsPage.columnAvailability'),
                            render: (_, m) => (m.availabilityPercent != null ? `${m.availabilityPercent.toFixed(1)}%` : '-'),
                          },
                          {
                            title: t('fstdsPage.columnReliability'),
                            render: (_, m) => (m.reliabilityPercent != null ? `${m.reliabilityPercent.toFixed(1)}%` : '-'),
                          },
                        ]}
                      />
                    </div>
                  )}
                  <List
                    header={t('fstdsPage.evalHeader')}
                    size="small"
                    dataSource={fstd.evaluations ?? []}
                    locale={{ emptyText: t('fstdsPage.noEvaluations') }}
                    renderItem={(e) => (
                      <List.Item>
                        {t('fstdsPage.evalResultLabel', {
                          start: new Date(e.periodStart).toLocaleDateString(),
                          end: new Date(e.periodEnd).toLocaleDateString(),
                          result: e.result ?? '-',
                        })}
                        {e.evaluationType === 'extended' && <Tag color="purple" style={{ marginLeft: 8 }}>{t('fstdsPage.extendedTag')}</Tag>}
                        {e.isWithinWindow === false && (
                          <Tag color="red" style={{ marginLeft: 8 }}>
                            {t('fstdsPage.outOfWindowTag')}
                          </Tag>
                        )}
                        {t('fstdsPage.nextDueLabel')}
                        <Tag color={e.nextDueDate && new Date(e.nextDueDate) < new Date() ? 'red' : 'default'}>
                          {e.nextDueDate ? new Date(e.nextDueDate).toLocaleDateString() : '-'}
                        </Tag>
                      </List.Item>
                    )}
                  />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('fstdsPage.mocHeader')}</div>
                    <ChangeRequestPanel entityType="Fstd" entityId={fstd.id} />
                  </div>
                  <List
                    header={t('fstdsPage.discrepancyHeader')}
                    size="small"
                    dataSource={fstd.discrepancies ?? []}
                    locale={{ emptyText: t('fstdsPage.noDiscrepancies') }}
                    renderItem={(d) => {
                      const retentionExpired = d.retentionExpiresAt && new Date(d.retentionExpiresAt) < new Date()
                      const retentionActive = !!d.retentionCategory && !retentionExpired
                      return (
                      <List.Item
                        actions={
                          d.status === 'open'
                            ? [
                                <Button key="correct" size="small" onClick={() => setCorrectModalDiscrepancyId(d.id)}>
                                  {t('fstdsPage.markCorrected')}
                                </Button>,
                                retentionActive ? (
                                  <Button key="clear-retention" size="small" onClick={() => handleClearRetention(d.id)}>
                                    {t('fstdsPage.clearRetention')}
                                  </Button>
                                ) : (
                                  <Button key="set-retention" size="small" onClick={() => setRetentionModalDiscrepancyId(d.id)}>
                                    {t('fstdsPage.setRetention')}
                                  </Button>
                                ),
                                <Button key="movements" size="small" onClick={() => loadDiscrepancyMovements(d.id)}>
                                  {t('fstdsPage.viewRelatedMovements')}
                                </Button>,
                              ]
                            : [
                                <Button key="movements" size="small" onClick={() => loadDiscrepancyMovements(d.id)}>
                                  {t('fstdsPage.viewRelatedMovements')}
                                </Button>,
                              ]
                        }
                      >
                        <Space direction="vertical" size={0} style={{ width: '100%' }}>
                          <Space wrap>
                            <Tag color={d.status === 'open' ? (d.dueDate && new Date(d.dueDate) < new Date() ? 'red' : 'orange') : 'green'}>
                              {d.status === 'open' ? (d.dueDate && new Date(d.dueDate) < new Date() ? t('fstdsPage.overdueTag') : t('fstdsPage.inProgressTag')) : t('fstdsPage.correctedTag')}
                            </Tag>
                            {d.isMmi && <Tag color="red">{t('fstdsPage.mmiTag')}</Tag>}
                            {d.severityRating != null && <Tag>{t('fstdsPage.severityTag', { rating: d.severityRating })}</Tag>}
                            {d.trainingTimeLostMinutes != null && <Tag>{t('fstdsPage.lostTimeTag', { minutes: d.trainingTimeLostMinutes })}</Tag>}
                            {d.retentionCategory && (
                              <Tag color={retentionExpired ? 'default' : RETENTION_CATEGORY_COLOR[d.retentionCategory]}>
                                {retentionExpired ? t('fstdsPage.retentionExpiredPrefix') : t('fstdsPage.retentionPrefix')}
                                {t(`fstdsPage.retentionCategories.${d.retentionCategory}`)}
                                {d.retentionExpiresAt ? t('fstdsPage.retentionExpiresSuffix', { date: new Date(d.retentionExpiresAt).toLocaleDateString() }) : ''}
                              </Tag>
                            )}
                            <span>{d.description}</span>
                          </Space>
                          {d.retentionCategory && (
                            <span style={{ color: '#888', fontSize: 12 }}>{t('fstdsPage.retentionJustificationLabel', { text: d.retentionJustification })}</span>
                          )}
                          {discrepancyMovements[d.id] && (
                            <div style={{ marginTop: 4 }}>
                              {discrepancyMovements[d.id].length === 0 ? (
                                <span style={{ color: '#888', fontSize: 12 }}>{t('fstdsPage.noRelatedMovements')}</span>
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
                            {t('fstdsPage.discrepancyFooter', {
                              reportedAt: new Date(d.reportedAt).toLocaleString(),
                              dueDate: d.dueDate ? new Date(d.dueDate).toLocaleDateString() : '-',
                            })}
                            {d.correctiveAction ? t('fstdsPage.correctiveActionSuffix', { text: d.correctiveAction }) : ''}
                          </span>
                        </Space>
                      </List.Item>
                    )}}
                  />
                  <List
                    header={
                      <Space>
                        {t('fstdsPage.pmHeader')}
                        <Button size="small" onClick={() => openPmTaskModal(fstd.id)} disabled={pmTemplates.length === 0}>
                          {t('fstdsPage.registerPmTask')}
                        </Button>
                      </Space>
                    }
                    size="small"
                    dataSource={fstd.pmTasks ?? []}
                    locale={{ emptyText: pmTemplates.length === 0 ? t('fstdsPage.configureTemplateFirst') : t('fstdsPage.noPmTasks') }}
                    renderItem={(pmTask) => (
                      <List.Item
                        actions={
                          pmTask.status === 'PENDING_REVIEW'
                            ? [
                                <Button
                                  key="review"
                                  size="small"
                                  type="primary"
                                  onClick={() => {
                                    pmReviewForm.resetFields()
                                    setPmReviewModal(pmTask)
                                  }}
                                >
                                  {t('fstdsPage.review')}
                                </Button>,
                              ]
                            : []
                        }
                      >
                        <Space direction="vertical" size={0} style={{ width: '100%' }}>
                          <Space wrap>
                            <Tag>{t(`fstdsPage.pmCheckLevels.${pmTask.level}`)}</Tag>
                            <Tag color={PM_TASK_STATUS_COLOR[pmTask.status]}>{t(`fstdsPage.pmTaskStatus.${pmTask.status}`)}</Tag>
                            {pmTask.itemResultsJson
                              .filter((i) => !i.passed)
                              .map((i, idx) => (
                                <Tag key={idx} color="red">
                                  {t('fstdsPage.notPassedTag', { item: i.item, notes: i.notes || t('fstdsPage.notPassedDefault') })}
                                </Tag>
                              ))}
                          </Space>
                          <span style={{ color: '#888', fontSize: 12 }}>
                            {t('fstdsPage.pmTaskFooter', { taskDate: new Date(pmTask.taskDate).toLocaleDateString() })}
                            {pmTask.reviewedAt ? t('fstdsPage.reviewedAtSuffix', { date: new Date(pmTask.reviewedAt).toLocaleString() }) : ''}
                            {pmTask.reviewNotes ? t('fstdsPage.reviewNotesSuffix', { notes: pmTask.reviewNotes }) : ''}
                          </span>
                        </Space>
                      </List.Item>
                    )}
                  />
                  <List
                    header={t('fstdsPage.safetyCheckHeader')}
                    size="small"
                    dataSource={fstd.safetyChecks ?? []}
                    locale={{ emptyText: t('fstdsPage.noSafetyChecks') }}
                    renderItem={(c) => (
                      <List.Item>
                        <Space direction="vertical" size={0} style={{ width: '100%' }}>
                          <Space wrap>
                            <Tag color={c.overallResult === 'pass' ? 'green' : 'red'}>
                              {c.overallResult === 'pass' ? t('fstdsPage.allPassedTag') : t('fstdsPage.foundIssuesTag')}
                            </Tag>
                            {c.itemsJson
                              .filter((i) => !i.passed)
                              .map((i) => (
                                <Tag key={i.item} color="red">
                                  {t('fstdsPage.notPassedTag', { item: i.item, notes: i.notes || t('fstdsPage.notPassedDefault') })}
                                </Tag>
                              ))}
                          </Space>
                          <span style={{ color: '#888', fontSize: 12 }}>
                            {t('fstdsPage.safetyCheckFooter', {
                              checkedAt: new Date(c.checkedAt).toLocaleDateString(),
                              nextDue: new Date(c.nextDueDate).toLocaleDateString(),
                            })}
                          </span>
                        </Space>
                      </List.Item>
                    )}
                  />
                  {isCaac && (
                    <List
                      header={t('fstdsPage.preFlightCheckHeader')}
                      size="small"
                      dataSource={fstd.preFlightChecks ?? []}
                      locale={{ emptyText: t('fstdsPage.noPreFlightChecks') }}
                      renderItem={(c) => (
                        <List.Item>
                          <Space direction="vertical" size={0} style={{ width: '100%' }}>
                            <Space wrap>
                              <Tag color={c.overallResult === 'pass' ? 'green' : 'red'}>
                                {c.overallResult === 'pass' ? t('fstdsPage.allPassedTag') : t('fstdsPage.foundIssuesTag')}
                              </Tag>
                              {c.itemsJson
                                .filter((i) => !i.passed)
                                .map((i) => (
                                  <Tag key={i.item} color="red">
                                    {t('fstdsPage.notPassedTag', { item: i.item, notes: i.notes || t('fstdsPage.notPassedDefault') })}
                                  </Tag>
                                ))}
                            </Space>
                            <span style={{ color: '#888', fontSize: 12 }}>
                              {t('fstdsPage.preFlightCheckFooter', {
                                checkDate: new Date(c.checkDate).toLocaleDateString(),
                                nextDue: new Date(c.nextDueDate).toLocaleDateString(),
                              })}
                            </span>
                          </Space>
                        </List.Item>
                      )}
                    />
                  )}
                  <List
                    header={t('fstdsPage.qtgDocHeader')}
                    size="small"
                    dataSource={fstd.qtgDocuments ?? []}
                    locale={{ emptyText: t('fstdsPage.noQtgDocuments') }}
                    renderItem={(d) => (
                      <List.Item
                        actions={
                          d.originalFileName
                            ? [
                                <Button key="download" size="small" icon={<DownloadOutlined />} onClick={() => handleDownloadQtgDocument(d)}>
                                  {t('fstdsPage.download')}
                                </Button>,
                              ]
                            : []
                        }
                      >
                        <Tag color={d.documentType === 'MQTG' ? 'purple' : 'blue'}>{d.documentType}</Tag>
                        {d.version}
                        <Tag color={d.supersededAt ? 'default' : 'green'} style={{ marginLeft: 8 }}>
                          {d.supersededAt ? t('fstdsPage.historicalVersionTag') : t('fstdsPage.currentVersionTag')}
                        </Tag>
                        <span style={{ color: '#888', marginLeft: 8 }}>
                          {t('fstdsPage.qtgEffectiveDate', { date: new Date(d.effectiveDate).toLocaleDateString() })}
                          {d.documentType === 'MQTG' ? t('fstdsPage.mqtgLifetimeNote') : ''}
                          {d.originalFileName
                            ? t('fstdsPage.uploadedFileSuffix', { name: d.originalFileName, size: ((d.fileSize ?? 0) / 1024).toFixed(1) })
                            : d.pointerUrl
                              ? t('fstdsPage.externalLinkSuffix', { url: d.pointerUrl })
                              : ''}
                        </span>
                      </List.Item>
                    )}
                  />
                  <List
                    header={t('fstdsPage.qtgRunHeader')}
                    size="small"
                    dataSource={fstd.qtgRuns ?? []}
                    locale={{ emptyText: t('fstdsPage.noQtgRuns') }}
                    renderItem={(r) => (
                      <List.Item>
                        <Tag>{r.year} Q{r.quarter}</Tag>
                        {r.completedAt ? new Date(r.completedAt).toLocaleDateString() : t('fstdsPage.notCompletedTag')}
                        {r.result && <Tag style={{ marginLeft: 8 }}>{r.result}</Tag>}
                        {r.burstTested && (
                          <Tag color="red" style={{ marginLeft: 8 }}>
                            {t('fstdsPage.burstTestedTag')}
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

      <Modal title={t('fstdsPage.createModalTitle')} open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical" initialValues={{ qualificationBasisType: isCaac ? 'CCAR_60' : 'EASA_LEGACY_LEVEL' }}>
          <Form.Item name="deviceCode" label={t('fstdsPage.fieldDeviceCode')} rules={[{ required: true }]}>
            <Input placeholder={t('fstdsPage.fieldDeviceCodePlaceholder')} />
          </Form.Item>
          <Form.Item name="representedAircraft" label={t('fstdsPage.fieldRepresentedAircraft')} rules={[{ required: true }]}>
            <Input placeholder={t('fstdsPage.fieldRepresentedAircraftPlaceholder')} />
          </Form.Item>
          <Form.Item name="deviceType" label={t('fstdsPage.fieldDeviceType')} rules={[{ required: true }]}>
            <Select options={DEVICE_TYPES.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="qualificationBasisType" label={t('fstdsPage.fieldQualificationBasis')} rules={[{ required: true }]}>
            <Select
              onChange={() => form.setFieldValue('legacyLevel', undefined)}
              options={QUALIFICATION_BASIS_TYPES.map((v) => ({
                value: v,
                label: t(v === 'EASA_FCS' ? 'fstdsPage.qualificationBasisFcsOption' : v === 'CCAR_60' ? 'fstdsPage.qualificationBasisCcarOption' : 'fstdsPage.qualificationBasisLegacyOption'),
              }))}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.qualificationBasisType !== cur.qualificationBasisType}>
            {({ getFieldValue }) => {
              const basis = getFieldValue('qualificationBasisType') as FstdQualificationBasisType
              if (basis === 'EASA_FCS') return null
              const ccar = basis === 'CCAR_60'
              return (
                <Form.Item name="legacyLevel" label={t(ccar ? 'fstdsPage.fieldCcarLevel' : 'fstdsPage.fieldLegacyLevel')}>
                  <Select allowClear options={(ccar ? CCAR_60_LEVELS : LEGACY_LEVELS).map((v) => ({ value: v, label: v }))} />
                </Form.Item>
              )
            }}
          </Form.Item>
          {isCaac && (
            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.deviceType !== cur.deviceType}>
              {({ getFieldValue }) =>
                getFieldValue('deviceType') === 'FFS' && (
                  <Form.Item
                    name="isLargeAircraftPublicTransport"
                    label={t('fstdsPage.fieldIsLargeAircraft')}
                    valuePropName="checked"
                    tooltip={t('fstdsPage.fieldIsLargeAircraftTooltip')}
                  >
                    <Switch />
                  </Form.Item>
                )
              }
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title={t('fstdsPage.evalModalTitle')}
        open={!!evalModalFstdId}
        onOk={handleRecordEvaluation}
        onCancel={() => setEvalModalFstdId(undefined)}
      >
        <Form
          form={evalForm}
          layout="vertical"
          initialValues={{ range: [dayjs().subtract(5, 'day'), dayjs()], result: 'pass', useExtension: false, extensionMonths: 24 }}
        >
          <Form.Item name="range" label={t('fstdsPage.fieldEvalRange')} rules={[{ required: true }]}>
            <DatePicker.RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="result" label={t('fstdsPage.fieldResult')} rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'pass', label: t('fstdsPage.resultPass') },
                { value: 'partial', label: t('fstdsPage.resultPartial') },
                { value: 'fail', label: t('fstdsPage.resultFail') },
              ]}
            />
          </Form.Item>
          {isCaac ? (
            (() => {
              const evalFstd = fstds.find((f) => f.id === evalModalFstdId)
              return (
                evalFstd &&
                evalFstd.deviceType !== 'BITD' && (
                  <Alert
                    type={qms?.isEstablished ? 'success' : 'warning'}
                    showIcon
                    message={t('fstdsPage.caacValidityMonths', { months: computeCaacValidityMonths(evalFstd) })}
                    description={ts('fstdsPage.extensionSelfAssessmentNote')}
                  />
                )
              )
            })()
          ) : (
            <>
              <Form.Item name="useExtension" label={t('fstdsPage.fieldUseExtension')} valuePropName="checked">
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
                          message={t('fstdsPage.extensionEligibilityTitle')}
                          description={
                            <>
                              <div>{extensionEligibility.has36MonthsCompliantRecord ? '✓' : '✗'} {t('fstdsPage.extension36MonthRecord')}</div>
                              <div>{extensionEligibility.hasAnnualManagementAudit ? '✓' : '✗'} {t('fstdsPage.extensionAnnualAudit')}</div>
                              <div>{ts('fstdsPage.extensionSelfAssessmentNote')}</div>
                            </>
                          }
                        />
                      )}
                      <Form.Item name="extensionMonths" label={t('fstdsPage.fieldExtensionMonths')} rules={[{ required: true }]}>
                        <Select
                          options={[
                            { value: 24, label: t('fstdsPage.extension24Months') },
                            { value: 36, label: t('fstdsPage.extension36Months') },
                          ]}
                        />
                      </Form.Item>
                      <Form.Item
                        name="selfAssessmentConfirmed"
                        valuePropName="checked"
                        rules={[{ validator: (_, v) => (v ? Promise.resolve() : Promise.reject(new Error(t('fstdsPage.selfAssessmentValidationError')))) }]}
                      >
                        <Switch checkedChildren={t('fstdsPage.selfAssessmentConfirmedSwitch')} unCheckedChildren={t('fstdsPage.selfAssessmentUnconfirmedSwitch')} />
                      </Form.Item>
                    </>
                  )
                }
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      <Modal
        title={t('fstdsPage.discrepancyModalTitle')}
        open={!!discrepancyModalFstdId}
        onOk={handleReportDiscrepancy}
        onCancel={() => setDiscrepancyModalFstdId(undefined)}
      >
        <Form form={discrepancyForm} layout="vertical">
          <Form.Item name="description" label={t('fstdsPage.fieldProblemDescription')} rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder={t('fstdsPage.fieldProblemDescriptionPlaceholder')} />
          </Form.Item>
          <Form.Item name="isMmi" label={t('fstdsPage.fieldIsMmi')} initialValue={false}>
            <Select
              options={[
                { value: false, label: t('fstdsPage.mmiNo') },
                { value: true, label: t('fstdsPage.mmiYes') },
              ]}
            />
          </Form.Item>
          <Form.Item name="severityRating" label={t('fstdsPage.fieldSeverityRating')}>
            <InputNumber min={1} max={5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="trainingTimeLostMinutes" label={t('fstdsPage.fieldTrainingTimeLost')}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('fstdsPage.correctModalTitle')}
        open={!!correctModalDiscrepancyId}
        onOk={handleCorrectDiscrepancy}
        onCancel={() => setCorrectModalDiscrepancyId(undefined)}
      >
        <Form form={correctForm} layout="vertical">
          <Form.Item name="correctiveAction" label={t('fstdsPage.fieldCorrectiveAction')} rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('fstdsPage.retentionModalTitle')}
        open={!!retentionModalDiscrepancyId}
        onOk={handleSetRetention}
        onCancel={() => setRetentionModalDiscrepancyId(undefined)}
      >
        <Form form={retentionForm} layout="vertical">
          <Form.Item name="category" label={t('fstdsPage.fieldRetentionCategory')} rules={[{ required: true }]}>
            <Select
              options={(Object.keys(RETENTION_CATEGORY_COLOR) as RetentionCategory[]).map((c) => ({
                value: c,
                label: t(`fstdsPage.retentionCategories.${c}`),
              }))}
            />
          </Form.Item>
          <Form.Item name="justification" label={t('fstdsPage.fieldJustification')} rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder={t('fstdsPage.fieldJustificationPlaceholder')} />
          </Form.Item>
          <Form.Item name="approvedById" label={t('fstdsPage.fieldApprover')} rules={[{ required: true }]}>
            <Select options={personnel.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))} />
          </Form.Item>
          <Form.Item name="expiresAt" label={t('fstdsPage.fieldExpiresAt')}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('fstdsPage.pmTemplateModalTitle')}
        open={pmTemplateModalOpen}
        onOk={handleSetPmTemplate}
        onCancel={() => setPmTemplateModalOpen(false)}
        width={600}
      >
        <Form form={pmTemplateForm} layout="vertical">
          <Form.Item name="level" label={t('fstdsPage.columnLevel')} rules={[{ required: true }]}>
            <Select options={PM_CHECK_LEVELS.map((l) => ({ value: l, label: t(`fstdsPage.pmCheckLevels.${l}`) }))} />
          </Form.Item>
          <Form.List name="items" initialValue={[{ item: '' }]}>
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                    <Form.Item name={[field.name, 'item']} rules={[{ required: true, message: t('fstdsPage.fieldCheckItem') }]}>
                      <Input placeholder={t('fstdsPage.fieldCheckItemPlaceholder')} style={{ width: 400 }} />
                    </Form.Item>
                    <DeleteOutlined onClick={() => remove(field.name)} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />}>
                  {t('fstdsPage.addCheckItem')}
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      <Modal
        title={t('fstdsPage.pmTaskModalTitle')}
        open={!!pmTaskModalFstdId}
        onOk={handleCreatePmTask}
        onCancel={() => setPmTaskModalFstdId(undefined)}
        width={600}
      >
        <Form form={pmTaskForm} layout="vertical" initialValues={{ taskDate: dayjs() }}>
          <Form.Item name="level" label={t('fstdsPage.columnLevel')} rules={[{ required: true }]}>
            <Select
              options={pmTemplates.map((tpl) => ({ value: tpl.level, label: t(`fstdsPage.pmCheckLevels.${tpl.level}`) }))}
              onChange={(level: PmCheckLevel) => {
                setPmTaskLevel(level)
                const template = pmTemplates.find((tpl) => tpl.level === level)
                pmTaskForm.setFieldsValue({
                  items: (template?.itemsJson ?? []).map((i) => ({ item: i.item, passed: true, notes: '' })),
                })
              }}
            />
          </Form.Item>
          <Form.Item name="taskDate" label={t('fstdsPage.fieldTaskDate')} rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="performedById" label={t('fstdsPage.fieldPerformedBy')}>
            <Select allowClear options={personnel.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))} />
          </Form.Item>
          <Form.Item name="responsibleIds" label={t('fstdsPage.fieldResponsibleIds')}>
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
                        <Switch checkedChildren={t('fstdsPage.passedSwitch')} unCheckedChildren={t('fstdsPage.notPassedSwitch')} />
                      </Form.Item>
                      <Form.Item name={[field.name, 'notes']} noStyle>
                        <Input placeholder={t('fstdsPage.fieldItemNotesPlaceholder')} style={{ width: 220 }} />
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
        title={t('fstdsPage.pmReviewModalTitle')}
        open={!!pmReviewModal}
        onCancel={() => setPmReviewModal(undefined)}
        footer={
          <Space>
            <Button onClick={() => setPmReviewModal(undefined)}>{t('fstdsPage.cancel')}</Button>
            <Button danger onClick={() => handleReviewPmTask(false)}>
              {t('fstdsPage.reviewRejected')}
            </Button>
            <Button type="primary" onClick={() => handleReviewPmTask(true)}>
              {t('fstdsPage.reviewApproved')}
            </Button>
          </Space>
        }
      >
        <Form form={pmReviewForm} layout="vertical">
          <Form.Item name="reviewedById" label={t('fstdsPage.fieldReviewer')} rules={[{ required: true }]}>
            <Select options={personnel.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))} />
          </Form.Item>
          <Form.Item name="reviewNotes" label={t('fstdsPage.fieldReviewNotes')}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('fstdsPage.safetyCheckModalTitle')}
        open={!!safetyCheckModalFstdId}
        onOk={handleRecordSafetyCheck}
        onCancel={() => setSafetyCheckModalFstdId(undefined)}
      >
        <Form form={safetyCheckForm} layout="vertical" initialValues={{ checkedAt: dayjs() }}>
          <Form.Item name="checkedAt" label={t('fstdsPage.fieldCheckedAt')} rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          {SAFETY_CHECK_ITEMS.map((item) => (
            <Form.Item key={item} label={item} style={{ marginBottom: 12 }}>
              <Switch
                checked={safetyCheckItemState[item]}
                checkedChildren={t('fstdsPage.passedSwitch')}
                unCheckedChildren={t('fstdsPage.notPassedSwitch')}
                onChange={(checked) => setSafetyCheckItemState((s) => ({ ...s, [item]: checked }))}
              />
            </Form.Item>
          ))}
          {Object.values(safetyCheckItemState).some((v) => !v) && (
            <Form.Item name="notes" label={t('fstdsPage.fieldUnqualifiedNotes')}>
              <Input.TextArea rows={2} />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title={t('fstdsPage.preFlightCheckModalTitle')}
        open={!!preFlightCheckModalFstdId}
        onOk={handleRecordPreFlightCheck}
        onCancel={() => setPreFlightCheckModalFstdId(undefined)}
        width={600}
      >
        <Alert style={{ marginBottom: 12 }} type="info" showIcon message={t('fstdsPage.preFlightCheckIntro')} />
        <Form form={preFlightCheckForm} layout="vertical" initialValues={{ checkDate: dayjs() }}>
          <Form.Item name="checkDate" label={t('fstdsPage.fieldCheckDate')} rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="performedById" label={t('fstdsPage.fieldPerformedBy')}>
            <Select allowClear options={personnel.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))} />
          </Form.Item>
          {preFlightCheckItems.map((item) => (
            <Form.Item key={item} label={item} style={{ marginBottom: 12 }}>
              <Switch
                checked={preFlightCheckItemState[item]}
                checkedChildren={t('fstdsPage.passedSwitch')}
                unCheckedChildren={t('fstdsPage.notPassedSwitch')}
                onChange={(checked) => setPreFlightCheckItemState((s) => ({ ...s, [item]: checked }))}
              />
            </Form.Item>
          ))}
          {Object.values(preFlightCheckItemState).some((v) => !v) && (
            <Form.Item name="notes" label={t('fstdsPage.fieldUnqualifiedNotes')}>
              <Input.TextArea rows={2} />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title={t('fstdsPage.qtgDocModalTitle')}
        open={!!qtgDocModalFstdId}
        onOk={handleAddQtgDocument}
        onCancel={() => setQtgDocModalFstdId(undefined)}
      >
        <Form form={qtgDocForm} layout="vertical">
          <Form.Item name="documentType" label={t('fstdsPage.fieldDocumentType')} rules={[{ required: true }]}>
            <Select
              options={QTG_DOCUMENT_TYPES.map((v) => ({
                value: v,
                label: v === 'MQTG' ? t('fstdsPage.mqtgOption') : v,
              }))}
            />
          </Form.Item>
          <Form.Item name="version" label={t('fstdsPage.fieldVersion')} rules={[{ required: true }]}>
            <Input placeholder={t('fstdsPage.fieldVersionPlaceholder')} />
          </Form.Item>
          <Form.Item name="effectiveDate" label={t('fstdsPage.fieldEffectiveDate')} rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="fileList"
            label={t('fstdsPage.fieldUploadFile')}
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
          >
            <Upload beforeUpload={() => false} maxCount={1} accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg">
              <Button icon={<UploadOutlined />}>{t('fstdsPage.chooseFile')}</Button>
            </Upload>
          </Form.Item>
          <Form.Item name="pointerUrl" label={t('fstdsPage.fieldPointerUrl')}>
            <Input placeholder={t('fstdsPage.fieldPointerUrlPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('fstdsPage.qtgRunModalTitle')}
        open={!!qtgRunModalFstdId}
        onOk={handleRecordQuarterlyRun}
        onCancel={() => setQtgRunModalFstdId(undefined)}
      >
        <Form form={qtgRunForm} layout="vertical" initialValues={{ year: dayjs().year(), completedAt: dayjs() }}>
          <Form.Item name="year" label={t('fstdsPage.fieldYear')} rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="quarter" label={t('fstdsPage.fieldQuarter')} rules={[{ required: true }]}>
            <Select
              options={[1, 2, 3, 4].map((q) => ({ value: q, label: `Q${q}` }))}
            />
          </Form.Item>
          <Form.Item name="completedAt" label={t('fstdsPage.fieldCompletedAt')} rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="result" label={t('fstdsPage.fieldResult')}>
            <Select
              options={[
                { value: 'pass', label: t('fstdsPage.resultPass') },
                { value: 'partial', label: t('fstdsPage.resultPartial') },
                { value: 'fail', label: t('fstdsPage.resultFail') },
              ]}
            />
          </Form.Item>
          <Form.Item name="notes" label={t('fstdsPage.fieldNotes')}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('fstdsPage.fcsCapModalTitle')}
        open={!!fcsCapModalFstdId}
        onOk={handleSetFcsCapability}
        onCancel={() => setFcsCapModalFstdId(undefined)}
      >
        <Form form={fcsCapForm} layout="vertical">
          <Form.Item name="characteristic" label={t('fstdsPage.fieldCharacteristic')} rules={[{ required: true }]}>
            <Select options={FCS_CHARACTERISTICS.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="fidelityLevel" label={t('fstdsPage.fieldFidelityLevel')} rules={[{ required: true }]}>
            <Select options={FCS_FIDELITY_LEVELS.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="subsystem" label={t('fstdsPage.fieldSubsystem')}>
            <Input placeholder={t('fstdsPage.fieldSubsystemPlaceholder')} />
          </Form.Item>
          <Form.Item name="isAssigned" label={t('fstdsPage.fieldIsAssigned')} initialValue={false}>
            <Select
              options={[
                { value: false, label: t('fstdsPage.isAssignedNo') },
                { value: true, label: t('fstdsPage.isAssignedYes') },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('fstdsPage.checkTaskModalTitle')}
        open={!!checkTaskModalFstdId}
        onOk={handleCheckTask}
        onCancel={() => setCheckTaskModalFstdId(undefined)}
        okText={t('fstdsPage.checkButton')}
      >
        <Form form={checkTaskForm} layout="vertical">
          <Form.Item name="taskCode" label={t('fstdsPage.columnTaskCode')} rules={[{ required: true }]}>
            <Input placeholder={t('fstdsPage.fieldTaskCodePlaceholder')} />
          </Form.Item>
        </Form>
        {checkTaskResult && (
          <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
            <Alert
              type={checkTaskResult.canStartTraining ? 'success' : 'error'}
              showIcon
              message={t('fstdsPage.canStartTrainingMessage', {
                status: checkTaskResult.canStartTraining ? t('fstdsPage.satisfied') : t('fstdsPage.notSatisfied'),
                basis: checkTaskResult.basis,
              })}
            />
            <Alert
              type={checkTaskResult.canCompleteTraining ? 'success' : 'warning'}
              showIcon
              message={t('fstdsPage.canCompleteTrainingMessage', {
                status: checkTaskResult.canCompleteTraining ? t('fstdsPage.satisfied') : t('fstdsPage.notSatisfied'),
              })}
              description={checkTaskResult.reason}
            />
          </Space>
        )}
      </Modal>

      <Modal
        title={t('fstdsPage.trainingMatrixModalTitle')}
        open={trainingMatrixModalOpen}
        onOk={handleAddTrainingMatrixEntry}
        onCancel={() => setTrainingMatrixModalOpen(false)}
      >
        <Form form={trainingMatrixForm} layout="vertical">
          <Form.Item name="taskCode" label={t('fstdsPage.columnTaskCode')} rules={[{ required: true }]}>
            <Input placeholder={t('fstdsPage.fieldTaskCodePlaceholder2')} />
          </Form.Item>
          <Form.Item name="taskName" label={t('fstdsPage.fieldTaskName')} rules={[{ required: true }]}>
            <Input placeholder={t('fstdsPage.fieldTaskNamePlaceholder')} />
          </Form.Item>
          <Form.Item name="characteristic" label={t('fstdsPage.fieldCharacteristic')} rules={[{ required: true }]}>
            <Select options={FCS_CHARACTERISTICS.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="thresholdT" label={t('fstdsPage.fieldThresholdT')} rules={[{ required: true }]}>
            <Select options={FCS_FIDELITY_LEVELS.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="thresholdTP" label={t('fstdsPage.fieldThresholdTP')} rules={[{ required: true }]}>
            <Select options={FCS_FIDELITY_LEVELS.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('fstdsPage.eslModalTitle')}
        open={!!eslModalFstdId}
        onOk={handleCreateEslRevision}
        onCancel={() => setEslModalFstdId(undefined)}
        width={800}
      >
        <Form form={eslForm} layout="vertical" initialValues={{ revisionDate: dayjs() }}>
          <Space>
            <Form.Item name="revisionNumber" label={t('fstdsPage.fieldRevisionNumber')} rules={[{ required: true }]}>
              <Input placeholder={t('fstdsPage.fieldRevisionNumberPlaceholder')} style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="revisionDate" label={t('fstdsPage.fieldRevisionDate')} rules={[{ required: true }]}>
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
            { title: t('fstdsPage.fieldCharacteristic'), dataIndex: 'characteristic', width: 70, render: (v: FcsCharacteristic) => <Tag>{v}</Tag> },
            {
              title: t('fstdsPage.columnFidelityLevel'),
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
              title: t('fstdsPage.columnEquipmentDescription'),
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
              title: t('fstdsPage.columnLimitations'),
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
        title={t('fstdsPage.eslDeclareModalTitle')}
        open={!!eslDeclareModalId}
        onOk={handleDeclareEsl}
        onCancel={() => setEslDeclareModalId(undefined)}
      >
        <Form form={eslDeclareForm} layout="vertical">
          <Form.Item name="personnelId" label={t('fstdsPage.fieldDeclarer')} rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={personnel.map((p) => ({ value: p.id, label: `${p.lastName}${p.firstName}` }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('fstdsPage.perfMetricModalTitle')}
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
          <Form.Item name="period" label={t('fstdsPage.fieldPeriod')} rules={[{ required: true }]}>
            <DatePicker picker="month" style={{ width: '100%' }} />
          </Form.Item>
          <Space wrap>
            <Form.Item name="plannedAvailableHours" label={t('fstdsPage.fieldPlannedAvailableHours')} rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="scheduledTrainingHours" label={t('fstdsPage.fieldScheduledTrainingHours')} rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="supportHours" label={t('fstdsPage.fieldSupportHours')} rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: 160 }} />
            </Form.Item>
          </Space>
          <Space wrap>
            <Form.Item name="fstdFailureHours" label={t('fstdsPage.fieldFstdFailureHours')} rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="externalFailureHours" label={t('fstdsPage.fieldExternalFailureHours')} rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="lostTrainingHours" label={t('fstdsPage.fieldLostTrainingHours')} rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: 160 }} />
            </Form.Item>
          </Space>
          <Space wrap>
            <Form.Item name="discrepancyCount" label={t('fstdsPage.fieldDiscrepancyCount')} rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="interruptionCount" label={t('fstdsPage.fieldInterruptionCount')} rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: 160 }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}
