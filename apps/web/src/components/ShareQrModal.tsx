import { CopyOutlined, DownloadOutlined, PrinterOutlined } from '@ant-design/icons'
import { Alert, App, Button, Input, Modal, Popconfirm, Space, Typography } from 'antd'
import { QRCodeCanvas } from 'qrcode.react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ShareInfo, ShareType } from '../api/shares'
import { sharesApi } from '../api/shares'
import { printQrLabels } from '../utils/printQrLabels'

export interface ShareFstd {
  id: string
  deviceCode: string
  representedAircraft: string
}

/// 实时二维码: 扫码打开公开只读页 /s/<token>, 页面每次加载(并每分钟自动刷新)都读最新计划, 所以二维码本身不需要更新。
/// 不传 fstd = 机构级(训练计划/人员班表); 传 fstd = 这台模拟机自己的二维码(只显示它的训练计划), 可打印成标签贴在设备上。
/// 任何拿到二维码/链接的人无需登录都能看到计划; 泄露时"重新生成"让旧码立即失效, "停用"则关闭分享。
export function ShareQrModal({ open, onClose, organizationId, type, fstd }: { open: boolean; onClose: () => void; organizationId?: string; type: ShareType; fstd?: ShareFstd }) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [info, setInfo] = useState<ShareInfo>()
  const [loading, setLoading] = useState(false)
  const canvasWrapper = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (!organizationId) return
    const all = await sharesApi.list(organizationId, fstd?.id)
    setInfo(all.find((s) => s.type === type))
  }, [organizationId, type, fstd?.id])

  useEffect(() => {
    if (open) load().catch(() => message.error(t('share.failed')))
  }, [open, load, message, t])

  const run = async (fn: () => Promise<ShareInfo>) => {
    if (!organizationId) return
    setLoading(true)
    try {
      setInfo(await fn())
    } catch {
      message.error(t('share.failed'))
    } finally {
      setLoading(false)
    }
  }

  const url = info?.token ? `${window.location.origin}/s/${info.token}` : ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      message.success(t('share.copied'))
    } catch {
      message.error(t('share.copyFailed'))
    }
  }

  const download = () => {
    const canvas = canvasWrapper.current?.querySelector('canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = fstd ? `${fstd.deviceCode}-qr.png` : `${type === 'TRAINING_PLAN' ? 'training-plan' : 'roster'}-qr.png`
    link.click()
  }

  const printLabel = async () => {
    if (!fstd) return
    const ok = await printQrLabels([{ title: fstd.deviceCode, subtitle: fstd.representedAircraft, url }], `${fstd.deviceCode} ${t('share.label')}`, t('share.labelHint'))
    if (!ok) message.error(t('share.popupBlocked'))
  }

  const title = fstd ? `${fstd.deviceCode} ${t('share.titleDevice')}` : t(type === 'TRAINING_PLAN' ? 'share.titleTraining' : 'share.titleRoster')
  const intro = fstd ? t('share.introDevice', { code: fstd.deviceCode }) : t(type === 'TRAINING_PLAN' ? 'share.introTraining' : 'share.introRoster')

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={title} width={420} destroyOnHidden>
      <Typography.Paragraph type="secondary">{intro}</Typography.Paragraph>
      {!info?.enabled ? (
        <Button type="primary" block loading={loading} disabled={!organizationId} onClick={() => run(() => sharesApi.enable(organizationId as string, type, fstd?.id))}>
          {t('share.enable')}
        </Button>
      ) : (
        <Space direction="vertical" align="center" style={{ width: '100%' }}>
          <div ref={canvasWrapper} style={{ padding: 12, background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8 }}>
            <QRCodeCanvas value={url} size={220} marginSize={1} level="M" />
          </div>
          {fstd && (
            <Typography.Text strong style={{ fontSize: 16 }}>
              {fstd.deviceCode} {fstd.representedAircraft}
            </Typography.Text>
          )}
          <Input.Search readOnly value={url} enterButton={<CopyOutlined />} onSearch={copy} style={{ width: 360 }} />
          <Space wrap>
            <Button icon={<DownloadOutlined />} onClick={download}>
              {t('share.download')}
            </Button>
            {fstd && (
              <Button icon={<PrinterOutlined />} onClick={printLabel}>
                {t('share.printLabel')}
              </Button>
            )}
            <Popconfirm title={t(fstd ? 'share.rotateConfirmDevice' : 'share.rotateConfirm')} onConfirm={() => run(() => sharesApi.rotate(organizationId as string, type, fstd?.id))}>
              <Button loading={loading}>{t('share.rotate')}</Button>
            </Popconfirm>
            <Popconfirm title={t('share.disableConfirm')} onConfirm={() => run(() => sharesApi.disable(organizationId as string, type, fstd?.id))}>
              <Button danger loading={loading}>
                {t('share.disable')}
              </Button>
            </Popconfirm>
          </Space>
        </Space>
      )}
      <Alert style={{ marginTop: 16 }} type="warning" showIcon message={t('share.warning')} />
    </Modal>
  )
}
