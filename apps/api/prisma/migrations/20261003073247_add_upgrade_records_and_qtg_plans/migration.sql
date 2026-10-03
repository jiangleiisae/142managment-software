-- CreateEnum
CREATE TYPE "UpgradeCategory" AS ENUM ('MODEL_UPGRADE', 'SUBSYSTEM_UPGRADE', 'INSTRUMENT_CALIBRATION', 'DATABASE_UPDATE');

-- CreateTable
CREATE TABLE "fstd_upgrade_records" (
    "id" TEXT NOT NULL,
    "fstdId" TEXT NOT NULL,
    "category" "UpgradeCategory" NOT NULL,
    "performedOn" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "subsystem" TEXT,
    "versionFrom" TEXT,
    "versionTo" TEXT,
    "performedByPersonnelId" TEXT,
    "performedByName" TEXT,
    "result" TEXT NOT NULL DEFAULT 'pass',
    "nextDueDate" DATE,
    "isModification" BOOLEAN NOT NULL DEFAULT false,
    "caacReportRef" TEXT,
    "caacReportedOn" DATE,
    "notes" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fstd_upgrade_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fstd_qtg_plans" (
    "id" TEXT NOT NULL,
    "fstdId" TEXT NOT NULL,
    "quarter" INTEGER NOT NULL,
    "windowStart" TEXT NOT NULL,
    "windowEnd" TEXT NOT NULL,
    "responsibleIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fstd_qtg_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fstd_upgrade_records_fstdId_performedOn_idx" ON "fstd_upgrade_records"("fstdId", "performedOn");

-- CreateIndex
CREATE UNIQUE INDEX "fstd_qtg_plans_fstdId_quarter_key" ON "fstd_qtg_plans"("fstdId", "quarter");

-- AddForeignKey
ALTER TABLE "fstd_upgrade_records" ADD CONSTRAINT "fstd_upgrade_records_fstdId_fkey" FOREIGN KEY ("fstdId") REFERENCES "fstds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fstd_qtg_plans" ADD CONSTRAINT "fstd_qtg_plans_fstdId_fkey" FOREIGN KEY ("fstdId") REFERENCES "fstds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
