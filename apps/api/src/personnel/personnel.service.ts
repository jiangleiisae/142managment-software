import { Injectable, NotFoundException } from '@nestjs/common';
import { InstructorType } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

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

  findAll(tenantId: string) {
    return this.prisma.personnel.findMany({
      where: { tenantId },
      include: { qualifications: true, roleAssignments: true, instructorProfile: true },
    });
  }

  async findOne(id: string, tenantId: string) {
    const person = await this.prisma.personnel.findUnique({
      where: { id },
      include: { qualifications: true, roleAssignments: true, instructorProfile: true },
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
}
