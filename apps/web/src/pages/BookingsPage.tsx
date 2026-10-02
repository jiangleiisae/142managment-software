import { DownloadOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { Alert, App, AutoComplete, Button, Col, DatePicker, Empty, Form, Input, InputNumber, List, Modal, Row, Select, Space, Table, Tag, TimePicker, Typography, Upload } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ImportBookingsResult } from '../api/bookings'
import { bookingsApi } from '../api/bookings'
import { fstdsApi } from '../api/fstds'
import { studentsApi } from '../api/students'
import type { Booking, BookingResourceType, Fstd, Student } from '../api/types'
import { OrganizationSelector } from '../components/OrganizationSelector'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'

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
  const [importResult, setImportResult] = useState<ImportBookingsResult>()
  const [customers, setCustomers] = useState<{ value: string }[]>([])
  const [form] = Form.useForm()
  const dialogFstdId = Form.useWatch('fstdId', form) as string | undefined

  useEffect(() => {
    if (!selectedId) return
    fstdsApi.list(selectedId).then((list) => {
      setFstds(list)
      setSelectedFstdId(list[0]?.id)
    })
    studentsApi.list(selectedId).then(setStudents)
    bookingsApi.listCustomers(selectedId).then((list) => setCustomers(list.map((c) => ({ value: c.name })))).catch(() => undefined)
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

  const openCreate = () => {
    form.resetFields()
    form.setFieldsValue({ fstdId: selectedFstdId })
    setModalOpen(true)
  }

  // 日期 + 开始/结束时间一律按北京时间解释 (与训练计划表一致, 不受浏览器时区影响); 结束时间不晚于开始时间视为次日结束 (跨午夜)
  const handleCreate = async () => {
    if (!selectedId) return
    const v = await form.validateFields()
    const day = (v.date as dayjs.Dayjs).format('YYYY-MM-DD')
    const startText = (v.startTime as dayjs.Dayjs).format('HH:mm')
    const endText = (v.endTime as dayjs.Dayjs).format('HH:mm')
    const startAt = new Date(`${day}T${startText}:00+08:00`)
    let endAt = new Date(`${day}T${endText}:00+08:00`)
    if (endAt <= startAt) endAt = new Date(endAt.getTime() + 24 * 60 * 60 * 1000)
    const text = (x?: string) => (x && x.trim() ? x.trim() : undefined)
    try {
      await bookingsApi.create({
        organizationId: selectedId,
        resourceType: 'FSTD' as BookingResourceType,
        resourceId: v.fstdId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        studentId: v.studentId,
        taskCode: v.taskCode,
        trainingType: text(v.trainingType),
        customerName: text(v.customerName),
        pilotName: text(v.pilotName),
        instructorName: text(v.instructorName),
        examinerName: text(v.examinerName),
        contactPhone: text(v.contactPhone),
        revenue: v.revenue ?? undefined,
        notes: text(v.notes),
      })
      message.success(t('bookings.createSuccess'))
      setModalOpen(false)
      if (v.fstdId === selectedFstdId) load()
      else setSelectedFstdId(v.fstdId)
    } catch (e) {
      const err = e as { response?: { data?: { message?: string | string[] } } }
      const msg = err.response?.data?.message
      message.error((Array.isArray(msg) ? msg.join('; ') : msg) ?? t('bookings.createFailed'))
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
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
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
              { title: t('bookings.columnTrainingType'), dataIndex: 'trainingType', render: (v?: string | null) => v ?? '-' },
              { title: t('bookings.columnTaskCode'), dataIndex: 'taskCode', render: (v?: string) => (v ? <Tag color="blue">{v}</Tag> : '-') },
              { title: t('bookings.columnCustomer'), dataIndex: 'customerName', render: (v?: string | null) => v ?? '-' },
              { title: t('bookings.columnPilot'), dataIndex: 'pilotName', render: (v?: string | null) => v ?? '-' },
              { title: t('bookings.columnInstructor'), dataIndex: 'instructorName', render: (v?: string | null) => v ?? '-' },
              { title: t('bookings.columnExaminer'), dataIndex: 'examinerName', render: (v?: string | null) => v ?? '-' },
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

      <Modal title={t('bookings.createModalTitle')} open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)} width={720} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="fstdId" label={t('bookings.fieldDevice')} rules={[{ required: true }]}>
                <Select
                  options={fstds.map((f) => ({ value: f.id, label: `${f.deviceCode} ${f.representedAircraft}` }))}
                  onChange={() => form.setFieldValue('taskCode', undefined)}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="date" label={t('bookings.fieldDate')} rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="startTime" label={t('bookings.fieldStartTime')} rules={[{ required: true }]}>
                <TimePicker format="HH:mm" minuteStep={5} needConfirm={false} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="endTime" label={t('bookings.fieldEndTime')} rules={[{ required: true }]} extra={t('bookings.fieldEndTimeHint')}>
                <TimePicker format="HH:mm" minuteStep={5} needConfirm={false} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="trainingType" label={t('bookings.fieldTrainingType')}>
                <Input maxLength={100} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="taskCode" label={t('bookings.fieldTaskCode')}>
                <Select
                  allowClear
                  placeholder={t('bookings.fieldTaskCodePlaceholder')}
                  options={(fstds.find((f) => f.id === (dialogFstdId ?? selectedFstdId))?.qualifiedTasks ?? []).map((task) => ({ value: task.taskCode, label: `${task.taskCode} - ${task.taskName}` }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="customerName" label={t('bookings.fieldCustomer')}>
                <AutoComplete options={customers} filterOption={(input, option) => (option?.value ?? '').toLowerCase().includes(input.toLowerCase())} maxLength={100} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="pilotName" label={t('bookings.fieldPilot')}>
                <Input maxLength={200} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="instructorName" label={t('bookings.fieldInstructor')}>
                <Input maxLength={100} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="examinerName" label={t('bookings.fieldExaminer')}>
                <Input maxLength={100} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="contactPhone" label={t('bookings.fieldPhone')}>
                <Input maxLength={50} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="revenue" label={t('bookings.fieldRevenue')}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label={t('bookings.fieldNotes')}>
            <Input.TextArea rows={2} maxLength={500} />
          </Form.Item>
          <Form.Item name="studentId" label={t('bookings.fieldStudent')}>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder={t('bookings.fieldStudentPlaceholder')}
              options={students.map((st) => ({ value: st.id, label: `${st.lastName}${st.firstName}` }))}
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
            {(importResult.missingDevices ?? []).length > 0 && (
              <Alert
                style={{ marginBottom: 12 }}
                type="warning"
                showIcon
                message={t('bookings.importMissingDevices', { devices: importResult.missingDevices?.join('、') })}
              />
            )}
            {(importResult.warnings ?? []).length > 0 && (
              <List
                size="small"
                header={t('bookings.importWarningsHeader', { count: importResult.warnings?.length })}
                dataSource={importResult.warnings}
                renderItem={(w) => (
                  <List.Item>
                    <Typography.Text type="warning">{t('bookings.importErrorRow', { row: w.row, message: w.message })}</Typography.Text>
                  </List.Item>
                )}
              />
            )}
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
