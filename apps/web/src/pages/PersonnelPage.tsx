import { PlusOutlined } from '@ant-design/icons'
import { App, Button, Form, Input, Modal, Select, Space, Table, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { personnelApi } from '../api/personnel'
import type { InstructorType, Personnel } from '../api/types'

const INSTRUCTOR_TYPES: InstructorType[] = ['FI', 'TRI', 'SFI', 'THEORETICAL', 'EXAMINER']

export function PersonnelPage() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [instructorModalId, setInstructorModalId] = useState<string>()
  const [form] = Form.useForm()
  const [instructorForm] = Form.useForm()

  const load = () => {
    setLoading(true)
    personnelApi
      .list()
      .then(setPersonnel)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleCreate = async () => {
    const values = await form.validateFields()
    await personnelApi.create(values)
    message.success(t('personnel.createSuccess'))
    setModalOpen(false)
    form.resetFields()
    load()
  }

  const isExpiringSoon = (validUntil?: string | null) => {
    if (!validUntil) return false
    const days = (new Date(validUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return days < 90
  }

  const handleSetInstructorProfile = async () => {
    if (!instructorModalId) return
    const values = await instructorForm.validateFields()
    await personnelApi.setInstructorProfile(instructorModalId, values.instructorType)
    message.success(t('personnel.instructorProfileSet'))
    setInstructorModalId(undefined)
    load()
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          {t('personnel.addButton')}
        </Button>
      </Space>

      <Table<Personnel>
        rowKey="id"
        loading={loading}
        dataSource={personnel}
        columns={[
          { title: t('personnel.columnLastName'), dataIndex: 'lastName' },
          { title: t('personnel.columnFirstName'), dataIndex: 'firstName' },
          { title: t('personnel.columnEmail'), dataIndex: 'email' },
          {
            title: t('personnel.columnQualifications'),
            dataIndex: 'qualifications',
            render: (quals: Personnel['qualifications']) => (
              <Space wrap>
                {(quals ?? []).map((q) => (
                  <Tag key={q.id} color={isExpiringSoon(q.validUntil) ? 'red' : 'default'}>
                    {q.qualificationType}
                    {q.validUntil
                      ? ` (${t('personnel.validUntil', { date: new Date(q.validUntil).toLocaleDateString() })})`
                      : ''}
                  </Tag>
                ))}
              </Space>
            ),
          },
          {
            title: t('personnel.columnInstructorType'),
            dataIndex: 'instructorProfile',
            render: (profile: Personnel['instructorProfile']) =>
              profile ? <Tag color="blue">{profile.instructorType}</Tag> : <Tag>{t('personnel.notInstructor')}</Tag>,
          },
          {
            title: t('personnel.columnActions'),
            render: (_, p) => (
              <Button
                size="small"
                onClick={() => {
                  instructorForm.setFieldsValue({ instructorType: p.instructorProfile?.instructorType ?? 'FI' })
                  setInstructorModalId(p.id)
                }}
              >
                {t('personnel.setInstructorType')}
              </Button>
            ),
          },
        ]}
      />

      <Modal
        title={t('personnel.createModalTitle')}
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => setModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="firstName" label={t('personnel.fieldFirstName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="lastName" label={t('personnel.fieldLastName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label={t('personnel.fieldEmail')}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('personnel.instructorModalTitle')}
        open={!!instructorModalId}
        onOk={handleSetInstructorProfile}
        onCancel={() => setInstructorModalId(undefined)}
      >
        <Form form={instructorForm} layout="vertical">
          <Form.Item name="instructorType" label={t('personnel.fieldInstructorType')} rules={[{ required: true }]}>
            <Select options={INSTRUCTOR_TYPES.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
