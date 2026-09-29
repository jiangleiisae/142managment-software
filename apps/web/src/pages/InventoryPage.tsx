import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import {
  Alert,
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
  message,
} from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
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

const FAULTY_PART_STATUS_LABEL: Record<FaultyPartStatus, { text: string; color: string }> = {
  PENDING_DECISION: { text: '待决定', color: 'orange' },
  SENT_FOR_REPAIR: { text: '已送修', color: 'blue' },
  RETURNED_TO_SUPPLIER: { text: '已退供应商', color: 'purple' },
  REPAIRED_RETURNED_TO_STOCK: { text: '修复已入库', color: 'green' },
  SCRAPPED: { text: '已报废', color: 'red' },
}

const SCRAP_STATUS_COLOR: Record<ScrapRequestStatus, string> = { PENDING: 'orange', APPROVED: 'green', REJECTED: 'red' }
const DEMAND_STATUS_COLOR: Record<DemandRequestStatus, string> = { PENDING: 'orange', CONVERTED: 'green', CANCELLED: 'default' }
const SCRAP_REASON_OPTIONS = [
  { value: 'DAMAGED', label: '损坏' },
  { value: 'EXPIRED', label: '过期' },
  { value: 'OBSOLETE', label: '淘汰停用' },
  { value: 'LOST', label: '遗失' },
  { value: 'OTHER', label: '其他' },
]

const WAREHOUSE_TYPE_LABEL: Record<Warehouse['type'], string> = {
  OWN: '自有仓库',
  CONSIGNMENT: '寄售仓库',
  THIRD_PARTY_MANAGED: '第三方托管仓库',
}

