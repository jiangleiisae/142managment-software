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
  LowStockItem,
  PartMovement,
  PurchaseOrder,
  SparePart,
  Supplier,
  Tool,
} from '../api/inventory'
import { inventoryApi } from '../api/inventory'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'

const PO_STATUS_COLOR: Record<PurchaseOrder['status'], string> = {
  DRAFT: 'default',
  SUBMITTED: 'processing',
  APPROVED: 'blue',
  RECEIVED: 'green',
  CANCELLED: 'red',
}

function SparePartsTab({ organizationId }: { organizationId: string }) {
  const [parts, setParts] = useState<SparePart[]>([])
  const [lowStock, setLowStock] = useState<LowStockItem[]>([])
  const [movements, setMovements] = useState<Record<string, PartMovement[]>>({})
  const [partModalOpen, setPartModalOpen] = useState(false)
  const [movementModalPartId, setMovementModalPartId] = useState<string>()
  const [partForm] = Form.useForm()
  const [movementForm] = Form.useForm()

  const load = () => {
    inventoryApi.listSpareParts(organizationId).then(setParts)
    inventoryApi.listLowStock().then(setLowStock)
  }
  useEffect(load, [organizationId])

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
            title: '库存',
            render: (_, p) => (
              <Tag color={p.currentQuantity < p.minQuantity ? 'red' : 'green'}>
                {p.currentQuantity} / 最低{p.minQuantity} {p.unit}
              </Tag>
            ),
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
          <Form.Item name="minQuantity" label="最低库存量" initialValue={0} rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
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
          ]}
        />
      )}
    </div>
  )
}
