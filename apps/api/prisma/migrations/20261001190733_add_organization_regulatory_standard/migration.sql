-- CreateEnum
CREATE TYPE "RegulatoryStandard" AS ENUM ('EASA', 'CAAC');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "regulatoryStandard" "RegulatoryStandard" NOT NULL DEFAULT 'EASA';
