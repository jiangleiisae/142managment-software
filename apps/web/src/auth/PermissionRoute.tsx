import { Result } from 'antd'
import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from './AuthContext'
import type { Permission } from '../api/users'

/// 路由级权限守卫: 用于防止STAFF账户绕过菜单直接输入URL访问无权限的模块
export function PermissionRoute({ permission }: { permission: Permission | Permission[] }) {
  const { t } = useTranslation()
  const { hasPermission } = useAuth()
  if (![permission].flat().some((p) => hasPermission(p))) {
    return <Result status="403" title={t('common.noAccessTitle')} subTitle={t('common.noAccessSubtitle')} />
  }
  return <Outlet />
}

/// 仅OWNER/ADMIN可访问 (如用户与权限管理页面)
export function AdminOnlyRoute() {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  if (!isAdmin) {
    return <Result status="403" title={t('common.noAccessTitle')} subTitle={t('common.noAccessAdminOnlySubtitle')} />
  }
  return <Outlet />
}
