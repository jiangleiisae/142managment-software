import {
  ApartmentOutlined,
  AuditOutlined,
  BookOutlined,
  CalendarOutlined,
  DesktopOutlined,
  InboxOutlined,
  LockOutlined,
  LogoutOutlined,
  RocketOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Button, Layout, Menu, Space, Typography } from 'antd'
import type { MenuProps } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { Permission } from '../api/users'

const { Header, Sider, Content } = Layout

const menuItems: { key: string; icon: React.ReactNode; label: string; permission?: Permission }[] = [
  { key: '/organizations', icon: <ApartmentOutlined />, label: '机构与证书', permission: 'ORGANIZATION' },
  { key: '/management-system', icon: <AuditOutlined />, label: '管理体系 SMS/QMS', permission: 'MANAGEMENT_SYSTEM' },
  { key: '/fstds', icon: <RocketOutlined />, label: '模拟机(FSTD)', permission: 'FSTD' },
  { key: '/inventory', icon: <InboxOutlined />, label: '备件/工具管理', permission: 'INVENTORY' },
  { key: '/personnel', icon: <TeamOutlined />, label: '人员资质', permission: 'PERSONNEL' },
  { key: '/courses', icon: <BookOutlined />, label: '课程管理', permission: 'COURSES' },
  { key: '/students', icon: <UserOutlined />, label: '学员记录', permission: 'STUDENTS' },
  { key: '/bookings', icon: <CalendarOutlined />, label: '排班预订', permission: 'SCHEDULING' },
  { key: '/kiosk', icon: <DesktopOutlined />, label: '缺陷报告 Kiosk' }, // 任何在场人员均可使用, 不受模块权限限制
  { key: '/isms', icon: <LockOutlined />, label: '信息安全 ISMS', permission: 'ISMS' },
]

export function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAdmin, hasPermission, logout } = useAuth()

  const visibleItems: MenuProps['items'] = menuItems
    .filter((item) => !item.permission || hasPermission(item.permission))
    .map(({ key, icon, label }) => ({ key, icon, label }))

  if (isAdmin) {
    visibleItems.push({ key: '/users', icon: <SettingOutlined />, label: '用户与权限' })
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0">
        <div style={{ color: '#fff', textAlign: 'center', padding: 16, fontWeight: 600 }}>
          培训中心管理系统
        </div>
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
            EASA ATO 合规管理平台 (MVP)
          </Typography.Text>
          <Space>
            <Typography.Text type="secondary">
              {user?.email} ({user?.role})
            </Typography.Text>
            <Button icon={<LogoutOutlined />} onClick={handleLogout}>
              退出登录
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
