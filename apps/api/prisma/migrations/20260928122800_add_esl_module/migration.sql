-- CreateTable
CREATE TABLE "equipment_specification_lists" (
    "id" TEXT NOT NULL,
    "fstdId" TEXT NOT NULL,
    "revisionNumber" TEXT NOT NULL,
    "revisionDate" TIMESTAMP(3) NOT NULL,
    "declaredById" TEXT,
    "declaredAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_specification_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esl_feature_entries" (
    "id" TEXT NOT NULL,
    "eslId" TEXT NOT NULL,
    "characteristic" "FcsCharacteristic" NOT NULL,
    "fidelityLevel" "FcsFidelityLevel",
    "equipmentDescription" TEXT,
    "limitations" TEXT,

    CONSTRAINT "esl_feature_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "esl_feature_entries_eslId_characteristic_key" ON "esl_feature_entries"("eslId", "characteristic");

-- AddForeignKey
ALTER TABLE "equipment_specification_lists" ADD CONSTRAINT "equipment_specification_lists_fstdId_fkey" FOREIGN KEY ("fstdId") REFERENCES "fstds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esl_feature_entries" ADD CONSTRAINT "esl_feature_entries_eslId_fkey" FOREIGN KEY ("eslId") REFERENCES "equipment_specification_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
