-- CreateTable
CREATE TABLE "instructor_initial_trainings" (
    "id" TEXT NOT NULL,
    "instructorProfileId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "totalHours" DOUBLE PRECISION,
    "itemsJson" JSONB NOT NULL DEFAULT '[]',
    "writtenExamPassed" BOOLEAN NOT NULL DEFAULT false,
    "writtenExamDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instructor_initial_trainings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "instructor_initial_trainings_instructorProfileId_key" ON "instructor_initial_trainings"("instructorProfileId");

-- AddForeignKey
ALTER TABLE "instructor_initial_trainings" ADD CONSTRAINT "instructor_initial_trainings_instructorProfileId_fkey" FOREIGN KEY ("instructorProfileId") REFERENCES "instructor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
