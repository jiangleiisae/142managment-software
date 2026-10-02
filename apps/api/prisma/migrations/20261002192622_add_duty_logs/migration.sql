-- CreateEnum
CREATE TYPE "DutyLogStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "DutyEntryKind" AS ENUM ('ROUTINE', 'NON_ROUTINE');

-- CreateTable
CREATE TABLE "duty_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shiftTypeId" TEXT NOT NULL,
    "groupId" TEXT,
    "groupKey" TEXT NOT NULL DEFAULT '',
    "status" "DutyLogStatus" NOT NULL DEFAULT 'DRAFT',
    "engineerIds" TEXT[],
    "drSnapshotJson" JSONB,
    "createdByEmail" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "duty_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duty_entries" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "kind" "DutyEntryKind" NOT NULL DEFAULT 'ROUTINE',
    "content" TEXT NOT NULL,
    "fstdId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "duty_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duty_handovers" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fstdId" TEXT,
    "toDate" DATE NOT NULL,
    "toShiftTypeId" TEXT NOT NULL,
    "toStartAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "completedInLogId" TEXT,
    "completedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "duty_handovers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "duty_logs_organizationId_date_idx" ON "duty_logs"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "duty_logs_organizationId_date_shiftTypeId_groupKey_key" ON "duty_logs"("organizationId", "date", "shiftTypeId", "groupKey");

-- CreateIndex
CREATE INDEX "duty_entries_logId_idx" ON "duty_entries"("logId");

-- CreateIndex
CREATE INDEX "duty_handovers_logId_idx" ON "duty_handovers"("logId");

-- CreateIndex
CREATE INDEX "duty_handovers_toStartAt_idx" ON "duty_handovers"("toStartAt");

-- AddForeignKey
ALTER TABLE "duty_logs" ADD CONSTRAINT "duty_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_logs" ADD CONSTRAINT "duty_logs_shiftTypeId_fkey" FOREIGN KEY ("shiftTypeId") REFERENCES "shift_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_logs" ADD CONSTRAINT "duty_logs_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "roster_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_entries" ADD CONSTRAINT "duty_entries_logId_fkey" FOREIGN KEY ("logId") REFERENCES "duty_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_handovers" ADD CONSTRAINT "duty_handovers_logId_fkey" FOREIGN KEY ("logId") REFERENCES "duty_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_handovers" ADD CONSTRAINT "duty_handovers_toShiftTypeId_fkey" FOREIGN KEY ("toShiftTypeId") REFERENCES "shift_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
