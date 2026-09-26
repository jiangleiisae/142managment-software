import {
  ApartmentOutlined,
  AuditOutlined,
  BookOutlined,
  CalendarOutlined,
  InboxOutlined,
  LogoutOutlined,
  RocketOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Button, Layout, Menu, Space, Typography } from 'antd'
import type { MenuProps } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const { Header, Sider, Content } = Layout

const menuItems: MenuProps['items'] = [
  { key: '/organizations', icon: <ApartmentOutlined />, label: '机构与证书' },
  { key: '/management-system', icon: <AuditOutlined />, label: '管理体系 SMS/QMS' },
  { key: '/fstds', icon: <RocketOutlined />, label: '模拟机(FSTD)' },
  { key: '/inventory', icon: <InboxOutlined />, label: '备件/工具管理' },
  { key: '/personnel', icon: <TeamOutlined />, label: '人员资质' },
  { key: '/courses', icon: <BookOutlined />, label: '课程管理' },
  { key: '/students', icon: <UserOutlined />, label: '学员记录' },
  { key: '/bookings', icon: <CalendarOutlined />, label: '排班预订' },
]

export function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()

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
          items={menuItems}
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
            <Typography.Text type="secondary">{user?.email}</Typography.Text>
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
