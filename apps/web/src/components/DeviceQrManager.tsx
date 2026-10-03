import { PrinterOutlined, QrcodeOutlined } from '@ant-design/icons'
import { Alert, App, Button, Modal, Space, Table, Tag } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DeviceShare } from '../api/shares'
import { sharesApi } from '../api/shares'
import { printQrLabels } from '../utils/printQrLabels'
import { ShareQrModal } from './ShareQrModal'
import type { ShareFstd } from './ShareQrModal'

/// 每台模拟机的二维码一览: 逐台查看/启用, 或一键启用全部并打印标签(贴在设备上, 扫码看这台设备的训练计划)。
export function DeviceQrManager({ open, onClose, organizationId, organizationName }: { open: boolean; onClose: () => void; organizationId?: string; organizationName?: string }) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [rows, setRows] = useState<DeviceShare[]>([])
  const [busy, setBusy] = useState(false)
  const [single, setSingle] = useState<ShareFstd>()

  const load = useCallback(async () => {
    if (!organizationId) return
    setRows(await sharesApi.listDevices(organizationId))
  }, [organizationId])

  useEffect(() => {
    if (open) load().catch(() => message.error(t('share.failed')))
  }, [open, load, message, t])

  const printAll = async () => {
    if (!organizationId) return
    // 同步打开窗口由 printQrLabels 负责, 这里先把没启用的设备都启用 (token 在启用后才有)
    setBusy(true)
    try {
      const missing = rows.filter((r) => !r.enabled)
      await Promise.all(missing.map((r) => sharesApi.enable(organizationId, 'TRAINING_PLAN', r.fstdId)))
      const fresh = missing.length ? await sharesApi.listDevices(organizationId) : rows
      setRows(fresh)
      const labels = fresh.filter((r) => r.token).map((r) => ({ title: r.deviceCode, subtitle: r.representedAircraft, url: `${window.location.origin}/s/${r.token}` }))
      const ok = await printQrLabels(labels, `${organizationName ?? ''} ${t('share.allLabels')}`.trim(), t('share.labelHint'))
      if (!ok) message.error(t('share.popupBlocked'))
    } catch {
      message.error(t('share.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={t('share.deviceManagerTitle')} width={640} destroyOnHidden>
      <Alert type="info" showIcon style={{ marginBottom: 12 }} message={t('share.deviceManagerHint')} />
      <Space style={{ marginBottom: 8 }}>
        <Button type="primary" icon={<PrinterOutlined />} loading={busy} disabled={rows.length === 0} onClick={printAll}>
          {t('share.enableAndPrintAll')}
        </Button>
      </Space>
      <Table
        rowKey="fstdId"
        size="small"
        pagination={false}
        dataSource={rows}
        locale={{ emptyText: t('share.noDevices') }}
        columns={[
          { title: t('share.device'), render: (_, r) => `${r.deviceCode} ${r.representedAircraft}` },
          { title: t('share.status'), render: (_, r) => (r.enabled ? <Tag color="green">{t('share.enabled')}</Tag> : <Tag>{t('share.notEnabled')}</Tag>) },
          {
            title: '',
            render: (_, r) => (
              <Button size="small" icon={<QrcodeOutlined />} onClick={() => setSingle({ id: r.fstdId, deviceCode: r.deviceCode, representedAircraft: r.representedAircraft })}>
                {t('share.qrButton')}
              </Button>
            ),
          },
        ]}
      />
      <ShareQrModal
        open={!!single}
        onClose={() => {
          setSingle(undefined)
          load().catch(() => undefined)
        }}
        organizationId={organizationId}
        type="TRAINING_PLAN"
        fstd={single}
      />
    </Modal>
  )
}
