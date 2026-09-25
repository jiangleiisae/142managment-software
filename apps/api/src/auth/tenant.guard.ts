import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthContext } from './jwt-payload.interface.js';

/// 全局Guard (在 JwtAuthGuard 之后执行): 如果请求(query/body)里带了 organizationId,
/// 必须校验该机构确实属于当前登录用户的租户, 否则403。
/// 这是关闭"客户端随便传 organizationId/tenantId 就能看到别的租户数据"这个漏洞的核心防线。
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthContext | undefined;
    if (!user) return true; // @Public() 路由没有 user, 不做租户校验

    const organizationId: string | undefined = request.query?.organizationId ?? request.body?.organizationId;
    if (!organizationId) return true; // 该路由不涉及机构范围数据, 无需校验

    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org || org.tenantId !== user.tenantId) {
      throw new ForbiddenException(`Organization ${organizationId} 不属于当前租户`);
    }
    return true;
  }
}
