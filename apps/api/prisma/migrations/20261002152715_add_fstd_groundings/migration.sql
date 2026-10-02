-- CreateTable
CREATE TABLE "fstd_groundings" (
    "id" TEXT NOT NULL,
    "fstdId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fstd_groundings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fstd_groundings_fstdId_date_key" ON "fstd_groundings"("fstdId", "date");

-- AddForeignKey
ALTER TABLE "fstd_groundings" ADD CONSTRAINT "fstd_groundings_fstdId_fkey" FOREIGN KEY ("fstdId") REFERENCES "fstds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
