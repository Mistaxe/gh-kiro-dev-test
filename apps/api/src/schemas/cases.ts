import { z } from 'zod'

/**
 * Case Management Schemas
 * 
 * Zod schemas for case-related API validation with assignment validation,
 * program-based access controls, and audit trail requirements.
 */

/**
 * Case Status Schema
 * Defines valid case statuses
 */
export const CaseStatusSchema = z.enum([
  'open',
  'active',
  'on_hold',
  'closed',
  'transferred'
])

/**
 * Program Access Level Schema
 * Defines access levels for program-based access control
 */
export const ProgramAccessLevelSchema = z.enum([
  'view',
  'write', 
  'full'
])

/**
 * Create Case Request Schema
 */
export const CreateCaseSchema = z.object({
  client_id: z.string().uuid(),
  location_id: z.string().uuid(),
  program_ids: z.array(z.string().uuid()).optional().default([]),
  assigned_user_ids: z.array(z.string().uuid()).optional().default([]),
  status: CaseStatusSchema.optional().default('open')
})

/**
 * Update Case Request Schema
 */
export const UpdateCaseSchema = z.object({
  status: CaseStatusSchema.optional(),
  program_ids: z.array(z.string().uuid()).optional(),
  assigned_user_ids: z.array(z.string().uuid()).optional()
})

/**
 * Close Case Request Schema
 */
export const CloseCaseSchema = z.object({
  reason: z.string().min(1).max(500)
})

/**
 * Case Assignment Request Schema
 */
export const CaseAssignmentSchema = z.object({
  user_ids: z.array(z.string().uuid()).min(1),
  reason: z.string().min(1).max(500)
})

/**
 * Caseload Query Schema
 */
export const CaseloadQuerySchema = z.object({
  status: CaseStatusSchema.optional(),
  program_ids: z.array(z.string().uuid()).optional(),
  location_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0)
})

/**
 * Case Details Schema (Full Access)
 */
export const CaseDetailsFullSchema = z.object({
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  location_id: z.string().uuid(),
  status: CaseStatusSchema,
  program_ids: z.array(z.string().uuid()),
  assigned_user_ids: z.array(z.string().uuid()),
  opened_at: z.string(),
  closed_at: z.string().nullable(),
  access_level: z.literal('full'),
  client_info: z.object({
    id: z.string().uuid(),
    pii_ref: z.record(z.any()).nullable(),
    flags: z.record(z.any()).nullable()
  }).nullable(),
  location_info: z.object({
    id: z.string().uuid(),
    name: z.string(),
    org_id: z.string().uuid()
  }).nullable(),
  assigned_users: z.array(z.object({
    id: z.string().uuid(),
    display_name: z.string(),
    role: z.string()
  }))
})

/**
 * Case Details Schema (Limited Access)
 */
export const CaseDetailsLimitedSchema = z.object({
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  location_id: z.string().uuid(),
  status: CaseStatusSchema,
  program_ids: z.array(z.string().uuid()),
  assigned_user_ids: z.array(z.string().uuid()),
  opened_at: z.string(),
  closed_at: z.string().nullable(),
  access_level: z.literal('limited'),
  client_info: z.object({
    id: z.string().uuid(),
    initials: z.string(),
    approximate_age: z.number().nullable()
  }).nullable(),
  location_info: z.object({
    id: z.string().uuid(),
    name: z.string(),
    org_id: z.string().uuid()
  }).nullable(),
  assigned_users: z.array(z.object({
    id: z.string().uuid(),
    display_name: z.string(),
    role: z.string()
  }))
})

/**
 * Case Details Schema (Minimal Access)
 */
export const CaseDetailsMinimalSchema = z.object({
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  location_id: z.string().uuid(),
  status: CaseStatusSchema,
  program_ids: z.array(z.string().uuid()),
  assigned_user_ids: z.array(z.string().uuid()),
  opened_at: z.string(),
  closed_at: z.string().nullable(),
  access_level: z.literal('minimal'),
  client_info: z.object({
    id: z.string().uuid(),
    initials: z.string(),
    approximate_age: z.number().nullable()
  }).nullable(),
  location_info: z.object({
    id: z.string().uuid(),
    name: z.string()
  }).nullable(),
  assigned_users: z.array(z.object({
    id: z.string().uuid(),
    display_name: z.string()
  }))
})

/**
 * Case Details Union Schema
 */
export const CaseDetailsSchema = z.union([
  CaseDetailsFullSchema,
  CaseDetailsLimitedSchema,
  CaseDetailsMinimalSchema
])

/**
 * Case Summary Schema
 */
export const CaseSummarySchema = z.object({
  id: z.string().uuid(),
  location_id: z.string().uuid(),
  status: CaseStatusSchema,
  program_ids: z.array(z.string().uuid()),
  assigned_user_ids: z.array(z.string().uuid()),
  opened_at: z.string(),
  closed_at: z.string().nullable(),
  location_info: z.object({
    id: z.string().uuid(),
    name: z.string(),
    org_id: z.string().uuid().optional()
  }).nullable(),
  access_level: z.enum(['full', 'limited', 'minimal'])
})

