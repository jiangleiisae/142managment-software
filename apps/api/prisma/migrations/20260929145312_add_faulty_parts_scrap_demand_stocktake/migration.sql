-- CreateEnum
CREATE TYPE "FaultyPartStatus" AS ENUM ('PENDING_DECISION', 'SENT_FOR_REPAIR', 'RETURNED_TO_SUPPLIER', 'REPAIRED_RETURNED_TO_STOCK', 'SCRAPPED');

-- CreateEnum
CREATE TYPE "ScrapRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DemandRequestStatus" AS ENUM ('PENDING', 'CONVERTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StocktakeStatus" AS ENUM ('IN_PROGRESS', 'RECONCILED');

-- CreateTable
CREATE TABLE "faulty_part_records" (
    "id" TEXT NOT NULL,
    "sparePartId" TEXT NOT NULL,
    "removedFromFstdId" TEXT,
    "relatedDiscrepancyId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "faultDescription" TEXT NOT NULL,
    "status" "FaultyPartStatus" NOT NULL DEFAULT 'PENDING_DECISION',
    "supplierId" TEXT,
    "sentAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faulty_part_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_scrap_requests" (
    "id" TEXT NOT NULL,
    "sparePartId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "requestedById" TEXT,
    "status" "ScrapRequestStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "part_scrap_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_demand_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sparePartId" TEXT,
    "partNumber" TEXT,
    "name" TEXT,
    "quantity" INTEGER NOT NULL,
    "neededBy" TIMESTAMP(3),
    "requestedById" TEXT,
    "status" "DemandRequestStatus" NOT NULL DEFAULT 'PENDING',
    "purchaseOrderId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "part_demand_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stocktake_sessions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT,
    "status" "StocktakeStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reconciledAt" TIMESTAMP(3),
    "reconciledById" TEXT,

    CONSTRAINT "stocktake_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stocktake_items" (
    "id" TEXT NOT NULL,
    "stocktakeSessionId" TEXT NOT NULL,
    "sparePartId" TEXT NOT NULL,
    "systemQuantity" INTEGER NOT NULL,
    "countedQuantity" INTEGER,
    "notes" TEXT,

    CONSTRAINT "stocktake_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stocktake_items_stocktakeSessionId_sparePartId_key" ON "stocktake_items"("stocktakeSessionId", "sparePartId");

-- AddForeignKey
ALTER TABLE "faulty_part_records" ADD CONSTRAINT "faulty_part_records_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "spare_parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faulty_part_records" ADD CONSTRAINT "faulty_part_records_removedFromFstdId_fkey" FOREIGN KEY ("removedFromFstdId") REFERENCES "fstds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faulty_part_records" ADD CONSTRAINT "faulty_part_records_relatedDiscrepancyId_fkey" FOREIGN KEY ("relatedDiscrepancyId") REFERENCES "discrepancy_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faulty_part_records" ADD CONSTRAINT "faulty_part_records_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_scrap_requests" ADD CONSTRAINT "part_scrap_requests_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "spare_parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_demand_requests" ADD CONSTRAINT "part_demand_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_demand_requests" ADD CONSTRAINT "part_demand_requests_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "spare_parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_demand_requests" ADD CONSTRAINT "part_demand_requests_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocktake_sessions" ADD CONSTRAINT "stocktake_sessions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocktake_items" ADD CONSTRAINT "stocktake_items_stocktakeSessionId_fkey" FOREIGN KEY ("stocktakeSessionId") REFERENCES "stocktake_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocktake_items" ADD CONSTRAINT "stocktake_items_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "spare_parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
