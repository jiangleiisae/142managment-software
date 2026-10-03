import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AcceptLanguageResolver, HeaderResolver, I18nModule } from 'nestjs-i18n';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuditLogModule } from './audit-log/audit-log.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { PermissionsGuard } from './auth/permissions.guard.js';
import { TenantGuard } from './auth/tenant.guard.js';
import { ChangeManagementModule } from './change-management/change-management.module.js';
import { CourseModule } from './course/course.module.js';
import { FstdModule } from './fstd/fstd.module.js';
import { IsmsModule } from './isms/isms.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { ManagementSystemModule } from './management-system/management-system.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { OrganizationModule } from './organization/organization.module.js';
import { PersonnelModule } from './personnel/personnel.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { RosterModule } from './roster/roster.module.js';
import { DutyModule } from './duty/duty.module.js';
import { ChecklistModule } from './checklist/checklist.module.js';
import { UpgradeModule } from './upgrade/upgrade.module.js';
import { QualityModule } from './quality/quality.module.js';
import { RetentionModule } from './retention/retention.module.js';
import { SchedulingModule } from './scheduling/scheduling.module.js';
import { StudentModule } from './student/student.module.js';
import { UserModule } from './user/user.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // 默认限流: 每IP每分钟100次请求; 登录/注册等易受暴力破解攻击的路由通过 @Throttle() 单独设更严格的限制。
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),
    // 前端通过 X-Lang 请求头携带当前界面语言(zh|en); 未携带时退回 Accept-Language, 都没有则用中文。
    I18nModule.forRoot({
      fallbackLanguage: 'zh',
      loaderOptions: { path: join(import.meta.dirname, 'i18n/'), watch: true },
      resolvers: [new HeaderResolver(['x-lang']), AcceptLanguageResolver],
    }),
    PrismaModule,
    AuditLogModule,
    AuthModule,
    OrganizationModule,
    ManagementSystemModule,
    FstdModule,
    InventoryModule,
    PersonnelModule,
    CourseModule,
    StudentModule,
    SchedulingModule,
    ReportsModule,
    RosterModule,
    DutyModule,
    ChecklistModule,
    UpgradeModule,
    QualityModule,
    RetentionModule,
    IsmsModule,
    UserModule,
    ChangeManagementModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // 全局限流/认证/租户隔离/模块权限校验, 按顺序执行: ThrottlerGuard(限流, 优先于其他所有校验) ->
    // JwtAuthGuard(验证token, @Public()例外) -> TenantGuard(校验organizationId归属) ->
    // PermissionsGuard(校验@RequirePermissions()所需模块权限)
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
