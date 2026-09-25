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

  endRoleAssignment(id: string) {
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

  /// 找出尚未上报且已临近/超过72小时时限的强制性事件 (供二期告警任务调用)
  async findOverdueOccurrenceReports() {
    const cutoff72h = new Date(Date.now() - 72 * 60 * 60 * 1000);
    return this.prisma.occurrenceReport.findMany({
      where: { isMandatory: true, reportedAt: null, discoveredAt: { lte: cutoff72h } },
    });
  }

  markOccurrenceReported(id: string, reportedTo: string) {
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

  createAuditTask(auditScheduleId: string, data: { auditorId?: string; scope: string }) {
    return this.prisma.auditTask.create({ data: { auditScheduleId, ...data } });
  }

  completeAuditTask(id: string) {
    return this.prisma.auditTask.update({ where: { id }, data: { status: 'completed', performedAt: new Date() } });
  }

  addFinding(auditTaskId: string, data: { level: number; description: string; rootCause?: string }) {
    return this.prisma.finding.create({ data: { auditTaskId, ...data } });
  }

  addCorrectiveAction(findingId: string, data: { planDescription: string; responsiblePersonnelId?: string; dueDate?: string }) {
    return this.prisma.correctiveAction.create({
      data: {
        findingId,
        planDescription: data.planDescription,
        responsiblePersonnelId: data.responsiblePersonnelId,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });
  }

  async closeCorrectiveAction(id: string) {
    const action = await this.prisma.correctiveAction.findUnique({ where: { id } });
    if (!action) throw new NotFoundException(`CorrectiveAction ${id} not found`);
    return this.prisma.correctiveAction.update({ where: { id }, data: { status: 'closed', closedAt: new Date() } });
  }
}
