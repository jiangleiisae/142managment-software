-- AlterEnum
ALTER TYPE "FstdQualificationBasisType" ADD VALUE 'CCAR_60';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LegacyLevel" ADD VALUE 'FTD_3';
ALTER TYPE "LegacyLevel" ADD VALUE 'FTD_4';
ALTER TYPE "LegacyLevel" ADD VALUE 'FTD_5';
ALTER TYPE "LegacyLevel" ADD VALUE 'FTD_6';
ALTER TYPE "LegacyLevel" ADD VALUE 'FTD_7';
