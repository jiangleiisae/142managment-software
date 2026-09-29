-- CreateTable
CREATE TABLE "organisational_self_reviews" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "itemsJson" JSONB NOT NULL,
    "overallResult" TEXT NOT NULL,
    "notifiedAuthorityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organisational_self_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organisational_self_reviews_organizationId_year_key" ON "organisational_self_reviews"("organizationId", "year");

-- AddForeignKey
ALTER TABLE "organisational_self_reviews" ADD CONSTRAINT "organisational_self_reviews_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
