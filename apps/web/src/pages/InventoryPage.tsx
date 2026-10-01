import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import {
  Alert,
  App,
  Button,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Select,
  Space,
  Tabs,
  Table,
  Tag,
} from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  CalibrationDueSoonItem,
  DemandRequestStatus,
  FaultyPartRecord,
  FaultyPartStatus,
  LowStockItem,
  PartDemandRequest,
  PartInspectionDueSoonItem,
  PartInspectionRecord,
  PartLoan,
  PartMovement,
  PartScrapRequest,
  PartTypeConfig,
  PurchaseOrder,
  ScrapRequestStatus,
  SparePart,
  StocktakeSession,
  Supplier,
  Tool,
  Warehouse,
  WarehouseStock,
} from '../api/inventory'
import { inventoryApi } from '../api/inventory'
import type { Discrepancy } from '../api/fstds'
import { fstdsApi } from '../api/fstds'
import { personnelApi } from '../api/personnel'
import type { Fstd, Personnel } from '../api/types'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'

const PO_STATUS_COLOR: Record<PurchaseOrder['status'], string> = {
  DRAFT: 'default',
  SUBMITTED: 'processing',
  APPROVED: 'blue',
  RECEIVED: 'green',
  CANCELLED: 'red',
}

const FAULTY_PART_STATUS_COLOR: Record<FaultyPartStatus, string> = {
  PENDING_DECISION: 'orange',
  SENT_FOR_REPAIR: 'blue',
  RETURNED_TO_SUPPLIER: 'purple',
  REPAIRED_RETURNED_TO_STOCK: 'green',
  SCRAPPED: 'red',
}

const SCRAP_STATUS_COLOR: Record<ScrapRequestStatus, string> = { PENDING: 'orange', APPROVED: 'green', REJECTED: 'red' }
const DEMAND_STATUS_COLOR: Record<DemandRequestStatus, string> = { PENDING: 'orange', CONVERTED: 'green', CANCELLED: 'default' }
const SCRAP_REASON_CODES = ['DAMAGED', 'EXPIRED', 'OBSOLETE', 'LOST', 'OTHER']

