-- CreateTable
CREATE TABLE "fstd_safety_facility_checks" (
    "id" TEXT NOT NULL,
    "fstdId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL,
    "checkedById" TEXT,
    "itemsJson" JSONB NOT NULL,
    "overallResult" TEXT NOT NULL,
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fstd_safety_facility_checks_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "fstd_safety_facility_checks" ADD CONSTRAINT "fstd_safety_facility_checks_fstdId_fkey" FOREIGN KEY ("fstdId") REFERENCES "fstds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
