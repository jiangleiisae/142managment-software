import { PlusOutlined } from '@ant-design/icons'
import { Button, DatePicker, Empty, Form, Modal, Select, Space, Table, Tag, message } from 'antd'
import { useEffect, useState } from 'react'
import { bookingsApi } from '../api/bookings'
import { fstdsApi } from '../api/fstds'
import { studentsApi } from '../api/students'
import type { Booking, BookingResourceType, Fstd, Student } from '../api/types'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'

const { RangePicker } = DatePicker

// 需求清单 3.8: 排课引擎强依赖设备能力(3.3)/学员前置条件(3.7)的实时校验, 校验逻辑全部在后端, 这里负责把结果透出给用户
export function BookingsPage() {
  const { organizations, selectedId, select } = useSelectedOrganization()
  const [fstds, setFstds] = useState<Fstd[]>([])
  const [students, setStudents] = useState<Student[]>([])
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
    studentsApi.list(selectedId).then(setStudents)
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

  const selectedFstd = fstds.find((f) => f.id === selectedFstdId)

  const handleCreate = async () => {
    if (!selectedFstdId || !selectedId) return
    const values = await form.validateFields()
    const [startAt, endAt] = values.range
    try {
      await bookingsApi.create({
        organizationId: selectedId,
        resourceType: 'FSTD' as BookingResourceType,
        resourceId: selectedFstdId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        studentId: values.studentId,
        taskCode: values.taskCode,
      })
      message.success('预订成功')
      setModalOpen(false)
      form.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? '预订失败')
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
              { title: '训练科目', dataIndex: 'taskCode', render: (v?: string) => (v ? <Tag color="blue">{v}</Tag> : '-') },
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
          <Form.Item name="taskCode" label="训练科目 (校验设备是否已鉴定该科目)">
            <Select
              allowClear
              placeholder="不选则不校验具体科目"
              options={(selectedFstd?.qualifiedTasks ?? []).map((t) => ({ value: t.taskCode, label: `${t.taskCode} - ${t.taskName}` }))}
            />
          </Form.Item>
          <Form.Item name="studentId" label="学员 (校验体检证有效性, ORA.ATO.145)">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="不选则不校验学员前置条件"
              options={students.map((s) => ({ value: s.id, label: `${s.lastName}${s.firstName}` }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
