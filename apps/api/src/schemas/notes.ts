/**
 * Note Management Schemas
 * 
 * JSON Schema definitions for note CRUD operations with helper vs provider
 * classification and confidential note access controls.
 */

// Create Note Request Schema
export const CreateNoteSchema = {
  type: 'object',
  properties: {
    subject_type: {
      type: 'string',
      enum: ['client', 'case', 'referral', 'service']
    },
    subject_id: {
      type: 'string',
      format: 'uuid'
    },
    title: {
      type: 'string',
      maxLength: 255
    },
    content: {
      type: 'string',
      minLength: 1,
      maxLength: 10000
    },
    classification: {
      type: 'string',
      enum: ['standard', 'confidential', 'helper_journal'],
      default: 'standard'
    },
    tags: {
      type: 'array',
      items: {
        type: 'string',
        maxLength: 50
      },
      maxItems: 10
    },
    contains_phi: {
      type: 'boolean',
      default: false
    }
  },
  required: ['subject_type', 'subject_id', 'content'],
  additionalProperties: false
} as const

// Update Note Request Schema
export const UpdateNoteSchema = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      maxLength: 255
    },
    content: {
      type: 'string',
      minLength: 1,
      maxLength: 10000
    },
    tags: {
      type: 'array',
      items: {
        type: 'string',
        maxLength: 50
      },
      maxItems: 10
    },
    contains_phi: {
      type: 'boolean'
    }
  },
  additionalProperties: false
} as const

// Search Notes Query Schema
export const SearchNotesSchema = {
  type: 'object',
  properties: {
    subject_type: {
      type: 'string',
      enum: ['client', 'case', 'referral', 'service']
    },
    subject_id: {
      type: 'string',
      format: 'uuid'
    },
    search_term: {
      type: 'string',
      maxLength: 100
    },
    tags: {
      type: 'array',
      items: {
        type: 'string',
        maxLength: 50
      },
      maxItems: 5
    },
    include_helper_journals: {
      type: 'boolean',
      default: false
    },
    classification: {
      type: 'string',
      enum: ['standard', 'confidential', 'helper_journal']
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

// Grant Note Access Request Schema
export const GrantNoteAccessSchema = {
  type: 'object',
  properties: {
    granted_to_user_id: {
      type: 'string',
      format: 'uuid'
    },
    reason: {
      type: 'string',
      minLength: 10,
      maxLength: 500
    },
    duration_hours: {
      type: 'number',
      minimum: 1,
      maximum: 168, // 1 week max
      default: 24
    }
  },
  required: ['granted_to_user_id', 'reason'],
  additionalProperties: false
} as const

// Note Response Schema
export const NoteResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    subject_type: { type: 'string' },
    subject_id: { type: 'string', format: 'uuid' },
    classification: { type: 'string' },
    is_helper_journal: { type: 'boolean' },
    title: { type: 'string', nullable: true },
    content: { type: 'string' },
    contains_phi: { type: 'boolean' },
    tags: {
      type: 'array',
      items: { type: 'string' }
    },
    author: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        display_name: { type: 'string' },
        is_helper: { type: 'boolean' }
      }
    },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' }
  }
} as const

// Search Notes Response Schema
export const SearchNotesResponseSchema = {
  type: 'object',
  properties: {
    notes: {
      type: 'array',
      items: NoteResponseSchema
    },
    total_count: { type: 'number' },
    has_more: { type: 'boolean' }
  }
} as const

// TypeScript types derived from schemas
export interface CreateNoteRequest {
  subject_type: 'client' | 'case' | 'referral' | 'service'
  subject_id: string
  title?: string
  content: string
  classification?: 'standard' | 'confidential' | 'helper_journal'
  tags?: string[]
  contains_phi?: boolean
}

export interface UpdateNoteRequest {
  title?: string
  content?: string
  tags?: string[]
  contains_phi?: boolean
}

export interface SearchNotesQuery {
  subject_type?: 'client' | 'case' | 'referral' | 'service'
  subject_id?: string
  search_term?: string
  tags?: string[]
  include_helper_journals?: boolean
  classification?: 'standard' | 'confidential' | 'helper_journal'
  limit?: number
  offset?: number
}

export interface GrantNoteAccessRequest {
  granted_to_user_id: string
  reason: string
  duration_hours?: number
}

export interface NoteResponse {
  id: string
  subject_type: string
  subject_id: string
  classification: string
  is_helper_journal: boolean
  title?: string
  content: string
  contains_phi: boolean
  tags: string[]
  author: {
    id: string
    display_name: string
    is_helper: boolean
  }
  created_at: string
  updated_at: string
}

export interface SearchNotesResponse {
  notes: NoteResponse[]
  total_count: number
  has_more: boolean
}