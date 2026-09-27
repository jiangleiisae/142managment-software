-- CreateEnum
CREATE TYPE "MocStatus" AS ENUM ('DRAFT', 'RISK_ASSESSED', 'IMPLEMENTED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "SpiDirection" AS ENUM ('LOWER_IS_BETTER', 'HIGHER_IS_BETTER');

-- CreateTable
CREATE TABLE "safety_policies" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "policyText" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "signedById" TEXT,
    "signedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "safety_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "management_of_changes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "changeDescription" TEXT NOT NULL,
    "status" "MocStatus" NOT NULL DEFAULT 'DRAFT',
    "riskAssessmentId" TEXT,
    "implementationPlan" TEXT,
    "implementedAt" TIMESTAMP(3),
    "verificationNotes" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "management_of_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_response_plans" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "planText" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emergency_response_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_drills" (
    "id" TEXT NOT NULL,
    "erpId" TEXT NOT NULL,
    "drilledAt" TIMESTAMP(3) NOT NULL,
    "scenario" TEXT NOT NULL,
    "outcome" TEXT,
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_drills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_performance_indicators" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "direction" "SpiDirection" NOT NULL DEFAULT 'LOWER_IS_BETTER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "safety_performance_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_performance_measurements" (
    "id" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "safety_performance_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_review_board_meetings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "meetingDate" TIMESTAMP(3) NOT NULL,
    "attendeeRoles" TEXT[],
    "agenda" TEXT NOT NULL,
    "decisions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "safety_review_board_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_review_board_actions" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsiblePersonnelId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',

    CONSTRAINT "safety_review_board_actions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "safety_policies" ADD CONSTRAINT "safety_policies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_of_changes" ADD CONSTRAINT "management_of_changes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_of_changes" ADD CONSTRAINT "management_of_changes_riskAssessmentId_fkey" FOREIGN KEY ("riskAssessmentId") REFERENCES "risk_assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_response_plans" ADD CONSTRAINT "emergency_response_plans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp_drills" ADD CONSTRAINT "erp_drills_erpId_fkey" FOREIGN KEY ("erpId") REFERENCES "emergency_response_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_performance_indicators" ADD CONSTRAINT "safety_performance_indicators_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_performance_measurements" ADD CONSTRAINT "safety_performance_measurements_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "safety_performance_indicators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_review_board_meetings" ADD CONSTRAINT "safety_review_board_meetings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_review_board_actions" ADD CONSTRAINT "safety_review_board_actions_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "safety_review_board_meetings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
