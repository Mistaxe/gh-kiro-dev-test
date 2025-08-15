import { z } from 'zod'

/**
 * Client Management Schemas
 * 
 * Zod schemas for client-related API validation with PHI protection
 * and consent validation requirements.
 */

/**
 * PII Reference Schema
 * Contains personally identifiable information with optional fields
 */
export const PIIRefSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD format
  ssn_last4: z.string().regex(/^\d{4}$/).optional(),
  phone: z.string().min(10).max(20).optional(),
  email: z.string().email().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional()
  }).optional()
})

/**
 * Client Flags Schema
 * Non-PHI flags for client classification and workflow
 */
export const ClientFlagsSchema = z.object({
  high_risk: z.boolean().optional(),
  requires_interpreter: z.boolean().optional(),
  preferred_language: z.string().optional(),
  mobility_assistance: z.boolean().optional(),
  emergency_contact_required: z.boolean().optional()
})

/**
 * Create Client Request Schema
 */
export const CreateClientSchema = z.object({
  pii_ref: PIIRefSchema.optional(),
  flags: ClientFlagsSchema.optional(),
  primary_location_id: z.string().uuid().optional()
})

/**
 * Update Client Request Schema
 */
export const UpdateClientSchema = z.object({
  pii_ref: z.record(z.any()).optional(), // Allow partial updates
  flags: ClientFlagsSchema.optional(),
  primary_location_id: z.string().uuid().optional()
})

/**
 * Search Clients Query Schema
 */
export const SearchClientsSchema = z.object({
  search_term: z.string().min(1).max(100).optional(),
  fingerprint: z.string().min(1).max(255).optional(),
  limit: z.number().int().min(1).max(100).default(20)
})

/**
 * Link Client Request Schema
 */
export const LinkClientSchema = z.object({
  to_org_id: z.string().uuid(),
  reason: z.string().min(1).max(500),
  consent_id: z.string().uuid().optional()
})

/**
 * Client Search Result Schema
 */
export const ClientSearchResultSchema = z.object({
  id: z.string().uuid(),
  initials: z.string(),
  approximate_age: z.number().nullable(),
  fingerprint_match: z.boolean().optional(),
  same_org: z.boolean(),
  created_at: z.string()
})

/**
 * Client Details Schema (Full Access)
 */
export const ClientDetailsFullSchema = z.object({
  id: z.string().uuid(),
  tenant_root_id: z.string().uuid(),
  owner_org_id: z.string().uuid(),
  primary_location_id: z.string().uuid().nullable(),
  pii_ref: z.record(z.any()).nullable(),
  flags: ClientFlagsSchema.nullable(),
  fingerprint: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  access_level: z.literal('full')
})

/**
 * Client Details Schema (Minimal Access)
 */
export const ClientDetailsMinimalSchema = z.object({
  id: z.string().uuid(),
  initials: z.string(),
  approximate_age: z.number().nullable(),
  fingerprint: z.string().nullable(),
  access_level: z.literal('minimal'),
  consent_required: z.boolean()
})

/**
 * Client Details Union Schema
 */
export const ClientDetailsSchema = z.union([
  ClientDetailsFullSchema,
  ClientDetailsMinimalSchema
])

/**
 * Client Link Schema
 */
export const ClientLinkSchema = z.object({
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  from_org_id: z.string().uuid(),
  to_org_id: z.string().uuid(),
  consent_id: z.string().uuid().nullable(),
  reason: z.string(),
  linked_by: z.string().uuid(),
  linked_at: z.string(),
  unlinked_at: z.string().nullable(),
  unlinked_by: z.string().uuid().nullable(),
  unlink_reason: z.string().nullable(),
  from_org: z.object({ name: z.string() }).optional(),
  to_org: z.object({ name: z.string() }).optional(),
  linked_by_user: z.object({ display_name: z.string() }).optional()
})

/**
 * Fingerprint Generation Request Schema
 */
export const GenerateFingerprintSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  region_salt: z.string().optional()
})

/**
 * Type exports for use in services and routes
 */
export type PIIRef = z.infer<typeof PIIRefSchema>
export type ClientFlags = z.infer<typeof ClientFlagsSchema>
export type CreateClientRequest = z.infer<typeof CreateClientSchema>
export type UpdateClientRequest = z.infer<typeof UpdateClientSchema>
export type SearchClientsQuery = z.infer<typeof SearchClientsSchema>
export type LinkClientRequest = z.infer<typeof LinkClientSchema>
export type ClientSearchResult = z.infer<typeof ClientSearchResultSchema>
export type ClientDetailsFull = z.infer<typeof ClientDetailsFullSchema>
export type ClientDetailsMinimal = z.infer<typeof ClientDetailsMinimalSchema>
export type ClientDetails = z.infer<typeof ClientDetailsSchema>
export type ClientLink = z.infer<typeof ClientLinkSchema>
export type GenerateFingerprintRequest = z.infer<typeof GenerateFingerprintSchema>

/**
 * Validation helpers
 */
export const validatePHIAccess = (piiRef: any): boolean => {
  if (!piiRef || typeof piiRef !== 'object') return false
  
  const phiFields = ['first_name', 'last_name', 'dob', 'ssn_last4', 'phone', 'email', 'address']
  return phiFields.some(field => piiRef[field] !== undefined)
}

export const sanitizeForMinimalAccess = (client: any): ClientDetailsMinimal => {
  const initials = client.pii_ref?.first_name && client.pii_ref?.last_name
    ? `${client.pii_ref.first_name.charAt(0)}${client.pii_ref.last_name.charAt(0)}`.toUpperCase()
    : 'N/A'
  
  const approximateAge = client.pii_ref?.dob
    ? Math.floor(new Date().getFullYear() - new Date(client.pii_ref.dob).getFullYear() / 5) * 5
    : null

  return {
    id: client.id,
    initials,
    approximate_age: approximateAge,
    fingerprint: client.fingerprint,
    access_level: 'minimal',
    consent_required: true
  }
}