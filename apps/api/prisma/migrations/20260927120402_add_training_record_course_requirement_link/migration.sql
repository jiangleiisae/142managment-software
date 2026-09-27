-- AlterTable
ALTER TABLE "training_records" ADD COLUMN     "courseRequirementId" TEXT;

-- AddForeignKey
ALTER TABLE "training_records" ADD CONSTRAINT "training_records_courseRequirementId_fkey" FOREIGN KEY ("courseRequirementId") REFERENCES "course_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
