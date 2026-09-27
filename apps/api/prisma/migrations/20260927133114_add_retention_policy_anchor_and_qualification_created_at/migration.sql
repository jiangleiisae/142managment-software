-- AlterTable
ALTER TABLE "qualification_records" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "record_retention_policies" ADD COLUMN     "anchorEvent" TEXT NOT NULL DEFAULT 'created_at';
