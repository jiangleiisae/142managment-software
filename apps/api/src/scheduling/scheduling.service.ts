import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingResourceType } from '@prisma/client';
import { FstdService } from '../fstd/fstd.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SchedulingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fstdService: FstdService,
  ) {}

  /// 需求清单 3.8: 排课引擎作为消费方, 校验资源在时间段内无冲突
  private async assertNoConflict(resourceType: BookingResourceType, resourceId: string, startAt: Date, endAt: Date) {
    const conflict = await this.prisma.booking.findFirst({
      where: {
        resourceType,
        resourceId,
        status: 'confirmed',
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });
    if (conflict) {
      throw new BadRequestException(
        `Resource ${resourceType}:${resourceId} already booked ${conflict.startAt.toISOString()} - ${conflict.endAt.toISOString()}`,
      );
    }
  }

  /// 需求清单 3.8: "排课引擎作为消费方调用各模块暴露的校验服务" —— 这里是该原则的落地:
  /// FSTD资源校验设备状态与已鉴定任务清单(3.3.3), 学员资源校验体检证有效性(ORA.ATO.145/3.7)。
  /// 校验不通过直接抛错阻断排课, 而不是仅仅记录时间冲突。
  private async assertResourceEligible(data: {
    organizationId: string;
    resourceType: BookingResourceType;
    resourceId: string;
    taskCode?: string;
    studentId?: string;
  }) {
    if (data.resourceType === 'FSTD') {
      const fstd = await this.prisma.fstd.findUnique({ where: { id: data.resourceId } });
      if (!fstd || fstd.organizationId !== data.organizationId) {
        throw new BadRequestException(`FSTD ${data.resourceId} 不属于该机构`);
      }
      if (fstd.status !== 'active') {
        throw new BadRequestException(`FSTD ${fstd.deviceCode} 当前状态为 ${fstd.status}, 不可排课`);
      }
      if (data.taskCode) {
        // 统一能力判定入口 (需求清单3.3.3 can_device_perform_task): 内部按qualificationBasisType自动分流到
        // legacy已鉴定任务清单校验, 或FCS体系的训练矩阵逐特征保真度比对, 排课引擎作为消费方无需关心具体判定逻辑。
        // 排课只要求达到T(可开始训练)即可预订; 是否达到TP(可完成训练/计入学时)留给训练记录/进度卡在结课时判断。
        const capability = await this.fstdService.canDevicePerformTask(data.resourceId, data.taskCode);
        if (!capability.canStartTraining) {
          throw new BadRequestException(`FSTD ${fstd.deviceCode} 不满足训练科目 "${data.taskCode}" 的能力要求: ${capability.reason}`);
        }
        // Training Restriction: 若该科目所需部件存在未修复的MMI缺陷, 阻止排课 (吸收FAA §60.20 Training Restriction概念)
        const blockingDiscrepancy = await this.prisma.discrepancyLog.findFirst({
          where: { fstdId: data.resourceId, isMmi: true, status: 'open' },
        });
        if (blockingDiscrepancy) {
          throw new BadRequestException(
            `FSTD ${fstd.deviceCode} 存在未修复的MMI缺陷 ("${blockingDiscrepancy.description}"), 该科目暂时受限 (Training Restriction)`,
          );
        }
      }
    }

    if (data.studentId) {
      const student = await this.prisma.student.findUnique({ where: { id: data.studentId } });
      if (!student || student.organizationId !== data.organizationId) {
        throw new BadRequestException(`Student ${data.studentId} 不属于该机构`);
      }
      if (student.medicalCertExpiry && student.medicalCertExpiry < new Date()) {
        throw new BadRequestException(
          `学员 ${student.firstName}${student.lastName} 体检证已于 ${student.medicalCertExpiry.toLocaleDateString()} 过期, 不能安排训练 (ORA.ATO.145)`,
        );
      }
    }

    if (data.resourceType === 'INSTRUCTOR') {
      const org = await this.prisma.organization.findUnique({ where: { id: data.organizationId } });
      if (!org) throw new BadRequestException(`Organization ${data.organizationId} 不存在`);
      const instructor = await this.prisma.personnel.findUnique({
        where: { id: data.resourceId },
        include: { instructorProfile: true, qualifications: true },
      });
      if (!instructor || instructor.tenantId !== org.tenantId) {
        throw new BadRequestException(`Instructor ${data.resourceId} 不属于该机构`);
      }
      if (!instructor.instructorProfile) {
        throw new BadRequestException(`${instructor.firstName}${instructor.lastName} 尚未登记为教员 (缺少教员档案)`);
      }
      const expired = instructor.qualifications.find((q) => q.validUntil && q.validUntil < new Date());
      if (expired) {
        throw new BadRequestException(
          `教员 ${instructor.firstName}${instructor.lastName} 的资质 "${expired.qualificationType}" 已于 ${expired.validUntil!.toLocaleDateString()} 过期, 不能安排训练`,
        );
      }
    }
  }

  async create(data: {
    organizationId: string;
    resourceType: BookingResourceType;
    resourceId: string;
    startAt: string;
    endAt: string;
    courseId?: string;
    studentId?: string;
    taskCode?: string;
  }) {
    const startAt = new Date(data.startAt);
    const endAt = new Date(data.endAt);
    if (startAt >= endAt) throw new BadRequestException('startAt must be before endAt');

    // organizationId 的租户归属已由全局 TenantGuard 校验
    await this.assertResourceEligible(data);
    await this.assertNoConflict(data.resourceType, data.resourceId, startAt, endAt);

    return this.prisma.booking.create({
      data: { ...data, startAt, endAt },
    });
  }

  findByResource(resourceType: BookingResourceType, resourceId: string, tenantId: string) {
    return this.prisma.booking.findMany({
      where: { resourceType, resourceId, status: 'confirmed', organization: { tenantId } },
      orderBy: { startAt: 'asc' },
    });
  }

  async cancel(id: string, tenantId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: { organization: true } });
    if (!booking || booking.organization.tenantId !== tenantId) throw new NotFoundException(`Booking ${id} not found`);
    return this.prisma.booking.update({ where: { id }, data: { status: 'cancelled' } });
  }
}
