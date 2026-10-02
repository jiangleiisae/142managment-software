import { Injectable, NotFoundException, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/// 需求清单 3.9 保存策略表: 保存期限做成配置表而非硬编码, 应用启动时幂等写入/更新 (documentType 唯一)
const POLICY_SEED: Array<{
  documentType: string;
  retentionMonths: number | null;
  anchorEvent: string;
  basisRegulation: string;
  description: string;
}> = [
  {
    documentType: 'default_fallback',
    retentionMonths: 60,
    anchorEvent: 'created_at',
    basisRegulation: 'AMC1 ORA.GEN.220(b)(d)',
    description: '默认兜底: 未明确规定期限的任何记录, 至少保存5年',
  },
  {
    documentType: 'student_training_record',
    retentionMonths: 36,
    anchorEvent: 'enrollment_completed_at',
    basisRegulation: 'ORA.ATO.120',
    description: '学员训练记录 (含体检证到期信息): 训练全程 + 结课后3年',
  },
  {
    documentType: 'personnel_qualification_record',
    retentionMonths: 60,
    anchorEvent: 'created_at',
    basisRegulation: 'ORA.GEN.210(d)',
    description: '人员经验/资质/培训记录: 未明确期限, 按5年兜底',
  },
  {
    documentType: 'fstd_initial_qualification',
    retentionMonths: null,
    anchorEvent: 'created_at',
    basisRegulation: 'ORA.FSTD.240(a)',
    description: 'FSTD初始鉴定基础文件/证书/初评报告: 设备全生命周期保存',
  },
  {
    documentType: 'fstd_periodic_documentation',
    retentionMonths: 60,
    anchorEvent: 'created_at',
    basisRegulation: 'ORA.FSTD.240(b)',
    description: 'FSTD周期性复检文档/内部测试报告/技术日志/CMS报告/审计计划: 至少5年',
  },
  {
    documentType: 'fstd_safety_facility_check',
    retentionMonths: 60,
    anchorEvent: 'created_at',
    basisRegulation: 'ORA.FSTD.115(b)',
    description: 'FSTD安全设施年检记录: 未注明期限, 按5年兜底',
  },
  {
    documentType: 'fstd_fault_record',
    retentionMonths: 60,
    anchorEvent: 'reported_at',
    basisRegulation: 'AMC1 ORA.GEN.220(b)(d) / CCAR-60 第60.41(a)(4)条',
    description: 'FSTD故障记录 (缺陷登记及纠正措施): EASA侧未注明期限按5年兜底; CAAC要求至少保留前2年',
  },
  {
    documentType: 'compliance_monitoring_finding',
    retentionMonths: 60,
    anchorEvent: 'created_at',
    basisRegulation: 'ORA.GEN.200(a)(6)',
    description: '管理体系/合规监督记录 (发现项/纠正措施/审核记录): 未注明期限, 按5年兜底',
  },
];

/// CAAC最低保存期限 (CCAR-142第142.91条(c)款、CCAR-60第60.41条)。CAAC是在EASA基础上叠加要求而非替换,
/// 实际执行期限取"EASA策略表"与"CAAC最低要求"中较长者——目前CAAC各项最低期限均短于已配置的EASA期限, 因此不会缩短任何现有保存期限,
/// 这里的意义是在CAAC机构下明示法规依据, 并防止将来EASA策略被调低时低于CAAC底线。
const CAAC_MINIMUMS: Record<string, { months: number; basis: string; note: string }> = {
  student_training_record: { months: 24, basis: 'CCAR-142 第142.91(c)(1)条', note: '学员训练记录: 完成训练、考试或检查后至少2年' },
  personnel_qualification_record: {
    months: 24,
    basis: 'CCAR-142 第142.91(c)(2)条',
    note: '教员/检查员资质记录: 受雇期间及解雇后2年内; 系统暂无解聘日期字段, 沿用自录入起5年的兜底期限',
  },
  fstd_periodic_documentation: {
    months: 24,
    basis: 'CCAR-60 第60.41(a)(3)条',
    note: '客观测试与性能验证结果保存2年; 最近3次或2年定期鉴定结果取较长者',
  },
  fstd_fault_record: { months: 24, basis: 'CCAR-60 第60.41(a)(4)条', note: '故障记录本/系统中前2年的故障记录(缺件、故障、纠正措施及日期)' },
};

export interface RetentionStatusItem {
  documentType: string;
  description: string | null;
  basisRegulation: string | null;
  retentionMonths: number | null;
  caacMinimum?: { months: number; basis: string; note: string };
  totalCount: number;
  protectedCount: number; // 仍在强制保存期内 (或尚无法计算起算点, 如训练未结课), 禁止删除/归档
  eligibleForArchivalCount: number; // 已满最低保存期, 可以考虑归档 (非强制删除)
}

@Injectable()
export class RetentionService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    for (const policy of POLICY_SEED) {
      await this.prisma.recordRetentionPolicy.upsert({
        where: { documentType: policy.documentType },
        create: policy,
        update: policy,
      });
    }
  }

  listPolicies() {
    return this.prisma.recordRetentionPolicy.findMany({ orderBy: { documentType: 'asc' } });
  }

  async getPolicy(documentType: string) {
    const policy = await this.prisma.recordRetentionPolicy.findUnique({ where: { documentType } });
    if (!policy) throw new NotFoundException(`Retention policy for ${documentType} not configured`);
    return policy;
  }

  /// 保存期限截止日期; retentionMonths=null(永久) 或 anchorDate=null(起算点尚未发生, 如训练未结课) 均返回 null 表示"当前不可计算/禁止归档"
  computeRetentionUntil(retentionMonths: number | null, anchorDate: Date | null): Date | null {
    if (retentionMonths === null || anchorDate === null) return null;
    const until = new Date(anchorDate);
    until.setMonth(until.getMonth() + retentionMonths);
    return until;
  }

  private summarize(retentionMonths: number | null, anchorDates: Array<Date | null>): { protectedCount: number; eligibleForArchivalCount: number } {
    const now = new Date();
    let protectedCount = 0;
    let eligibleForArchivalCount = 0;
    for (const anchorDate of anchorDates) {
      const until = this.computeRetentionUntil(retentionMonths, anchorDate);
      if (until !== null && until <= now) {
        eligibleForArchivalCount++;
      } else {
        protectedCount++;
      }
    }
    return { protectedCount, eligibleForArchivalCount };
  }

  /// 合规监督仪表盘: 对每个已建模的记录类型, 统计"仍在强制保存期内"vs"已满最低保存期可归档"的数量 (3.9 跨模块基础设施)
  async getComplianceStatus(tenantId: string): Promise<RetentionStatusItem[]> {
    const policies = await this.listPolicies();
    const byType = new Map(policies.map((p) => [p.documentType, p]));
    const results: RetentionStatusItem[] = [];
    const hasCaacOrg = (await this.prisma.organization.count({ where: { tenantId, regulatoryStandard: 'CAAC' } })) > 0;

    const push = (documentType: string, anchorDates: Array<Date | null>) => {
      const policy = byType.get(documentType);
      if (!policy) return;
      const caacMinimum = hasCaacOrg ? CAAC_MINIMUMS[documentType] : undefined;
      // 取较严者; retentionMonths=null(永久)本身已最严
      const effectiveMonths =
        policy.retentionMonths === null || !caacMinimum ? policy.retentionMonths : Math.max(policy.retentionMonths, caacMinimum.months);
      const { protectedCount, eligibleForArchivalCount } = this.summarize(effectiveMonths, anchorDates);
      results.push({
        documentType,
        description: policy.description,
        basisRegulation: policy.basisRegulation,
        retentionMonths: effectiveMonths,
        caacMinimum,
        totalCount: anchorDates.length,
        protectedCount,
        eligibleForArchivalCount,
      });
    };

    const trainingRecords = await this.prisma.trainingRecord.findMany({
      where: { enrollment: { student: { organization: { tenantId } } } },
      include: { enrollment: true },
    });
    push(
      'student_training_record',
      trainingRecords.map((r) => (r.enrollment.status === 'completed' ? r.enrollment.completedAt : null)),
    );

    const qualifications = await this.prisma.qualificationRecord.findMany({
      where: { personnel: { tenantId } },
    });
    push('personnel_qualification_record', qualifications.map((q) => q.createdAt));

    const fstds = await this.prisma.fstd.findMany({ where: { organization: { tenantId } } });
    const mqtgDocs = await this.prisma.fstdQtgDocument.findMany({
      where: { fstd: { organization: { tenantId } }, documentType: 'MQTG' },
    });
    // MQTG及初始鉴定记录合并计入同一"设备全生命周期"保存策略 (ORA.FSTD.240(a))
    push('fstd_initial_qualification', [...fstds.map((f) => f.createdAt), ...mqtgDocs.map((d) => d.createdAt)]);

    const evaluations = await this.prisma.fstdRecurrentEvaluation.findMany({
      where: { fstd: { organization: { tenantId } } },
    });
    const socVdrDocs = await this.prisma.fstdQtgDocument.findMany({
      where: { fstd: { organization: { tenantId } }, documentType: { in: ['SOC', 'VDR'] } },
    });
    const quarterlyRuns = await this.prisma.fstdQtgQuarterlyRun.findMany({
      where: { fstd: { organization: { tenantId } }, completedAt: { not: null } },
    });
    // 周期性QTG运行记录/SOC/VDR/内部测试报告等均归入"FSTD周期性复检文档"5年保存策略 (ORA.FSTD.240(b))
    push('fstd_periodic_documentation', [
      ...evaluations.map((e) => e.createdAt),
      ...socVdrDocs.map((d) => d.createdAt),
      ...quarterlyRuns.map((r) => r.completedAt),
    ]);

    if (hasCaacOrg) {
      const discrepancies = await this.prisma.discrepancyLog.findMany({ where: { fstd: { organization: { tenantId } } } });
      push('fstd_fault_record', discrepancies.map((d) => d.reportedAt));
    }

    const findings = await this.prisma.finding.findMany({
      where: { auditTask: { auditSchedule: { organization: { tenantId } } } },
    });
    push('compliance_monitoring_finding', findings.map((f) => f.createdAt));

    const safetyChecks = await this.prisma.fstdSafetyFacilityCheck.findMany({
      where: { fstd: { organization: { tenantId } } },
    });
    push('fstd_safety_facility_check', safetyChecks.map((c) => c.createdAt));

    return results;
  }
}
