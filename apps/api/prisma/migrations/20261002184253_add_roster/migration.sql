-- CreateEnum
CREATE TYPE "ShiftCategory" AS ENUM ('WORK', 'BUSINESS_TRIP', 'SICK_LEAVE', 'COMPENSATORY_LEAVE', 'ANNUAL_LEAVE', 'OTHER');

-- CreateTable
CREATE TABLE "shift_types" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ShiftCategory" NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "endsNextDay" BOOLEAN NOT NULL DEFAULT false,
    "restMinutes" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL,
    "generatesMaintenanceTasks" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster_groups" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roster_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster_members" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "groupId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roster_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster_entries" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shiftTypeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roster_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shift_types_organizationId_code_key" ON "shift_types"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "roster_groups_organizationId_name_key" ON "roster_groups"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "roster_members_organizationId_personnelId_key" ON "roster_members"("organizationId", "personnelId");

-- CreateIndex
CREATE INDEX "roster_entries_organizationId_date_idx" ON "roster_entries"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "roster_entries_organizationId_personnelId_date_key" ON "roster_entries"("organizationId", "personnelId", "date");

-- AddForeignKey
ALTER TABLE "shift_types" ADD CONSTRAINT "shift_types_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_groups" ADD CONSTRAINT "roster_groups_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_members" ADD CONSTRAINT "roster_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_members" ADD CONSTRAINT "roster_members_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_members" ADD CONSTRAINT "roster_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "roster_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_entries" ADD CONSTRAINT "roster_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_entries" ADD CONSTRAINT "roster_entries_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_entries" ADD CONSTRAINT "roster_entries_shiftTypeId_fkey" FOREIGN KEY ("shiftTypeId") REFERENCES "shift_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
