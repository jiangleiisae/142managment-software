import { ChangeApprovalType, Permission } from '@prisma/client';

export interface ChangeTypeConfig {
  approvalType: ChangeApprovalType;
  minNoticeDays: number;
  label: string;
  requiredDetailFields?: string[];
}

/// 需求清单3.1 ORA.GEN.130: 事先批准类(机构名称/主要经营场所/活动范围/新增地点/负责人变更/
/// Nominated Person变更/文档变更/设施变更, 提前≥30天, 人员变更提前≥10天) vs 无需事先批准类
/// (医疗设备/FSTD技术人员/维护排班/教员名单, 记录后直接通知当局)
const ORGANIZATION_CHANGE_TYPES: Record<string, ChangeTypeConfig> = {
  NAME: { approvalType: 'PRIOR_APPROVAL', minNoticeDays: 30, label: '机构名称变更' },
  PRINCIPAL_PLACE: { approvalType: 'PRIOR_APPROVAL', minNoticeDays: 30, label: '主要经营场所变更' },
  SCOPE: { approvalType: 'PRIOR_APPROVAL', minNoticeDays: 30, label: '活动范围变更' },
  NEW_LOCATION: { approvalType: 'PRIOR_APPROVAL', minNoticeDays: 30, label: '新增地点' },
  ACCOUNTABLE_MANAGER: { approvalType: 'PRIOR_APPROVAL', minNoticeDays: 10, label: '负责人变更' },
  NOMINATED_PERSON: { approvalType: 'PRIOR_APPROVAL', minNoticeDays: 10, label: 'Nominated Person变更' },
  DOCUMENTATION: { approvalType: 'PRIOR_APPROVAL', minNoticeDays: 30, label: '文档变更' },
  FACILITY: { approvalType: 'PRIOR_APPROVAL', minNoticeDays: 30, label: '设施变更' },
  MEDICAL_EQUIPMENT: { approvalType: 'NOTIFICATION_ONLY', minNoticeDays: 0, label: '医疗设备' },
  FSTD_TECHNICIAN: { approvalType: 'NOTIFICATION_ONLY', minNoticeDays: 0, label: 'FSTD技术人员' },
  MAINTENANCE_SCHEDULE: { approvalType: 'NOTIFICATION_ONLY', minNoticeDays: 0, label: '维护排班' },
  INSTRUCTOR_LIST: { approvalType: 'NOTIFICATION_ONLY', minNoticeDays: 0, label: '教员名单' },
};

/// 需求清单3.3.6: 6类FSTD变更, 均须"提前告知主管机关"(吸收FAA 21天双方响应等待期作为默认SLA,
/// EASA条文未给出具体天数)。各类型的差异化处理规则见 change-management.service.ts 的审批前置校验。
const FSTD_CHANGE_TYPES: Record<string, ChangeTypeConfig> = {
  UPDATE: { approvalType: 'PRIOR_APPROVAL', minNoticeDays: 21, label: '一般更新 (不改变等级/FCS)' },
  UPGRADE: {
    approvalType: 'PRIOR_APPROVAL',
    minNoticeDays: 21,
    label: '升级/重新分级 (须按最新标准完整重新初始鉴定)',
    requiredDetailFields: ['newLevelOrBasis'],
  },
  MAJOR_MODIFICATION: {
    approvalType: 'PRIOR_APPROVAL',
    minNoticeDays: 21,
    label: '重大改装',
    requiredDetailFields: ['impactAssessment', 'revisedTestPlan'],
  },
  RELOCATION: {
    approvalType: 'PRIOR_APPROVAL',
    minNoticeDays: 21,
    label: '搬迁 (恢复前须完成≥1/3验证测试)',
    requiredDetailFields: ['verificationTestPercentComplete'],
  },
  DEACTIVATION: {
    approvalType: 'PRIOR_APPROVAL',
    minNoticeDays: 21,
    label: '停用',
    requiredDetailFields: ['storagePlan'],
  },
  TRANSFER: {
    approvalType: 'PRIOR_APPROVAL',
    minNoticeDays: 21,
    label: '转手',
    requiredDetailFields: ['newOperatorName'],
  },
};

export const CHANGE_TYPE_CONFIG: Record<string, Record<string, ChangeTypeConfig>> = {
  Organization: ORGANIZATION_CHANGE_TYPES,
  Fstd: FSTD_CHANGE_TYPES,
};

export const ENTITY_PERMISSION: Record<string, Permission> = {
  Organization: 'ORGANIZATION',
  Fstd: 'FSTD',
};
