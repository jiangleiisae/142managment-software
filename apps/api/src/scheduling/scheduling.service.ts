import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingResourceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SchedulingService {
  constructor(private readonly prisma: PrismaService) {}

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

  async create(data: {
    organizationId: string;
    resourceType: BookingResourceType;
    resourceId: string;
    startAt: string;
    endAt: string;
    courseId?: string;
    studentId?: string;
  }) {
    const startAt = new Date(data.startAt);
    const endAt = new Date(data.endAt);
    if (startAt >= endAt) throw new BadRequestException('startAt must be before endAt');

    // organizationId 的租户归属已由全局 TenantGuard 校验
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
