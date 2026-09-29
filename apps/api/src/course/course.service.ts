import { Injectable, NotFoundException } from '@nestjs/common';
import { CourseType, Prisma } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CourseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async findCourseOrThrow(courseId: string, tenantId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: { organization: true },
    });
    if (!course || course.organization.tenantId !== tenantId) throw new NotFoundException(`Course ${courseId} not found`);
    return course;
  }

  // 需求清单 3.6: 一期基础版, 不含ZFTT/MPL等特殊课程规则
  async create(tenantId: string, data: { organizationId: string; name: string; courseType: CourseType }) {
    const course = await this.prisma.course.create({ data });
    await this.auditLog.write(tenantId, 'Course', course.id, 'create', null, course);
    return course;
  }

  findAll(organizationId: string) {
    return this.prisma.course.findMany({ where: { organizationId } });
  }

  async findOne(id: string, tenantId: string) {
    await this.findCourseOrThrow(id, tenantId);
    return this.prisma.course.findUnique({
      where: { id },
      include: { trainingProgramme: true, enrollments: true, requirements: true },
    });
  }

  async approve(id: string, tenantId: string) {
    const before = await this.findCourseOrThrow(id, tenantId);
    const updated = await this.prisma.course.update({ where: { id }, data: { isApproved: true, approvedAt: new Date() } });
    await this.auditLog.write(tenantId, 'Course', id, 'approve', before, updated);
    return updated;
  }

  // ORA.ATO.125 训练大纲
  async setTrainingProgramme(
    courseId: string,
    tenantId: string,
    data: { summary?: string; stagesJson?: Prisma.InputJsonValue; standardTasksJson?: Prisma.InputJsonValue },
  ) {
    await this.findCourseOrThrow(courseId, tenantId);
    const before = await this.prisma.trainingProgramme.findUnique({ where: { courseId } });
    const updated = await this.prisma.trainingProgramme.upsert({
      where: { courseId },
      create: { courseId, summary: data.summary, stagesJson: data.stagesJson, standardTasksJson: data.standardTasksJson },
      update: { summary: data.summary, stagesJson: data.stagesJson, standardTasksJson: data.standardTasksJson },
    });
    await this.auditLog.write(tenantId, 'TrainingProgramme', courseId, before ? 'update' : 'create', before, updated);
    return updated;
  }

  // ---- 课程要求 <-> FSTD能力校验 (需求清单3.3.3/3.6: 课程与设备已鉴定任务清单的关联) ----

  async addRequirement(courseId: string, tenantId: string, data: { taskCode: string; taskName: string; minHours?: number }) {
    await this.findCourseOrThrow(courseId, tenantId);
    return this.prisma.courseRequirement.create({ data: { courseId, ...data } });
  }

  async listRequirements(courseId: string, tenantId: string) {
    await this.findCourseOrThrow(courseId, tenantId);
    return this.prisma.courseRequirement.findMany({ where: { courseId } });
  }

  /// 校验某台FSTD是否满足课程的全部训练科目要求 (对应需求清单 can_device_perform_task 的课程级聚合版本)
  async checkFstdCompatibility(courseId: string, fstdId: string, tenantId: string) {
    const course = await this.findCourseOrThrow(courseId, tenantId);
    const fstd = await this.prisma.fstd.findUnique({ where: { id: fstdId } });
    if (!fstd || fstd.organizationId !== course.organizationId) {
      throw new NotFoundException(`FSTD ${fstdId} not found in this organization`);
    }

    const requirements = await this.prisma.courseRequirement.findMany({ where: { courseId } });
    const qualifiedTasks = await this.prisma.fstdQualifiedTask.findMany({ where: { fstdId } });
    const qualifiedCodes = new Set(qualifiedTasks.map((t) => t.taskCode));

    const missingTasks = requirements.filter((r) => !qualifiedCodes.has(r.taskCode));
    return {
      compatible: missingTasks.length === 0,
      totalRequirements: requirements.length,
      missingTasks: missingTasks.map((t) => ({ taskCode: t.taskCode, taskName: t.taskName })),
    };
  }
}
