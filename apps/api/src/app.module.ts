import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { TenantGuard } from './auth/tenant.guard.js';
import { CourseModule } from './course/course.module.js';
import { FstdModule } from './fstd/fstd.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { ManagementSystemModule } from './management-system/management-system.module.js';
import { OrganizationModule } from './organization/organization.module.js';
import { PersonnelModule } from './personnel/personnel.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RetentionModule } from './retention/retention.module.js';
import { SchedulingModule } from './scheduling/scheduling.module.js';
import { StudentModule } from './student/student.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    OrganizationModule,
    ManagementSystemModule,
    FstdModule,
    InventoryModule,
    PersonnelModule,
    CourseModule,
    StudentModule,
    SchedulingModule,
    RetentionModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // 全局认证与租户隔离: JwtAuthGuard 先跑 (验证token, @Public()例外), TenantGuard 后跑 (校验organizationId归属)
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
  ],
})
export class AppModule {}
