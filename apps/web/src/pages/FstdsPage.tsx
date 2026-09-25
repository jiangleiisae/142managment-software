import { PlusOutlined } from '@ant-design/icons'
import { Button, Empty, Form, Input, Modal, Select, Space, Table, Tag, message } from 'antd'
import { useEffect, useState } from 'react'
import { fstdsApi } from '../api/fstds'
import type { Fstd, FstdDeviceType, LegacyLevel } from '../api/types'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'

const DEVICE_TYPES: FstdDeviceType[] = ['FFS', 'FTD', 'FNPT', 'BITD']
const LEGACY_LEVELS: LegacyLevel[] = [
  'FFS_A', 'FFS_B', 'FFS_C', 'FFS_D', 'FTD_1', 'FTD_2', 'FNPT_I', 'FNPT_II', 'FNPT_II_MCC', 'BITD',
]

export function FstdsPage() {
  const { organizations, selectedId, select } = useSelectedOrganization()
  const [fstds, setFstds] = useState<Fstd[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  const load = () => {
    if (!selectedId) return
    setLoading(true)
    fstdsApi
      .list(selectedId)
      .then(setFstds)
      .finally(() => setLoading(false))
  }

  useEffect(load, [selectedId])

  const handleCreate = async () => {
    if (!selectedId) return
    const values = await form.validateFields()
    await fstdsApi.create({ organizationId: selectedId, ...values })
    message.success('模拟机创建成功')
    setModalOpen(false)
    form.resetFields()
    load()
  }

  return (
    <div>
      <OrganizationSelector organizations={organizations} selectedId={selectedId} onChange={select} />

      {!selectedId ? (
        <Empty description="请先创建并选择一个机构" />
      ) : (
        <>
          <Space style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              新增模拟机
            </Button>
          </Space>

          <Table<Fstd>
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
                title: '已鉴定任务数',
                dataIndex: 'qualifiedTasks',
                render: (v: Fstd['qualifiedTasks']) => v?.length ?? 0,
              },
              { title: '状态', dataIndex: 'status' },
            ]}
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
    </div>
  )
}
