/**
 * Referral Management Schemas
 * 
 * JSON Schema definitions for referral CRUD operations with PHI detection,
 * consent validation, and visibility scope controls.
 */

// Create Referral Request Schema
export const CreateReferralSchema = {
  type: 'object',
  properties: {
    to_location_id: {
      type: 'string',
      format: 'uuid'
    },
    client_id: {
      type: 'string',
      format: 'uuid'
    },
    referral_type: {
      type: 'string',
      enum: ['direct', 'record_keeping'],
      default: 'direct'
    },
    title: {
      type: 'string',
      minLength: 1,
      maxLength: 255
    },
    description: {
      type: 'string',
      minLength: 1,
      maxLength: 5000
    },
    urgency: {
      type: 'string',
      enum: ['routine', 'urgent', 'emergency'],
      default: 'routine'
    },
    visibility_scope: {
      type: 'string',
      enum: ['organization', 'network', 'public'],
      default: 'organization'
    },
    consent_id: {
      type: 'string',
      format: 'uuid'
    }
  },
  required: ['to_location_id', 'title', 'description'],
  additionalProperties: false
} as const

// Update Referral Request Schema
export const UpdateReferralSchema = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      minLength: 1,
      maxLength: 255
    },
    description: {
      type: 'string',
      minLength: 1,
      maxLength: 5000
    },
    urgency: {
      type: 'string',
      enum: ['routine', 'urgent', 'emergency']
    },
    visibility_scope: {
      type: 'string',
      enum: ['organization', 'network', 'public']
    }
  },
  additionalProperties: false
} as const

// Search Referrals Query Schema
export const SearchReferralsSchema = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['pending', 'accepted', 'declined', 'completed', 'cancelled']
    },
    urgency: {
      type: 'string',
      enum: ['routine', 'urgent', 'emergency']
    },
    referral_type: {
      type: 'string',
      enum: ['direct', 'record_keeping']
    },
    from_location_id: {
      type: 'string',
      format: 'uuid'
    },
    to_location_id: {
      type: 'string',
      format: 'uuid'
    },
    search_term: {
      type: 'string',
      maxLength: 100
    },
    limit: {
      type: 'number',
      minimum: 1,
      maximum: 100,
      default: 50
    },
    offset: {
      type: 'number',
      minimum: 0,
      default: 0
    }
  },
  additionalProperties: false
} as const

// Respond to Referral Request Schema
export const RespondToReferralSchema = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['accepted', 'declined']
    },
    response_notes: {
      type: 'string',
      maxLength: 1000
    }
  },
  required: ['status'],
  additionalProperties: false
} as const

// Referral Response Schema
export const ReferralResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    from_user_id: { type: 'string', format: 'uuid' },
    from_location: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        org_id: { type: 'string', format: 'uuid' }
      }
    },
    to_location: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        org_id: { type: 'string', format: 'uuid' }
      }
    },
    client_id: { type: 'string', format: 'uuid', nullable: true },
    referral_type: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string' },
    urgency: { type: 'string' },
    contains_phi: { type: 'boolean' },
    phi_fields: {
      type: 'array',
      items: { type: 'string' }
    },
    visibility_scope: { type: 'string' },
    status: { type: 'string' },
    responded_at: { type: 'string', format: 'date-time', nullable: true },
    responded_by_user_id: { type: 'string', format: 'uuid', nullable: true },
    response_notes: { type: 'string', nullable: true },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
    from_user: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        display_name: { type: 'string' }
      }
    }
  }
} as const

// Search Referrals Response Schema
export const SearchReferralsResponseSchema = {
  type: 'object',
  properties: {
    referrals: {
      type: 'array',
      items: ReferralResponseSchema
    },
    total_count: { type: 'number' },
    has_more: { type: 'boolean' }
  }
} as const

// Service Match Response Schema
export const ServiceMatchResponseSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      service_profile_id: { type: 'string', format: 'uuid' },
      location_id: { type: 'string', format: 'uuid' },
      location_name: { type: 'string' },
      org_name: { type: 'string' },
      taxonomy_code: { type: 'string', nullable: true },
      populations: {
        type: 'array',
        items: { type: 'string' }
      },
      description: { type: 'string', nullable: true },
      match_score: { type: 'number' },
      claimed: { type: 'boolean' },
      availability: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            total: { type: 'number' },
            available: { type: 'number' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  }
} as const

// TypeScript types derived from schemas
export interface CreateReferralRequest {
  to_location_id: string
  client_id?: string
  referral_type?: 'direct' | 'record_keeping'
  title: string
  description: string
  urgency?: 'routine' | 'urgent' | 'emergency'
  visibility_scope?: 'organization' | 'network' | 'public'
  consent_id?: string
}

export interface UpdateReferralRequest {
  title?: string
  description?: string
  urgency?: 'routine' | 'urgent' | 'emergency'
  visibility_scope?: 'organization' | 'network' | 'public'
}

export interface SearchReferralsQuery {
  status?: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled'
  urgency?: 'routine' | 'urgent' | 'emergency'
  referral_type?: 'direct' | 'record_keeping'
  from_location_id?: string
  to_location_id?: string
  search_term?: string
  limit?: number
  offset?: number
}

export interface RespondToReferralRequest {
  status: 'accepted' | 'declined'
  response_notes?: string
}

export interface ReferralResponse {
  id: string
  from_user_id: string
  from_location: {
    id: string
    name: string
    org_id: string
  }
  to_location: {
    id: string
    name: string
    org_id: string
  }
  client_id?: string
  referral_type: string
  title: string
  description: string
  urgency: string
  contains_phi: boolean
  phi_fields: string[]
  visibility_scope: string
  status: string
  responded_at?: string
  responded_by_user_id?: string
  response_notes?: string
  created_at: string
  updated_at: string
  from_user: {
    id: string
    display_name: string
  }
}

export interface SearchReferralsResponse {
  referrals: ReferralResponse[]
  total_count: number
  has_more: boolean
}

export interface ServiceMatch {
  service_profile_id: string
  location_id: string
  location_name: string
  org_name: string
  taxonomy_code?: string
  populations: string[]
  description?: string
  match_score: number
  claimed: boolean
  availability: Array<{
    type: string
    total: number
    available: number
    updated_at: string
  }>
}