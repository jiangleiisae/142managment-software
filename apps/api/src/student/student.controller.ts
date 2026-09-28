import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Permission } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { StudentService } from './student.service.js';

@Controller('students')
@RequirePermissions(Permission.STUDENTS)
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Post()
  create(
    @Body()
    dto: { organizationId: string; firstName: string; lastName: string; licenceNo?: string; medicalCertExpiry?: string },
  ) {
    return this.studentService.create(dto);
  }

  @Get()
  findAll(@Query('organizationId') organizationId: string) {
    return this.studentService.findAll(organizationId);
  }

  @Get('expiring-medical-certs')
  findExpiringMedicalCerts(@CurrentUser() user: AuthContext, @Query('withinDays') withinDays: string) {
    return this.studentService.findExpiringMedicalCerts(user.tenantId, Number(withinDays) || 60);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.studentService.findOne(id, user.tenantId);
  }

  @Post(':id/enroll')
  enroll(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: { courseId: string }) {
    return this.studentService.enroll(id, user.tenantId, dto.courseId);
  }

  @Post('enrollments/:enrollmentId/training-records')
  addTrainingRecord(
    @CurrentUser() user: AuthContext,
    @Param('enrollmentId') enrollmentId: string,
    @Body()
    dto: {
      sessionDate: string;
      subject: string;
      progressNotes?: string;
      testScore?: string;
      assessedById?: string;
      courseRequirementId?: string;
    },
  ) {
    return this.studentService.addTrainingRecord(enrollmentId, user.tenantId, dto);
  }

  @Get('enrollments/:enrollmentId/training-records')
  listTrainingRecords(@CurrentUser() user: AuthContext, @Param('enrollmentId') enrollmentId: string) {
    return this.studentService.listTrainingRecords(enrollmentId, user.tenantId);
  }

  @Get('enrollments/:enrollmentId/progress-card')
  getProgressCard(@CurrentUser() user: AuthContext, @Param('enrollmentId') enrollmentId: string) {
    return this.studentService.getProgressCard(enrollmentId, user.tenantId);
  }

  @Post('enrollments/:enrollmentId/complete')
  completeEnrollment(@CurrentUser() user: AuthContext, @Param('enrollmentId') enrollmentId: string) {
    return this.studentService.completeEnrollment(enrollmentId, user.tenantId);
  }

  @Post('enrollments/:enrollmentId/withdraw')
  withdrawEnrollment(@CurrentUser() user: AuthContext, @Param('enrollmentId') enrollmentId: string) {
    return this.studentService.withdrawEnrollment(enrollmentId, user.tenantId);
  }
}
