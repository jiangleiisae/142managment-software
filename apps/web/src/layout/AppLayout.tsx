import {
  BarChartOutlined,
  CalendarOutlined,
  DesktopOutlined,
  FormOutlined,
  InboxOutlined,
  LogoutOutlined,
  QuestionCircleOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useState } from 'react'
import { Button, Layout, Menu, Select, Space, Typography } from 'antd'
import type { MenuProps } from 'antd'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { NotificationBell } from '../components/NotificationBell'
import { setLanguage, type SupportedLanguage } from '../i18n'
import type { Permission } from '../api/users'
import feikenLogoWhite from '../assets/feiken-logo-white.png'

const { Header, Sider, Content } = Layout

type MenuLeaf = { key: string; labelKey: string; permission?: Permission | Permission[]; adminOnly?: boolean }
type MenuEntry =
  | { type: 'item'; icon: React.ReactNode; leaf: MenuLeaf }
  | { type: 'group'; key: string; icon: React.ReactNode; labelKey: string; children: MenuLeaf[] }

/// 侧边栏: 同一类别的功能收进可折叠的分组, 没有可见子项的分组整个隐藏。
/// 单个功能的类别(备件/统计报表/Kiosk)直接作为一级菜单。
const menuEntries: MenuEntry[] = [
  {
    type: 'group',
    key: 'group:compliance',
    icon: <SafetyCertificateOutlined />,
    labelKey: 'menu.group.compliance',
    children: [
      { key: '/organizations', labelKey: 'menu.organizations', permission: 'ORGANIZATION' },
      { key: '/management-system', labelKey: 'menu.managementSystem', permission: 'MANAGEMENT_SYSTEM' },
      { key: '/isms', labelKey: 'menu.isms', permission: 'ISMS' },
    ],
  },
  {
    type: 'group',
    key: 'group:fstd',
    icon: <RocketOutlined />,
    labelKey: 'menu.group.fstd',
    children: [
      { key: '/fstds', labelKey: 'menu.fstds', permission: 'FSTD' },
      { key: '/grounding', labelKey: 'menu.grounding', permission: 'FSTD' },
    ],
  },
  { type: 'item', icon: <InboxOutlined />, leaf: { key: '/inventory', labelKey: 'menu.inventory', permission: 'INVENTORY' } },
  {
    type: 'group',
    key: 'group:training',
    icon: <TeamOutlined />,
    labelKey: 'menu.group.training',
    children: [
      { key: '/personnel', labelKey: 'menu.personnel', permission: 'PERSONNEL' },
      { key: '/courses', labelKey: 'menu.courses', permission: 'COURSES' },
      { key: '/students', labelKey: 'menu.students', permission: 'STUDENTS' },
    ],
  },
  {
    type: 'group',
    key: 'group:scheduling',
    icon: <CalendarOutlined />,
    labelKey: 'menu.group.scheduling',
    children: [
      { key: '/bookings', labelKey: 'menu.bookings', permission: 'SCHEDULING' },
      { key: '/training-plan', labelKey: 'menu.trainingPlan', permission: 'SCHEDULING' },
      { key: '/roster', labelKey: 'menu.roster', permission: 'SCHEDULING' },
    ],
  },
  {
    type: 'group',
    key: 'group:records',
    icon: <FormOutlined />,
    labelKey: 'menu.group.records',
    children: [
      { key: '/duty', labelKey: 'menu.duty', permission: 'SCHEDULING' },
      { key: '/pre-flight', labelKey: 'menu.preFlightRecord', permission: 'FSTD' },
      { key: '/post-flight', labelKey: 'menu.postFlightRecord', permission: 'FSTD' },
      { key: '/checklist-config', labelKey: 'menu.checklistConfig', permission: 'FSTD' },
    ],
  },
  { type: 'item', icon: <BarChartOutlined />, leaf: { key: '/reports', labelKey: 'menu.reports', permission: ['FSTD', 'INVENTORY'] } },
  // Kiosk 任何在场人员均可使用, 不受模块权限限制
  { type: 'item', icon: <DesktopOutlined />, leaf: { key: '/kiosk', labelKey: 'menu.kiosk' } },
  {
    type: 'group',
    key: 'group:system',
    icon: <SettingOutlined />,
    labelKey: 'menu.group.system',
    children: [
      { key: '/users', labelKey: 'menu.users', adminOnly: true },
      { key: '/audit-logs', labelKey: 'menu.auditLogs', adminOnly: true },
    ],
  },
]

