-- CreateEnum
CREATE TYPE "RetentionCategory" AS ENUM ('CATEGORY_I', 'CATEGORY_II', 'CATEGORY_III');

-- CreateEnum
CREATE TYPE "PartCategory" AS ENUM ('CONSUMABLE', 'ROTABLE');

-- AlterTable
ALTER TABLE "discrepancy_logs" ADD COLUMN     "retentionApprovedAt" TIMESTAMP(3),
ADD COLUMN     "retentionApprovedById" TEXT,
ADD COLUMN     "retentionCategory" "RetentionCategory",
ADD COLUMN     "retentionExpiresAt" TIMESTAMP(3),
ADD COLUMN     "retentionJustification" TEXT;

-- AlterTable
ALTER TABLE "spare_parts" ADD COLUMN     "partCategory" "PartCategory" NOT NULL DEFAULT 'CONSUMABLE';

-- AddForeignKey
ALTER TABLE "part_movements" ADD CONSTRAINT "part_movements_relatedDiscrepancyId_fkey" FOREIGN KEY ("relatedDiscrepancyId") REFERENCES "discrepancy_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
