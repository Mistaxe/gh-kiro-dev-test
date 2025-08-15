// Service Profile types for the Service Registry and Availability System

export interface ServiceProfile {
  id: string;
  location_id: string;
  taxonomy_code?: string;
  populations: string[];
  eligibility: Record<string, any>;
  hours: Record<string, any>;
  description?: string;
  claimed: boolean;
  claim_owner_user_id?: string;
  curator_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ServiceProfileWithDetails extends ServiceProfile {
  location_info: {
    id: string;
    name: string;
    org_id: string;
    claimed: boolean;
    attributes: Record<string, any>;
  };
  organization_info: {
    id: string;
    name: string;
    org_type?: string;
  };
  claim_owner_info?: {
    id: string;
    display_name?: string;
    email: string;
  };
  search_rank?: number;
}

export interface ServiceProfileSearchParams {
  search_term?: string;
  populations?: string[];
  eligibility_filter?: Record<string, any>;
  claimed_only?: boolean;
  org_id?: string;
  limit?: number;
  offset?: number;
}

export interface ServiceProfileSearchResult {
  profiles: ServiceProfileWithDetails[];
  total_count: number;
  has_more: boolean;
}

export interface CreateServiceProfileRequest {
  location_id: string;
  taxonomy_code?: string;
  populations?: string[];
  eligibility?: Record<string, any>;
  hours?: Record<string, any>;
  description?: string;
}

export interface UpdateServiceProfileRequest {
  taxonomy_code?: string;
  populations?: string[];
  eligibility?: Record<string, any>;
  hours?: Record<string, any>;
  description?: string;
  curator_notes?: string;
}

// Availability types
export interface Availability {
  id: string;
  location_id: string;
  type: 'beds' | 'slots' | 'appointments';
  attributes: Record<string, any>;
  total: number;
  available: number;
  version: number;
  updated_by: string;
  updated_at: string;
  created_at: string;
}

export interface AvailabilityWithLocation extends Availability {
  location_info: {
    id: string;
    name: string;
    org_id: string;
  };
}

export interface CreateAvailabilityRequest {
  location_id: string;
  type: 'beds' | 'slots' | 'appointments';
  attributes?: Record<string, any>;
  total: number;
  available: number;
}

export interface UpdateAvailabilityRequest {
  total?: number;
  available?: number;
  version: number; // Required for optimistic concurrency control
}

export interface AvailabilitySummary {
  org_id: string;
  location_id: string;
  location_name: string;
  type: string;
  total_capacity: number;
  total_available: number;
  availability_records: number;
  last_updated: string;
}

// Population types for validation
export type PopulationType = 
  | 'adults' 
  | 'adolescents' 
  | 'children' 
  | 'families' 
  | 'seniors' 
  | 'veterans';

// Availability type for validation
export type AvailabilityType = 'beds' | 'slots' | 'appointments';

// Eligibility criteria common patterns
export interface EligibilityCriteria {
  age_min?: number;
  age_max?: number;
  gender?: string[];
  insurance?: string[];
  conditions?: string[];
  income_max?: number;
  geographic_area?: string[];
  [key: string]: any; // Allow additional criteria
}

// Hours structure for service profiles
export interface ServiceHours {
  monday?: { open: string; close: string };
  tuesday?: { open: string; close: string };
  wednesday?: { open: string; close: string };
  thursday?: { open: string; close: string };
  friday?: { open: string; close: string };
  saturday?: { open: string; close: string };
  sunday?: { open: string; close: string };
  notes?: string;
  [key: string]: any; // Allow additional hour specifications
}