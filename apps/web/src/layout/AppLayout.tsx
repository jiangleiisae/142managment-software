import {
  ApartmentOutlined,
  AuditOutlined,
  BookOutlined,
  CalendarOutlined,
  DesktopOutlined,
  FileSearchOutlined,
  InboxOutlined,
  LockOutlined,
  LogoutOutlined,
  QuestionCircleOutlined,
  RocketOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Button, Layout, Menu, Select, Space, Typography } from 'antd'
import type { MenuProps } from 'antd'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { NotificationBell } from '../components/NotificationBell'
import { setLanguage, type SupportedLanguage } from '../i18n'
import type { Permission } from '../api/users'

const { Header, Sider, Content } = Layout

const menuItems: { key: string; icon: React.ReactNode; labelKey: string; permission?: Permission }[] = [
  { key: '/organizations', icon: <ApartmentOutlined />, labelKey: 'menu.organizations', permission: 'ORGANIZATION' },
  { key: '/management-system', icon: <AuditOutlined />, labelKey: 'menu.managementSystem', permission: 'MANAGEMENT_SYSTEM' },
  { key: '/fstds', icon: <RocketOutlined />, labelKey: 'menu.fstds', permission: 'FSTD' },
  { key: '/inventory', icon: <InboxOutlined />, labelKey: 'menu.inventory', permission: 'INVENTORY' },
  { key: '/personnel', icon: <TeamOutlined />, labelKey: 'menu.personnel', permission: 'PERSONNEL' },
  { key: '/courses', icon: <BookOutlined />, labelKey: 'menu.courses', permission: 'COURSES' },
  { key: '/students', icon: <UserOutlined />, labelKey: 'menu.students', permission: 'STUDENTS' },
  { key: '/bookings', icon: <CalendarOutlined />, labelKey: 'menu.bookings', permission: 'SCHEDULING' },
  { key: '/kiosk', icon: <DesktopOutlined />, labelKey: 'menu.kiosk' }, // 任何在场人员均可使用, 不受模块权限限制
  { key: '/isms', icon: <LockOutlined />, labelKey: 'menu.isms', permission: 'ISMS' },
]

export function AppLayout() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAdmin, hasPermission, logout } = useAuth()

  const visibleItems: MenuProps['items'] = menuItems
    .filter((item) => !item.permission || hasPermission(item.permission))
    .map(({ key, icon, labelKey }) => ({ key, icon, label: t(labelKey) }))

  if (isAdmin) {
    visibleItems.push({ key: '/users', icon: <SettingOutlined />, label: t('menu.users') })
    visibleItems.push({ key: '/audit-logs', icon: <FileSearchOutlined />, label: t('menu.auditLogs') })
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0">
        <div style={{ color: '#fff', textAlign: 'center', padding: 16, fontWeight: 600 }}>{t('app.title')}</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={visibleItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography.Text strong style={{ fontSize: 16 }}>
            {t('app.subtitle')}
          </Typography.Text>
          <Space size="large">
            <Select<SupportedLanguage>
              size="small"
              style={{ width: 90 }}
              value={i18n.language === 'en' ? 'en' : 'zh'}
              onChange={setLanguage}
              options={[
                { value: 'zh', label: t('language.zh') },
                { value: 'en', label: t('language.en') },
              ]}
            />
            <NotificationBell />
            <Button
              type="text"
              icon={<QuestionCircleOutlined style={{ fontSize: 18 }} />}
              onClick={() => navigate('/help')}
              aria-label={t('menu.help')}
            />
            <Typography.Text type="secondary">
              {user?.email} ({user?.role})
            </Typography.Text>
            <Button icon={<LogoutOutlined />} onClick={handleLogout}>
              {t('header.logout')}
            </Button>
          </Space>
        </Header>
        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
