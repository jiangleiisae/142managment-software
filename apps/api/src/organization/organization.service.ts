import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CertificateStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { CreateCertificateDto } from './dto/create-certificate.dto.js';

/// 允许的证书状态迁移 (需求清单 3.1 证书状态机: ORA.GEN.135 Continued Validity)
const ALLOWED_TRANSITIONS: Record<CertificateStatus, CertificateStatus[]> = {
  ACTIVE: [CertificateStatus.SUSPENDED, CertificateStatus.TERMINATED],
  SUSPENDED: [CertificateStatus.ACTIVE, CertificateStatus.REVOKED, CertificateStatus.TERMINATED],
  REVOKED: [],
  TERMINATED: [],
};

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  private async writeAuditLog(
    tenantId: string,
    entityType: string,
    entityId: string,
    action: string,
    beforeJson?: unknown,
    afterJson?: unknown,
  ) {
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        entityType,
        entityId,
        action,
        beforeJson: beforeJson as Prisma.InputJsonValue,
        afterJson: afterJson as Prisma.InputJsonValue,
      },
    });
  }

  async create(dto: CreateOrganizationDto) {
    const org = await this.prisma.organization.create({ data: dto });
    await this.writeAuditLog(dto.tenantId, 'Organization', org.id, 'create', null, org);
    return org;
  }

  findAll(tenantId: string) {
    return this.prisma.organization.findMany({ where: { tenantId } });
  }

  async findOne(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: { certificates: { include: { courseApprovals: true } } },
    });
    if (!org) throw new NotFoundException(`Organization ${id} not found`);
    return org;
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    const before = await this.findOne(id);
    const after = await this.prisma.organization.update({ where: { id }, data: dto });
    await this.writeAuditLog(before.tenantId, 'Organization', id, 'update', before, after);
    return after;
  }

  // ---- 3.1 证书管理 (EASA Form 143) ----

  async addCertificate(organizationId: string, dto: CreateCertificateDto) {
    const org = await this.findOne(organizationId);
    const cert = await this.prisma.organizationCertificate.create({
      data: {
        organizationId,
        certificateNo: dto.certificateNo,
        issuedAuthority: dto.issuedAuthority,
        regulationBasis: dto.regulationBasis,
        approvalScope: dto.approvalScope,
        issuedAt: new Date(dto.issuedAt),
        status: CertificateStatus.ACTIVE,
      },
    });
    await this.writeAuditLog(org.tenantId, 'OrganizationCertificate', cert.id, 'create', null, cert);
    return cert;
  }

  listCertificates(organizationId: string) {
    return this.prisma.organizationCertificate.findMany({ where: { organizationId } });
  }

  private async transitionCertificate(
    certificateId: string,
    targetStatus: CertificateStatus,
    reason: string | undefined,
    timestampField: 'suspendedAt' | 'revokedAt' | 'terminatedAt' | null,
  ) {
    const cert = await this.prisma.organizationCertificate.findUnique({
      where: { id: certificateId },
      include: { organization: true },
    });
    if (!cert) throw new NotFoundException(`Certificate ${certificateId} not found`);

    const allowed = ALLOWED_TRANSITIONS[cert.status];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Cannot transition certificate from ${cert.status} to ${targetStatus}`,
      );
    }

    const updated = await this.prisma.organizationCertificate.update({
      where: { id: certificateId },
      data: {
        status: targetStatus,
        statusReason: reason,
        ...(timestampField ? { [timestampField]: new Date() } : {}),
      },
    });

    await this.writeAuditLog(
      cert.organization.tenantId,
      'OrganizationCertificate',
      certificateId,
      `status_change:${cert.status}->${targetStatus}`,
      cert,
      updated,
    );
    return updated;
  }

  /// 合规监督发现问题未按期整改 -> 暂停 (ORA.GEN.150 联动)
  suspendCertificate(certificateId: string, reason?: string) {
    return this.transitionCertificate(certificateId, CertificateStatus.SUSPENDED, reason, 'suspendedAt');
  }

  /// 整改完成 -> 恢复持续有效
  restoreCertificate(certificateId: string, reason?: string) {
    return this.transitionCertificate(certificateId, CertificateStatus.ACTIVE, reason, null);
  }

  /// 整改超期 -> 吊销
  revokeCertificate(certificateId: string, reason?: string) {
    return this.transitionCertificate(certificateId, CertificateStatus.REVOKED, reason, 'revokedAt');
  }

  /// 机构主动交回 -> 终止
  terminateCertificate(certificateId: string, reason?: string) {
    return this.transitionCertificate(certificateId, CertificateStatus.TERMINATED, reason, 'terminatedAt');
  }
}
