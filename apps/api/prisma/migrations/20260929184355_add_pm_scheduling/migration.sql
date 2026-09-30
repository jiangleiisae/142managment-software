-- CreateEnum
CREATE TYPE "PmCheckLevel" AS ENUM ('WEEKLY', 'MONTHLY', 'SEMI_ANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "PmTaskStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "pm_checklist_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "level" "PmCheckLevel" NOT NULL,
    "itemsJson" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pm_checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pm_tasks" (
    "id" TEXT NOT NULL,
    "fstdId" TEXT NOT NULL,
    "checklistTemplateId" TEXT NOT NULL,
    "level" "PmCheckLevel" NOT NULL,
    "taskDate" TIMESTAMP(3) NOT NULL,
    "performedById" TEXT,
    "responsibleIds" TEXT[],
    "itemResultsJson" JSONB NOT NULL,
    "status" "PmTaskStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pm_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pm_checklist_templates_organizationId_level_key" ON "pm_checklist_templates"("organizationId", "level");

-- AddForeignKey
ALTER TABLE "pm_checklist_templates" ADD CONSTRAINT "pm_checklist_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pm_tasks" ADD CONSTRAINT "pm_tasks_fstdId_fkey" FOREIGN KEY ("fstdId") REFERENCES "fstds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pm_tasks" ADD CONSTRAINT "pm_tasks_checklistTemplateId_fkey" FOREIGN KEY ("checklistTemplateId") REFERENCES "pm_checklist_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
