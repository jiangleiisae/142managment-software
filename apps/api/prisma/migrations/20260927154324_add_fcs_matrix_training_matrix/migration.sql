-- CreateEnum
CREATE TYPE "FcsCharacteristic" AS ENUM ('FDK', 'CLH', 'CLO', 'SYS', 'GND', 'IGE', 'OGE', 'SND', 'VIB', 'MTN', 'VIS', 'NAV', 'ATM', 'OST');

-- CreateEnum
CREATE TYPE "FcsFidelityLevel" AS ENUM ('N', 'G', 'R', 'S');

-- CreateTable
CREATE TABLE "fstd_fcs_capabilities" (
    "id" TEXT NOT NULL,
    "fstdId" TEXT NOT NULL,
    "characteristic" "FcsCharacteristic" NOT NULL,
    "fidelityLevel" "FcsFidelityLevel" NOT NULL,
    "subsystem" TEXT,
    "isAssigned" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "fstd_fcs_capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_matrix_entries" (
    "id" TEXT NOT NULL,
    "taskCode" TEXT NOT NULL,
    "taskName" TEXT NOT NULL,
    "characteristic" "FcsCharacteristic" NOT NULL,
    "thresholdT" "FcsFidelityLevel" NOT NULL,
    "thresholdTP" "FcsFidelityLevel" NOT NULL,

    CONSTRAINT "training_matrix_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fstd_fcs_capabilities_fstdId_characteristic_subsystem_key" ON "fstd_fcs_capabilities"("fstdId", "characteristic", "subsystem");

-- CreateIndex
CREATE UNIQUE INDEX "training_matrix_entries_taskCode_characteristic_key" ON "training_matrix_entries"("taskCode", "characteristic");

-- AddForeignKey
ALTER TABLE "fstd_fcs_capabilities" ADD CONSTRAINT "fstd_fcs_capabilities_fstdId_fkey" FOREIGN KEY ("fstdId") REFERENCES "fstds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
