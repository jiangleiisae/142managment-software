-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateTable
CREATE TABLE "quality_meetings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'ONSITE',
    "department" TEXT,
    "location" TEXT,
    "hostPersonnelId" TEXT,
    "recorderPersonnelId" TEXT,
    "attendeeIds" TEXT[],
    "topics" TEXT,
    "lastWeekReport" TEXT,
    "thisWeekTasksJson" JSONB NOT NULL DEFAULT '[]',
    "faultAnalysis" TEXT,
    "suggestions" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quality_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_trainings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "trainerName" TEXT,
    "content" TEXT,
    "attendeeIds" TEXT[],
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quality_trainings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_items" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "inspection_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "other_inspections" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "inspectedOn" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "performedByPersonnelId" TEXT,
    "itemsJson" JSONB NOT NULL,
    "overallResult" TEXT NOT NULL,
    "notes" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "other_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surveys" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "status" "SurveyStatus" NOT NULL DEFAULT 'DRAFT',
    "questionsJson" JSONB NOT NULL DEFAULT '[]',
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_responses" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT,
    "answersJson" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quality_meetings_organizationId_startAt_idx" ON "quality_meetings"("organizationId", "startAt");

-- CreateIndex
CREATE INDEX "quality_trainings_organizationId_startAt_idx" ON "quality_trainings"("organizationId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_items_organizationId_name_key" ON "inspection_items"("organizationId", "name");

-- CreateIndex
CREATE INDEX "other_inspections_organizationId_inspectedOn_idx" ON "other_inspections"("organizationId", "inspectedOn");

-- CreateIndex
CREATE INDEX "surveys_organizationId_status_idx" ON "surveys"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "survey_responses_surveyId_userId_key" ON "survey_responses"("surveyId", "userId");

-- AddForeignKey
ALTER TABLE "quality_meetings" ADD CONSTRAINT "quality_meetings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_trainings" ADD CONSTRAINT "quality_trainings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_items" ADD CONSTRAINT "inspection_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_inspections" ADD CONSTRAINT "other_inspections_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
