import { SupabaseClient } from '@supabase/supabase-js';
import type {
  Availability,
  AvailabilityWithLocation,
  AvailabilitySummary,
  CreateAvailabilityRequest,
  UpdateAvailabilityRequest
} from '../schemas/service-profile.js';

export interface AvailabilitySearchParams {
  location_ids?: string[];
  type?: 'beds' | 'slots' | 'appointments';
  attribute_predicates?: Record<string, any>;
  min_available?: number;
  org_id?: string;
  limit?: number;
  offset?: number;
}

export interface AvailabilitySearchResult {
  availability: AvailabilityWithLocation[];
  total_count: number;
  has_more: boolean;
}

export interface AvailabilityUpdateResult {
  success: boolean;
  version?: number;
  total?: number;
  available?: number;
  updated_at?: string;
  error?: string;
  current_version?: number;
  provided_version?: number;
  message?: string;
}

export class AvailabilityService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Create a new availability record
   */
  async createAvailability(data: CreateAvailabilityRequest): Promise<string> {
    const { data: result, error } = await this.supabase.rpc('rpc_create_availability', {
      p_location_id: data.location_id,
      p_type: data.type,
      p_attributes: data.attributes || {},
      p_total: data.total,
      p_available: data.available
    });

    if (error) {
      if (error.code === '23505') {
        throw new Error('Availability record already exists for this location, type, and attributes combination');
      } else if (error.code === '23514') {
        throw new Error('Available count cannot exceed total capacity');
      } else {
        throw new Error(`Failed to create availability record: ${error.message}`);
      }
    }

    return result;
  }

  /**
   * Update availability with optimistic concurrency control
   */
  async updateAvailability(
    availabilityId: string,
    data: UpdateAvailabilityRequest
  ): Promise<AvailabilityUpdateResult> {
    const { data: result, error } = await this.supabase.rpc('rpc_update_availability', {
      p_availability_id: availabilityId,
      p_total: data.total || null,
      p_available: data.available || null,
      p_version: data.version
    });

    if (error) {
      if (error.code === '23514') {
        throw new Error('Available count cannot exceed total capacity');
      } else {
        throw new Error(`Failed to update availability record: ${error.message}`);
      }
    }

    return result as AvailabilityUpdateResult;
  }

  /**
   * Search availability records with JSON predicate matching
   */
  async searchAvailability(params: AvailabilitySearchParams): Promise<AvailabilitySearchResult> {
    const { data: result, error } = await this.supabase.rpc('rpc_search_availability', {
      p_location_ids: params.location_ids || [],
      p_type: params.type || null,
      p_attribute_predicates: params.attribute_predicates || {},
      p_min_available: params.min_available || null,
      p_org_id: params.org_id || null,
      p_limit: params.limit || 20,
      p_offset: params.offset || 0
    });

    if (error) {
      throw new Error(`Failed to search availability records: ${error.message}`);
    }

    return result as AvailabilitySearchResult;
  }

  /**
   * Get availability record details by ID
   */
  async getAvailability(availabilityId: string): Promise<AvailabilityWithLocation> {
    const { data: result, error } = await this.supabase.rpc('rpc_get_availability', {
      p_availability_id: availabilityId
    });

    if (error) {
      throw new Error(`Failed to get availability record: ${error.message}`);
    }

    if (!result) {
      throw new Error('Availability record not found');
    }

    return result as AvailabilityWithLocation;
  }

  /**
   * Get availability summary from materialized view
   */
  async getAvailabilitySummary(
    orgId?: string,
    locationIds?: string[],
    type?: 'beds' | 'slots' | 'appointments'
  ): Promise<AvailabilitySummary[]> {
    const { data: result, error } = await this.supabase.rpc('rpc_get_availability_summary', {
      p_org_id: orgId || null,
      p_location_ids: locationIds || [],
      p_type: type || null
    });

    if (error) {
      throw new Error(`Failed to get availability summary: ${error.message}`);
    }

    return result as AvailabilitySummary[];
  }

  /**
   * Search availability by location
   */
  async getLocationAvailability(
    locationId: string,
    type?: 'beds' | 'slots' | 'appointments'
  ): Promise<AvailabilityWithLocation[]> {
    const searchResult = await this.searchAvailability({
      location_ids: [locationId],
      type,
      limit: 100
    });

    return searchResult.availability;
  }

  /**
   * Search availability by organization
   */
  async getOrganizationAvailability(
    orgId: string,
    type?: 'beds' | 'slots' | 'appointments',
    limit: number = 50,
    offset: number = 0
  ): Promise<AvailabilitySearchResult> {
    return this.searchAvailability({
      org_id: orgId,
      type,
      limit,
      offset
    });
  }

  /**
   * Search availability by attributes (JSON predicate matching)
   */
  async searchByAttributes(
    attributePredicates: Record<string, any>,
    minAvailable?: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<AvailabilitySearchResult> {
    return this.searchAvailability({
      attribute_predicates: attributePredicates,
      min_available: minAvailable,
      limit,
      offset
    });
  }

  /**
   * Get available capacity for specific criteria
   */
  async getAvailableCapacity(
    locationIds: string[],
    type: 'beds' | 'slots' | 'appointments',
    attributePredicates?: Record<string, any>
  ): Promise<{ total_capacity: number; total_available: number; locations: number }> {
    const searchResult = await this.searchAvailability({
      location_ids: locationIds,
      type,
      attribute_predicates: attributePredicates,
      limit: 1000 // Get all matching records
    });

    const totalCapacity = searchResult.availability.reduce((sum, avail) => sum + avail.total, 0);
    const totalAvailable = searchResult.availability.reduce((sum, avail) => sum + avail.available, 0);
    const uniqueLocations = new Set(searchResult.availability.map(avail => avail.location_id)).size;

    return {
      total_capacity: totalCapacity,
      total_available: totalAvailable,
      locations: uniqueLocations
    };
  }

  /**
   * Match client needs with available services using JSON predicates
   */
  async matchClientNeeds(
    clientNeeds: Record<string, any>,
    minAvailable: number = 1,
    limit: number = 20
  ): Promise<AvailabilityWithLocation[]> {
    // Convert client needs to attribute predicates
    // This is a simplified example - in practice, you might have more complex matching logic
    const attributePredicates: Record<string, any> = {};

    // Example predicate mappings:
    if (clientNeeds.gender === 'female') {
      attributePredicates.female = true;
    }
    if (clientNeeds.pregnant) {
      attributePredicates.pregnant = true;
    }
    if (clientNeeds.substance_use) {
      attributePredicates.substance_use = true;
    }
    if (clientNeeds.mental_health) {
      attributePredicates.mental_health = true;
    }
    if (clientNeeds.age) {
      // Age range matching would be handled in the SQL with range checks
      // For now, we'll include it in the predicates for simple matching
      if (clientNeeds.age <= 17) {
        attributePredicates.adolescent = true;
      }
    }

    const searchResult = await this.searchAvailability({
      attribute_predicates: attributePredicates,
      min_available: minAvailable,
      limit
    });

    return searchResult.availability;
  }

  /**
   * Refresh the availability summary materialized view
   */
  async refreshAvailabilitySummary(): Promise<void> {
    const { error } = await this.supabase.rpc('refresh_materialized_view', {
      view_name: 'app.availability_summary'
    });

    if (error) {
      throw new Error(`Failed to refresh availability summary: ${error.message}`);
    }
  }
}