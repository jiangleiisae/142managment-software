import { PlusOutlined } from '@ant-design/icons'
import { Button, DatePicker, Empty, Form, Input, Modal, Select, Space, Table, Tag, message } from 'antd'
import { useEffect, useState } from 'react'
import { bookingsApi } from '../api/bookings'
import { fstdsApi } from '../api/fstds'
import type { Booking, BookingResourceType, Fstd } from '../api/types'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'

const { RangePicker } = DatePicker

// 需求清单 3.8: 一期先做 FSTD 资源日历, 教室/教员资源留待后续扩展
export function BookingsPage() {
  const { organizations, selectedId, select } = useSelectedOrganization()
  const [fstds, setFstds] = useState<Fstd[]>([])
  const [selectedFstdId, setSelectedFstdId] = useState<string>()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    if (!selectedId) return
    fstdsApi.list(selectedId).then((list) => {
      setFstds(list)
      setSelectedFstdId(list[0]?.id)
    })
  }, [selectedId])

  const load = () => {
    if (!selectedFstdId) return
    setLoading(true)
    bookingsApi
      .listByResource('FSTD', selectedFstdId)
      .then(setBookings)
      .finally(() => setLoading(false))
  }

  useEffect(load, [selectedFstdId])

  const handleCreate = async () => {
    if (!selectedFstdId) return
    const values = await form.validateFields()
    const [startAt, endAt] = values.range
    try {
      await bookingsApi.create({
        resourceType: 'FSTD' as BookingResourceType,
        resourceId: selectedFstdId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      })
      message.success('预订成功')
      setModalOpen(false)
      form.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '预订失败 (可能存在时间冲突)')
    }
  }

  const cancel = async (id: string) => {
    await bookingsApi.cancel(id)
    message.success('已取消')
    load()
  }

  return (
    <div>
      <OrganizationSelector organizations={organizations} selectedId={selectedId} onChange={select} />

      {!selectedId ? (
        <Empty description="请先创建并选择一个机构" />
      ) : fstds.length === 0 ? (
        <Empty description="该机构还没有模拟机, 请先到「模拟机」页面创建" />
      ) : (
        <>
          <Space style={{ marginBottom: 16 }}>
            <Select
              style={{ width: 200 }}
              value={selectedFstdId}
              options={fstds.map((f) => ({ value: f.id, label: f.deviceCode }))}
              onChange={setSelectedFstdId}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              新增预订
            </Button>
          </Space>

          <Table<Booking>
            rowKey="id"
            loading={loading}
            dataSource={bookings}
            columns={[
              { title: '开始时间', dataIndex: 'startAt', render: (v: string) => new Date(v).toLocaleString() },
              { title: '结束时间', dataIndex: 'endAt', render: (v: string) => new Date(v).toLocaleString() },
              { title: '状态', dataIndex: 'status', render: (v: string) => <Tag>{v}</Tag> },
              {
                title: '操作',
                render: (_, record) => (
                  <Button size="small" danger onClick={() => cancel(record.id)}>
                    取消
                  </Button>
                ),
              },
            ]}
          />
        </>
      )}

      <Modal title="新增预订" open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="range" label="时间段" rules={[{ required: true }]}>
            <RangePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Input disabled value="资源冲突会在后端自动校验并拒绝" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
