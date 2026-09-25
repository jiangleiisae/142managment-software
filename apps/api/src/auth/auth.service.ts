import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
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
  ) {}

  private issueToken(payload: JwtPayload) {
    return this.jwtService.sign(payload);
  }

  /// 注册创建新租户 + 该租户的第一个用户 (OWNER)。一期没有"加入已有租户"的邀请流程, 后续按需补充。
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('该邮箱已被注册');

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

    const payload: JwtPayload = { sub: user.id, tenantId: tenant.id, role: user.role, email: user.email };
    return { accessToken: this.issueToken(payload), user: { id: user.id, email: user.email, role: user.role }, tenant };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('邮箱或密码错误');

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) throw new UnauthorizedException('邮箱或密码错误');

    const payload: JwtPayload = { sub: user.id, tenantId: user.tenantId, role: user.role, email: user.email };
    return { accessToken: this.issueToken(payload), user: { id: user.id, email: user.email, role: user.role } };
  }
}
