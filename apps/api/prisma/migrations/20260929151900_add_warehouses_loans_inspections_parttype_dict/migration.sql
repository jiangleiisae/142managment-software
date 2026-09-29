-- CreateEnum
CREATE TYPE "WarehouseType" AS ENUM ('OWN', 'CONSIGNMENT', 'THIRD_PARTY_MANAGED');

-- AlterTable
ALTER TABLE "part_movements" ADD COLUMN     "usageLocation" TEXT,
ADD COLUMN     "warehouseId" TEXT;

-- AlterTable (safe cast: preserve existing partCategory values instead of drop+recreate)
ALTER TABLE "spare_parts" ADD COLUMN     "inspectionIntervalMonths" INTEGER,
ADD COLUMN     "requiresInspection" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "spare_parts" ALTER COLUMN "partCategory" DROP DEFAULT;
ALTER TABLE "spare_parts" ALTER COLUMN "partCategory" TYPE TEXT USING ("partCategory"::TEXT);
ALTER TABLE "spare_parts" ALTER COLUMN "partCategory" SET DEFAULT 'CONSUMABLE';

-- DropEnum
DROP TYPE "PartCategory";

-- CreateTable
CREATE TABLE "part_type_configs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "part_type_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WarehouseType" NOT NULL DEFAULT 'OWN',
    "externalPartyInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_stocks" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "sparePartId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "warehouse_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_loans" (
    "id" TEXT NOT NULL,
    "sparePartId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "borrowerInfo" TEXT NOT NULL,
    "purposeNote" TEXT,
    "loanedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "loanMovementId" TEXT,
    "returnMovementId" TEXT,

    CONSTRAINT "part_loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_inspection_records" (
    "id" TEXT NOT NULL,
    "sparePartId" TEXT NOT NULL,
    "inspectedAt" TIMESTAMP(3) NOT NULL,
    "result" TEXT NOT NULL DEFAULT 'pass',
    "inspectorId" TEXT,
    "nextDueDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "part_inspection_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "part_type_configs_organizationId_code_key" ON "part_type_configs"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_organizationId_name_key" ON "warehouses"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_stocks_warehouseId_sparePartId_key" ON "warehouse_stocks"("warehouseId", "sparePartId");

-- CreateIndex
CREATE UNIQUE INDEX "part_loans_loanMovementId_key" ON "part_loans"("loanMovementId");

-- CreateIndex
CREATE UNIQUE INDEX "part_loans_returnMovementId_key" ON "part_loans"("returnMovementId");

-- AddForeignKey
ALTER TABLE "part_type_configs" ADD CONSTRAINT "part_type_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_stocks" ADD CONSTRAINT "warehouse_stocks_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_stocks" ADD CONSTRAINT "warehouse_stocks_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "spare_parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_loans" ADD CONSTRAINT "part_loans_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "spare_parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_loans" ADD CONSTRAINT "part_loans_loanMovementId_fkey" FOREIGN KEY ("loanMovementId") REFERENCES "part_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_loans" ADD CONSTRAINT "part_loans_returnMovementId_fkey" FOREIGN KEY ("returnMovementId") REFERENCES "part_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_inspection_records" ADD CONSTRAINT "part_inspection_records_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "spare_parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_movements" ADD CONSTRAINT "part_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