const OPEN_KEYS_STORAGE = 'tcms.menuOpenKeys'

function readOpenKeys(): string[] | null {
  try {
    const raw = localStorage.getItem(OPEN_KEYS_STORAGE)
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : null
  } catch {
    return null
  }
}

export function AppLayout() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAdmin, hasPermission, logout } = useAuth()

  const canSee = (leaf: MenuLeaf) => {
    if (leaf.adminOnly) return isAdmin
    return !leaf.permission || [leaf.permission].flat().some((p) => hasPermission(p))
  }

  const visibleEntries = menuEntries
    .map((entry) => (entry.type === 'item' ? (canSee(entry.leaf) ? entry : null) : { ...entry, children: entry.children.filter(canSee) }))
    .filter((entry): entry is MenuEntry => entry !== null && (entry.type === 'item' || entry.children.length > 0))

  const visibleItems: MenuProps['items'] = visibleEntries.map((entry) =>
    entry.type === 'item'
      ? { key: entry.leaf.key, icon: entry.icon, label: t(entry.leaf.labelKey) }
      : { key: entry.key, icon: entry.icon, label: t(entry.labelKey), children: entry.children.map((c) => ({ key: c.key, label: t(c.labelKey) })) },
  )

  // 当前页面所在的叶子菜单(详情页如 /organizations/123 归到 /organizations) 及其分组
  const leafKeys = visibleEntries.flatMap((e) => (e.type === 'item' ? [e.leaf.key] : e.children.map((c) => c.key)))
  const selectedKey = leafKeys.filter((k) => location.pathname === k || location.pathname.startsWith(k + '/')).sort((a, b) => b.length - a.length)[0]
  const currentGroupEntry = visibleEntries.find((e) => e.type === 'group' && e.children.some((c) => c.key === selectedKey))
  const currentGroup = currentGroupEntry?.type === 'group' ? currentGroupEntry.key : undefined

  const [openKeys, setOpenKeys] = useState<string[]>(() => {
    const saved = readOpenKeys() ?? []
    return currentGroup && !saved.includes(currentGroup) ? [...saved, currentGroup] : saved
  })
  const [lastGroup, setLastGroup] = useState(currentGroup)
  // 换页进入新分组时自动展开它 (用户手动折叠后不会反复弹开)
  if (currentGroup !== lastGroup) {
    setLastGroup(currentGroup)
    if (currentGroup && !openKeys.includes(currentGroup)) setOpenKeys([...openKeys, currentGroup])
  }
  const handleOpenChange = (keys: string[]) => {
    setOpenKeys(keys)
    try {
      localStorage.setItem(OPEN_KEYS_STORAGE, JSON.stringify(keys))
    } catch {
      // 浏览器禁用存储时忽略, 只是不记忆折叠状态
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0">
        <div style={{ textAlign: 'center', padding: '16px 12px 8px' }}>
          <img src={feikenLogoWhite} alt="Feiken Aviation" style={{ width: '100%', maxWidth: 120 }} />
        </div>
        <div style={{ color: '#fff', textAlign: 'center', padding: '0 16px 12px', fontSize: 13, opacity: 0.85 }}>{t('app.title')}</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKey ? [selectedKey] : []}
          openKeys={openKeys}
          onOpenChange={handleOpenChange}
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
