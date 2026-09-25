import { Injectable, NotFoundException } from '@nestjs/common';
import { ManagementRoleType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ManagementSystemService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- 3.2.1 组织角色与任命 ----

  assignRole(data: { organizationId: string; personnelId: string; role: ManagementRoleType; startDate: string; appointmentRef?: string }) {
    return this.prisma.personnelRoleAssignment.create({
      data: {
        organizationId: data.organizationId,
        personnelId: data.personnelId,
        role: data.role,
        startDate: new Date(data.startDate),
        appointmentRef: data.appointmentRef,
      },
    });
  }

  listRoleAssignments(organizationId: string) {
    return this.prisma.personnelRoleAssignment.findMany({
      where: { organizationId, endDate: null },
      include: { personnel: true },
    });
  }

  async endRoleAssignment(id: string, tenantId: string) {
    const assignment = await this.prisma.personnelRoleAssignment.findUnique({
      where: { id },
      include: { organization: true },
    });
    if (!assignment || assignment.organization.tenantId !== tenantId) {
      throw new NotFoundException(`Role assignment ${id} not found`);
    }
    return this.prisma.personnelRoleAssignment.update({ where: { id }, data: { endDate: new Date() } });
  }

  // ---- 3.2.2 事件报告 (ORA.GEN.160), 72小时强制上报倒计时 ----

  reportOccurrence(data: {
    organizationId: string;
    discoveredAt: string;
    occurrenceType: string;
    involvedPersonnel?: string;
    involvedAircraft?: string;
    involvedFstdId?: string;
    isMandatory?: boolean;
  }) {
    return this.prisma.occurrenceReport.create({
      data: {
        organizationId: data.organizationId,
        discoveredAt: new Date(data.discoveredAt),
        occurrenceType: data.occurrenceType,
        involvedPersonnel: data.involvedPersonnel,
        involvedAircraft: data.involvedAircraft,
        involvedFstdId: data.involvedFstdId,
        isMandatory: data.isMandatory ?? true,
      },
    });
  }

  /// 找出尚未上报且已临近/超过72小时时限的强制性事件, 限定在当前租户范围内 (此前漏了租户过滤, 已修复)
  async findOverdueOccurrenceReports(tenantId: string) {
    const cutoff72h = new Date(Date.now() - 72 * 60 * 60 * 1000);
    return this.prisma.occurrenceReport.findMany({
      where: {
        isMandatory: true,
        reportedAt: null,
        discoveredAt: { lte: cutoff72h },
        organization: { tenantId },
      },
    });
  }

  async markOccurrenceReported(id: string, tenantId: string, reportedTo: string) {
    const report = await this.prisma.occurrenceReport.findUnique({ where: { id }, include: { organization: true } });
    if (!report || report.organization.tenantId !== tenantId) throw new NotFoundException(`Occurrence report ${id} not found`);
    return this.prisma.occurrenceReport.update({
      where: { id },
      data: { reportedAt: new Date(), reportedTo },
    });
  }

  // ---- 3.2.3 合规监督闭环: audit_schedule -> audit_task -> finding -> corrective_action ----

  createAuditSchedule(data: { organizationId: string; title: string; plannedAt: string; scopeTag?: string }) {
    return this.prisma.auditSchedule.create({
      data: {
        organizationId: data.organizationId,
        title: data.title,
        plannedAt: new Date(data.plannedAt),
        scopeTag: data.scopeTag,
      },
    });
  }

  listAuditSchedules(organizationId: string) {
    return this.prisma.auditSchedule.findMany({
      where: { organizationId },
      include: { tasks: { include: { findings: true } } },
    });
  }

  private async findAuditScheduleOrThrow(auditScheduleId: string, tenantId: string) {
    const schedule = await this.prisma.auditSchedule.findUnique({
      where: { id: auditScheduleId },
      include: { organization: true },
    });
    if (!schedule || schedule.organization.tenantId !== tenantId) {
      throw new NotFoundException(`Audit schedule ${auditScheduleId} not found`);
    }
    return schedule;
  }

  private async findAuditTaskOrThrow(auditTaskId: string, tenantId: string) {
    const task = await this.prisma.auditTask.findUnique({
      where: { id: auditTaskId },
      include: { auditSchedule: { include: { organization: true } } },
    });
    if (!task || task.auditSchedule.organization.tenantId !== tenantId) {
      throw new NotFoundException(`Audit task ${auditTaskId} not found`);
    }
    return task;
  }

  private async findFindingOrThrow(findingId: string, tenantId: string) {
    const finding = await this.prisma.finding.findUnique({
      where: { id: findingId },
      include: { auditTask: { include: { auditSchedule: { include: { organization: true } } } } },
    });
    if (!finding || finding.auditTask.auditSchedule.organization.tenantId !== tenantId) {
      throw new NotFoundException(`Finding ${findingId} not found`);
    }
    return finding;
  }

  async createAuditTask(auditScheduleId: string, tenantId: string, data: { auditorId?: string; scope: string }) {
    await this.findAuditScheduleOrThrow(auditScheduleId, tenantId);
    return this.prisma.auditTask.create({ data: { auditScheduleId, ...data } });
  }

  async completeAuditTask(id: string, tenantId: string) {
    await this.findAuditTaskOrThrow(id, tenantId);
    return this.prisma.auditTask.update({ where: { id }, data: { status: 'completed', performedAt: new Date() } });
  }

  async addFinding(auditTaskId: string, tenantId: string, data: { level: number; description: string; rootCause?: string }) {
    await this.findAuditTaskOrThrow(auditTaskId, tenantId);
    return this.prisma.finding.create({ data: { auditTaskId, ...data } });
  }

  async addCorrectiveAction(
    findingId: string,
    tenantId: string,
    data: { planDescription: string; responsiblePersonnelId?: string; dueDate?: string },
  ) {
    await this.findFindingOrThrow(findingId, tenantId);
    return this.prisma.correctiveAction.create({
      data: {
        findingId,
        planDescription: data.planDescription,
        responsiblePersonnelId: data.responsiblePersonnelId,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });
  }

  async closeCorrectiveAction(id: string, tenantId: string) {
    const action = await this.prisma.correctiveAction.findUnique({
      where: { id },
      include: { finding: { include: { auditTask: { include: { auditSchedule: { include: { organization: true } } } } } } },
    });
    if (!action || action.finding.auditTask.auditSchedule.organization.tenantId !== tenantId) {
      throw new NotFoundException(`CorrectiveAction ${id} not found`);
    }
    return this.prisma.correctiveAction.update({ where: { id }, data: { status: 'closed', closedAt: new Date() } });
  }
}
