import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/// 标记不需要JWT认证的路由 (如 /auth/login, /auth/register)
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
