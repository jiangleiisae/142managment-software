import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import type { JwtPayload } from './jwt-payload.interface.js';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly i18n: I18nService,
  ) {}

  /// 登录/注册这两个接口在未登录状态下调用, 错误提示要跟着前端当前选择的语言走 (见 app.module.ts 的
  /// HeaderResolver, 读取前端发来的 X-Lang 请求头)。
  private t(key: string) {
    return this.i18n.t(key, { lang: I18nContext.current()?.lang });
  }

  private issueToken(payload: JwtPayload) {
    return this.jwtService.sign(payload);
  }

  /// 注册创建新租户 + 该租户的第一个用户 (OWNER)。一期没有"加入已有租户"的邀请流程, 后续按需补充。
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException(this.t('auth.emailAlreadyRegistered'));

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const { user, tenant } = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { name: dto.tenantName } });
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.email,
          passwordHash,
          role: UserRole.OWNER,
        },
      });
      return { user, tenant };
    });

    const payload: JwtPayload = { sub: user.id };
    return {
      accessToken: this.issueToken(payload),
      user: { id: user.id, email: user.email, role: user.role, permissions: user.permissions },
      tenant,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException(this.t('auth.invalidCredentials'));
    if (!user.isActive) throw new UnauthorizedException(this.t('auth.accountDisabled'));

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) throw new UnauthorizedException(this.t('auth.invalidCredentials'));

    const payload: JwtPayload = { sub: user.id };
    return {
      accessToken: this.issueToken(payload),
      user: { id: user.id, email: user.email, role: user.role, permissions: user.permissions },
    };
  }
}
