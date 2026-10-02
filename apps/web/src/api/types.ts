// 与后端 Prisma schema (apps/api/prisma/schema.prisma) 对应的前端类型子集

export type CertificateStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'TERMINATED'

export type RegulatoryStandard = 'EASA' | 'CAAC'

export interface Organization {
  id: string
  tenantId: string
  type: 'EASA_ATO' | 'EASA_ATO_DUAL_FAA142'
  regulatoryStandard: RegulatoryStandard
  name: string
  address?: string | null
  competentAuthority?: string | null
  isComplexOrg: boolean
  complexOrgReason?: string | null
  createdAt: string
  certificates?: OrganizationCertificate[]
}

export interface OrganizationCertificate {
  id: string
  organizationId: string
  certificateNo: string
  issuedAuthority: string
  regulationBasis: string
  approvalScope: string
  status: CertificateStatus
  issuedAt: string
  suspendedAt?: string | null
  revokedAt?: string | null
  terminatedAt?: string | null
  statusReason?: string | null
}

export type FstdDeviceType = 'FFS' | 'FTD' | 'FNPT' | 'BITD'
export type LegacyLevel =
  | 'FFS_A'
  | 'FFS_B'
  | 'FFS_C'
  | 'FFS_D'
  | 'FTD_1'
  | 'FTD_2'
  | 'FNPT_I'
  | 'FNPT_II'
  | 'FNPT_II_MCC'
  | 'BITD'

export type FstdQualificationBasisType = 'EASA_LEGACY_LEVEL' | 'EASA_FCS'

export interface Fstd {
  id: string
  organizationId: string
  deviceCode: string
  representedAircraft: string
  deviceType: FstdDeviceType
  status: string
  qualificationBasisType: FstdQualificationBasisType
  isLargeAircraftPublicTransport: boolean
  legacyLevel?: { level: LegacyLevel } | null
  qualifiedTasks?: { id: string; taskCode: string; taskName: string }[]
}

export type InstructorType = 'FI' | 'TRI' | 'SFI' | 'THEORETICAL' | 'EXAMINER'

export interface InstructorInitialTrainingItem {
  item: string
  completed: boolean
}

export interface InstructorInitialTraining {
  id?: string
  instructorProfileId?: string
  completedAt?: string | null
  totalHours?: number | null
  itemsJson?: InstructorInitialTrainingItem[]
  writtenExamPassed?: boolean
  writtenExamDate?: string | null
  isComplete: boolean
}

export interface Personnel {
  id: string
  tenantId: string
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  qualifications?: QualificationRecord[]
  instructorProfile?: { instructorType: InstructorType; initialTraining?: InstructorInitialTraining | null } | null
  user?: { id: string; email: string } | null
}

export interface QualificationRecord {
  id: string
  qualificationType: string
  certificateNo?: string | null
  validUntil?: string | null
}

export type CourseType =
  | 'LAPL'
  | 'PPL'
  | 'CPL'
  | 'MPL'
  | 'ATPL'
  | 'INSTRUMENT_RATING'
  | 'TYPE_RATING'
  | 'OTHER'

export interface Course {
  id: string
  organizationId: string
  name: string
  courseType: CourseType
  isApproved: boolean
}

export interface Student {
  id: string
  organizationId: string
  firstName: string
  lastName: string
  licenceNo?: string | null
  medicalCertExpiry?: string | null
}

export type BookingResourceType = 'FSTD' | 'CLASSROOM' | 'INSTRUCTOR'

export interface Booking {
  id: string
  resourceType: BookingResourceType
  resourceId: string
  startAt: string
  endAt: string
  status: string
  studentId?: string | null
  taskCode?: string | null
  customerName?: string | null
  pilotName?: string | null
  instructorName?: string | null
  examinerName?: string | null
  trainingType?: string | null
  contactPhone?: string | null
  revenue?: string | null
  notes?: string | null
}
