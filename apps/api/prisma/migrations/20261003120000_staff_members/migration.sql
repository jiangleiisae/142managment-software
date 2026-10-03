-- 排班人员(维护人员 / 行政综合人员)独立成表, 不再引用「人员资质」的人员档案; 班次/班组按部门区分。
-- 数据迁移: 现有班表成员搬进 staff_members (id = 人员ID_机构ID, 保证同一人员在多个机构也不冲突),
-- 班表记录、值班日志的工程师、检查单的执行人里的旧人员ID改成新的排班人员ID (对不上的原样保留, 页面按人员档案兜底显示名字)。

BEGIN;

-- CreateEnum
CREATE TYPE "StaffDepartment" AS ENUM ('MAINTENANCE', 'ADMIN');

-- 班次、班组按部门区分
ALTER TABLE "shift_types" ADD COLUMN     "department" "StaffDepartment" NOT NULL DEFAULT 'MAINTENANCE';
ALTER TABLE "roster_groups" ADD COLUMN     "department" "StaffDepartment" NOT NULL DEFAULT 'MAINTENANCE';
DROP INDEX "shift_types_organizationId_code_key";
DROP INDEX "roster_groups_organizationId_name_key";
CREATE UNIQUE INDEX "shift_types_organizationId_department_code_key" ON "shift_types"("organizationId", "department", "code");
CREATE UNIQUE INDEX "roster_groups_organizationId_department_name_key" ON "roster_groups"("organizationId", "department", "name");

-- CreateTable
CREATE TABLE "staff_members" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "department" "StaffDepartment" NOT NULL,
    "name" TEXT NOT NULL,
    "employeeNo" TEXT,
    "position" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "groupId" TEXT,
    "userId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_members_userId_key" ON "staff_members"("userId");
CREATE INDEX "staff_members_organizationId_department_idx" ON "staff_members"("organizationId", "department");

-- 数据迁移 1: 现有班表成员 -> 维护人员 (登录账号只关联到该人员的第一条班表成员记录, 因为 userId 唯一)
INSERT INTO "staff_members" ("id", "organizationId", "department", "name", "groupId", "userId", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT r."personnelId" || '_' || r."organizationId",
       r."organizationId",
       'MAINTENANCE'::"StaffDepartment",
       btrim(r."lastName" || r."firstName"),
       r."groupId",
       CASE WHEN r.rn = 1 THEN (SELECT u."id" FROM "users" u WHERE u."personnelId" = r."personnelId" LIMIT 1) END,
       r."sortOrder",
       true,
       r."createdAt",
       CURRENT_TIMESTAMP
FROM (
  SELECT rm.*, p."lastName", p."firstName", row_number() OVER (PARTITION BY rm."personnelId" ORDER BY rm."createdAt") AS rn
  FROM "roster_members" rm
  JOIN "personnel" p ON p."id" = rm."personnelId"
) r;

-- 数据迁移 2: 已经被移出班表但留有历史班次的人员 -> 停用的维护人员 (历史班次保留)
INSERT INTO "staff_members" ("id", "organizationId", "department", "name", "sortOrder", "isActive", "updatedAt")
SELECT DISTINCT re."personnelId" || '_' || re."organizationId", re."organizationId", 'MAINTENANCE'::"StaffDepartment", btrim(p."lastName" || p."firstName"), 0, false, CURRENT_TIMESTAMP
FROM "roster_entries" re
JOIN "personnel" p ON p."id" = re."personnelId"
WHERE NOT EXISTS (SELECT 1 FROM "staff_members" s WHERE s."id" = re."personnelId" || '_' || re."organizationId");

-- 班表记录: personnelId -> staffId
ALTER TABLE "roster_entries" ADD COLUMN "staffId" TEXT;
UPDATE "roster_entries" SET "staffId" = "personnelId" || '_' || "organizationId";
ALTER TABLE "roster_entries" ALTER COLUMN "staffId" SET NOT NULL;
ALTER TABLE "roster_entries" DROP CONSTRAINT "roster_entries_personnelId_fkey";
DROP INDEX "roster_entries_organizationId_personnelId_date_key";
ALTER TABLE "roster_entries" DROP COLUMN "personnelId";
CREATE UNIQUE INDEX "roster_entries_organizationId_staffId_date_key" ON "roster_entries"("organizationId", "staffId", "date");

-- 值班日志的工程师、检查单的执行人: 能对上排班人员的换成新ID, 对不上的保持原样
UPDATE "duty_logs" dl
SET "engineerIds" = ARRAY(
  SELECT CASE WHEN EXISTS (SELECT 1 FROM "staff_members" s WHERE s."id" = e || '_' || dl."organizationId") THEN e || '_' || dl."organizationId" ELSE e END
  FROM unnest(dl."engineerIds") AS e
);
UPDATE "checklist_records" cr
SET "performedByPersonnelId" = cr."performedByPersonnelId" || '_' || cr."organizationId"
WHERE cr."performedByPersonnelId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "staff_members" s WHERE s."id" = cr."performedByPersonnelId" || '_' || cr."organizationId");

-- 修改历史(审计轨迹)里的班表记录: 实体ID 里的旧人员ID 换成新的排班人员ID (机构ID:人员ID:日期 -> 机构ID:人员ID_机构ID:日期)
UPDATE "audit_logs"
SET "entityId" = split_part("entityId", ':', 1) || ':' || split_part("entityId", ':', 2) || '_' || split_part("entityId", ':', 1) || ':' || split_part("entityId", ':', 3)
WHERE "entityType" = 'RosterEntry' AND position('_' in split_part("entityId", ':', 2)) = 0;

-- 旧的班表成员表
DROP TABLE "roster_members";

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "roster_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "roster_entries" ADD CONSTRAINT "roster_entries_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
