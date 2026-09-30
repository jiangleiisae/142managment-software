import { BellOutlined, SyncOutlined } from '@ant-design/icons'
import { Badge, Button, Empty, List, Popover, Typography, message } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { notificationsApi, type AppNotification } from '../api/notifications'
import { useAuth } from '../auth/AuthContext'

const POLL_INTERVAL_MS = 60_000

export function NotificationBell() {
  const { isAdmin } = useAuth()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [checking, setChecking] = useState(false)

  const refreshUnreadCount = () => {
    notificationsApi.unreadCount().then(setUnreadCount).catch(() => undefined)
  }

  useEffect(() => {
    refreshUnreadCount()
    const timer = setInterval(refreshUnreadCount, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      notificationsApi.list().then(setNotifications).catch(() => undefined)
    }
  }

  const handleMarkRead = async (id: string) => {
    const updated = await notificationsApi.markRead(id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? updated : n)))
    refreshUnreadCount()
  }

  const handleCheckNow = async () => {
    setChecking(true)
    try {
      const { notifiedCount } = await notificationsApi.checkOverdueOccurrenceReports()
      message.success(`检查完成, 新发出 ${notifiedCount} 条提醒`)
      const list = await notificationsApi.list()
      setNotifications(list)
      refreshUnreadCount()
    } finally {
      setChecking(false)
    }
  }

  const content = (
    <div style={{ width: 360 }}>
      <List
        size="small"
        dataSource={notifications}
        locale={{ emptyText: <Empty description="暂无通知" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        style={{ maxHeight: 400, overflowY: 'auto' }}
        renderItem={(item) => (
          <List.Item
            style={{ cursor: item.readAt ? 'default' : 'pointer', background: item.readAt ? undefined : '#f0f5ff' }}
            onClick={() => !item.readAt && handleMarkRead(item.id)}
          >
            <List.Item.Meta
              title={
                <Typography.Text strong={!item.readAt}>
                  {item.title}
                </Typography.Text>
              }
              description={
                <>
                  <div>{item.message}</div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}
                  </Typography.Text>
                </>
              }
            />
          </List.Item>
        )}
      />
      {isAdmin && (
        <div style={{ textAlign: 'right', marginTop: 8, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
          <Button size="small" icon={<SyncOutlined />} loading={checking} onClick={handleCheckNow}>
            立即检查到期提醒
          </Button>
        </div>
      )}
    </div>
  )

  return (
    <Popover
      title="通知"
      trigger="click"
      placement="bottomRight"
      open={open}
      onOpenChange={handleOpenChange}
      content={content}
    >
      <Badge count={unreadCount} size="small">
        <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
      </Badge>
    </Popover>
  )
}
