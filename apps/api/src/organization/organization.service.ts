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

  create(tenantId: string, dto: CreateOrganizationDto) {
    return this.prisma.organization
      .create({ data: { ...dto, tenantId } })
      .then(async (org) => {
        await this.writeAuditLog(tenantId, 'Organization', org.id, 'create', null, org);
        return org;
      });
  }

  findAll(tenantId: string) {
    return this.prisma.organization.findMany({ where: { tenantId } });
  }

  /// 所有 :id 路由的统一入口: 先确认该机构确实属于调用者的租户, 否则视同不存在 (403/404都不泄露存在性时用404更保守)
  async findOne(id: string, tenantId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: { certificates: { include: { courseApprovals: true } } },
    });
    if (!org || org.tenantId !== tenantId) throw new NotFoundException(`Organization ${id} not found`);
    return org;
  }

  async update(id: string, tenantId: string, dto: UpdateOrganizationDto) {
    const before = await this.findOne(id, tenantId);
    const after = await this.prisma.organization.update({ where: { id }, data: dto });
    await this.writeAuditLog(tenantId, 'Organization', id, 'update', before, after);
    return after;
  }

  // ---- 3.1 证书管理 (EASA Form 143) ----

  async addCertificate(organizationId: string, tenantId: string, dto: CreateCertificateDto) {
    const org = await this.findOne(organizationId, tenantId);
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

  async listCertificates(organizationId: string, tenantId: string) {
    await this.findOne(organizationId, tenantId);
    return this.prisma.organizationCertificate.findMany({ where: { organizationId } });
  }

  /// certId 路由拿不到 organizationId, 需要反查证书所属机构再校验租户 (TenantGuard 覆盖不到这类路径)
  private async findCertificateOrThrow(certificateId: string, tenantId: string) {
    const cert = await this.prisma.organizationCertificate.findUnique({
      where: { id: certificateId },
      include: { organization: true },
    });
    if (!cert || cert.organization.tenantId !== tenantId) {
      throw new NotFoundException(`Certificate ${certificateId} not found`);
    }
    return cert;
  }

  private async transitionCertificate(
    certificateId: string,
    tenantId: string,
    targetStatus: CertificateStatus,
    reason: string | undefined,
    timestampField: 'suspendedAt' | 'revokedAt' | 'terminatedAt' | null,
  ) {
    const cert = await this.findCertificateOrThrow(certificateId, tenantId);

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
      tenantId,
      'OrganizationCertificate',
      certificateId,
      `status_change:${cert.status}->${targetStatus}`,
      cert,
      updated,
    );
    return updated;
  }

  suspendCertificate(certificateId: string, tenantId: string, reason?: string) {
    return this.transitionCertificate(certificateId, tenantId, CertificateStatus.SUSPENDED, reason, 'suspendedAt');
  }

  restoreCertificate(certificateId: string, tenantId: string, reason?: string) {
    return this.transitionCertificate(certificateId, tenantId, CertificateStatus.ACTIVE, reason, null);
  }

  revokeCertificate(certificateId: string, tenantId: string, reason?: string) {
    return this.transitionCertificate(certificateId, tenantId, CertificateStatus.REVOKED, reason, 'revokedAt');
  }

  terminateCertificate(certificateId: string, tenantId: string, reason?: string) {
    return this.transitionCertificate(certificateId, tenantId, CertificateStatus.TERMINATED, reason, 'terminatedAt');
  }
}
