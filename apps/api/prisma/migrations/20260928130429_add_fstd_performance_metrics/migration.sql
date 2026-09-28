-- CreateTable
CREATE TABLE "fstd_performance_metrics" (
    "id" TEXT NOT NULL,
    "fstdId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "plannedAvailableHours" DOUBLE PRECISION NOT NULL,
    "scheduledTrainingHours" DOUBLE PRECISION NOT NULL,
    "supportHours" DOUBLE PRECISION NOT NULL,
    "fstdFailureHours" DOUBLE PRECISION NOT NULL,
    "externalFailureHours" DOUBLE PRECISION NOT NULL,
    "lostTrainingHours" DOUBLE PRECISION NOT NULL,
    "discrepancyCount" INTEGER NOT NULL,
    "interruptionCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fstd_performance_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fstd_performance_metrics_fstdId_year_month_key" ON "fstd_performance_metrics"("fstdId", "year", "month");

-- AddForeignKey
ALTER TABLE "fstd_performance_metrics" ADD CONSTRAINT "fstd_performance_metrics_fstdId_fkey" FOREIGN KEY ("fstdId") REFERENCES "fstds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
