import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string // userId
  tenantId: string
  role: UserRole
  email: string
}

/// 挂在 req.user 上的认证上下文, 全系统所有需要"当前租户"的地方都应从这里取, 不再信任客户端传入的 tenantId
export interface AuthContext {
  userId: string
  tenantId: string
  role: UserRole
  email: string
}
