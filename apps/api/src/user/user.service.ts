import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditLogService } from '../audit-log/audit-log.service.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

const BCRYPT_ROUNDS = 12;

/// 用户账户管理: 仅OWNER/ADMIN账户可访问。OWNER账户本身不可通过本模块修改(注册时生成, 永久保有全部权限)。
/// 只有OWNER能创建/修改ADMIN账户, 防止ADMIN互相提权或降权彼此。
@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private assertIsAdmin(actor: AuthContext) {
    if (actor.role !== UserRole.OWNER && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('仅管理账户(OWNER/ADMIN)可管理用户账户');
    }
  }

  private toSafeUser(user: User) {
    const { passwordHash: _passwordHash, ...safe } = user;
    return safe;
  }

  async list(actor: AuthContext) {
    this.assertIsAdmin(actor);
    const users = await this.prisma.user.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: { createdAt: 'asc' },
    });
    return users.map((u) => this.toSafeUser(u));
  }

  async create(actor: AuthContext, dto: CreateUserDto) {
    this.assertIsAdmin(actor);
    if (dto.role === UserRole.ADMIN && actor.role !== UserRole.OWNER) {
      throw new ForbiddenException('仅OWNER账户可创建ADMIN账户');
    }
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('该邮箱已被注册');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { tenantId: actor.tenantId, email: dto.email, passwordHash, role: dto.role, permissions: dto.permissions },
    });
    const safeUser = this.toSafeUser(user);
    await this.auditLog.write(actor.tenantId, 'User', user.id, 'create', null, safeUser);
    return safeUser;
  }

  private async findTargetOrThrow(actor: AuthContext, targetId: string) {
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target || target.tenantId !== actor.tenantId) throw new NotFoundException(`User ${targetId} not found`);
    return target;
  }

  async update(actor: AuthContext, targetId: string, dto: UpdateUserDto) {
    this.assertIsAdmin(actor);
    const target = await this.findTargetOrThrow(actor, targetId);

    if (target.role === UserRole.OWNER) throw new ForbiddenException('不能修改OWNER账户');
    if (target.role === UserRole.ADMIN && actor.role !== UserRole.OWNER) {
      throw new ForbiddenException('仅OWNER账户可修改ADMIN账户');
    }
    if (dto.role === UserRole.ADMIN && actor.role !== UserRole.OWNER) {
      throw new ForbiddenException('仅OWNER账户可将账户设为ADMIN');
    }

    const user = await this.prisma.user.update({
      where: { id: targetId },
      data: { role: dto.role, permissions: dto.permissions, isActive: dto.isActive },
    });
    const safeUser = this.toSafeUser(user);
    await this.auditLog.write(actor.tenantId, 'User', targetId, 'update', this.toSafeUser(target), safeUser);
    return safeUser;
  }

  async resetPassword(actor: AuthContext, targetId: string, dto: ResetPasswordDto) {
    this.assertIsAdmin(actor);
    const target = await this.findTargetOrThrow(actor, targetId);

    if (target.role === UserRole.OWNER && targetId !== actor.userId) {
      throw new ForbiddenException('不能重置OWNER账户的密码');
    }
    if (target.role === UserRole.ADMIN && actor.role !== UserRole.OWNER) {
      throw new ForbiddenException('仅OWNER账户可重置ADMIN账户的密码');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({ where: { id: targetId }, data: { passwordHash } });
    // 不记录密码哈希本身, 仅记录"密码已被重置"这一事实, 供事后追溯是谁在什么时间重置了哪个账户的密码
    await this.auditLog.write(actor.tenantId, 'User', targetId, 'reset_password');
    return { success: true };
  }
}
