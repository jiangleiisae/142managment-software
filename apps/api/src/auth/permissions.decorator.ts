import { SetMetadata } from '@nestjs/common';
import { Permission } from '@prisma/client';

export const PERMISSIONS_KEY = 'permissions';

/// 标记某控制器/路由所需的模块权限。OWNER/ADMIN账户不受此限制, 对全部模块拥有完全访问权限;
/// STAFF账户须在 permissions 字段中持有全部列出的权限才能访问。
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);

export const SKIP_PERMISSION_KEY = 'skipPermissionCheck';

/// 方法级例外: 即使所在控制器声明了 @RequirePermissions(), 该路由仍对任意已登录用户放行
/// (如Kiosk缺陷报告场景: 任何在场人员都应能报告缺陷, 不应被模块权限拦住)
export const SkipPermissionCheck = () => SetMetadata(SKIP_PERMISSION_KEY, true);
