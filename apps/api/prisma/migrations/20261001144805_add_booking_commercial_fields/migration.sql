-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "instructorName" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "pilotName" TEXT,
ADD COLUMN     "revenue" DECIMAL(12,2);
