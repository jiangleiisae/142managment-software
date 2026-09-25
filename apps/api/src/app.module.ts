import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { OrganizationModule } from './organization/organization.module.js';
import { ManagementSystemModule } from './management-system/management-system.module.js';
import { FstdModule } from './fstd/fstd.module.js';
import { PersonnelModule } from './personnel/personnel.module.js';
import { CourseModule } from './course/course.module.js';
import { StudentModule } from './student/student.module.js';
import { SchedulingModule } from './scheduling/scheduling.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    OrganizationModule,
    ManagementSystemModule,
    FstdModule,
    PersonnelModule,
    CourseModule,
    StudentModule,
    SchedulingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
