// 与后端 Prisma schema (apps/api/prisma/schema.prisma) 对应的前端类型子集

export type CertificateStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'TERMINATED'

export interface Organization {
  id: string
  tenantId: string
  type: 'EASA_ATO' | 'EASA_ATO_DUAL_FAA142'
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

export interface Fstd {
  id: string
  organizationId: string
  deviceCode: string
  representedAircraft: string
  deviceType: FstdDeviceType
  status: string
  legacyLevel?: { level: LegacyLevel } | null
  qualifiedTasks?: { id: string; taskCode: string; taskName: string }[]
}

export interface Personnel {
  id: string
  tenantId: string
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  qualifications?: QualificationRecord[]
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
}
