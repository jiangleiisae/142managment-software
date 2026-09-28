-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('ORGANIZATION', 'MANAGEMENT_SYSTEM', 'FSTD', 'INVENTORY', 'PERSONNEL', 'COURSES', 'STUDENTS', 'SCHEDULING', 'ISMS');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "permissions" "Permission"[];
