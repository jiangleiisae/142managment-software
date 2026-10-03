import { CopyOutlined, DownloadOutlined } from '@ant-design/icons'
import { Alert, App, Button, Input, Modal, Popconfirm, Space, Typography } from 'antd'
import { QRCodeCanvas } from 'qrcode.react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ShareInfo, ShareType } from '../api/shares'
import { sharesApi } from '../api/shares'

/// 实时二维码: 扫码打开公开只读页 /s/<token>, 页面每次加载(并每分钟自动刷新)都读最新计划, 所以二维码本身不需要更新。
/// 任何拿到二维码/链接的人无需登录都能看到计划; 泄露时"重新生成"让旧码立即失效, "停用"则关闭分享。
export function ShareQrModal({ open, onClose, organizationId, type }: { open: boolean; onClose: () => void; organizationId?: string; type: ShareType }) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [info, setInfo] = useState<ShareInfo>()
  const [loading, setLoading] = useState(false)
  const canvasWrapper = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (!organizationId) return
    const all = await sharesApi.list(organizationId)
    setInfo(all.find((s) => s.type === type))
  }, [organizationId, type])

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
    link.download = `${type === 'TRAINING_PLAN' ? 'training-plan' : 'roster'}-qr.png`
    link.click()
  }

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={t(type === 'TRAINING_PLAN' ? 'share.titleTraining' : 'share.titleRoster')} width={420} destroyOnHidden>
      <Typography.Paragraph type="secondary">{t(type === 'TRAINING_PLAN' ? 'share.introTraining' : 'share.introRoster')}</Typography.Paragraph>
      {!info?.enabled ? (
        <Button type="primary" block loading={loading} disabled={!organizationId} onClick={() => run(() => sharesApi.enable(organizationId as string, type))}>
          {t('share.enable')}
        </Button>
      ) : (
        <Space direction="vertical" align="center" style={{ width: '100%' }}>
          <div ref={canvasWrapper} style={{ padding: 12, background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8 }}>
            <QRCodeCanvas value={url} size={220} marginSize={1} level="M" />
          </div>
          <Input.Search readOnly value={url} enterButton={<CopyOutlined />} onSearch={copy} style={{ width: 360 }} />
          <Space wrap>
            <Button icon={<DownloadOutlined />} onClick={download}>
              {t('share.download')}
            </Button>
            <Popconfirm title={t('share.rotateConfirm')} onConfirm={() => run(() => sharesApi.rotate(organizationId as string, type))}>
              <Button loading={loading}>{t('share.rotate')}</Button>
            </Popconfirm>
            <Popconfirm title={t('share.disableConfirm')} onConfirm={() => run(() => sharesApi.disable(organizationId as string, type))}>
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
