import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Permission } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { Public } from '../auth/public.decorator.js';
import { ShareActionDto } from './dto/share.dto.js';
import { ShareService } from './share.service.js';

/// 分享链接的管理 (需登录, 权限沿用 SCHEDULING)
@Controller('shares')
@RequirePermissions(Permission.SCHEDULING)
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  @Get()
  list(@Query('organizationId') organizationId: string) {
    return this.shareService.list(organizationId);
  }

  @Post('enable')
  enable(@CurrentUser() user: AuthContext, @Body() dto: ShareActionDto) {
    return this.shareService.enable(user.tenantId, user.email, dto.organizationId, dto.type);
  }

  @Post('rotate')
  rotate(@CurrentUser() user: AuthContext, @Body() dto: ShareActionDto) {
    return this.shareService.rotate(user.tenantId, user.email, dto.organizationId, dto.type);
  }

  @Post('disable')
  disable(@CurrentUser() user: AuthContext, @Body() dto: ShareActionDto) {
    return this.shareService.disable(user.tenantId, user.email, dto.organizationId, dto.type);
  }
}

/// 公开只读页面的数据接口: 无需登录, 凭二维码里的 token 读取最新计划。
/// 单独限流 (每IP每分钟30次), 响应不缓存、不让搜索引擎收录。
@Controller('public')
export class PublicShareController {
  constructor(private readonly shareService: ShareService) {}

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('share/:token')
  view(@Res({ passthrough: true }) res: Response, @Param('token') token: string, @Query('date') date?: string, @Query('days') days?: string, @Query('month') month?: string) {
    res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
    return this.shareService.publicView(token, { date, days, month });
  }
}
