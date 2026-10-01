-- CreateTable
CREATE TABLE "fstd_pre_flight_checks" (
    "id" TEXT NOT NULL,
    "fstdId" TEXT NOT NULL,
    "checkDate" TIMESTAMP(3) NOT NULL,
    "performedById" TEXT,
    "itemsJson" JSONB NOT NULL,
    "overallResult" TEXT NOT NULL,
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fstd_pre_flight_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fstd_pre_flight_checks_fstdId_checkDate_key" ON "fstd_pre_flight_checks"("fstdId", "checkDate");

-- AddForeignKey
ALTER TABLE "fstd_pre_flight_checks" ADD CONSTRAINT "fstd_pre_flight_checks_fstdId_fkey" FOREIGN KEY ("fstdId") REFERENCES "fstds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
