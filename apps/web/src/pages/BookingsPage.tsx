import { DownloadOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { App, Button, DatePicker, Empty, Form, List, Modal, Select, Space, Table, Tag, Typography, Upload } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { bookingsApi } from '../api/bookings'
import { fstdsApi } from '../api/fstds'
import { studentsApi } from '../api/students'
import type { Booking, BookingResourceType, Fstd, Student } from '../api/types'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'

const { RangePicker } = DatePicker

// 需求清单 3.8: 排课引擎强依赖设备能力(3.3)/学员前置条件(3.7)的实时校验, 校验逻辑全部在后端, 这里负责把结果透出给用户
export function BookingsPage() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { organizations, selectedId, select } = useSelectedOrganization()
  const [fstds, setFstds] = useState<Fstd[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [selectedFstdId, setSelectedFstdId] = useState<string>()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ createdCount: number; errorCount: number; errors: { row: number; message: string }[] }>()
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
      message.success(t('bookings.createSuccess'))
      setModalOpen(false)
      form.resetFields()
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('bookings.createFailed'))
    }
  }

  const cancel = async (id: string) => {
    await bookingsApi.cancel(id)
    message.success(t('bookings.cancelled'))
    load()
  }

  const handleImport = async (file: File) => {
    if (!selectedId) return false
    setImporting(true)
    try {
      const result = await bookingsApi.importExcel(selectedId, file)
      setImportResult(result)
      load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err.response?.data?.message ?? t('bookings.importFailed'))
    } finally {
      setImporting(false)
    }
    return false
  }

  return (
    <div>
      <OrganizationSelector organizations={organizations} selectedId={selectedId} onChange={select} />

      {!selectedId ? (
        <Empty description={t('bookings.selectOrgFirst')} />
      ) : fstds.length === 0 ? (
        <Empty description={t('bookings.noFstds')} />
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
              {t('bookings.addButton')}
            </Button>
            <Button icon={<DownloadOutlined />} href="/templates/schedule-template.xlsx" download>
              {t('bookings.downloadTemplate')}
            </Button>
            <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={handleImport}>
              <Button icon={<UploadOutlined />} loading={importing}>
                {t('bookings.importExcel')}
              </Button>
            </Upload>
          </Space>

          <Table<Booking>
            rowKey="id"
            loading={loading}
            dataSource={bookings}
            scroll={{ x: 'max-content' }}
            columns={[
              { title: t('bookings.columnStartAt'), dataIndex: 'startAt', render: (v: string) => new Date(v).toLocaleString() },
              { title: t('bookings.columnEndAt'), dataIndex: 'endAt', render: (v: string) => new Date(v).toLocaleString() },
              { title: t('bookings.columnTaskCode'), dataIndex: 'taskCode', render: (v?: string) => (v ? <Tag color="blue">{v}</Tag> : '-') },
              { title: t('bookings.columnCustomer'), dataIndex: 'customerName', render: (v?: string | null) => v ?? '-' },
              { title: t('bookings.columnPilot'), dataIndex: 'pilotName', render: (v?: string | null) => v ?? '-' },
              { title: t('bookings.columnInstructor'), dataIndex: 'instructorName', render: (v?: string | null) => v ?? '-' },
              { title: t('bookings.columnRevenue'), dataIndex: 'revenue', render: (v?: string | null) => v ?? '-' },
              { title: t('bookings.columnStatus'), dataIndex: 'status', render: (v: string) => <Tag>{v}</Tag> },
              {
                title: t('bookings.columnActions'),
                render: (_, record) => (
                  <Button size="small" danger onClick={() => cancel(record.id)}>
                    {t('bookings.cancel')}
                  </Button>
                ),
              },
            ]}
            expandable={{
              rowExpandable: (record) => !!(record.contactPhone || record.notes),
              expandedRowRender: (record) => (
                <Space direction="vertical" size={0}>
                  {record.contactPhone && <div>{t('bookings.columnPhone')}: {record.contactPhone}</div>}
                  {record.notes && <div>{t('bookings.columnNotes')}: {record.notes}</div>}
                </Space>
              ),
            }}
          />
        </>
      )}

      <Modal title={t('bookings.createModalTitle')} open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="range" label={t('bookings.fieldRange')} rules={[{ required: true }]}>
            <RangePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="taskCode" label={t('bookings.fieldTaskCode')}>
            <Select
              allowClear
              placeholder={t('bookings.fieldTaskCodePlaceholder')}
              options={(selectedFstd?.qualifiedTasks ?? []).map((task) => ({ value: task.taskCode, label: `${task.taskCode} - ${task.taskName}` }))}
            />
          </Form.Item>
          <Form.Item name="studentId" label={t('bookings.fieldStudent')}>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder={t('bookings.fieldStudentPlaceholder')}
              options={students.map((s) => ({ value: s.id, label: `${s.lastName}${s.firstName}` }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('bookings.importResultTitle')}
        open={!!importResult}
        onOk={() => setImportResult(undefined)}
        onCancel={() => setImportResult(undefined)}
        cancelButtonProps={{ style: { display: 'none' } }}
      >
        {importResult && (
          <>
            <Typography.Paragraph>
              {importResult.errorCount === 0
                ? t('bookings.importAllSuccess', { created: importResult.createdCount })
                : t('bookings.importSuccessSummary', { created: importResult.createdCount, failed: importResult.errorCount })}
            </Typography.Paragraph>
            {importResult.errors.length > 0 && (
              <List
                size="small"
                dataSource={importResult.errors}
                renderItem={(err) => (
                  <List.Item>
                    <Typography.Text type="danger">{t('bookings.importErrorRow', { row: err.row, message: err.message })}</Typography.Text>
                  </List.Item>
                )}
              />
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
