-- CreateEnum
CREATE TYPE "ShareType" AS ENUM ('TRAINING_PLAN', 'ROSTER');

-- CreateTable
CREATE TABLE "public_shares" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "ShareType" NOT NULL,
    "token" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),

    CONSTRAINT "public_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "public_shares_token_key" ON "public_shares"("token");

-- CreateIndex
CREATE UNIQUE INDEX "public_shares_organizationId_type_key" ON "public_shares"("organizationId", "type");

-- AddForeignKey
ALTER TABLE "public_shares" ADD CONSTRAINT "public_shares_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
