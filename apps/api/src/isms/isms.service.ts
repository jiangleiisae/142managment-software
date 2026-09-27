import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InfoAssetCriticality, InfoSecurityIncidentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class IsmsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- 3.2.4 信息资产清单 ----

  createAsset(data: {
    organizationId: string;
    name: string;
    category: string;
    criticality?: InfoAssetCriticality;
    ownerPersonnelId?: string;
    description?: string;
  }) {
    return this.prisma.informationAsset.create({ data });
  }

  listAssets(organizationId: string) {
    return this.prisma.informationAsset.findMany({
      where: { organizationId },
      include: { riskAssessments: { include: { mitigations: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findAssetOrThrow(assetId: string, tenantId: string) {
    const asset = await this.prisma.informationAsset.findUnique({ where: { id: assetId }, include: { organization: true } });
    if (!asset || asset.organization.tenantId !== tenantId) throw new NotFoundException(`Information asset ${assetId} not found`);
    return asset;
  }

  private async findRiskAssessmentOrThrow(riskAssessmentId: string, tenantId: string) {
    const assessment = await this.prisma.infoSecurityRiskAssessment.findUnique({
      where: { id: riskAssessmentId },
      include: { asset: { include: { organization: true } } },
    });
    if (!assessment || assessment.asset.organization.tenantId !== tenantId) {
      throw new NotFoundException(`Info security risk assessment ${riskAssessmentId} not found`);
    }
    return assessment;
  }

  // ---- 信息安全风险评估: 复用SMS风险矩阵模式 (概率x影响) ----

  async assessRisk(
    assetId: string,
    tenantId: string,
    data: { likelihoodLevel: number; impactLevel: number; existingControls?: string; residualRiskLevel?: number },
  ) {
    await this.findAssetOrThrow(assetId, tenantId);
    if (data.likelihoodLevel < 1 || data.likelihoodLevel > 5 || data.impactLevel < 1 || data.impactLevel > 5) {
      throw new BadRequestException('likelihoodLevel 和 impactLevel 必须在 1-5 之间');
    }
    return this.prisma.infoSecurityRiskAssessment.create({
      data: {
        assetId,
        likelihoodLevel: data.likelihoodLevel,
        impactLevel: data.impactLevel,
        riskScore: data.likelihoodLevel * data.impactLevel,
        existingControls: data.existingControls,
        residualRiskLevel: data.residualRiskLevel,
      },
    });
  }

  async addMitigationAction(
    riskAssessmentId: string,
    tenantId: string,
    data: { description: string; responsiblePersonnelId?: string; dueDate?: string },
  ) {
    await this.findRiskAssessmentOrThrow(riskAssessmentId, tenantId);
    return this.prisma.infoSecurityMitigationAction.create({
      data: {
        riskAssessmentId,
        description: data.description,
        responsiblePersonnelId: data.responsiblePersonnelId,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });
  }

  async closeMitigationAction(id: string, tenantId: string) {
    const action = await this.prisma.infoSecurityMitigationAction.findUnique({
      where: { id },
      include: { riskAssessment: { include: { asset: { include: { organization: true } } } } },
    });
    if (!action || action.riskAssessment.asset.organization.tenantId !== tenantId) {
      throw new NotFoundException(`Mitigation action ${id} not found`);
    }
    return this.prisma.infoSecurityMitigationAction.update({ where: { id }, data: { status: 'closed' } });
  }

  /// 高风险(评分>=阈值)且尚未完全缓解的信息安全风险 (含"零缓解措施"这种最紧急情况, 与SMS的listOpenHighRisks同一判定逻辑)
  async listOpenHighRisks(tenantId: string, riskScoreThreshold = 12) {
    return this.prisma.infoSecurityRiskAssessment.findMany({
      where: {
        riskScore: { gte: riskScoreThreshold },
        asset: { organization: { tenantId } },
        OR: [{ mitigations: { none: {} } }, { mitigations: { some: { status: { not: 'closed' } } } }],
      },
      include: { asset: true, mitigations: true },
    });
  }

  // ---- 3.2.4 信息安全事件响应: OPEN -> CONTAINED -> RESOLVED ----

  reportIncident(data: {
    organizationId: string;
    discoveredAt: string;
    incidentType: string;
    description: string;
    affectedAssetId?: string;
    severity: number;
  }) {
    if (data.severity < 1 || data.severity > 5) {
      throw new BadRequestException('severity 必须在 1-5 之间');
    }
    return this.prisma.infoSecurityIncident.create({
      data: {
        organizationId: data.organizationId,
        discoveredAt: new Date(data.discoveredAt),
        incidentType: data.incidentType,
        description: data.description,
        affectedAssetId: data.affectedAssetId,
        severity: data.severity,
      },
    });
  }

  listIncidents(organizationId: string) {
    return this.prisma.infoSecurityIncident.findMany({
      where: { organizationId },
      include: { affectedAsset: true },
      orderBy: { discoveredAt: 'desc' },
    });
  }

  private async findIncidentOrThrow(id: string, tenantId: string) {
    const incident = await this.prisma.infoSecurityIncident.findUnique({ where: { id }, include: { organization: true } });
    if (!incident || incident.organization.tenantId !== tenantId) throw new NotFoundException(`Incident ${id} not found`);
    return incident;
  }

  /// 遏制先于解决 (NIST事件响应流程): 只能从OPEN进入CONTAINED, 只能从CONTAINED进入RESOLVED
  async containIncident(id: string, tenantId: string, responseActions: string) {
    const incident = await this.findIncidentOrThrow(id, tenantId);
    if (incident.status !== InfoSecurityIncidentStatus.OPEN) {
      throw new BadRequestException(`Cannot contain incident from status ${incident.status}`);
    }
    return this.prisma.infoSecurityIncident.update({
      where: { id },
      data: { status: InfoSecurityIncidentStatus.CONTAINED, responseActions, containedAt: new Date() },
    });
  }

  async resolveIncident(id: string, tenantId: string) {
    const incident = await this.findIncidentOrThrow(id, tenantId);
    if (incident.status !== InfoSecurityIncidentStatus.CONTAINED) {
      throw new BadRequestException(`Cannot resolve incident from status ${incident.status}: must be contained first`);
    }
    return this.prisma.infoSecurityIncident.update({
      where: { id },
      data: { status: InfoSecurityIncidentStatus.RESOLVED, resolvedAt: new Date() },
    });
  }

  /// 全租户范围内尚未解决的事件, 按严重度降序 (仪表盘告警)
  async listOpenIncidents(tenantId: string) {
    return this.prisma.infoSecurityIncident.findMany({
      where: { organization: { tenantId }, status: { not: InfoSecurityIncidentStatus.RESOLVED } },
      include: { affectedAsset: true },
      orderBy: [{ severity: 'desc' }, { discoveredAt: 'asc' }],
    });
  }
}
