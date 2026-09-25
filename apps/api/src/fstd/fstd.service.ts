import { Injectable, NotFoundException } from '@nestjs/common';
import { FstdDeviceType, LegacyLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class FstdService {
  constructor(private readonly prisma: PrismaService) {}

  // 需求清单 3.3.1: 一期仅 EASA legacy 等级字典, FCS矩阵留待三期 (qualificationBasisType 默认 EASA_LEGACY_LEVEL)
  create(data: {
    organizationId: string;
    deviceCode: string;
    representedAircraft: string;
    deviceType: FstdDeviceType;
    serialNumber?: string;
    location?: string;
    legacyLevel?: LegacyLevel;
  }) {
    return this.prisma.fstd.create({
      data: {
        organizationId: data.organizationId,
        deviceCode: data.deviceCode,
        representedAircraft: data.representedAircraft,
        deviceType: data.deviceType,
        serialNumber: data.serialNumber,
        location: data.location,
        ...(data.legacyLevel
          ? { legacyLevel: { create: { level: data.legacyLevel } } }
          : {}),
      },
      include: { legacyLevel: true },
    });
  }

  findAll(organizationId: string) {
    return this.prisma.fstd.findMany({
      where: { organizationId },
      include: { legacyLevel: true, qualifiedTasks: true },
    });
  }

  async findOne(id: string) {
    const fstd = await this.prisma.fstd.findUnique({
      where: { id },
      include: {
        legacyLevel: true,
        qualifiedTasks: true,
        recurrentEvals: { orderBy: { periodStart: 'desc' } },
        discrepancies: { where: { status: 'open' } },
      },
    });
    if (!fstd) throw new NotFoundException(`FSTD ${id} not found`);
    return fstd;
  }

  // 需求清单 3.3.3: 已鉴定任务清单, 连接设备与训练科目
  addQualifiedTask(fstdId: string, data: { taskCode: string; taskName: string; requiresSpecialAuth?: boolean }) {
    return this.prisma.fstdQualifiedTask.create({ data: { fstdId, ...data } });
  }

  /// 排课引擎调用的核心校验接口 (需求清单 3.3.3: can_device_perform_task)
  async canPerformTask(fstdId: string, taskCode: string): Promise<boolean> {
    const task = await this.prisma.fstdQualifiedTask.findFirst({ where: { fstdId, taskCode } });
    return !!task;
  }

  // 需求清单 3.3.7: 缺陷处理, 吸收FAA 30天修复时限规则
  reportDiscrepancy(fstdId: string, data: { description: string; isMmi?: boolean; reportedById?: string }) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // 吸收 FAA §60.25 30天规则 (EASA条文未给出具体天数)
    return this.prisma.discrepancyLog.create({
      data: {
        fstdId,
        description: data.description,
        isMmi: data.isMmi ?? false,
        reportedById: data.reportedById,
        dueDate,
      },
    });
  }

  correctDiscrepancy(discrepancyId: string, data: { correctiveAction: string; correctedById?: string }) {
    return this.prisma.discrepancyLog.update({
      where: { id: discrepancyId },
      data: {
        correctiveAction: data.correctiveAction,
        correctedById: data.correctedById,
        correctedAt: new Date(),
        status: 'corrected',
      },
    });
  }
}
