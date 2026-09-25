import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class StudentService {
  constructor(private readonly prisma: PrismaService) {}

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

  async findOne(id: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: { enrollments: { include: { course: true, trainingRecords: true } } },
    });
    if (!student) throw new NotFoundException(`Student ${id} not found`);
    return student;
  }

  /// ORA.ATO.145 训练前置条件校验: 体检证必须在有效期内才能入学
  async enroll(studentId: string, courseId: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException(`Student ${studentId} not found`);

    if (student.medicalCertExpiry && student.medicalCertExpiry < new Date()) {
      throw new BadRequestException(
        `Student ${studentId} medical certificate expired on ${student.medicalCertExpiry.toISOString()} - cannot enroll (ORA.ATO.145)`,
      );
    }

    return this.prisma.enrollment.create({ data: { studentId, courseId } });
  }

  addTrainingRecord(
    enrollmentId: string,
    data: { sessionDate: string; subject: string; progressNotes?: string; testScore?: string; assessedById?: string },
  ) {
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
