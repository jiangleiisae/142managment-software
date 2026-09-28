import { Result } from 'antd'
import { Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'
import type { Permission } from '../api/users'

/// 路由级权限守卫: 用于防止STAFF账户绕过菜单直接输入URL访问无权限的模块
export function PermissionRoute({ permission }: { permission: Permission }) {
  const { hasPermission } = useAuth()
  if (!hasPermission(permission)) {
    return <Result status="403" title="无访问权限" subTitle="您的账户没有该模块的访问权限, 请联系管理员" />
  }
  return <Outlet />
}

/// 仅OWNER/ADMIN可访问 (如用户与权限管理页面)
export function AdminOnlyRoute() {
  const { isAdmin } = useAuth()
  if (!isAdmin) {
    return <Result status="403" title="无访问权限" subTitle="仅管理账户(OWNER/ADMIN)可访问该页面" />
  }
  return <Outlet />
}
