import { Injectable, NotFoundException } from '@nestjs/common';
import { CourseType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CourseService {
  constructor(private readonly prisma: PrismaService) {}

  private async findCourseOrThrow(courseId: string, tenantId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: { organization: true },
    });
    if (!course || course.organization.tenantId !== tenantId) throw new NotFoundException(`Course ${courseId} not found`);
    return course;
  }

  // 需求清单 3.6: 一期基础版, 不含ZFTT/MPL等特殊课程规则
  create(data: { organizationId: string; name: string; courseType: CourseType }) {
    return this.prisma.course.create({ data });
  }

  findAll(organizationId: string) {
    return this.prisma.course.findMany({ where: { organizationId } });
  }

  async findOne(id: string, tenantId: string) {
    await this.findCourseOrThrow(id, tenantId);
    return this.prisma.course.findUnique({
      where: { id },
      include: { trainingProgramme: true, enrollments: true },
    });
  }

  async approve(id: string, tenantId: string) {
    await this.findCourseOrThrow(id, tenantId);
    return this.prisma.course.update({ where: { id }, data: { isApproved: true, approvedAt: new Date() } });
  }

  // ORA.ATO.125 训练大纲
  async setTrainingProgramme(
    courseId: string,
    tenantId: string,
    data: { summary?: string; stagesJson?: Prisma.InputJsonValue; standardTasksJson?: Prisma.InputJsonValue },
  ) {
    await this.findCourseOrThrow(courseId, tenantId);
    return this.prisma.trainingProgramme.upsert({
      where: { courseId },
      create: { courseId, summary: data.summary, stagesJson: data.stagesJson, standardTasksJson: data.standardTasksJson },
      update: { summary: data.summary, stagesJson: data.stagesJson, standardTasksJson: data.standardTasksJson },
    });
  }
}
