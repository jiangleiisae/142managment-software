-- CreateEnum
CREATE TYPE "InfoAssetCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "InfoSecurityIncidentStatus" AS ENUM ('OPEN', 'CONTAINED', 'RESOLVED');

-- CreateTable
CREATE TABLE "information_assets" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "criticality" "InfoAssetCriticality" NOT NULL DEFAULT 'MEDIUM',
    "ownerPersonnelId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "information_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "info_security_risk_assessments" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "likelihoodLevel" INTEGER NOT NULL,
    "impactLevel" INTEGER NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "existingControls" TEXT,
    "residualRiskLevel" INTEGER,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "info_security_risk_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "info_security_mitigation_actions" (
    "id" TEXT NOT NULL,
    "riskAssessmentId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsiblePersonnelId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',

    CONSTRAINT "info_security_mitigation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "info_security_incidents" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "discoveredAt" TIMESTAMP(3) NOT NULL,
    "incidentType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "affectedAssetId" TEXT,
    "severity" INTEGER NOT NULL,
    "status" "InfoSecurityIncidentStatus" NOT NULL DEFAULT 'OPEN',
    "responseActions" TEXT,
    "containedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "info_security_incidents_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "information_assets" ADD CONSTRAINT "information_assets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "info_security_risk_assessments" ADD CONSTRAINT "info_security_risk_assessments_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "information_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "info_security_mitigation_actions" ADD CONSTRAINT "info_security_mitigation_actions_riskAssessmentId_fkey" FOREIGN KEY ("riskAssessmentId") REFERENCES "info_security_risk_assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "info_security_incidents" ADD CONSTRAINT "info_security_incidents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "info_security_incidents" ADD CONSTRAINT "info_security_incidents_affectedAssetId_fkey" FOREIGN KEY ("affectedAssetId") REFERENCES "information_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
