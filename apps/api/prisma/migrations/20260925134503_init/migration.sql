-- CreateEnum
CREATE TYPE "ChangeApprovalType" AS ENUM ('PRIOR_APPROVAL', 'NOTIFICATION_ONLY');

-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'LOGGED', 'NOTIFIED');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('EASA_ATO', 'EASA_ATO_DUAL_FAA142');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "ManagementRoleType" AS ENUM ('ACCOUNTABLE_MANAGER', 'NOMINATED_PERSON_COMPLIANCE', 'SAFETY_MANAGER', 'COMPLIANCE_MONITORING_MANAGER', 'HEAD_OF_TRAINING', 'CFI', 'CTKI');

-- CreateEnum
CREATE TYPE "FstdQualificationBasisType" AS ENUM ('EASA_LEGACY_LEVEL', 'EASA_FCS');

-- CreateEnum
CREATE TYPE "FstdDeviceType" AS ENUM ('FFS', 'FTD', 'FNPT', 'BITD');

-- CreateEnum
CREATE TYPE "LegacyLevel" AS ENUM ('FFS_A', 'FFS_B', 'FFS_C', 'FFS_D', 'FTD_1', 'FTD_2', 'FNPT_I', 'FNPT_II', 'FNPT_II_MCC', 'BITD');

-- CreateEnum
CREATE TYPE "InstructorType" AS ENUM ('FI', 'TRI', 'SFI', 'THEORETICAL', 'EXAMINER');

-- CreateEnum
CREATE TYPE "CourseType" AS ENUM ('LAPL', 'PPL', 'CPL', 'MPL', 'ATPL', 'INSTRUMENT_RATING', 'TYPE_RATING', 'OTHER');

