import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UserService } from './user.service.js';

/// 用户账户与权限管理。不声明 @RequirePermissions(), 因为"能否管理账户"由角色(OWNER/ADMIN)
/// 决定而非模块权限, 校验逻辑在 UserService 内完成 (STAFF账户调用会被service层拒绝)。
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  list(@CurrentUser() user: AuthContext) {
    return this.userService.list(user);
  }

  @Post()
  create(@CurrentUser() user: AuthContext, @Body() dto: CreateUserDto) {
    return this.userService.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.userService.update(user, id, dto);
  }

  @Post(':id/reset-password')
  resetPassword(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.userService.resetPassword(user, id, dto);
  }
}