/**
 * Caseload Result Schema
 */
export const CaseloadResultSchema = z.object({
  cases: z.array(CaseSummarySchema),
  total_count: z.number().int(),
  has_more: z.boolean()
})

/**
 * Case Assignment History Schema
 */
export const CaseAssignmentHistorySchema = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid(),
  user_id: z.string().uuid(),
  assigned_by: z.string().uuid(),
  assigned_at: z.string(),
  unassigned_at: z.string().nullable(),
  unassigned_by: z.string().uuid().nullable(),
  reason: z.string(),
  user_info: z.object({
    display_name: z.string(),
    role: z.string()
  }).optional(),
  assigned_by_user: z.object({
    display_name: z.string()
  }).optional()
})

/**
 * Type exports for use in services and routes
 */
export type CaseStatus = z.infer<typeof CaseStatusSchema>
export type ProgramAccessLevel = z.infer<typeof ProgramAccessLevelSchema>
export type CreateCaseRequest = z.infer<typeof CreateCaseSchema>
export type UpdateCaseRequest = z.infer<typeof UpdateCaseSchema>
export type CloseCaseRequest = z.infer<typeof CloseCaseSchema>
export type CaseAssignmentRequest = z.infer<typeof CaseAssignmentSchema>
export type CaseloadQuery = z.infer<typeof CaseloadQuerySchema>
export type CaseDetailsFull = z.infer<typeof CaseDetailsFullSchema>
export type CaseDetailsLimited = z.infer<typeof CaseDetailsLimitedSchema>
export type CaseDetailsMinimal = z.infer<typeof CaseDetailsMinimalSchema>
export type CaseDetails = z.infer<typeof CaseDetailsSchema>
export type CaseSummary = z.infer<typeof CaseSummarySchema>
export type CaseloadResult = z.infer<typeof CaseloadResultSchema>
export type CaseAssignmentHistory = z.infer<typeof CaseAssignmentHistorySchema>

/**
 * Validation helpers
 */
export const validateCaseAccess = (
  context: { assigned_to_user?: boolean; shares_program?: boolean; same_location?: boolean }
): 'full' | 'limited' | 'minimal' => {
  if (context.assigned_to_user) {
    return 'full'
  } else if (context.shares_program || context.same_location) {
    return 'limited'
  } else {
    return 'minimal'
  }
}

export const validateProgramAccess = (
  userPrograms: string[],
  casePrograms: string[]
): boolean => {
  return casePrograms.some(programId => userPrograms.includes(programId))
}

export const sanitizeForAccessLevel = (
  caseData: any,
  accessLevel: 'full' | 'limited' | 'minimal',
  consentOk: boolean = false
): CaseDetails => {
  const baseCase = {
    id: caseData.id,
    client_id: caseData.client_id,
    location_id: caseData.location_id,
    status: caseData.status,
    program_ids: caseData.program_ids || [],
    assigned_user_ids: caseData.assigned_user_ids || [],
    opened_at: caseData.opened_at,
    closed_at: caseData.closed_at,
    access_level: accessLevel
  }

  if (accessLevel === 'full' && consentOk) {
    return {
      ...baseCase,
      access_level: 'full',
      client_info: caseData.client_info,
      location_info: caseData.location_info,
      assigned_users: caseData.assigned_users || []
    } as CaseDetailsFull
  } else if (accessLevel === 'limited') {
    return {
      ...baseCase,
      access_level: 'limited',
      client_info: caseData.client_info ? {
        id: caseData.client_info.id,
        initials: generateInitials(caseData.client_info.pii_ref),
        approximate_age: calculateApproximateAge(caseData.client_info.pii_ref?.dob)
      } : null,
      location_info: caseData.location_info,
      assigned_users: caseData.assigned_users || []
    } as CaseDetailsLimited
  } else {
    return {
      ...baseCase,
      access_level: 'minimal',
      client_info: caseData.client_info ? {
        id: caseData.client_info.id,
        initials: generateInitials(caseData.client_info.pii_ref),
        approximate_age: calculateApproximateAge(caseData.client_info.pii_ref?.dob)
      } : null,
      location_info: caseData.location_info ? {
        id: caseData.location_info.id,
        name: caseData.location_info.name
      } : null,
      assigned_users: (caseData.assigned_users || []).map((user: any) => ({
        id: user.id,
        display_name: user.display_name
      }))
    } as CaseDetailsMinimal
  }
}

/**
 * Helper functions
 */
function generateInitials(piiRef?: Record<string, any>): string {
  if (!piiRef?.first_name || !piiRef?.last_name) {
    return 'N/A'
  }
  return `${piiRef.first_name.charAt(0)}${piiRef.last_name.charAt(0)}`.toUpperCase()
}

function calculateApproximateAge(dob?: string): number | null {
  if (!dob) return null
  
  const birthDate = new Date(dob)
  const today = new Date()
  const age = today.getFullYear() - birthDate.getFullYear()
  
  // Round to nearest 5-year band
  return Math.floor(age / 5) * 5
}