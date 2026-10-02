-- CreateEnum
CREATE TYPE "ChecklistType" AS ENUM ('PRE_FLIGHT', 'POST_FLIGHT');

-- CreateTable
CREATE TABLE "checklist_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fstdId" TEXT NOT NULL,
    "type" "ChecklistType" NOT NULL,
    "itemsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fstdId" TEXT NOT NULL,
    "type" "ChecklistType" NOT NULL,
    "date" DATE NOT NULL,
    "shiftTypeId" TEXT NOT NULL,
    "performedByPersonnelId" TEXT,
    "performedByEmail" TEXT,
    "itemsJson" JSONB NOT NULL,
    "overallResult" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "checklist_templates_fstdId_type_key" ON "checklist_templates"("fstdId", "type");

-- CreateIndex
CREATE INDEX "checklist_records_organizationId_date_idx" ON "checklist_records"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_records_fstdId_type_date_shiftTypeId_key" ON "checklist_records"("fstdId", "type", "date", "shiftTypeId");

-- AddForeignKey
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_fstdId_fkey" FOREIGN KEY ("fstdId") REFERENCES "fstds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_records" ADD CONSTRAINT "checklist_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_records" ADD CONSTRAINT "checklist_records_fstdId_fkey" FOREIGN KEY ("fstdId") REFERENCES "fstds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_records" ADD CONSTRAINT "checklist_records_shiftTypeId_fkey" FOREIGN KEY ("shiftTypeId") REFERENCES "shift_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