function SparePartsTab({ organizationId }: { organizationId: string }) {
  const [parts, setParts] = useState<SparePart[]>([])
  const [lowStock, setLowStock] = useState<LowStockItem[]>([])
  const [movements, setMovements] = useState<Record<string, PartMovement[]>>({})
  const [openDiscrepancies, setOpenDiscrepancies] = useState<Discrepancy[]>([])
  const [typeConfigs, setTypeConfigs] = useState<PartTypeConfig[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [partModalOpen, setPartModalOpen] = useState(false)
  const [movementModalPartId, setMovementModalPartId] = useState<string>()
  const [partForm] = Form.useForm()
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
    message.success('备件已建档')
    setPartModalOpen(false)
    partForm.resetFields()
    load()
  }

  const handleRecordMovement = async () => {
    if (!movementModalPartId) return
    const values = await movementForm.validateFields()
    try {
      await inventoryApi.recordMovement(movementModalPartId, values)
      message.success('出入库记录已保存')
      setMovementModalPartId(undefined)
      movementForm.resetFields()
      load()
      loadMovements(movementModalPartId)
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '操作失败')
    }
  }

  return (
    <div>
      {lowStock.length > 0 && (
        <Alert
          style={{ marginBottom: 16 }}
          type="warning"
          showIcon
          message={`有 ${lowStock.length} 项备件库存低于最低库存量, 建议尽快采购`}
          description={lowStock.map((p) => `${p.name}(${p.currentQuantity}/${p.minQuantity})`).join('、')}
        />
      )}
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setPartModalOpen(true)}>
          新增备件
        </Button>
      </Space>
      <Table<SparePart>
        rowKey="id"
        dataSource={parts}
        columns={[
          { title: '备件编号', dataIndex: 'partNumber' },
          { title: '名称', dataIndex: 'name' },
          { title: '适用机型/设备', dataIndex: 'compatibleWith' },
          {
            title: '分类',
            dataIndex: 'partCategory',
            render: (v: SparePart['partCategory']) => <Tag color={v === 'ROTABLE' ? 'blue' : 'default'}>{categoryLabel(v)}</Tag>,
          },
          {
            title: '库存',
            render: (_, p) => (
              <Tag color={p.currentQuantity < p.minQuantity ? 'red' : 'green'}>
                {p.currentQuantity} / 最低{p.minQuantity} {p.unit}
              </Tag>
            ),
          },
          {
            title: '检测要求',
            render: (_, p) => (p.requiresInspection ? <Tag color="purple">每{p.inspectionIntervalMonths}个月</Tag> : '-'),
          },
          {
            title: '操作',
            render: (_, p) => (
              <Button size="small" onClick={() => setMovementModalPartId(p.id)}>
                出入库登记
              </Button>
            ),
          },
        ]}
        expandable={{
          onExpand: (expanded, p) => expanded && loadMovements(p.id),
          expandedRowRender: (p) => (
            <List
              size="small"
              dataSource={movements[p.id] ?? []}
              locale={{ emptyText: '暂无出入库记录' }}
              renderItem={(m) => (
                <List.Item>
                  <Tag color={m.type === 'IN' ? 'green' : m.type === 'OUT' ? 'orange' : 'default'}>{m.type}</Tag>
                  {m.quantity} {p.unit} - {m.note} ({new Date(m.performedAt).toLocaleString()})
                  {m.warehouse && (
                    <Tag color="geekblue" style={{ marginLeft: 8 }}>
                      仓库: {m.warehouse.name}
                    </Tag>
                  )}
                  {m.usageLocation && (
                    <Tag color="cyan" style={{ marginLeft: 8 }}>
                      使用位置: {m.usageLocation}
                    </Tag>
                  )}
                  {m.relatedDiscrepancy && (
                    <Tag color="volcano" style={{ marginLeft: 8 }}>
                      关联缺陷: {m.relatedDiscrepancy.fstd.deviceCode} - {m.relatedDiscrepancy.description}
                    </Tag>
                  )}
                </List.Item>
              )}
            />
          ),
        }}
      />

      <Modal title="新增备件" open={partModalOpen} onOk={handleCreatePart} onCancel={() => setPartModalOpen(false)}>
        <Form form={partForm} layout="vertical">
          <Form.Item name="partNumber" label="备件编号" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="compatibleWith" label="适用机型/设备">
            <Input placeholder="如: A320 FFS / 通用" />
          </Form.Item>
          <Form.Item name="partCategory" label="备件分类" initialValue="CONSUMABLE" rules={[{ required: true }]}>
            <Select options={typeConfigs.map((c) => ({ value: c.code, label: c.label }))} />
          </Form.Item>
          <Form.Item name="minQuantity" label="最低库存量" initialValue={0} rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="requiresInspection" label="是否要求定期检测" initialValue={false}>
            <Select
              options={[
                { value: false, label: '否' },
                { value: true, label: '是 (适航性相关备件, 独立于工具校准计划)' },
              ]}
            />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.requiresInspection !== cur.requiresInspection}
          >
            {({ getFieldValue }) =>
              getFieldValue('requiresInspection') && (
                <Form.Item name="inspectionIntervalMonths" label="检测间隔(月)" rules={[{ required: true }]}>
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              )
            }
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="出入库登记"
        open={!!movementModalPartId}
        onOk={handleRecordMovement}
        onCancel={() => setMovementModalPartId(undefined)}
      >
        <Form form={movementForm} layout="vertical" initialValues={{ type: 'IN' }}>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'IN', label: '入库' },
                { value: 'OUT', label: '出库' },
                { value: 'ADJUSTMENT', label: '盘点调整 (可为负数)' },
              ]}
            />
          </Form.Item>
          <Form.Item name="quantity" label="数量" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="warehouseId" label="仓库 (可选)">
            <Select
              allowClear
              placeholder="若需按仓库拆分库存, 可选择本次出入库发生的仓库"
              options={warehouses.map((w) => ({ value: w.id, label: `${w.name} (${WAREHOUSE_TYPE_LABEL[w.type]})` }))}
            />
          </Form.Item>
          <Form.Item name="usageLocation" label="使用位置 (可选, 出库时填写实际安装位置)">
            <Input placeholder="如: FFS-01 视景系统机柜 / 工位3" />
          </Form.Item>
          <Form.Item name="relatedDiscrepancyId" label="关联缺陷 (可选)">
            <Select
              allowClear
              placeholder="若本次领用是为了排除某个缺陷, 可关联该缺陷"
              options={openDiscrepancies.map((d) => ({ value: d.id, label: `${d.fstd?.deviceCode ?? d.fstdId} - ${d.description}` }))}
            />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input placeholder="如: 用于FFS-01维修 / 采购到货" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function ToolsTab({ organizationId }: { organizationId: string }) {
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
    message.success('工具已建档')
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
    message.success('校准记录已保存, 下次到期日已自动计算')
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
          message={`有 ${dueSoon.length} 件工具的校准即将到期或从未校准过`}
          description={dueSoon.map((t) => t.name).join('、')}
        />
      )}
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setToolModalOpen(true)}>
          新增工具
        </Button>
      </Space>
      <Table<Tool>
        rowKey="id"
        dataSource={tools}
        columns={[
          { title: '工具编号', dataIndex: 'toolCode' },
          { title: '名称', dataIndex: 'name' },
          { title: '校准周期(月)', dataIndex: 'calibrationIntervalMonths' },
          {
            title: '最近校准/下次到期',
            render: (_, t) => {
              const latest = t.calibrations?.[0]
              if (!latest) return <Tag color="red">从未校准</Tag>
              return (
                <Tag color={latest.nextDueDate && new Date(latest.nextDueDate) < new Date() ? 'red' : 'default'}>
                  {latest.result} / {latest.nextDueDate ? new Date(latest.nextDueDate).toLocaleDateString() : '-'}
                </Tag>
              )
            },
          },
          {
            title: '操作',
            render: (_, t) => (
              <Button size="small" onClick={() => setCalModalToolId(t.id)}>
                记录校准
              </Button>
            ),
          },
        ]}
      />

      <Modal title="新增工具" open={toolModalOpen} onOk={handleCreateTool} onCancel={() => setToolModalOpen(false)}>
        <Form form={toolForm} layout="vertical">
          <Form.Item name="toolCode" label="工具编号" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="calibrationIntervalMonths" label="校准周期(月)" initialValue={12} rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="记录校准" open={!!calModalToolId} onOk={handleRecordCalibration} onCancel={() => setCalModalToolId(undefined)}>
        <Form form={calForm} layout="vertical" initialValues={{ calibratedAt: dayjs(), result: 'pass' }}>
          <Form.Item name="calibratedAt" label="校准日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="result" label="结果" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'pass', label: '通过' },
                { value: 'fail', label: '未通过' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function PurchaseOrdersTab({ organizationId }: { organizationId: string }) {
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
    message.success('供应商已添加')
    setSupplierModalOpen(false)
    supplierForm.resetFields()
    load()
  }

  const handleCreatePO = async () => {
    const values = await poForm.validateFields()
    await inventoryApi.createPurchaseOrder({ organizationId, supplierId: values.supplierId, items: values.items })
    message.success('采购单已创建 (草稿)')
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
      message.success(action === 'receive' ? '已入库, 备件库存已自动更新' : '状态已更新')
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '操作失败')
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<PlusOutlined />} onClick={() => setSupplierModalOpen(true)}>
          新增供应商
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setPoModalOpen(true)} disabled={suppliers.length === 0 || parts.length === 0}>
          新建采购单
        </Button>
        {(suppliers.length === 0 || parts.length === 0) && (
          <span style={{ color: '#999' }}>需先有供应商和备件才能建采购单</span>
        )}
      </Space>

      <Table<PurchaseOrder>
        rowKey="id"
        dataSource={orders}
        columns={[
          { title: '供应商', dataIndex: ['supplier', 'name'] },
          {
            title: '明细',
            render: (_, po) => po.items.map((i) => `${i.sparePart.name} x${i.quantity}`).join(', '),
          },
          { title: '状态', dataIndex: 'status', render: (v: PurchaseOrder['status']) => <Tag color={PO_STATUS_COLOR[v]}>{v}</Tag> },
          {
            title: '操作',
            render: (_, po) => (
              <Space>
                {po.status === 'DRAFT' && (
                  <Button size="small" onClick={() => transition('submit', po.id)}>
                    提交
                  </Button>
                )}
                {po.status === 'SUBMITTED' && (
                  <Button size="small" type="primary" onClick={() => transition('approve', po.id)}>
                    批准
                  </Button>
                )}
                {po.status === 'APPROVED' && (
                  <Button size="small" type="primary" onClick={() => transition('receive', po.id)}>
                    确认到货入库
                  </Button>
                )}
                {(po.status === 'DRAFT' || po.status === 'SUBMITTED') && (
                  <Button size="small" danger onClick={() => transition('cancel', po.id)}>
                    取消
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />

      <Modal title="新增供应商" open={supplierModalOpen} onOk={handleCreateSupplier} onCancel={() => setSupplierModalOpen(false)}>
        <Form form={supplierForm} layout="vertical">
          <Form.Item name="name" label="供应商名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="serviceCategory" label="服务类别">
            <Input placeholder="如: 视景系统 / 运动系统" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="新建采购单" open={poModalOpen} onOk={handleCreatePO} onCancel={() => setPoModalOpen(false)} width={600}>
        <Form form={poForm} layout="vertical">
          <Form.Item name="supplierId" label="供应商" rules={[{ required: true }]}>
            <Select options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
          </Form.Item>
          <Form.List name="items" initialValue={[{}]}>
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                    <Form.Item name={[field.name, 'sparePartId']} rules={[{ required: true, message: '选择备件' }]}>
                      <Select style={{ width: 200 }} placeholder="备件" options={parts.map((p) => ({ value: p.id, label: p.name }))} />
                    </Form.Item>
                    <Form.Item name={[field.name, 'quantity']} rules={[{ required: true, message: '数量' }]}>
                      <InputNumber min={1} placeholder="数量" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'unitPrice']}>
                      <InputNumber min={0} placeholder="单价" />
                    </Form.Item>
                    <DeleteOutlined onClick={() => remove(field.name)} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />}>
                  添加一项
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
    message.success('故障件已登记')
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
        statusModal.target === 'REPAIRED_RETURNED_TO_STOCK' ? '已标记修复完成, 库存已自动增加' : '状态已更新',
      )
      setStatusModal(undefined)
      statusForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '操作失败')
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setReportModalOpen(true)} disabled={parts.length === 0}>
          登记故障件
        </Button>
        {parts.length === 0 && <span style={{ color: '#999' }}>需先有备件才能登记故障件</span>}
      </Space>
      <Table<FaultyPartRecord>
        rowKey="id"
        dataSource={records}
        columns={[
          { title: '备件', render: (_, r) => `${r.sparePart.partNumber} - ${r.sparePart.name}` },
          { title: '拆自设备', render: (_, r) => r.removedFromFstd?.deviceCode ?? '-' },
          { title: '数量', dataIndex: 'quantity' },
          { title: '故障描述', dataIndex: 'faultDescription' },
          {
            title: '状态',
            render: (_, r) => <Tag color={FAULTY_PART_STATUS_LABEL[r.status].color}>{FAULTY_PART_STATUS_LABEL[r.status].text}</Tag>,
          },
          { title: '送修/退换对象', render: (_, r) => r.supplier?.name ?? '-' },
          {
            title: '操作',
            render: (_, r) =>
              r.status === 'PENDING_DECISION' ? (
                <Space>
                  <Button size="small" onClick={() => setStatusModal({ record: r, target: 'SENT_FOR_REPAIR' })}>
                    送修
                  </Button>
                  <Button size="small" onClick={() => setStatusModal({ record: r, target: 'RETURNED_TO_SUPPLIER' })}>
                    退供应商
                  </Button>
                  <Button size="small" danger onClick={() => setStatusModal({ record: r, target: 'SCRAPPED' })}>
                    报废
                  </Button>
                </Space>
              ) : r.status === 'SENT_FOR_REPAIR' || r.status === 'RETURNED_TO_SUPPLIER' ? (
                <Space>
                  <Button size="small" type="primary" onClick={() => setStatusModal({ record: r, target: 'REPAIRED_RETURNED_TO_STOCK' })}>
                    修复入库
                  </Button>
                  <Button size="small" danger onClick={() => setStatusModal({ record: r, target: 'SCRAPPED' })}>
                    报废
                  </Button>
                </Space>
              ) : (
                <Tag>已完结</Tag>
              ),
          },
        ]}
      />

      <Modal title="登记故障件" open={reportModalOpen} onOk={handleReport} onCancel={() => setReportModalOpen(false)}>
        <Form form={reportForm} layout="vertical" initialValues={{ quantity: 1 }}>
          <Form.Item name="sparePartId" label="备件" rules={[{ required: true }]}>
            <Select options={parts.map((p) => ({ value: p.id, label: `${p.partNumber} - ${p.name}` }))} />
          </Form.Item>
          <Form.Item name="removedFromFstdId" label="拆自设备 (可选)">
            <Select allowClear options={fstds.map((f) => ({ value: f.id, label: f.deviceCode }))} />
          </Form.Item>
          <Form.Item name="quantity" label="数量" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="faultDescription" label="故障描述" rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={statusModal ? `${FAULTY_PART_STATUS_LABEL[statusModal.target].text}` : ''}
        open={!!statusModal}
        onOk={handleUpdateStatus}
        onCancel={() => setStatusModal(undefined)}
      >
        <Form form={statusForm} layout="vertical">
          {(statusModal?.target === 'SENT_FOR_REPAIR' || statusModal?.target === 'RETURNED_TO_SUPPLIER') && (
            <Form.Item name="supplierId" label="送修/退换对象" rules={[{ required: true }]}>
              <Select options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
            </Form.Item>
          )}
          <Form.Item name="resolutionNotes" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function ScrapRequestsTab({ organizationId }: { organizationId: string }) {
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
      message.success('报废申请已提交, 待审批')
      setRequestModalOpen(false)
      requestForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '操作失败')
    }
  }

  const handleApprove = async () => {
    if (!approveModalId) return
    const values = await approveForm.validateFields()
    await inventoryApi.approveScrap(approveModalId, values.approvedById)
    message.success('报废已批准, 库存已扣减')
    setApproveModalId(undefined)
    approveForm.resetFields()
    load()
  }

  const handleReject = async () => {
    if (!rejectModalId) return
    const values = await rejectForm.validateFields()
    await inventoryApi.rejectScrap(rejectModalId, values.rejectedReason)
    message.success('报废申请已驳回')
    setRejectModalId(undefined)
    rejectForm.resetFields()
    load()
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setRequestModalOpen(true)} disabled={parts.length === 0}>
          申请报废
        </Button>
      </Space>
      <Table<PartScrapRequest>
        rowKey="id"
        dataSource={requests}
        columns={[
          { title: '备件', render: (_, r) => `${r.sparePart.partNumber} - ${r.sparePart.name}` },
          { title: '数量', dataIndex: 'quantity' },
          { title: '原因', dataIndex: 'reasonCode' },
          { title: '状态', render: (_, r) => <Tag color={SCRAP_STATUS_COLOR[r.status]}>{r.status}</Tag> },
          { title: '驳回理由', dataIndex: 'rejectedReason' },
          {
            title: '操作',
            render: (_, r) =>
              r.status === 'PENDING' ? (
                <Space>
                  <Button size="small" type="primary" onClick={() => setApproveModalId(r.id)}>
                    批准
                  </Button>
                  <Button size="small" danger onClick={() => setRejectModalId(r.id)}>
                    驳回
                  </Button>
                </Space>
              ) : (
                <Tag>已处理</Tag>
              ),
          },
        ]}
      />

      <Modal title="申请报废" open={requestModalOpen} onOk={handleCreate} onCancel={() => setRequestModalOpen(false)}>
        <Form form={requestForm} layout="vertical">
          <Form.Item name="sparePartId" label="备件" rules={[{ required: true }]}>
            <Select options={parts.map((p) => ({ value: p.id, label: `${p.partNumber} - ${p.name} (库存${p.currentQuantity})` }))} />
          </Form.Item>
          <Form.Item name="quantity" label="数量" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reasonCode" label="报废原因" rules={[{ required: true }]}>
            <Select options={SCRAP_REASON_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="批准报废" open={!!approveModalId} onOk={handleApprove} onCancel={() => setApproveModalId(undefined)}>
        <Form form={approveForm} layout="vertical">
          <Form.Item name="approvedById" label="审批人" rules={[{ required: true }]}>
            <Select options={personnel.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="驳回报废申请" open={!!rejectModalId} onOk={handleReject} onCancel={() => setRejectModalId(undefined)}>
        <Form form={rejectForm} layout="vertical">
          <Form.Item name="rejectedReason" label="驳回理由">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function DemandRequestsTab({ organizationId }: { organizationId: string }) {
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
    message.success('需求已登记')
    setCreateModalOpen(false)
    createForm.resetFields()
    load()
  }

  const handleCancel = async (id: string) => {
    await inventoryApi.cancelDemandRequest(id)
    message.success('需求已取消')
    load()
  }

  const handleConvert = async () => {
    if (!convertModalId) return
    const values = await convertForm.validateFields()
    try {
      await inventoryApi.convertDemandToPurchaseOrder(convertModalId, values.supplierId)
      message.success('已转为采购单 (草稿)')
      setConvertModalId(undefined)
      convertForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '操作失败')
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
          登记需求
        </Button>
      </Space>
      <Table<PartDemandRequest>
        rowKey="id"
        dataSource={requests}
        columns={[
          { title: '备件', render: (_, r) => (r.sparePart ? `${r.sparePart.partNumber} - ${r.sparePart.name}` : `${r.partNumber ?? ''} ${r.name ?? ''} (尚未建档)`) },
          { title: '数量', dataIndex: 'quantity' },
          { title: '需要日期', render: (_, r) => (r.neededBy ? new Date(r.neededBy).toLocaleDateString() : '-') },
          { title: '状态', render: (_, r) => <Tag color={DEMAND_STATUS_COLOR[r.status]}>{r.status}</Tag> },
          { title: '备注', dataIndex: 'notes' },
          {
            title: '操作',
            render: (_, r) =>
              r.status === 'PENDING' ? (
                <Space>
                  <Button size="small" type="primary" disabled={!r.sparePart} onClick={() => setConvertModalId(r.id)}>
                    转采购单
                  </Button>
                  <Button size="small" danger onClick={() => handleCancel(r.id)}>
                    取消
                  </Button>
                </Space>
              ) : (
                <Tag>已处理</Tag>
              ),
          },
        ]}
      />

      <Modal
        title="登记需求"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => setCreateModalOpen(false)}
      >
        <Form form={createForm} layout="vertical" initialValues={{ quantity: 1 }}>
          <Space style={{ marginBottom: 8 }}>
            <span>备件类型:</span>
            <Select
              value={isCataloged ? 'cataloged' : 'new'}
              style={{ width: 200 }}
              onChange={(v) => setIsCataloged(v === 'cataloged')}
              options={[
                { value: 'cataloged', label: '系统内已建档的备件' },
                { value: 'new', label: '尚未建档的新备件' },
              ]}
            />
          </Space>
          {isCataloged ? (
            <Form.Item name="sparePartId" label="备件" rules={[{ required: isCataloged }]}>
              <Select options={parts.map((p) => ({ value: p.id, label: `${p.partNumber} - ${p.name}` }))} />
            </Form.Item>
          ) : (
            <>
              <Form.Item name="partNumber" label="备件编号" rules={[{ required: !isCataloged }]}>
                <Input />
              </Form.Item>
              <Form.Item name="name" label="名称">
                <Input />
              </Form.Item>
            </>
          )}
          <Form.Item name="quantity" label="数量" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="neededBy" label="预计需要日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} placeholder="如: 预计下季度大修需要" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="转为采购单" open={!!convertModalId} onOk={handleConvert} onCancel={() => setConvertModalId(undefined)}>
        <Form form={convertForm} layout="vertical">
          <Form.Item name="supplierId" label="供应商" rules={[{ required: true }]}>
            <Select options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function StocktakeTab({ organizationId }: { organizationId: string }) {
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
    message.success('盘点已开始, 已按当前账面库存生成快照')
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
      message.success('对账完成, 差异已自动调整入库存')
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '操作失败')
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
          开始新盘点
        </Button>
      </Space>
      <Table<StocktakeSession>
        rowKey="id"
        dataSource={sessions}
        columns={[
          { title: '标题', render: (_, s) => s.title ?? '(未命名)' },
          { title: '开始时间', dataIndex: 'startedAt', render: (v: string) => new Date(v).toLocaleString() },
          {
            title: '状态',
            render: (_, s) => <Tag color={s.status === 'IN_PROGRESS' ? 'orange' : 'green'}>{s.status === 'IN_PROGRESS' ? '进行中' : '已对账'}</Tag>,
          },
          { title: '对账时间', render: (_, s) => (s.reconciledAt ? new Date(s.reconciledAt).toLocaleString() : '-') },
          {
            title: '操作',
            render: (_, s) =>
              s.status === 'IN_PROGRESS' ? (
                <Button size="small" type="primary" onClick={() => handleReconcile(s.id)}>
                  完成对账
                </Button>
              ) : (
                <Tag>已完成</Tag>
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
                { title: '备件', render: (_, i) => `${i.sparePart.partNumber} - ${i.sparePart.name}` },
                { title: '账面库存', dataIndex: 'systemQuantity' },
                {
                  title: '实盘数',
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
                  title: '差异',
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

      <Modal title="开始新盘点" open={createModalOpen} onOk={handleCreate} onCancel={() => setCreateModalOpen(false)}>
        <Form form={createForm} layout="vertical">
          <Form.Item name="title" label="盘点标题 (可选)">
            <Input placeholder="如: 2026年第三季度库存盘点" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function PartTypeConfigTab({ organizationId }: { organizationId: string }) {
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
      message.success('分类已添加')
      setCreateModalOpen(false)
      createForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '操作失败')
    }
  }

  const handleRename = async () => {
    if (!renameModal) return
    const values = await renameForm.validateFields()
    await inventoryApi.updatePartTypeConfigLabel(renameModal.id, values.label)
    message.success('显示名称已更新')
    setRenameModal(undefined)
    load()
  }

  const handleDelete = async (id: string) => {
    try {
      await inventoryApi.deletePartTypeConfig(id)
      message.success('分类已删除')
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '操作失败')
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
          新增分类
        </Button>
        <span style={{ color: '#999' }}>消耗件/周转件为内置分类, 不可删除但可改显示名称; 可自行追加其他分类</span>
      </Space>
      <Table<PartTypeConfig>
        rowKey="id"
        dataSource={configs}
        columns={[
          { title: '编码', dataIndex: 'code' },
          { title: '显示名称', dataIndex: 'label' },
          { title: '类型', render: (_, c) => (c.isBuiltIn ? <Tag color="blue">内置</Tag> : <Tag>自定义</Tag>) },
          {
            title: '操作',
            render: (_, c) => (
              <Space>
                <Button
                  size="small"
                  onClick={() => {
                    renameForm.setFieldsValue({ label: c.label })
                    setRenameModal(c)
                  }}
                >
                  改名称
                </Button>
                {!c.isBuiltIn && (
                  <Button size="small" danger onClick={() => handleDelete(c.id)}>
                    删除
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />

      <Modal title="新增分类" open={createModalOpen} onOk={handleCreate} onCancel={() => setCreateModalOpen(false)}>
        <Form form={createForm} layout="vertical">
          <Form.Item name="code" label="编码" rules={[{ required: true, message: '如 CONSIGNMENT_ITEM, 全大写+下划线' }]}>
            <Input placeholder="如: CONSIGNMENT_ITEM" />
          </Form.Item>
          <Form.Item name="label" label="显示名称" rules={[{ required: true }]}>
            <Input placeholder="如: 寄售件" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="修改显示名称" open={!!renameModal} onOk={handleRename} onCancel={() => setRenameModal(undefined)}>
        <Form form={renameForm} layout="vertical">
          <Form.Item name="label" label="显示名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function WarehousesTab({ organizationId }: { organizationId: string }) {
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
    message.success('仓库已建档')
    setCreateModalOpen(false)
    createForm.resetFields()
    load()
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
          新增仓库
        </Button>
      </Space>
      <Table<Warehouse>
        rowKey="id"
        dataSource={warehouses}
        columns={[
          { title: '仓库名称', dataIndex: 'name' },
          { title: '类型', render: (_, w) => <Tag color={w.type === 'OWN' ? 'default' : 'purple'}>{WAREHOUSE_TYPE_LABEL[w.type]}</Tag> },
          { title: '寄售/托管方信息', dataIndex: 'externalPartyInfo' },
        ]}
        expandable={{
          onExpand: (expanded, w) => expanded && loadStock(w.id),
          expandedRowRender: (w) => (
            <List
              size="small"
              dataSource={stock[w.id] ?? []}
              locale={{ emptyText: '该仓库暂无库存记录' }}
              renderItem={(s) => (
                <List.Item>
                  {s.sparePart?.partNumber} - {s.sparePart?.name}: {s.quantity} {s.sparePart?.unit}
                </List.Item>
              )}
            />
          ),
        }}
      />

      <Modal title="新增仓库" open={createModalOpen} onOk={handleCreate} onCancel={() => setCreateModalOpen(false)}>
        <Form form={createForm} layout="vertical" initialValues={{ type: 'OWN' }}>
          <Form.Item name="name" label="仓库名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'OWN', label: '自有仓库' },
                { value: 'CONSIGNMENT', label: '寄售仓库 (备件所有权归供应商)' },
                { value: 'THIRD_PARTY_MANAGED', label: '第三方托管仓库 (所有权归本机构, 存放于第三方)' },
              ]}
            />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.type !== cur.type}
          >
            {({ getFieldValue }) =>
              getFieldValue('type') !== 'OWN' && (
                <Form.Item name="externalPartyInfo" label="对方信息 (供应商/托管方名称)">
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
      message.success('借出登记已保存, 库存已扣减')
      setCreateModalOpen(false)
      createForm.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '操作失败')
    }
  }

  const handleReturn = async (id: string) => {
    await inventoryApi.returnLoan(id)
    message.success('已登记归还, 库存已恢复')
    load()
  }

  return (
    <div>
      {overdue.length > 0 && (
        <Alert
          style={{ marginBottom: 16 }}
          type="warning"
          showIcon
          message={`有 ${overdue.length} 项借用件已逾期未归还`}
          description={overdue.map((l) => `${l.sparePart.name}(借用方: ${l.borrowerInfo})`).join('、')}
        />
      )}
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)} disabled={parts.length === 0}>
          登记借出
        </Button>
      </Space>
      <Table<PartLoan>
        rowKey="id"
        dataSource={loans}
        columns={[
          { title: '备件', render: (_, l) => `${l.sparePart.partNumber} - ${l.sparePart.name}` },
          { title: '数量', dataIndex: 'quantity' },
          { title: '借用方', dataIndex: 'borrowerInfo' },
          { title: '借出时间', dataIndex: 'loanedAt', render: (v: string) => new Date(v).toLocaleDateString() },
          {
            title: '应还日期',
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
            title: '状态',
            render: (_, l) => (l.returnedAt ? <Tag color="green">已归还</Tag> : <Tag color="orange">借出中</Tag>),
          },
          {
            title: '操作',
            render: (_, l) =>
              !l.returnedAt && (
                <Button size="small" type="primary" onClick={() => handleReturn(l.id)}>
                  登记归还
                </Button>
              ),
          },
        ]}
      />

      <Modal title="登记借出" open={createModalOpen} onOk={handleCreate} onCancel={() => setCreateModalOpen(false)}>
        <Form form={createForm} layout="vertical" initialValues={{ quantity: 1 }}>
          <Form.Item name="sparePartId" label="备件" rules={[{ required: true }]}>
            <Select options={parts.map((p) => ({ value: p.id, label: `${p.partNumber} - ${p.name} (库存${p.currentQuantity})` }))} />
          </Form.Item>
          <Form.Item name="quantity" label="数量" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="borrowerInfo" label="借用方 (人员/单位)" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="dueDate" label="应还日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="purposeNote" label="用途备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function PartInspectionTab({ organizationId }: { organizationId: string }) {
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
    message.success('检测记录已保存, 下次到期日已自动计算')
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
          message={`有 ${dueSoon.length} 项备件的检测即将到期或从未检测过`}
          description={dueSoon.map((p) => p.name).join('、')}
        />
      )}
      <Table<SparePart>
        rowKey="id"
        dataSource={parts}
        locale={{ emptyText: '暂无要求定期检测的备件 (在备件库存新增/编辑时勾选"是否要求定期检测")' }}
        columns={[
          { title: '备件编号', dataIndex: 'partNumber' },
          { title: '名称', dataIndex: 'name' },
          { title: '检测间隔', render: (_, p) => `每${p.inspectionIntervalMonths}个月` },
          {
            title: '操作',
            render: (_, p) => (
              <Button
                size="small"
                type="primary"
                onClick={() => {
                  recordForm.resetFields()
                  setRecordModalPartId(p.id)
                }}
              >
                记录检测
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
              locale={{ emptyText: '尚未记录任何检测' }}
              renderItem={(i) => (
                <List.Item>
                  <Tag color={i.result === 'pass' ? 'green' : 'red'}>{i.result}</Tag>
                  检测日期 {new Date(i.inspectedAt).toLocaleDateString()}, 下次到期{' '}
                  {i.nextDueDate ? new Date(i.nextDueDate).toLocaleDateString() : '-'}
                  {i.notes ? ` | ${i.notes}` : ''}
                </List.Item>
              )}
            />
          ),
        }}
      />

      <Modal title="记录检测" open={!!recordModalPartId} onOk={handleRecord} onCancel={() => setRecordModalPartId(undefined)}>
        <Form form={recordForm} layout="vertical" initialValues={{ inspectedAt: dayjs(), result: 'pass' }}>
          <Form.Item name="inspectedAt" label="检测日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="result" label="结果" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'pass', label: '通过' },
                { value: 'fail', label: '未通过' },
              ]}
            />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export function InventoryPage() {
  const { organizations, selectedId, select } = useSelectedOrganization()

  return (
    <div>
      <OrganizationSelector organizations={organizations} selectedId={selectedId} onChange={select} />
      {!selectedId ? (
        <Empty description="请先创建并选择一个机构" />
      ) : (
        <Tabs
          destroyOnHidden
          items={[
            { key: 'parts', label: '备件库存', children: <SparePartsTab organizationId={selectedId} /> },
            { key: 'tools', label: '工具校准', children: <ToolsTab organizationId={selectedId} /> },
            { key: 'po', label: '采购订单', children: <PurchaseOrdersTab organizationId={selectedId} /> },
            { key: 'faulty', label: '故障件管理', children: <FaultyPartsTab organizationId={selectedId} /> },
            { key: 'scrap', label: '报废管理', children: <ScrapRequestsTab organizationId={selectedId} /> },
            { key: 'demand', label: '备件需求', children: <DemandRequestsTab organizationId={selectedId} /> },
            { key: 'stocktake', label: '备件盘点', children: <StocktakeTab organizationId={selectedId} /> },
            { key: 'warehouses', label: '仓库管理', children: <WarehousesTab organizationId={selectedId} /> },
            { key: 'loans', label: '借用管理', children: <LoansTab organizationId={selectedId} /> },
            { key: 'inspection', label: '备件检测', children: <PartInspectionTab organizationId={selectedId} /> },
            { key: 'part-types', label: '备件信息配置', children: <PartTypeConfigTab organizationId={selectedId} /> },
          ]}
        />
      )}
    </div>
  )
}
