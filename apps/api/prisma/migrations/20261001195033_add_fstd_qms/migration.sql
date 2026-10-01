-- AlterTable
ALTER TABLE "fstds" ADD COLUMN     "isLargeAircraftPublicTransport" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "fstd_qms" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "establishedAt" TIMESTAMP(3),
    "designatedManagerName" TEXT,
    "itemsJson" JSONB NOT NULL DEFAULT '[]',
    "lastInternalAuditAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fstd_qms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fstd_qms_organizationId_key" ON "fstd_qms"("organizationId");

-- AddForeignKey
ALTER TABLE "fstd_qms" ADD CONSTRAINT "fstd_qms_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
