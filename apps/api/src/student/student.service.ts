import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class StudentService {
  constructor(private readonly prisma: PrismaService) {}

  private async findStudentOrThrow(studentId: string, tenantId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { organization: true },
    });
    if (!student || student.organization.tenantId !== tenantId) {
      throw new NotFoundException(`Student ${studentId} not found`);
    }
    return student;
  }

  create(data: {
    organizationId: string;
    firstName: string;
    lastName: string;
    licenceNo?: string;
    medicalCertExpiry?: string;
  }) {
    return this.prisma.student.create({
      data: {
        organizationId: data.organizationId,
        firstName: data.firstName,
        lastName: data.lastName,
        licenceNo: data.licenceNo,
        medicalCertExpiry: data.medicalCertExpiry ? new Date(data.medicalCertExpiry) : undefined,
      },
    });
  }

  findAll(organizationId: string) {
    return this.prisma.student.findMany({ where: { organizationId } });
  }

  async findOne(id: string, tenantId: string) {
    await this.findStudentOrThrow(id, tenantId);
    return this.prisma.student.findUnique({
      where: { id },
      include: { enrollments: { include: { course: true, trainingRecords: true } } },
    });
  }

  /// ORA.ATO.145 训练前置条件校验: 体检证必须在有效期内才能入学
  async enroll(studentId: string, tenantId: string, courseId: string) {
    const student = await this.findStudentOrThrow(studentId, tenantId);

    if (student.medicalCertExpiry && student.medicalCertExpiry < new Date()) {
      throw new BadRequestException(
        `Student ${studentId} medical certificate expired on ${student.medicalCertExpiry.toISOString()} - cannot enroll (ORA.ATO.145)`,
      );
    }

    // 课程也必须归属同一机构 (租户已通过学员校验, 这里再确认课程未跨机构挂载)
    const course = await this.prisma.course.findFirst({ where: { id: courseId, organizationId: student.organizationId } });
    if (!course) throw new NotFoundException(`Course ${courseId} not found in this organization`);

    return this.prisma.enrollment.create({ data: { studentId, courseId } });
  }

  async addTrainingRecord(
    enrollmentId: string,
    tenantId: string,
    data: { sessionDate: string; subject: string; progressNotes?: string; testScore?: string; assessedById?: string },
  ) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { student: { include: { organization: true } } },
    });
    if (!enrollment || enrollment.student.organization.tenantId !== tenantId) {
      throw new NotFoundException(`Enrollment ${enrollmentId} not found`);
    }

    return this.prisma.trainingRecord.create({
      data: {
        enrollmentId,
        sessionDate: new Date(data.sessionDate),
        subject: data.subject,
        progressNotes: data.progressNotes,
        testScore: data.testScore,
        assessedById: data.assessedById,
      },
    });
  }
}
