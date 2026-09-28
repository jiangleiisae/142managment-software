-- DropForeignKey
ALTER TABLE "fstd_change_requests" DROP CONSTRAINT "fstd_change_requests_fstdId_fkey";

-- AlterTable
ALTER TABLE "change_requests" ADD COLUMN     "description" TEXT,
ADD COLUMN     "detailsJson" JSONB,
ADD COLUMN     "earliestEffectiveDate" TIMESTAMP(3),
ADD COLUMN     "minNoticeDays" INTEGER;

-- DropTable
DROP TABLE "fstd_change_requests";

