import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from '@prisma/client';
import { PERMISSIONS_KEY, SKIP_PERMISSION_KEY } from './permissions.decorator.js';
import type { AuthContext } from './jwt-payload.interface.js';

/// 全局Guard (在 JwtAuthGuard/TenantGuard 之后执行): 校验当前账户是否拥有路由所需的模块权限。
/// OWNER/ADMIN账户始终放行 (管理账户对全部模块拥有完全访问权限); STAFF账户按 permissions 字段逐项校验。
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthContext | undefined;
    if (!user) return true; // @Public() 路由没有 user

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true; // 未声明权限要求的路由默认放行(仅要求登录)

    if (user.role === 'OWNER' || user.role === 'ADMIN') return true;

    const missing = required.filter((p) => !user.permissions.includes(p));
    if (missing.length > 0) {
      throw new ForbiddenException(`缺少所需权限: ${missing.join(', ')}`);
    }
    return true;
  }
}
