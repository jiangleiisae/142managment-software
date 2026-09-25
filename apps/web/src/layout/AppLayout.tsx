import {
  ApartmentOutlined,
  AuditOutlined,
  BookOutlined,
  CalendarOutlined,
  RocketOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Layout, Menu } from 'antd'
import type { MenuProps } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

const { Header, Sider, Content } = Layout

const menuItems: MenuProps['items'] = [
  { key: '/organizations', icon: <ApartmentOutlined />, label: '机构与证书' },
  { key: '/management-system', icon: <AuditOutlined />, label: '管理体系 SMS/QMS' },
  { key: '/fstds', icon: <RocketOutlined />, label: '模拟机(FSTD)' },
  { key: '/personnel', icon: <TeamOutlined />, label: '人员资质' },
  { key: '/courses', icon: <BookOutlined />, label: '课程管理' },
  { key: '/students', icon: <UserOutlined />, label: '学员记录' },
  { key: '/bookings', icon: <CalendarOutlined />, label: '排班预订' },
]

export function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()

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
        <Header style={{ background: '#fff', padding: '0 24px', fontSize: 16, fontWeight: 500 }}>
          EASA ATO 合规管理平台 (MVP)
        </Header>
        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