-- CreateEnum
CREATE TYPE "BookingResourceType" AS ENUM ('FSTD', 'CLASSROOM', 'INSTRUCTOR');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "approvalType" "ChangeApprovalType" NOT NULL,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "submittedAt" TIMESTAMP(3),
    "effectiveAt" TIMESTAMP(3),
    "authorityReply" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "record_retention_policies" (
    "id" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "retentionMonths" INTEGER,
    "basisRegulation" TEXT,
    "description" TEXT,

    CONSTRAINT "record_retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL DEFAULT 'EASA_ATO',
    "name" TEXT NOT NULL,
    "address" TEXT,
    "competentAuthority" TEXT,
    "isComplexOrg" BOOLEAN NOT NULL DEFAULT false,
    "complexOrgReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_certificates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "certificateNo" TEXT NOT NULL,
    "issuedAuthority" TEXT NOT NULL,
    "regulationBasis" TEXT NOT NULL DEFAULT 'Regulation (EU) No 1178/2011',
    "approvalScope" TEXT NOT NULL,
    "status" "CertificateStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "suspendedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "terminatedAt" TIMESTAMP(3),
    "statusReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_course_approval_attachments" (
    "id" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "approvedFstdCodes" TEXT[],
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "training_course_approval_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "isChangeApplication" BOOLEAN NOT NULL DEFAULT false,
    "proposedStartDate" TIMESTAMP(3),
    "headOfTrainingInfo" JSONB,
    "trainingSitesJson" JSONB,
    "aircraftListJson" JSONB,
    "fstdListJson" JSONB,
    "courseTypesJson" JSONB,
    "operationsManualRef" TEXT,
    "trainingManualRef" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personnel_role_assignments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "role" "ManagementRoleType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "appointmentRef" TEXT,

    CONSTRAINT "personnel_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hazard_register_entries" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "affectedArea" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hazard_register_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_assessments" (
    "id" TEXT NOT NULL,
    "hazardId" TEXT NOT NULL,
    "probabilityLevel" INTEGER NOT NULL,
    "severityLevel" INTEGER NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "existingMitigation" TEXT,
    "residualRiskLevel" INTEGER,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mitigation_actions" (
    "id" TEXT NOT NULL,
    "riskAssessmentId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsiblePersonnelId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',

    CONSTRAINT "mitigation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occurrence_reports" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "discoveredAt" TIMESTAMP(3) NOT NULL,
    "reportedAt" TIMESTAMP(3),
    "occurrenceType" TEXT NOT NULL,
    "involvedPersonnel" TEXT,
    "involvedAircraft" TEXT,
    "involvedFstdId" TEXT,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "reportedTo" TEXT,
    "followUpStatus" TEXT DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "occurrence_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_schedules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scopeTag" TEXT NOT NULL DEFAULT 'organization',
    "plannedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_tasks" (
    "id" TEXT NOT NULL,
    "auditScheduleId" TEXT NOT NULL,
    "auditorId" TEXT,
    "scope" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'planned',

    CONSTRAINT "audit_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "findings" (
    "id" TEXT NOT NULL,
    "auditTaskId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "rootCause" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corrective_actions" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "planDescription" TEXT NOT NULL,
    "responsiblePersonnelId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "corrective_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractorName" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "agreementRef" TEXT,
    "includedInAudit" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "contract_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fstds" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "deviceCode" TEXT NOT NULL,
    "serialNumber" TEXT,
    "representedAircraft" TEXT NOT NULL,
    "deviceType" "FstdDeviceType" NOT NULL,
    "qualificationBasisType" "FstdQualificationBasisType" NOT NULL DEFAULT 'EASA_LEGACY_LEVEL',
    "qualificationBasisVersion" TEXT,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fstds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fstd_legacy_levels" (
    "id" TEXT NOT NULL,
    "fstdId" TEXT NOT NULL,
    "level" "LegacyLevel" NOT NULL,

    CONSTRAINT "fstd_legacy_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fstd_qualified_tasks" (
    "id" TEXT NOT NULL,
    "fstdId" TEXT NOT NULL,
    "taskCode" TEXT NOT NULL,
    "taskName" TEXT NOT NULL,
    "requiresSpecialAuth" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "fstd_qualified_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fstd_recurrent_evaluations" (
    "id" TEXT NOT NULL,
    "fstdId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "evaluationType" TEXT NOT NULL DEFAULT 'standard',
    "result" TEXT,
    "nextDueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fstd_recurrent_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discrepancy_logs" (
    "id" TEXT NOT NULL,
    "fstdId" TEXT NOT NULL,
    "reportedById" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "isMmi" BOOLEAN NOT NULL DEFAULT false,
    "correctiveAction" TEXT,
    "correctedById" TEXT,
    "correctedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "dueDate" TIMESTAMP(3),

    CONSTRAINT "discrepancy_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fstd_change_requests" (
    "id" TEXT NOT NULL,
    "fstdId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "description" TEXT,
    "notifiedAuthorityAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fstd_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personnel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructor_profiles" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "instructorType" "InstructorType" NOT NULL,

    CONSTRAINT "instructor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qualification_records" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "qualificationType" TEXT NOT NULL,
    "certificateNo" TEXT,
    "issuingAuthority" TEXT,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),

    CONSTRAINT "qualification_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "courseType" "CourseType" NOT NULL,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_programmes" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "stagesJson" JSONB,
    "standardTasksJson" JSONB,
    "summary" TEXT,

    CONSTRAINT "training_programmes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "licenceNo" TEXT,
    "medicalCertExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_records" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "subject" TEXT NOT NULL,
    "progressNotes" TEXT,
    "testScore" TEXT,
    "assessedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "resourceType" "BookingResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "courseId" TEXT,
    "studentId" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_entityType_entityId_idx" ON "audit_logs"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "change_requests_tenantId_entityType_entityId_idx" ON "change_requests"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "record_retention_policies_documentType_key" ON "record_retention_policies"("documentType");

-- CreateIndex
CREATE UNIQUE INDEX "fstds_organizationId_deviceCode_key" ON "fstds"("organizationId", "deviceCode");

-- CreateIndex
CREATE UNIQUE INDEX "fstd_legacy_levels_fstdId_key" ON "fstd_legacy_levels"("fstdId");

-- CreateIndex
CREATE UNIQUE INDEX "instructor_profiles_personnelId_key" ON "instructor_profiles"("personnelId");

-- CreateIndex
CREATE UNIQUE INDEX "training_programmes_courseId_key" ON "training_programmes"("courseId");

-- CreateIndex
CREATE INDEX "bookings_resourceType_resourceId_startAt_idx" ON "bookings"("resourceType", "resourceId", "startAt");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_certificates" ADD CONSTRAINT "organization_certificates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_course_approval_attachments" ADD CONSTRAINT "training_course_approval_attachments_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "organization_certificates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_course_approval_attachments" ADD CONSTRAINT "training_course_approval_attachments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_records" ADD CONSTRAINT "application_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel_role_assignments" ADD CONSTRAINT "personnel_role_assignments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel_role_assignments" ADD CONSTRAINT "personnel_role_assignments_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hazard_register_entries" ADD CONSTRAINT "hazard_register_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "hazard_register_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mitigation_actions" ADD CONSTRAINT "mitigation_actions_riskAssessmentId_fkey" FOREIGN KEY ("riskAssessmentId") REFERENCES "risk_assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrence_reports" ADD CONSTRAINT "occurrence_reports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_schedules" ADD CONSTRAINT "audit_schedules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_tasks" ADD CONSTRAINT "audit_tasks_auditScheduleId_fkey" FOREIGN KEY ("auditScheduleId") REFERENCES "audit_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_auditTaskId_fkey" FOREIGN KEY ("auditTaskId") REFERENCES "audit_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_records" ADD CONSTRAINT "contract_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fstds" ADD CONSTRAINT "fstds_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fstd_legacy_levels" ADD CONSTRAINT "fstd_legacy_levels_fstdId_fkey" FOREIGN KEY ("fstdId") REFERENCES "fstds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fstd_qualified_tasks" ADD CONSTRAINT "fstd_qualified_tasks_fstdId_fkey" FOREIGN KEY ("fstdId") REFERENCES "fstds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fstd_recurrent_evaluations" ADD CONSTRAINT "fstd_recurrent_evaluations_fstdId_fkey" FOREIGN KEY ("fstdId") REFERENCES "fstds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discrepancy_logs" ADD CONSTRAINT "discrepancy_logs_fstdId_fkey" FOREIGN KEY ("fstdId") REFERENCES "fstds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fstd_change_requests" ADD CONSTRAINT "fstd_change_requests_fstdId_fkey" FOREIGN KEY ("fstdId") REFERENCES "fstds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_profiles" ADD CONSTRAINT "instructor_profiles_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qualification_records" ADD CONSTRAINT "qualification_records_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_programmes" ADD CONSTRAINT "training_programmes_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_records" ADD CONSTRAINT "training_records_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
