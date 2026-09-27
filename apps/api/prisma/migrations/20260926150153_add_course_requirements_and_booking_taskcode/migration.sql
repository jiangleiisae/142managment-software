-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "taskCode" TEXT;

-- CreateTable
CREATE TABLE "course_requirements" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "taskCode" TEXT NOT NULL,
    "taskName" TEXT NOT NULL,
    "minHours" DOUBLE PRECISION,

    CONSTRAINT "course_requirements_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "course_requirements" ADD CONSTRAINT "course_requirements_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
