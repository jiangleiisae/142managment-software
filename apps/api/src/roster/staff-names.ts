import type { PrismaService } from '../prisma/prisma.service.js';

/// 把一批 ID 解析成姓名: 先按排班人员(StaffMember)找, 找不到再按「人员资质」的人员档案找。
/// 兜底是为了历史数据: 值班日志的工程师、检查单的执行人在引入排班人员之前存的是人员档案 ID。
export async function resolveStaffNames(prisma: PrismaService, tenantId: string, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const names = new Map<string, string>();
  if (unique.length === 0) return names;
  const staff = await prisma.staffMember.findMany({ where: { id: { in: unique }, organization: { tenantId } }, select: { id: true, name: true } });
  for (const s of staff) names.set(s.id, s.name);
  const missing = unique.filter((id) => !names.has(id));
  if (missing.length > 0) {
    const people = await prisma.personnel.findMany({ where: { tenantId, id: { in: missing } } });
    for (const p of people) names.set(p.id, `${p.lastName}${p.firstName}`.trim());
  }
  return names;
}
