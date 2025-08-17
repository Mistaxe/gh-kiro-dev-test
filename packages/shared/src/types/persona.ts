/**
 * Persona Management Types
 * 
 * Types for managing test personas in the Lab environment
 */

export interface RoleAssignment {
  id: string
  role: string
  scope_type: 'global' | 'region' | 'network' | 'org' | 'location'
  scope_id: string
  scope_name?: string
  expires_at?: string
  source?: string
  metadata?: Record<string, any>
}

export interface Organization {
  id: string
  name: string
  org_type?: string
  dba?: string
  tenant_root_id: string
  region_id?: string
  region_name?: string
}

export interface ServiceLocation {
  id: string
  name: string
  org_id: string
  org_name?: string
  claimed: boolean
  claim_owner_user_id?: string
}

export interface Persona {
  id: string
  auth_user_id: string
  email: string
  display_name?: string
  phone?: string
  is_helper: boolean
  roles: RoleAssignment[]
  organizations: Organization[]
  locations: ServiceLocation[]
  created_at: string
  updated_at: string
}

export interface PersonaSession {
  persona_id: string
  active_org_id?: string
  active_location_id?: string
  purpose?: 'care' | 'billing' | 'QA' | 'oversight' | 'research'
  break_glass?: boolean
  break_glass_expires_at?: string
  session_started_at: string
}

export interface PersonaListResponse {
  personas: Persona[]
  total: number
}

export interface ImpersonationRequest {
  persona_id: string
  active_org_id?: string
  active_location_id?: string
  purpose?: 'care' | 'billing' | 'QA' | 'oversight' | 'research'
}

export interface ImpersonationResponse {
  success: boolean
  session: PersonaSession
  jwt_token?: string
  message: string
}

export interface ScopeSelectionRequest {
  active_org_id?: string
  active_location_id?: string
  purpose?: 'care' | 'billing' | 'QA' | 'oversight' | 'research'
}

export interface ScopeSelectionResponse {
  success: boolean
  session: PersonaSession
  message: string
}