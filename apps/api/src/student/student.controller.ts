import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { StudentService } from './student.service.js';

@Controller('students')
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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.studentService.findOne(id);
  }

  @Post(':id/enroll')
  enroll(@Param('id') id: string, @Body() dto: { courseId: string }) {
    return this.studentService.enroll(id, dto.courseId);
  }

  @Post('enrollments/:enrollmentId/training-records')
  addTrainingRecord(
    @Param('enrollmentId') enrollmentId: string,
    @Body()
    dto: { sessionDate: string; subject: string; progressNotes?: string; testScore?: string; assessedById?: string },
  ) {
    return this.studentService.addTrainingRecord(enrollmentId, dto);
  }
}
