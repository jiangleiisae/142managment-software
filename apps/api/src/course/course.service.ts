import { Injectable, NotFoundException } from '@nestjs/common';
import { CourseType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CourseService {
  constructor(private readonly prisma: PrismaService) {}

  // 需求清单 3.6: 一期基础版, 不含ZFTT/MPL等特殊课程规则
  create(data: { organizationId: string; name: string; courseType: CourseType }) {
    return this.prisma.course.create({ data });
  }

  findAll(organizationId: string) {
    return this.prisma.course.findMany({ where: { organizationId } });
  }

  async findOne(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: { trainingProgramme: true, enrollments: true },
    });
    if (!course) throw new NotFoundException(`Course ${id} not found`);
    return course;
  }

  approve(id: string) {
    return this.prisma.course.update({ where: { id }, data: { isApproved: true, approvedAt: new Date() } });
  }

  // ORA.ATO.125 训练大纲
  setTrainingProgramme(
    courseId: string,
    data: { summary?: string; stagesJson?: Prisma.InputJsonValue; standardTasksJson?: Prisma.InputJsonValue },
  ) {
    return this.prisma.trainingProgramme.upsert({
      where: { courseId },
      create: { courseId, summary: data.summary, stagesJson: data.stagesJson, standardTasksJson: data.standardTasksJson },
      update: { summary: data.summary, stagesJson: data.stagesJson, standardTasksJson: data.standardTasksJson },
    });
  }
}
