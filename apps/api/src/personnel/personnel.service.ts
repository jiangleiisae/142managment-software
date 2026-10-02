import { Injectable, NotFoundException } from '@nestjs/common';
import { InstructorType, Prisma } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/// CCAR-142第142.61条(c)款: 教员初始聘任前应完成的7个地面训练科目
export const INSTRUCTOR_INITIAL_TRAINING_ITEMS = [
  '教学法',
  '训练政策与程序',
  '学习过程的基本原理',
  '教员的职责、权利与限制',
  '每种课程对设备的最低要求',
  '训练科目的修订',
  '人为因素，包括机组资源管理',
];

interface InitialTrainingItem {
  item: string;
  completed: boolean;
}

/// 已完成初始培训: 完成日期已填写, 总学时≥8小时, 7个科目全部完成, 且笔试通过 (142.61(c)排课准入判定依据)
export function isInstructorInitialTrainingComplete(
  training: { completedAt: Date | null; totalHours: number | null; itemsJson: unknown; writtenExamPassed: boolean } | null | undefined,
): boolean {
  if (!training?.completedAt || !training.writtenExamPassed) return false;
  if ((training.totalHours ?? 0) < 8) return false;
  const items = Array.isArray(training.itemsJson) ? (training.itemsJson as InitialTrainingItem[]) : [];
  return items.length === INSTRUCTOR_INITIAL_TRAINING_ITEMS.length && items.every((i) => i.completed);
}

@Injectable()
export class PersonnelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  create(tenantId: string, data: { firstName: string; lastName: string; email?: string; phone?: string }) {
    return this.prisma.personnel.create({
      data: { tenantId, firstName: data.firstName, lastName: data.lastName, email: data.email, phone: data.phone },
    });
  }

  async findAll(tenantId: string) {
    const list = await this.prisma.personnel.findMany({
      where: { tenantId },
      include: {
        qualifications: true,
        roleAssignments: true,
        instructorProfile: { include: { initialTraining: true } },
        user: { select: { id: true, email: true } },
      },
    });
    return list.map((p) => ({
      ...p,
      instructorProfile: p.instructorProfile && {
        ...p.instructorProfile,
        initialTraining: p.instructorProfile.initialTraining && {
          ...p.instructorProfile.initialTraining,
          isComplete: isInstructorInitialTrainingComplete(p.instructorProfile.initialTraining),
        },
      },
    }));
  }

  async findOne(id: string, tenantId: string) {
    const person = await this.prisma.personnel.findUnique({
      where: { id },
      include: {
        qualifications: true,
        roleAssignments: true,
        instructorProfile: { include: { initialTraining: true } },
        user: { select: { id: true, email: true } },
      },
    });
    if (!person || person.tenantId !== tenantId) throw new NotFoundException(`Personnel ${id} not found`);
    return person;
  }

  // 需求清单 3.5: 证照/资质记录 + 到期提醒 (提醒任务留待二期接入 BullMQ)
  async addQualification(
    personnelId: string,
    tenantId: string,
    data: {
      qualificationType: string;
      certificateNo?: string;
      issuingAuthority?: string;
      validFrom?: string;
      validUntil?: string;
    },
  ) {
    await this.findOne(personnelId, tenantId);
    return this.prisma.qualificationRecord.create({
      data: {
        personnelId,
        qualificationType: data.qualificationType,
        certificateNo: data.certificateNo,
        issuingAuthority: data.issuingAuthority,
        validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
      },
    });
  }

  /// 找出即将到期的资质记录 (供二期提醒引擎调用, 一期先提供查询接口), 限定在当前租户范围内
  findExpiringSoon(tenantId: string, withinDays: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + withinDays);
    return this.prisma.qualificationRecord.findMany({
      where: { validUntil: { lte: cutoff, gte: new Date() }, personnel: { tenantId } },
      include: { personnel: true },
    });
  }

  /// 3.5 教员档案 (FI/TRI/SFI/理论教员/考试员), 与Personnel一对一, 按personnelId upsert
  async setInstructorProfile(personnelId: string, tenantId: string, instructorType: InstructorType) {
    await this.findOne(personnelId, tenantId);
    const before = await this.prisma.instructorProfile.findUnique({ where: { personnelId } });
    const updated = await this.prisma.instructorProfile.upsert({
      where: { personnelId },
      create: { personnelId, instructorType },
      update: { instructorType },
    });
    await this.auditLog.write(tenantId, 'InstructorProfile', personnelId, before ? 'update' : 'create', before, updated);
    return updated;
  }

  // ---- CCAR-142第142.61条(c)款: 教员初始培训 (≥8小时地面训练 + 笔试) ----

  listInitialTrainingItems() {
    return INSTRUCTOR_INITIAL_TRAINING_ITEMS;
  }

  async getInitialTraining(personnelId: string, tenantId: string) {
    const person = await this.findOne(personnelId, tenantId);
    if (!person.instructorProfile) throw new NotFoundException(`${personnelId} 尚无教员档案`);
    const training = await this.prisma.instructorInitialTraining.findUnique({
      where: { instructorProfileId: person.instructorProfile.id },
    });
    return { ...training, isComplete: isInstructorInitialTrainingComplete(training) };
  }

  async upsertInitialTraining(
    personnelId: string,
    tenantId: string,
    data: { completedAt?: string; totalHours?: number; items?: InitialTrainingItem[]; writtenExamPassed?: boolean; writtenExamDate?: string },
  ) {
    const person = await this.findOne(personnelId, tenantId);
    if (!person.instructorProfile) throw new NotFoundException(`${personnelId} 尚无教员档案, 请先登记教员档案`);
    const instructorProfileId = person.instructorProfile.id;
    const before = await this.prisma.instructorInitialTraining.findUnique({ where: { instructorProfileId } });
    const payload = {
      completedAt: data.completedAt ? new Date(data.completedAt) : before?.completedAt ?? null,
      totalHours: data.totalHours ?? before?.totalHours ?? null,
      itemsJson: (data.items ?? before?.itemsJson ?? []) as Prisma.InputJsonValue,
      writtenExamPassed: data.writtenExamPassed ?? before?.writtenExamPassed ?? false,
      writtenExamDate: data.writtenExamDate ? new Date(data.writtenExamDate) : before?.writtenExamDate ?? null,
    };
    const training = await this.prisma.instructorInitialTraining.upsert({
      where: { instructorProfileId },
      create: { instructorProfileId, ...payload },
      update: payload,
    });
    await this.auditLog.write(tenantId, 'InstructorInitialTraining', training.id, before ? 'update' : 'create', before, training);
    return { ...training, isComplete: isInstructorInitialTrainingComplete(training) };
  }
}
