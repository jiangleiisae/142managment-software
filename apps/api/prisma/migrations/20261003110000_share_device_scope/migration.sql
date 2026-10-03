-- 设备级分享: 每台模拟机可以有自己的公开训练计划二维码; scopeKey = fstdId 或空串(机构级)
-- AlterTable
ALTER TABLE "public_shares" ADD COLUMN "fstdId" TEXT,
ADD COLUMN "scopeKey" TEXT NOT NULL DEFAULT '';

-- DropIndex
DROP INDEX "public_shares_organizationId_type_key";

-- CreateIndex
CREATE UNIQUE INDEX "public_shares_organizationId_type_scopeKey_key" ON "public_shares"("organizationId", "type", "scopeKey");

-- AddForeignKey
ALTER TABLE "public_shares" ADD CONSTRAINT "public_shares_fstdId_fkey" FOREIGN KEY ("fstdId") REFERENCES "fstds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
