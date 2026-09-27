-- CreateEnum
CREATE TYPE "QtgDocumentType" AS ENUM ('SOC', 'VDR', 'MQTG');

-- CreateTable
CREATE TABLE "fstd_qtg_documents" (
    "id" TEXT NOT NULL,
    "fstdId" TEXT NOT NULL,
    "documentType" "QtgDocumentType" NOT NULL,
    "version" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "pointerUrl" TEXT,
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fstd_qtg_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fstd_qtg_quarterly_runs" (
    "id" TEXT NOT NULL,
    "fstdId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3),
    "result" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fstd_qtg_quarterly_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fstd_qtg_quarterly_runs_fstdId_year_quarter_key" ON "fstd_qtg_quarterly_runs"("fstdId", "year", "quarter");

-- AddForeignKey
ALTER TABLE "fstd_qtg_documents" ADD CONSTRAINT "fstd_qtg_documents_fstdId_fkey" FOREIGN KEY ("fstdId") REFERENCES "fstds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fstd_qtg_quarterly_runs" ADD CONSTRAINT "fstd_qtg_quarterly_runs_fstdId_fkey" FOREIGN KEY ("fstdId") REFERENCES "fstds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
