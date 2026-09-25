import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthContext } from './jwt-payload.interface.js';

/// 从已认证请求里取出 { userId, tenantId, role, email }, 全系统统一入口, 替代原先从query/body信任的tenantId
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthContext => {
  const request = ctx.switchToHttp().getRequest();
  return request.user as AuthContext;
});
