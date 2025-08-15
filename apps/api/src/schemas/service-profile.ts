import { z } from 'zod';
import { UuidSchema, PaginationQuerySchema } from './common.js';

// Population types validation
export const PopulationSchema = z.enum([
  'adults',
  'adolescents', 
  'children',
  'families',
  'seniors',
  'veterans'
]);

// Availability type validation
export const AvailabilityTypeSchema = z.enum(['beds', 'slots', 'appointments']);

// Service hours schema
export const ServiceHoursSchema = z.object({
  monday: z.object({ open: z.string(), close: z.string() }).optional(),
  tuesday: z.object({ open: z.string(), close: z.string() }).optional(),
  wednesday: z.object({ open: z.string(), close: z.string() }).optional(),
  thursday: z.object({ open: z.string(), close: z.string() }).optional(),
  friday: z.object({ open: z.string(), close: z.string() }).optional(),
  saturday: z.object({ open: z.string(), close: z.string() }).optional(),
  sunday: z.object({ open: z.string(), close: z.string() }).optional(),
  notes: z.string().optional()
}).catchall(z.any()); // Allow additional fields

// Eligibility criteria schema
export const EligibilityCriteriaSchema = z.object({
  age_min: z.number().int().min(0).max(120).optional(),
  age_max: z.number().int().min(0).max(120).optional(),
  gender: z.array(z.string()).optional(),
  insurance: z.array(z.string()).optional(),
  conditions: z.array(z.string()).optional(),
  income_max: z.number().min(0).optional(),
  geographic_area: z.array(z.string()).optional()
}).catchall(z.any()).refine(
  (data) => !data.age_min || !data.age_max || data.age_min <= data.age_max,
  { message: "age_min must be less than or equal to age_max" }
);

// Create service profile request schema
export const CreateServiceProfileSchema = z.object({
  location_id: UuidSchema,
  taxonomy_code: z.string().max(50).optional(),
  populations: z.array(PopulationSchema).default([]),
  eligibility: EligibilityCriteriaSchema.default({}),
  hours: ServiceHoursSchema.default({}),
  description: z.string().max(2000).optional()
});

// Update service profile request schema
export const UpdateServiceProfileSchema = z.object({
  taxonomy_code: z.string().max(50).optional(),
  populations: z.array(PopulationSchema).optional(),
  eligibility: EligibilityCriteriaSchema.optional(),
  hours: ServiceHoursSchema.optional(),
  description: z.string().max(2000).optional(),
  curator_notes: z.string().max(1000).optional()
});

// Service profile search query schema
export const ServiceProfileSearchSchema = z.object({
  search_term: z.string().max(200).optional(),
  populations: z.array(PopulationSchema).optional(),
  eligibility_filter: z.record(z.any()).default({}),
  claimed_only: z.boolean().optional(),
  org_id: UuidSchema.optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0)
});

// Service profile response schema
export const ServiceProfileSchema = z.object({
  id: UuidSchema,
  location_id: UuidSchema,
  taxonomy_code: z.string().nullable(),
  populations: z.array(z.string()),
  eligibility: z.record(z.any()),
  hours: z.record(z.any()),
  description: z.string().nullable(),
  claimed: z.boolean(),
  claim_owner_user_id: UuidSchema.nullable(),
  curator_notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string()
});

// Service profile with details response schema
export const ServiceProfileWithDetailsSchema = ServiceProfileSchema.extend({
  location_info: z.object({
    id: UuidSchema,
    name: z.string(),
    org_id: UuidSchema,
    claimed: z.boolean(),
    attributes: z.record(z.any())
  }),
  organization_info: z.object({
    id: UuidSchema,
    name: z.string(),
    org_type: z.string().nullable()
  }),
  claim_owner_info: z.object({
    id: UuidSchema,
    display_name: z.string().nullable(),
    email: z.string()
  }).nullable(),
  search_rank: z.number().optional()
});

// Service profile search result schema
export const ServiceProfileSearchResultSchema = z.object({
  profiles: z.array(ServiceProfileWithDetailsSchema),
  total_count: z.number(),
  has_more: z.boolean()
});

// Availability schemas
export const CreateAvailabilitySchema = z.object({
  location_id: UuidSchema,
  type: AvailabilityTypeSchema,
  attributes: z.record(z.any()).default({}),
  total: z.number().int().min(0),
  available: z.number().int().min(0)
}).refine(
  (data) => data.available <= data.total,
  { message: "available must be less than or equal to total" }
);

export const UpdateAvailabilitySchema = z.object({
  total: z.number().int().min(0).optional(),
  available: z.number().int().min(0).optional(),
  version: z.number().int().min(1) // Required for optimistic concurrency
}).refine(
  (data) => !data.total || !data.available || data.available <= data.total,
  { message: "available must be less than or equal to total" }
);

export const AvailabilitySchema = z.object({
  id: UuidSchema,
  location_id: UuidSchema,
  type: AvailabilityTypeSchema,
  attributes: z.record(z.any()),
  total: z.number(),
  available: z.number(),
  version: z.number(),
  updated_by: UuidSchema,
  updated_at: z.string(),
  created_at: z.string()
});

export const AvailabilityWithLocationSchema = AvailabilitySchema.extend({
  location_info: z.object({
    id: UuidSchema,
    name: z.string(),
    org_id: UuidSchema
  })
});

export const AvailabilitySummarySchema = z.object({
  org_id: UuidSchema,
  location_id: UuidSchema,
  location_name: z.string(),
  type: z.string(),
  total_capacity: z.number(),
  total_available: z.number(),
  availability_records: z.number(),
  last_updated: z.string()
});

// Claim service location schema
export const ClaimServiceLocationSchema = z.object({
  location_id: UuidSchema
});

// Export types
export type CreateServiceProfileRequest = z.infer<typeof CreateServiceProfileSchema>;
export type UpdateServiceProfileRequest = z.infer<typeof UpdateServiceProfileSchema>;
export type ServiceProfileSearchQuery = z.infer<typeof ServiceProfileSearchSchema>;
export type ServiceProfile = z.infer<typeof ServiceProfileSchema>;
export type ServiceProfileWithDetails = z.infer<typeof ServiceProfileWithDetailsSchema>;
export type ServiceProfileSearchResult = z.infer<typeof ServiceProfileSearchResultSchema>;
export type CreateAvailabilityRequest = z.infer<typeof CreateAvailabilitySchema>;
export type UpdateAvailabilityRequest = z.infer<typeof UpdateAvailabilitySchema>;
export type Availability = z.infer<typeof AvailabilitySchema>;
export type AvailabilityWithLocation = z.infer<typeof AvailabilityWithLocationSchema>;
export type AvailabilitySummary = z.infer<typeof AvailabilitySummarySchema>;
export type ClaimServiceLocationRequest = z.infer<typeof ClaimServiceLocationSchema>;
export type PopulationType = z.infer<typeof PopulationSchema>;
export type AvailabilityType = z.infer<typeof AvailabilityTypeSchema>;