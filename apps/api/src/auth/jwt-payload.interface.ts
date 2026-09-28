import { Permission, UserRole } from '@prisma/client';

/// JWT只携带身份标识(sub), role/permissions/isActive每次请求都从数据库实时读取(见JwtStrategy),
/// 这样账户被停用或权限被调整能立即生效, 不必等7天token过期或用户重新登录
export interface JwtPayload {
  sub: string // userId
}

/// 挂在 req.user 上的认证上下文, 全系统所有需要"当前租户/权限"的地方都应从这里取, 不再信任客户端传入的 tenantId
export interface AuthContext {
  userId: string
  tenantId: string
  role: UserRole
  email: string
  permissions: Permission[]
}