function SparePartsTab({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [parts, setParts] = useState<SparePart[]>([])
  const [lowStock, setLowStock] = useState<LowStockItem[]>([])
  const [movements, setMovements] = useState<Record<string, PartMovement[]>>({})
  const [openDiscrepancies, setOpenDiscrepancies] = useState<Discrepancy[]>([])
  const [typeConfigs, setTypeConfigs] = useState<PartTypeConfig[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [partModalOpen, setPartModalOpen] = useState(false)
  const [editModalPartId, setEditModalPartId] = useState<string>()
  const [movementModalPartId, setMovementModalPartId] = useState<string>()
  const [partForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [movementForm] = Form.useForm()

  const load = () => {
    inventoryApi.listSpareParts(organizationId).then(setParts)
    inventoryApi.listLowStock().then(setLowStock)
    fstdsApi.listOpenDiscrepanciesForOrg(organizationId).then(setOpenDiscrepancies)
    inventoryApi.listPartTypeConfigs(organizationId).then(setTypeConfigs)
    inventoryApi.listWarehouses(organizationId).then(setWarehouses)
  }
  useEffect(load, [organizationId])

  const categoryLabel = (code: string) => typeConfigs.find((c) => c.code === code)?.label ?? code

  const loadMovements = async (partId: string) => {
    const list = await inventoryApi.listMovements(partId)
    setMovements((prev) => ({ ...prev, [partId]: list }))
  }

  const handleCreatePart = async () => {
    const values = await partForm.validateFields()
    await inventoryApi.createSparePart({ organizationId, ...values })
    message.success(t('inventoryPage.parts.createSuccess'))
    setPartModalOpen(false)
    partForm.resetFields()
    load()
  }

  const openEditModal = (p: SparePart) => {
    editForm.setFieldsValue({
      name: p.name,
      compatibleWith: p.compatibleWith,
      partCategory: p.partCategory,
      minQuantity: p.minQuantity,
      location: p.location,
      requiresInspection: p.requiresInspection,
      inspectionIntervalMonths: p.inspectionIntervalMonths,
    })
    setEditModalPartId(p.id)
  }

  const handleEditPart = async () => {
    if (!editModalPartId) return
    const values = await editForm.validateFields()
    await inventoryApi.updateSparePart(editModalPartId, values)
    message.success(t('inventoryPage.parts.updateSuccess'))
    setEditModalPartId(undefined)
    load()
  }

  const handleRecordMovement = async () => {
    if (!movementModalPartId) return
    const values = await movementForm.validateFields()
    try {
      await inventoryApi.recordMovement(movementModalPartId, values)
      message.success(t('inventoryPage.parts.movementSuccess'))
      setMovementModalPartId(undefined)
      movementForm.resetFields()
      load()
      loadMovements(movementModalPartId)
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('inventoryPage.parts.operationFailed'))
    }
  }

  return (
    <div>
      {lowStock.length > 0 && (
        <Alert
          style={{ marginBottom: 16 }}
          type="warning"
          showIcon
          message={t('inventoryPage.parts.lowStockWarning', { count: lowStock.length })}
          description={lowStock.map((p) => `${p.name}(${p.currentQuantity}/${p.minQuantity})`).join('、')}
        />
      )}
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setPartModalOpen(true)}>
          {t('inventoryPage.parts.addButton')}
        </Button>
      </Space>
      <Table<SparePart>
        rowKey="id"
        dataSource={parts}
        columns={[
          { title: t('inventoryPage.parts.columnPartNumber'), dataIndex: 'partNumber' },
          { title: t('inventoryPage.parts.columnName'), dataIndex: 'name' },
          { title: t('inventoryPage.parts.columnCompatibleWith'), dataIndex: 'compatibleWith' },
          {
            title: t('inventoryPage.parts.columnCategory'),
            dataIndex: 'partCategory',
            render: (v: SparePart['partCategory']) => <Tag color={v === 'ROTABLE' ? 'blue' : 'default'}>{categoryLabel(v)}</Tag>,
          },
          {
            title: t('inventoryPage.parts.columnStock'),
            render: (_, p) => (
              <Tag color={p.currentQuantity < p.minQuantity ? 'red' : 'green'}>
                {t('inventoryPage.parts.stockTag', { current: p.currentQuantity, min: p.minQuantity, unit: p.unit })}
              </Tag>
            ),
          },
          {
            title: t('inventoryPage.parts.columnInspectionRequirement'),
            render: (_, p) =>
              p.requiresInspection ? (
                <Tag color="purple">{t('inventoryPage.parts.inspectionIntervalTag', { months: p.inspectionIntervalMonths })}</Tag>
              ) : (
                '-'
              ),
          },
          { title: t('inventoryPage.parts.columnLocation'), dataIndex: 'location', render: (v?: string | null) => v ?? '-' },
          {
            title: t('inventoryPage.parts.columnActions'),
            render: (_, p) => (
              <Space>
                <Button size="small" onClick={() => openEditModal(p)}>
                  {t('inventoryPage.parts.editButton')}
                </Button>
                <Button size="small" onClick={() => setMovementModalPartId(p.id)}>
                  {t('inventoryPage.parts.recordMovement')}
                </Button>
              </Space>
            ),
          },
        ]}
        expandable={{
          onExpand: (expanded, p) => expanded && loadMovements(p.id),
          expandedRowRender: (p) => (
            <List
              size="small"
              dataSource={movements[p.id] ?? []}
              locale={{ emptyText: t('inventoryPage.parts.noMovements') }}
              renderItem={(m) => (
                <List.Item>
                  <Tag color={m.type === 'IN' ? 'green' : m.type === 'OUT' ? 'orange' : 'default'}>{m.type}</Tag>
                  {m.quantity} {p.unit} - {m.note} ({new Date(m.performedAt).toLocaleString()})
                  {m.warehouse && (
                    <Tag color="geekblue" style={{ marginLeft: 8 }}>
                      {t('inventoryPage.parts.warehouseTag', { name: m.warehouse.name })}
                    </Tag>
                  )}
                  {m.usageLocation && (
                    <Tag color="cyan" style={{ marginLeft: 8 }}>
                      {t('inventoryPage.parts.usageLocationTag', { location: m.usageLocation })}
                    </Tag>
                  )}
                  {m.relatedDiscrepancy && (
                    <Tag color="volcano" style={{ marginLeft: 8 }}>
                      {t('inventoryPage.parts.relatedDiscrepancyTag', {
                        device: m.relatedDiscrepancy.fstd.deviceCode,
                        description: m.relatedDiscrepancy.description,
                      })}
                    </Tag>
                  )}
                </List.Item>
              )}
            />
          ),
        }}
      />

      <Modal title={t('inventoryPage.parts.createModalTitle')} open={partModalOpen} onOk={handleCreatePart} onCancel={() => setPartModalOpen(false)}>
        <Form form={partForm} layout="vertical">
          <Form.Item name="partNumber" label={t('inventoryPage.parts.fieldPartNumber')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label={t('inventoryPage.parts.fieldName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="compatibleWith" label={t('inventoryPage.parts.fieldCompatibleWith')}>
            <Input placeholder={t('inventoryPage.parts.fieldCompatibleWithPlaceholder')} />
          </Form.Item>
          <Form.Item name="partCategory" label={t('inventoryPage.parts.fieldCategory')} initialValue="CONSUMABLE" rules={[{ required: true }]}>
            <Select options={typeConfigs.map((c) => ({ value: c.code, label: c.label }))} />
          </Form.Item>
          <Form.Item name="minQuantity" label={t('inventoryPage.parts.fieldMinQuantity')} initialValue={0} rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="location" label={t('inventoryPage.parts.fieldLocation')}>
            <Input placeholder={t('inventoryPage.parts.fieldLocationPlaceholder')} />
          </Form.Item>
          <Form.Item name="requiresInspection" label={t('inventoryPage.parts.fieldRequiresInspection')} initialValue={false}>
            <Select
              options={[
                { value: false, label: t('inventoryPage.parts.requiresInspectionNo') },
                { value: true, label: t('inventoryPage.parts.requiresInspectionYes') },
              ]}
            />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.requiresInspection !== cur.requiresInspection}
          >
            {({ getFieldValue }) =>
              getFieldValue('requiresInspection') && (
                <Form.Item name="inspectionIntervalMonths" label={t('inventoryPage.parts.fieldInspectionInterval')} rules={[{ required: true }]}>
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              )
            }
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('inventoryPage.parts.editModalTitle')} open={!!editModalPartId} onOk={handleEditPart} onCancel={() => setEditModalPartId(undefined)}>
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label={t('inventoryPage.parts.fieldName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="compatibleWith" label={t('inventoryPage.parts.fieldCompatibleWith')}>
            <Input placeholder={t('inventoryPage.parts.fieldCompatibleWithPlaceholder')} />
          </Form.Item>
          <Form.Item name="partCategory" label={t('inventoryPage.parts.fieldCategory')} rules={[{ required: true }]}>
            <Select options={typeConfigs.map((c) => ({ value: c.code, label: c.label }))} />
          </Form.Item>
          <Form.Item name="minQuantity" label={t('inventoryPage.parts.fieldMinQuantity')} rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="location" label={t('inventoryPage.parts.fieldLocation')}>
            <Input placeholder={t('inventoryPage.parts.fieldLocationPlaceholder')} />
          </Form.Item>
          <Form.Item name="requiresInspection" label={t('inventoryPage.parts.fieldRequiresInspection')}>
            <Select
              options={[
                { value: false, label: t('inventoryPage.parts.requiresInspectionNo') },
                { value: true, label: t('inventoryPage.parts.requiresInspectionYes') },
              ]}
            />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.requiresInspection !== cur.requiresInspection}
          >
            {({ getFieldValue }) =>
              getFieldValue('requiresInspection') && (
                <Form.Item name="inspectionIntervalMonths" label={t('inventoryPage.parts.fieldInspectionInterval')} rules={[{ required: true }]}>
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              )
            }
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('inventoryPage.parts.movementModalTitle')}
        open={!!movementModalPartId}
        onOk={handleRecordMovement}
        onCancel={() => setMovementModalPartId(undefined)}
      >
        <Form form={movementForm} layout="vertical" initialValues={{ type: 'IN' }}>
          <Form.Item name="type" label={t('inventoryPage.parts.fieldMovementType')} rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'IN', label: t('inventoryPage.parts.movementTypeIn') },
                { value: 'OUT', label: t('inventoryPage.parts.movementTypeOut') },
                { value: 'ADJUSTMENT', label: t('inventoryPage.parts.movementTypeAdjustment') },
              ]}
            />
          </Form.Item>
          <Form.Item name="quantity" label={t('inventoryPage.parts.fieldQuantity')} rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="warehouseId" label={t('inventoryPage.parts.fieldWarehouse')}>
            <Select
              allowClear
              placeholder={t('inventoryPage.parts.fieldWarehousePlaceholder')}
              options={warehouses.map((w) => ({ value: w.id, label: `${w.name} (${t(`inventoryPage.warehouseTypes.${w.type}`)})` }))}
            />
          </Form.Item>
          <Form.Item name="usageLocation" label={t('inventoryPage.parts.fieldUsageLocation')}>
            <Input placeholder={t('inventoryPage.parts.fieldUsageLocationPlaceholder')} />
          </Form.Item>
          <Form.Item name="relatedDiscrepancyId" label={t('inventoryPage.parts.fieldRelatedDiscrepancy')}>
            <Select
              allowClear
              placeholder={t('inventoryPage.parts.fieldRelatedDiscrepancyPlaceholder')}
              options={openDiscrepancies.map((d) => ({ value: d.id, label: `${d.fstd?.deviceCode ?? d.fstdId} - ${d.description}` }))}
            />
          </Form.Item>
          <Form.Item name="note" label={t('inventoryPage.parts.fieldNote')}>
            <Input placeholder={t('inventoryPage.parts.fieldNotePlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function ToolsTab({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [tools, setTools] = useState<Tool[]>([])
  const [dueSoon, setDueSoon] = useState<CalibrationDueSoonItem[]>([])
  const [toolModalOpen, setToolModalOpen] = useState(false)
  const [calModalToolId, setCalModalToolId] = useState<string>()
  const [toolForm] = Form.useForm()
  const [calForm] = Form.useForm()

  const load = () => {
    inventoryApi.listTools(organizationId).then(setTools)
    inventoryApi.listCalibrationsDueSoon().then(setDueSoon)
  }
  useEffect(load, [organizationId])

  const handleCreateTool = async () => {
    const values = await toolForm.validateFields()
    await inventoryApi.createTool({ organizationId, ...values })
    message.success(t('inventoryPage.tools.createSuccess'))
    setToolModalOpen(false)
    toolForm.resetFields()
    load()
  }

  const handleRecordCalibration = async () => {
    if (!calModalToolId) return
    const values = await calForm.validateFields()
    await inventoryApi.recordCalibration(calModalToolId, {
      calibratedAt: values.calibratedAt.format('YYYY-MM-DD'),
      result: values.result,
    })
    message.success(t('inventoryPage.tools.calibrationSuccess'))
    setCalModalToolId(undefined)
    calForm.resetFields()
    load()
  }

  return (
    <div>
      {dueSoon.length > 0 && (
        <Alert
          style={{ marginBottom: 16 }}
          type="warning"
          showIcon
          message={t('inventoryPage.tools.dueSoonWarning', { count: dueSoon.length })}
          description={dueSoon.map((item) => item.name).join('、')}
        />
      )}
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setToolModalOpen(true)}>
          {t('inventoryPage.tools.addButton')}
        </Button>
      </Space>
      <Table<Tool>
        rowKey="id"
        dataSource={tools}
        columns={[
          { title: t('inventoryPage.tools.columnToolCode'), dataIndex: 'toolCode' },
          { title: t('inventoryPage.tools.columnName'), dataIndex: 'name' },
          { title: t('inventoryPage.tools.columnCalibrationInterval'), dataIndex: 'calibrationIntervalMonths' },
          {
            title: t('inventoryPage.tools.columnLatestCalibration'),
            render: (_, tool) => {
              const latest = tool.calibrations?.[0]
              if (!latest) return <Tag color="red">{t('inventoryPage.tools.neverCalibrated')}</Tag>
              return (
                <Tag color={latest.nextDueDate && new Date(latest.nextDueDate) < new Date() ? 'red' : 'default'}>
                  {latest.result} / {latest.nextDueDate ? new Date(latest.nextDueDate).toLocaleDateString() : '-'}
                </Tag>
              )
            },
          },
          {
            title: t('inventoryPage.tools.columnActions'),
            render: (_, tool) => (
              <Button size="small" onClick={() => setCalModalToolId(tool.id)}>
                {t('inventoryPage.tools.recordCalibration')}
              </Button>
            ),
          },
        ]}
      />

      <Modal title={t('inventoryPage.tools.createModalTitle')} open={toolModalOpen} onOk={handleCreateTool} onCancel={() => setToolModalOpen(false)}>
        <Form form={toolForm} layout="vertical">
          <Form.Item name="toolCode" label={t('inventoryPage.tools.fieldToolCode')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label={t('inventoryPage.tools.fieldName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="calibrationIntervalMonths" label={t('inventoryPage.tools.fieldCalibrationInterval')} initialValue={12} rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('inventoryPage.tools.calibrationModalTitle')} open={!!calModalToolId} onOk={handleRecordCalibration} onCancel={() => setCalModalToolId(undefined)}>
        <Form form={calForm} layout="vertical" initialValues={{ calibratedAt: dayjs(), result: 'pass' }}>
          <Form.Item name="calibratedAt" label={t('inventoryPage.tools.fieldCalibratedAt')} rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="result" label={t('inventoryPage.tools.fieldResult')} rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'pass', label: t('inventoryPage.tools.resultPass') },
                { value: 'fail', label: t('inventoryPage.tools.resultFail') },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function PurchaseOrdersTab({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [parts, setParts] = useState<SparePart[]>([])
  const [supplierModalOpen, setSupplierModalOpen] = useState(false)
  const [poModalOpen, setPoModalOpen] = useState(false)
  const [supplierForm] = Form.useForm()
  const [poForm] = Form.useForm()

  const load = () => {
    inventoryApi.listPurchaseOrders(organizationId).then(setOrders)
    inventoryApi.listSuppliers(organizationId).then(setSuppliers)
    inventoryApi.listSpareParts(organizationId).then(setParts)
  }
  useEffect(load, [organizationId])

  const handleCreateSupplier = async () => {
    const values = await supplierForm.validateFields()
    await inventoryApi.createSupplier({ organizationId, ...values })
    message.success(t('inventoryPage.po.supplierCreateSuccess'))
    setSupplierModalOpen(false)
    supplierForm.resetFields()
    load()
  }

  const handleCreatePO = async () => {
    const values = await poForm.validateFields()
    await inventoryApi.createPurchaseOrder({ organizationId, supplierId: values.supplierId, items: values.items })
    message.success(t('inventoryPage.po.poCreateSuccess'))
    setPoModalOpen(false)
    poForm.resetFields()
    load()
  }

  const transition = async (action: 'submit' | 'approve' | 'cancel' | 'receive', id: string) => {
    try {
      const fn = {
        submit: inventoryApi.submitPurchaseOrder,
        approve: inventoryApi.approvePurchaseOrder,
        cancel: inventoryApi.cancelPurchaseOrder,
        receive: inventoryApi.receivePurchaseOrder,
      }[action]
      await fn(id)
      message.success(action === 'receive' ? t('inventoryPage.po.receiveSuccess') : t('inventoryPage.po.statusUpdated'))
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('inventoryPage.po.operationFailed'))
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<PlusOutlined />} onClick={() => setSupplierModalOpen(true)}>
          {t('inventoryPage.po.addSupplier')}
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setPoModalOpen(true)} disabled={suppliers.length === 0 || parts.length === 0}>
          {t('inventoryPage.po.newPO')}
        </Button>
        {(suppliers.length === 0 || parts.length === 0) && (
          <span style={{ color: '#999' }}>{t('inventoryPage.po.needSupplierAndPartNote')}</span>
        )}
      </Space>

      <Table<PurchaseOrder>
        rowKey="id"
        dataSource={orders}
        columns={[
          { title: t('inventoryPage.po.columnSupplier'), dataIndex: ['supplier', 'name'] },
          {
            title: t('inventoryPage.po.columnDetails'),
            render: (_, po) => po.items.map((i) => `${i.sparePart.name} x${i.quantity}`).join(', '),
          },
          { title: t('inventoryPage.po.columnStatus'), dataIndex: 'status', render: (v: PurchaseOrder['status']) => <Tag color={PO_STATUS_COLOR[v]}>{v}</Tag> },
          {
            title: t('inventoryPage.po.columnActions'),
            render: (_, po) => (
              <Space>
                {po.status === 'DRAFT' && (
                  <Button size="small" onClick={() => transition('submit', po.id)}>
                    {t('inventoryPage.po.submit')}
                  </Button>
                )}
                {po.status === 'SUBMITTED' && (
                  <Button size="small" type="primary" onClick={() => transition('approve', po.id)}>
                    {t('inventoryPage.po.approve')}
                  </Button>
                )}
                {po.status === 'APPROVED' && (
                  <Button size="small" type="primary" onClick={() => transition('receive', po.id)}>
                    {t('inventoryPage.po.confirmReceive')}
                  </Button>
                )}
                {(po.status === 'DRAFT' || po.status === 'SUBMITTED') && (
                  <Button size="small" danger onClick={() => transition('cancel', po.id)}>
                    {t('inventoryPage.po.cancel')}
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />

      <Modal title={t('inventoryPage.po.addSupplierModalTitle')} open={supplierModalOpen} onOk={handleCreateSupplier} onCancel={() => setSupplierModalOpen(false)}>
        <Form form={supplierForm} layout="vertical">
          <Form.Item name="name" label={t('inventoryPage.po.fieldSupplierName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="serviceCategory" label={t('inventoryPage.po.fieldServiceCategory')}>
            <Input placeholder={t('inventoryPage.po.fieldServiceCategoryPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('inventoryPage.po.newPOModalTitle')} open={poModalOpen} onOk={handleCreatePO} onCancel={() => setPoModalOpen(false)} width={600}>
        <Form form={poForm} layout="vertical">
          <Form.Item name="supplierId" label={t('inventoryPage.po.fieldSupplier')} rules={[{ required: true }]}>
            <Select options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
          </Form.Item>
          <Form.List name="items" initialValue={[{}]}>
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                    <Form.Item name={[field.name, 'sparePartId']} rules={[{ required: true, message: t('inventoryPage.po.fieldSparePartRequired') }]}>
                      <Select style={{ width: 200 }} placeholder={t('inventoryPage.po.fieldSparePartPlaceholder')} options={parts.map((p) => ({ value: p.id, label: p.name }))} />
                    </Form.Item>
                    <Form.Item name={[field.name, 'quantity']} rules={[{ required: true, message: t('inventoryPage.po.fieldQuantityRequired') }]}>
                      <InputNumber min={1} placeholder={t('inventoryPage.po.fieldQuantityPlaceholder')} />
                    </Form.Item>
                    <Form.Item name={[field.name, 'unitPrice']}>
                      <InputNumber min={0} placeholder={t('inventoryPage.po.fieldUnitPricePlaceholder')} />
                    </Form.Item>
                    <DeleteOutlined onClick={() => remove(field.name)} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />}>
                  {t('inventoryPage.po.addItem')}
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  )
}

function FaultyPartsTab({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [records, setRecords] = useState<FaultyPartRecord[]>([])
  const [parts, setParts] = useState<SparePart[]>([])
  const [fstds, setFstds] = useState<Fstd[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [statusModal, setStatusModal] = useState<{ record: FaultyPartRecord; target: Exclude<FaultyPartStatus, 'PENDING_DECISION'> }>()
  const [reportForm] = Form.useForm()
  const [statusForm] = Form.useForm()

  const load = () => {
    inventoryApi.listFaultyParts(organizationId).then(setRecords)
    inventoryApi.listSpareParts(organizationId).then(setParts)
    fstdsApi.list(organizationId).then(setFstds)
    inventoryApi.listSuppliers(organizationId).then(setSuppliers)
  }
  useEffect(load, [organizationId])

  const handleReport = async () => {
    const values = await reportForm.validateFields()
    await inventoryApi.reportFaultyPart(values)
    message.success(t('inventoryPage.faulty.reportSuccess'))
    setReportModalOpen(false)
    reportForm.resetFields()
    load()
  }

  const handleUpdateStatus = async () => {
    if (!statusModal) return
    const values = await statusForm.validateFields()
    try {
      await inventoryApi.updateFaultyPartStatus(statusModal.record.id, { status: statusModal.target, ...values })
      message.success(
        statusModal.target === 'REPAIRED_RETURNED_TO_STOCK' ? t('inventoryPage.faulty.repairedSuccess') : t('inventoryPage.faulty.statusUpdated'),
      )
      setStatusModal(undefined)
      statusForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('inventoryPage.faulty.operationFailed'))
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setReportModalOpen(true)} disabled={parts.length === 0}>
          {t('inventoryPage.faulty.addButton')}
        </Button>
        {parts.length === 0 && <span style={{ color: '#999' }}>{t('inventoryPage.faulty.needPartsNote')}</span>}
      </Space>
      <Table<FaultyPartRecord>
        rowKey="id"
        dataSource={records}
        columns={[
          { title: t('inventoryPage.faulty.columnPart'), render: (_, r) => `${r.sparePart.partNumber} - ${r.sparePart.name}` },
          { title: t('inventoryPage.faulty.columnRemovedFrom'), render: (_, r) => r.removedFromFstd?.deviceCode ?? '-' },
          { title: t('inventoryPage.faulty.columnQuantity'), dataIndex: 'quantity' },
          { title: t('inventoryPage.faulty.columnFaultDescription'), dataIndex: 'faultDescription' },
          {
            title: t('inventoryPage.faulty.columnStatus'),
            render: (_, r) => <Tag color={FAULTY_PART_STATUS_COLOR[r.status]}>{t(`inventoryPage.faultyStatus.${r.status}`)}</Tag>,
          },
          { title: t('inventoryPage.faulty.columnSupplierParty'), render: (_, r) => r.supplier?.name ?? '-' },
          {
            title: t('inventoryPage.faulty.columnActions'),
            render: (_, r) =>
              r.status === 'PENDING_DECISION' ? (
                <Space>
                  <Button size="small" onClick={() => setStatusModal({ record: r, target: 'SENT_FOR_REPAIR' })}>
                    {t('inventoryPage.faulty.sendForRepair')}
                  </Button>
                  <Button size="small" onClick={() => setStatusModal({ record: r, target: 'RETURNED_TO_SUPPLIER' })}>
                    {t('inventoryPage.faulty.returnToSupplier')}
                  </Button>
                  <Button size="small" danger onClick={() => setStatusModal({ record: r, target: 'SCRAPPED' })}>
                    {t('inventoryPage.faulty.scrap')}
                  </Button>
                </Space>
              ) : r.status === 'SENT_FOR_REPAIR' || r.status === 'RETURNED_TO_SUPPLIER' ? (
                <Space>
                  <Button size="small" type="primary" onClick={() => setStatusModal({ record: r, target: 'REPAIRED_RETURNED_TO_STOCK' })}>
                    {t('inventoryPage.faulty.repairedReturnToStock')}
                  </Button>
                  <Button size="small" danger onClick={() => setStatusModal({ record: r, target: 'SCRAPPED' })}>
                    {t('inventoryPage.faulty.scrap')}
                  </Button>
                </Space>
              ) : (
                <Tag>{t('inventoryPage.faulty.closedTag')}</Tag>
              ),
          },
        ]}
      />

      <Modal title={t('inventoryPage.faulty.reportModalTitle')} open={reportModalOpen} onOk={handleReport} onCancel={() => setReportModalOpen(false)}>
        <Form form={reportForm} layout="vertical" initialValues={{ quantity: 1 }}>
          <Form.Item name="sparePartId" label={t('inventoryPage.faulty.fieldPart')} rules={[{ required: true }]}>
            <Select options={parts.map((p) => ({ value: p.id, label: `${p.partNumber} - ${p.name}` }))} />
          </Form.Item>
          <Form.Item name="removedFromFstdId" label={t('inventoryPage.faulty.fieldRemovedFrom')}>
            <Select allowClear options={fstds.map((f) => ({ value: f.id, label: f.deviceCode }))} />
          </Form.Item>
          <Form.Item name="quantity" label={t('inventoryPage.faulty.fieldQuantity')} rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="faultDescription" label={t('inventoryPage.faulty.fieldFaultDescription')} rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={statusModal ? t(`inventoryPage.faultyStatus.${statusModal.target}`) : ''}
        open={!!statusModal}
        onOk={handleUpdateStatus}
        onCancel={() => setStatusModal(undefined)}
      >
        <Form form={statusForm} layout="vertical">
          {(statusModal?.target === 'SENT_FOR_REPAIR' || statusModal?.target === 'RETURNED_TO_SUPPLIER') && (
            <Form.Item name="supplierId" label={t('inventoryPage.faulty.fieldSupplierParty')} rules={[{ required: true }]}>
              <Select options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
            </Form.Item>
          )}
          <Form.Item name="resolutionNotes" label={t('inventoryPage.faulty.fieldNotes')}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function ScrapRequestsTab({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [requests, setRequests] = useState<PartScrapRequest[]>([])
  const [parts, setParts] = useState<SparePart[]>([])
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [approveModalId, setApproveModalId] = useState<string>()
  const [rejectModalId, setRejectModalId] = useState<string>()
  const [requestForm] = Form.useForm()
  const [approveForm] = Form.useForm()
  const [rejectForm] = Form.useForm()

  const load = () => {
    inventoryApi.listScrapRequests(organizationId).then(setRequests)
    inventoryApi.listSpareParts(organizationId).then(setParts)
    personnelApi.list().then(setPersonnel)
  }
  useEffect(load, [organizationId])

  const handleCreate = async () => {
    const values = await requestForm.validateFields()
    try {
      await inventoryApi.requestScrap(values)
      message.success(t('inventoryPage.scrap.createSuccess'))
      setRequestModalOpen(false)
      requestForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('inventoryPage.scrap.operationFailed'))
    }
  }

  const handleApprove = async () => {
    if (!approveModalId) return
    const values = await approveForm.validateFields()
    await inventoryApi.approveScrap(approveModalId, values.approvedById)
    message.success(t('inventoryPage.scrap.approveSuccess'))
    setApproveModalId(undefined)
    approveForm.resetFields()
    load()
  }

  const handleReject = async () => {
    if (!rejectModalId) return
    const values = await rejectForm.validateFields()
    await inventoryApi.rejectScrap(rejectModalId, values.rejectedReason)
    message.success(t('inventoryPage.scrap.rejectSuccess'))
    setRejectModalId(undefined)
    rejectForm.resetFields()
    load()
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setRequestModalOpen(true)} disabled={parts.length === 0}>
          {t('inventoryPage.scrap.addButton')}
        </Button>
      </Space>
      <Table<PartScrapRequest>
        rowKey="id"
        dataSource={requests}
        columns={[
          { title: t('inventoryPage.scrap.columnPart'), render: (_, r) => `${r.sparePart.partNumber} - ${r.sparePart.name}` },
          { title: t('inventoryPage.scrap.columnQuantity'), dataIndex: 'quantity' },
          { title: t('inventoryPage.scrap.columnReason'), dataIndex: 'reasonCode' },
          { title: t('inventoryPage.scrap.columnStatus'), render: (_, r) => <Tag color={SCRAP_STATUS_COLOR[r.status]}>{r.status}</Tag> },
          { title: t('inventoryPage.scrap.columnRejectReason'), dataIndex: 'rejectedReason' },
          {
            title: t('inventoryPage.scrap.columnActions'),
            render: (_, r) =>
              r.status === 'PENDING' ? (
                <Space>
                  <Button size="small" type="primary" onClick={() => setApproveModalId(r.id)}>
                    {t('inventoryPage.scrap.approve')}
                  </Button>
                  <Button size="small" danger onClick={() => setRejectModalId(r.id)}>
                    {t('inventoryPage.scrap.reject')}
                  </Button>
                </Space>
              ) : (
                <Tag>{t('inventoryPage.scrap.processedTag')}</Tag>
              ),
          },
        ]}
      />

      <Modal title={t('inventoryPage.scrap.createModalTitle')} open={requestModalOpen} onOk={handleCreate} onCancel={() => setRequestModalOpen(false)}>
        <Form form={requestForm} layout="vertical">
          <Form.Item name="sparePartId" label={t('inventoryPage.scrap.fieldPart')} rules={[{ required: true }]}>
            <Select
              options={parts.map((p) => ({
                value: p.id,
                label: t('inventoryPage.scrap.fieldPartOption', { partNumber: p.partNumber, name: p.name, qty: p.currentQuantity }),
              }))}
            />
          </Form.Item>
          <Form.Item name="quantity" label={t('inventoryPage.scrap.fieldQuantity')} rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reasonCode" label={t('inventoryPage.scrap.fieldReason')} rules={[{ required: true }]}>
            <Select options={SCRAP_REASON_CODES.map((code) => ({ value: code, label: t(`inventoryPage.scrapReasons.${code}`) }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('inventoryPage.scrap.approveModalTitle')} open={!!approveModalId} onOk={handleApprove} onCancel={() => setApproveModalId(undefined)}>
        <Form form={approveForm} layout="vertical">
          <Form.Item name="approvedById" label={t('inventoryPage.scrap.fieldApprover')} rules={[{ required: true }]}>
            <Select options={personnel.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('inventoryPage.scrap.rejectModalTitle')} open={!!rejectModalId} onOk={handleReject} onCancel={() => setRejectModalId(undefined)}>
        <Form form={rejectForm} layout="vertical">
          <Form.Item name="rejectedReason" label={t('inventoryPage.scrap.fieldRejectReason')}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function DemandRequestsTab({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [requests, setRequests] = useState<PartDemandRequest[]>([])
  const [parts, setParts] = useState<SparePart[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [isCataloged, setIsCataloged] = useState(true)
  const [convertModalId, setConvertModalId] = useState<string>()
  const [createForm] = Form.useForm()
  const [convertForm] = Form.useForm()

  const load = () => {
    inventoryApi.listDemandRequests(organizationId).then(setRequests)
    inventoryApi.listSpareParts(organizationId).then(setParts)
    inventoryApi.listSuppliers(organizationId).then(setSuppliers)
  }
  useEffect(load, [organizationId])

  const handleCreate = async () => {
    const values = await createForm.validateFields()
    await inventoryApi.createDemandRequest({
      organizationId,
      ...values,
      neededBy: values.neededBy ? values.neededBy.format('YYYY-MM-DD') : undefined,
    })
    message.success(t('inventoryPage.demand.createSuccess'))
    setCreateModalOpen(false)
    createForm.resetFields()
    load()
  }

  const handleCancel = async (id: string) => {
    await inventoryApi.cancelDemandRequest(id)
    message.success(t('inventoryPage.demand.cancelSuccess'))
    load()
  }

  const handleConvert = async () => {
    if (!convertModalId) return
    const values = await convertForm.validateFields()
    try {
      await inventoryApi.convertDemandToPurchaseOrder(convertModalId, values.supplierId)
      message.success(t('inventoryPage.demand.convertSuccess'))
      setConvertModalId(undefined)
      convertForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('inventoryPage.demand.operationFailed'))
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
          {t('inventoryPage.demand.addButton')}
        </Button>
      </Space>
      <Table<PartDemandRequest>
        rowKey="id"
        dataSource={requests}
        columns={[
          {
            title: t('inventoryPage.demand.columnPart'),
            render: (_, r) =>
              r.sparePart
                ? `${r.sparePart.partNumber} - ${r.sparePart.name}`
                : t('inventoryPage.demand.notCatalogedPart', { partNumber: r.partNumber ?? '', name: r.name ?? '' }),
          },
          { title: t('inventoryPage.demand.columnQuantity'), dataIndex: 'quantity' },
          { title: t('inventoryPage.demand.columnNeededBy'), render: (_, r) => (r.neededBy ? new Date(r.neededBy).toLocaleDateString() : '-') },
          { title: t('inventoryPage.demand.columnStatus'), render: (_, r) => <Tag color={DEMAND_STATUS_COLOR[r.status]}>{r.status}</Tag> },
          { title: t('inventoryPage.demand.columnNotes'), dataIndex: 'notes' },
          {
            title: t('inventoryPage.demand.columnActions'),
            render: (_, r) =>
              r.status === 'PENDING' ? (
                <Space>
                  <Button size="small" type="primary" disabled={!r.sparePart} onClick={() => setConvertModalId(r.id)}>
                    {t('inventoryPage.demand.convertToPO')}
                  </Button>
                  <Button size="small" danger onClick={() => handleCancel(r.id)}>
                    {t('inventoryPage.demand.cancel')}
                  </Button>
                </Space>
              ) : (
                <Tag>{t('inventoryPage.demand.processedTag')}</Tag>
              ),
          },
        ]}
      />

      <Modal
        title={t('inventoryPage.demand.createModalTitle')}
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => setCreateModalOpen(false)}
      >
        <Form form={createForm} layout="vertical" initialValues={{ quantity: 1 }}>
          <Space style={{ marginBottom: 8 }}>
            <span>{t('inventoryPage.demand.partTypeLabel')}</span>
            <Select
              value={isCataloged ? 'cataloged' : 'new'}
              style={{ width: 200 }}
              onChange={(v) => setIsCataloged(v === 'cataloged')}
              options={[
                { value: 'cataloged', label: t('inventoryPage.demand.partTypeCataloged') },
                { value: 'new', label: t('inventoryPage.demand.partTypeNew') },
              ]}
            />
          </Space>
          {isCataloged ? (
            <Form.Item name="sparePartId" label={t('inventoryPage.demand.fieldPart')} rules={[{ required: isCataloged }]}>
              <Select options={parts.map((p) => ({ value: p.id, label: `${p.partNumber} - ${p.name}` }))} />
            </Form.Item>
          ) : (
            <>
              <Form.Item name="partNumber" label={t('inventoryPage.demand.fieldPartNumber')} rules={[{ required: !isCataloged }]}>
                <Input />
              </Form.Item>
              <Form.Item name="name" label={t('inventoryPage.demand.fieldName')}>
                <Input />
              </Form.Item>
            </>
          )}
          <Form.Item name="quantity" label={t('inventoryPage.demand.fieldQuantity')} rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="neededBy" label={t('inventoryPage.demand.fieldNeededBy')}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label={t('inventoryPage.demand.fieldNotes')}>
            <Input.TextArea rows={2} placeholder={t('inventoryPage.demand.fieldNotesPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('inventoryPage.demand.convertModalTitle')} open={!!convertModalId} onOk={handleConvert} onCancel={() => setConvertModalId(undefined)}>
        <Form form={convertForm} layout="vertical">
          <Form.Item name="supplierId" label={t('inventoryPage.demand.fieldSupplier')} rules={[{ required: true }]}>
            <Select options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function StocktakeTab({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [sessions, setSessions] = useState<StocktakeSession[]>([])
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm] = Form.useForm()

  const load = () => {
    inventoryApi.listStocktakeSessions(organizationId).then(setSessions)
  }
  useEffect(load, [organizationId])

  const refreshOne = async (id: string) => {
    const updated = await inventoryApi.getStocktakeSession(id)
    setSessions((prev) => prev.map((s) => (s.id === id ? updated : s)))
  }

  const handleCreate = async () => {
    const values = await createForm.validateFields()
    await inventoryApi.createStocktakeSession(organizationId, values.title)
    message.success(t('inventoryPage.stocktake.createSuccess'))
    setCreateModalOpen(false)
    createForm.resetFields()
    load()
  }

  const handleCount = async (itemId: string, sessionId: string, countedQuantity: number | null) => {
    if (countedQuantity == null) return
    await inventoryApi.recordStocktakeCount(itemId, countedQuantity)
    refreshOne(sessionId)
  }

  const handleReconcile = async (id: string) => {
    try {
      await inventoryApi.reconcileStocktake(id)
      message.success(t('inventoryPage.stocktake.reconcileSuccess'))
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('inventoryPage.stocktake.operationFailed'))
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
          {t('inventoryPage.stocktake.addButton')}
        </Button>
      </Space>
      <Table<StocktakeSession>
        rowKey="id"
        dataSource={sessions}
        columns={[
          { title: t('inventoryPage.stocktake.columnTitle'), render: (_, s) => s.title ?? t('inventoryPage.stocktake.untitled') },
          { title: t('inventoryPage.stocktake.columnStartedAt'), dataIndex: 'startedAt', render: (v: string) => new Date(v).toLocaleString() },
          {
            title: t('inventoryPage.stocktake.columnStatus'),
            render: (_, s) => (
              <Tag color={s.status === 'IN_PROGRESS' ? 'orange' : 'green'}>
                {s.status === 'IN_PROGRESS' ? t('inventoryPage.stocktake.inProgressTag') : t('inventoryPage.stocktake.reconciledTag')}
              </Tag>
            ),
          },
          { title: t('inventoryPage.stocktake.columnReconciledAt'), render: (_, s) => (s.reconciledAt ? new Date(s.reconciledAt).toLocaleString() : '-') },
          {
            title: t('inventoryPage.stocktake.columnActions'),
            render: (_, s) =>
              s.status === 'IN_PROGRESS' ? (
                <Button size="small" type="primary" onClick={() => handleReconcile(s.id)}>
                  {t('inventoryPage.stocktake.completeReconcile')}
                </Button>
              ) : (
                <Tag>{t('inventoryPage.stocktake.completedTag')}</Tag>
              ),
          },
        ]}
        expandable={{
          expandedRowRender: (s) => (
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={s.items}
              columns={[
                { title: t('inventoryPage.stocktake.columnPart'), render: (_, i) => `${i.sparePart.partNumber} - ${i.sparePart.name}` },
                { title: t('inventoryPage.stocktake.columnSystemQuantity'), dataIndex: 'systemQuantity' },
                {
                  title: t('inventoryPage.stocktake.columnCountedQuantity'),
                  render: (_, i) =>
                    s.status === 'IN_PROGRESS' ? (
                      <InputNumber
                        min={0}
                        defaultValue={i.countedQuantity ?? undefined}
                        onPressEnter={(e) => handleCount(i.id, s.id, Number((e.target as HTMLInputElement).value))}
                        onBlur={(e) => handleCount(i.id, s.id, e.target.value === '' ? null : Number(e.target.value))}
                      />
                    ) : (
                      (i.countedQuantity ?? '-')
                    ),
                },
                {
                  title: t('inventoryPage.stocktake.columnDifference'),
                  render: (_, i) =>
                    i.countedQuantity == null ? (
                      '-'
                    ) : (
                      <Tag color={i.countedQuantity === i.systemQuantity ? 'default' : 'red'}>
                        {i.countedQuantity - i.systemQuantity > 0 ? '+' : ''}
                        {i.countedQuantity - i.systemQuantity}
                      </Tag>
                    ),
                },
              ]}
            />
          ),
        }}
      />

      <Modal title={t('inventoryPage.stocktake.createModalTitle')} open={createModalOpen} onOk={handleCreate} onCancel={() => setCreateModalOpen(false)}>
        <Form form={createForm} layout="vertical">
          <Form.Item name="title" label={t('inventoryPage.stocktake.fieldTitle')}>
            <Input placeholder={t('inventoryPage.stocktake.fieldTitlePlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function PartTypeConfigTab({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [configs, setConfigs] = useState<PartTypeConfig[]>([])
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [renameModal, setRenameModal] = useState<PartTypeConfig>()
  const [createForm] = Form.useForm()
  const [renameForm] = Form.useForm()

  const load = () => {
    inventoryApi.listPartTypeConfigs(organizationId).then(setConfigs)
  }
  useEffect(load, [organizationId])

  const handleCreate = async () => {
    const values = await createForm.validateFields()
    try {
      await inventoryApi.createPartTypeConfig({ organizationId, ...values })
      message.success(t('inventoryPage.partTypes.createSuccess'))
      setCreateModalOpen(false)
      createForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('inventoryPage.partTypes.operationFailed'))
    }
  }

  const handleRename = async () => {
    if (!renameModal) return
    const values = await renameForm.validateFields()
    await inventoryApi.updatePartTypeConfigLabel(renameModal.id, values.label)
    message.success(t('inventoryPage.partTypes.renameSuccess'))
    setRenameModal(undefined)
    load()
  }

  const handleDelete = async (id: string) => {
    try {
      await inventoryApi.deletePartTypeConfig(id)
      message.success(t('inventoryPage.partTypes.deleteSuccess'))
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('inventoryPage.partTypes.operationFailed'))
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
          {t('inventoryPage.partTypes.addButton')}
        </Button>
        <span style={{ color: '#999' }}>{t('inventoryPage.partTypes.note')}</span>
      </Space>
      <Table<PartTypeConfig>
        rowKey="id"
        dataSource={configs}
        columns={[
          { title: t('inventoryPage.partTypes.columnCode'), dataIndex: 'code' },
          { title: t('inventoryPage.partTypes.columnLabel'), dataIndex: 'label' },
          {
            title: t('inventoryPage.partTypes.columnType'),
            render: (_, c) => (c.isBuiltIn ? <Tag color="blue">{t('inventoryPage.partTypes.builtInTag')}</Tag> : <Tag>{t('inventoryPage.partTypes.customTag')}</Tag>),
          },
          {
            title: t('inventoryPage.partTypes.columnActions'),
            render: (_, c) => (
              <Space>
                <Button
                  size="small"
                  onClick={() => {
                    renameForm.setFieldsValue({ label: c.label })
                    setRenameModal(c)
                  }}
                >
                  {t('inventoryPage.partTypes.rename')}
                </Button>
                {!c.isBuiltIn && (
                  <Button size="small" danger onClick={() => handleDelete(c.id)}>
                    {t('inventoryPage.partTypes.delete')}
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />

      <Modal title={t('inventoryPage.partTypes.createModalTitle')} open={createModalOpen} onOk={handleCreate} onCancel={() => setCreateModalOpen(false)}>
        <Form form={createForm} layout="vertical">
          <Form.Item name="code" label={t('inventoryPage.partTypes.fieldCode')} rules={[{ required: true, message: t('inventoryPage.partTypes.fieldCodeRequiredMessage') }]}>
            <Input placeholder={t('inventoryPage.partTypes.fieldCodePlaceholder')} />
          </Form.Item>
          <Form.Item name="label" label={t('inventoryPage.partTypes.fieldLabel')} rules={[{ required: true }]}>
            <Input placeholder={t('inventoryPage.partTypes.fieldLabelPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('inventoryPage.partTypes.renameModalTitle')} open={!!renameModal} onOk={handleRename} onCancel={() => setRenameModal(undefined)}>
        <Form form={renameForm} layout="vertical">
          <Form.Item name="label" label={t('inventoryPage.partTypes.fieldLabel')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function WarehousesTab({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [stock, setStock] = useState<Record<string, WarehouseStock[]>>({})
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm] = Form.useForm()

  const load = () => {
    inventoryApi.listWarehouses(organizationId).then(setWarehouses)
  }
  useEffect(load, [organizationId])

  const loadStock = async (warehouseId: string) => {
    const list = await inventoryApi.listWarehouseStock(warehouseId)
    setStock((prev) => ({ ...prev, [warehouseId]: list }))
  }

  const handleCreate = async () => {
    const values = await createForm.validateFields()
    await inventoryApi.createWarehouse({ organizationId, ...values })
    message.success(t('inventoryPage.warehouses.createSuccess'))
    setCreateModalOpen(false)
    createForm.resetFields()
    load()
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
          {t('inventoryPage.warehouses.addButton')}
        </Button>
      </Space>
      <Table<Warehouse>
        rowKey="id"
        dataSource={warehouses}
        columns={[
          { title: t('inventoryPage.warehouses.columnName'), dataIndex: 'name' },
          {
            title: t('inventoryPage.warehouses.columnType'),
            render: (_, w) => <Tag color={w.type === 'OWN' ? 'default' : 'purple'}>{t(`inventoryPage.warehouseTypes.${w.type}`)}</Tag>,
          },
          { title: t('inventoryPage.warehouses.columnExternalInfo'), dataIndex: 'externalPartyInfo' },
        ]}
        expandable={{
          onExpand: (expanded, w) => expanded && loadStock(w.id),
          expandedRowRender: (w) => (
            <List
              size="small"
              dataSource={stock[w.id] ?? []}
              locale={{ emptyText: t('inventoryPage.warehouses.noStock') }}
              renderItem={(s) => (
                <List.Item>
                  {s.sparePart?.partNumber} - {s.sparePart?.name}: {s.quantity} {s.sparePart?.unit}
                </List.Item>
              )}
            />
          ),
        }}
      />

      <Modal title={t('inventoryPage.warehouses.createModalTitle')} open={createModalOpen} onOk={handleCreate} onCancel={() => setCreateModalOpen(false)}>
        <Form form={createForm} layout="vertical" initialValues={{ type: 'OWN' }}>
          <Form.Item name="name" label={t('inventoryPage.warehouses.fieldName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label={t('inventoryPage.warehouses.fieldType')} rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'OWN', label: t('inventoryPage.warehouses.typeOwnOption') },
                { value: 'CONSIGNMENT', label: t('inventoryPage.warehouses.typeConsignmentOption') },
                { value: 'THIRD_PARTY_MANAGED', label: t('inventoryPage.warehouses.typeThirdPartyOption') },
              ]}
            />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.type !== cur.type}
          >
            {({ getFieldValue }) =>
              getFieldValue('type') !== 'OWN' && (
                <Form.Item name="externalPartyInfo" label={t('inventoryPage.warehouses.fieldExternalInfo')}>
                  <Input />
                </Form.Item>
              )
            }
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function LoansTab({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [loans, setLoans] = useState<PartLoan[]>([])
  const [overdue, setOverdue] = useState<PartLoan[]>([])
  const [parts, setParts] = useState<SparePart[]>([])
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm] = Form.useForm()

  const load = () => {
    inventoryApi.listLoans(organizationId).then(setLoans)
    inventoryApi.findOverdueLoans().then(setOverdue)
    inventoryApi.listSpareParts(organizationId).then(setParts)
  }
  useEffect(load, [organizationId])

  const handleCreate = async () => {
    const values = await createForm.validateFields()
    try {
      await inventoryApi.createLoan({
        ...values,
        dueDate: values.dueDate ? values.dueDate.format('YYYY-MM-DD') : undefined,
      })
      message.success(t('inventoryPage.loans.createSuccess'))
      setCreateModalOpen(false)
      createForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('inventoryPage.loans.operationFailed'))
    }
  }

  const handleReturn = async (id: string) => {
    await inventoryApi.returnLoan(id)
    message.success(t('inventoryPage.loans.returnSuccess'))
    load()
  }

  return (
    <div>
      {overdue.length > 0 && (
        <Alert
          style={{ marginBottom: 16 }}
          type="warning"
          showIcon
          message={t('inventoryPage.loans.overdueWarning', { count: overdue.length })}
          description={overdue.map((l) => t('inventoryPage.loans.overdueItem', { name: l.sparePart.name, borrower: l.borrowerInfo })).join('、')}
        />
      )}
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)} disabled={parts.length === 0}>
          {t('inventoryPage.loans.addButton')}
        </Button>
      </Space>
      <Table<PartLoan>
        rowKey="id"
        dataSource={loans}
        columns={[
          { title: t('inventoryPage.loans.columnPart'), render: (_, l) => `${l.sparePart.partNumber} - ${l.sparePart.name}` },
          { title: t('inventoryPage.loans.columnQuantity'), dataIndex: 'quantity' },
          { title: t('inventoryPage.loans.columnBorrower'), dataIndex: 'borrowerInfo' },
          { title: t('inventoryPage.loans.columnLoanedAt'), dataIndex: 'loanedAt', render: (v: string) => new Date(v).toLocaleDateString() },
          {
            title: t('inventoryPage.loans.columnDueDate'),
            render: (_, l) =>
              l.dueDate ? (
                <Tag color={!l.returnedAt && new Date(l.dueDate) < new Date() ? 'red' : 'default'}>
                  {new Date(l.dueDate).toLocaleDateString()}
                </Tag>
              ) : (
                '-'
              ),
          },
          {
            title: t('inventoryPage.loans.columnStatus'),
            render: (_, l) => (l.returnedAt ? <Tag color="green">{t('inventoryPage.loans.returnedTag')}</Tag> : <Tag color="orange">{t('inventoryPage.loans.onLoanTag')}</Tag>),
          },
          {
            title: t('inventoryPage.loans.columnActions'),
            render: (_, l) =>
              !l.returnedAt && (
                <Button size="small" type="primary" onClick={() => handleReturn(l.id)}>
                  {t('inventoryPage.loans.recordReturn')}
                </Button>
              ),
          },
        ]}
      />

      <Modal title={t('inventoryPage.loans.createModalTitle')} open={createModalOpen} onOk={handleCreate} onCancel={() => setCreateModalOpen(false)}>
        <Form form={createForm} layout="vertical" initialValues={{ quantity: 1 }}>
          <Form.Item name="sparePartId" label={t('inventoryPage.loans.fieldPart')} rules={[{ required: true }]}>
            <Select
              options={parts.map((p) => ({
                value: p.id,
                label: t('inventoryPage.loans.fieldPartOption', { partNumber: p.partNumber, name: p.name, qty: p.currentQuantity }),
              }))}
            />
          </Form.Item>
          <Form.Item name="quantity" label={t('inventoryPage.loans.fieldQuantity')} rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="borrowerInfo" label={t('inventoryPage.loans.fieldBorrower')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="dueDate" label={t('inventoryPage.loans.fieldDueDate')}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="purposeNote" label={t('inventoryPage.loans.fieldPurposeNote')}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function PartInspectionTab({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [parts, setParts] = useState<SparePart[]>([])
  const [dueSoon, setDueSoon] = useState<PartInspectionDueSoonItem[]>([])
  const [inspections, setInspections] = useState<Record<string, PartInspectionRecord[]>>({})
  const [recordModalPartId, setRecordModalPartId] = useState<string>()
  const [recordForm] = Form.useForm()

  const load = () => {
    inventoryApi.listSpareParts(organizationId).then((all) => setParts(all.filter((p) => p.requiresInspection)))
    inventoryApi.findPartInspectionsDueSoon().then(setDueSoon)
  }
  useEffect(load, [organizationId])

  const loadInspections = async (partId: string) => {
    const list = await inventoryApi.listPartInspections(partId)
    setInspections((prev) => ({ ...prev, [partId]: list }))
  }

  const handleRecord = async () => {
    if (!recordModalPartId) return
    const values = await recordForm.validateFields()
    await inventoryApi.recordPartInspection(recordModalPartId, {
      ...values,
      inspectedAt: values.inspectedAt.format('YYYY-MM-DD'),
    })
    message.success(t('inventoryPage.inspection.recordSuccess'))
    setRecordModalPartId(undefined)
    recordForm.resetFields()
    load()
    loadInspections(recordModalPartId)
  }

  return (
    <div>
      {dueSoon.length > 0 && (
        <Alert
          style={{ marginBottom: 16 }}
          type="warning"
          showIcon
          message={t('inventoryPage.inspection.dueSoonWarning', { count: dueSoon.length })}
          description={dueSoon.map((p) => p.name).join('、')}
        />
      )}
      <Table<SparePart>
        rowKey="id"
        dataSource={parts}
        locale={{ emptyText: t('inventoryPage.inspection.noPartsNote') }}
        columns={[
          { title: t('inventoryPage.inspection.columnPartNumber'), dataIndex: 'partNumber' },
          { title: t('inventoryPage.inspection.columnName'), dataIndex: 'name' },
          { title: t('inventoryPage.inspection.columnInterval'), render: (_, p) => t('inventoryPage.inspection.intervalTag', { months: p.inspectionIntervalMonths }) },
          {
            title: t('inventoryPage.inspection.columnActions'),
            render: (_, p) => (
              <Button
                size="small"
                type="primary"
                onClick={() => {
                  recordForm.resetFields()
                  setRecordModalPartId(p.id)
                }}
              >
                {t('inventoryPage.inspection.recordInspection')}
              </Button>
            ),
          },
        ]}
        expandable={{
          onExpand: (expanded, p) => expanded && loadInspections(p.id),
          expandedRowRender: (p) => (
            <List
              size="small"
              dataSource={inspections[p.id] ?? []}
              locale={{ emptyText: t('inventoryPage.inspection.noInspections') }}
              renderItem={(i) => (
                <List.Item>
                  <Tag color={i.result === 'pass' ? 'green' : 'red'}>{i.result}</Tag>
                  {t('inventoryPage.inspection.inspectionRecordLine', {
                    date: new Date(i.inspectedAt).toLocaleDateString(),
                    nextDue: i.nextDueDate ? new Date(i.nextDueDate).toLocaleDateString() : '-',
                  })}
                  {i.notes ? ` | ${i.notes}` : ''}
                </List.Item>
              )}
            />
          ),
        }}
      />

      <Modal title={t('inventoryPage.inspection.recordModalTitle')} open={!!recordModalPartId} onOk={handleRecord} onCancel={() => setRecordModalPartId(undefined)}>
        <Form form={recordForm} layout="vertical" initialValues={{ inspectedAt: dayjs(), result: 'pass' }}>
          <Form.Item name="inspectedAt" label={t('inventoryPage.inspection.fieldInspectedAt')} rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="result" label={t('inventoryPage.inspection.fieldResult')} rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'pass', label: t('inventoryPage.inspection.resultPass') },
                { value: 'fail', label: t('inventoryPage.inspection.resultFail') },
              ]}
            />
          </Form.Item>
          <Form.Item name="notes" label={t('inventoryPage.inspection.fieldNotes')}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export function InventoryPage() {
  const { t } = useTranslation()
  const { organizations, selectedId, select } = useSelectedOrganization()

  return (
    <div>
      <OrganizationSelector organizations={organizations} selectedId={selectedId} onChange={select} />
      {!selectedId ? (
        <Empty description={t('inventoryPage.selectOrgFirst')} />
      ) : (
        <Tabs
          destroyOnHidden
          items={[
            { key: 'parts', label: t('inventoryPage.tabParts'), children: <SparePartsTab organizationId={selectedId} /> },
            { key: 'tools', label: t('inventoryPage.tabTools'), children: <ToolsTab organizationId={selectedId} /> },
            { key: 'po', label: t('inventoryPage.tabPO'), children: <PurchaseOrdersTab organizationId={selectedId} /> },
            { key: 'faulty', label: t('inventoryPage.tabFaulty'), children: <FaultyPartsTab organizationId={selectedId} /> },
            { key: 'scrap', label: t('inventoryPage.tabScrap'), children: <ScrapRequestsTab organizationId={selectedId} /> },
            { key: 'demand', label: t('inventoryPage.tabDemand'), children: <DemandRequestsTab organizationId={selectedId} /> },
            { key: 'stocktake', label: t('inventoryPage.tabStocktake'), children: <StocktakeTab organizationId={selectedId} /> },
            { key: 'warehouses', label: t('inventoryPage.tabWarehouses'), children: <WarehousesTab organizationId={selectedId} /> },
            { key: 'loans', label: t('inventoryPage.tabLoans'), children: <LoansTab organizationId={selectedId} /> },
            { key: 'inspection', label: t('inventoryPage.tabInspection'), children: <PartInspectionTab organizationId={selectedId} /> },
            { key: 'part-types', label: t('inventoryPage.tabPartTypes'), children: <PartTypeConfigTab organizationId={selectedId} /> },
          ]}
        />
      )}
    </div>
  )
}
