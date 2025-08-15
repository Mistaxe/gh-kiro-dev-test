import { SupabaseClient } from '@supabase/supabase-js';
import type {
  ServiceProfile,
  ServiceProfileWithDetails,
  ServiceProfileSearchResult,
  CreateServiceProfileRequest,
  UpdateServiceProfileRequest,
  ServiceProfileSearchQuery,
  ClaimServiceLocationRequest
} from '../schemas/service-profile.js';

export class ServiceProfileService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Create a new service profile
   */
  async createServiceProfile(data: CreateServiceProfileRequest): Promise<string> {
    const { data: result, error } = await this.supabase.rpc('rpc_create_service_profile', {
      p_location_id: data.location_id,
      p_taxonomy_code: data.taxonomy_code || null,
      p_populations: data.populations || [],
      p_eligibility: data.eligibility || {},
      p_hours: data.hours || {},
      p_description: data.description || null
    });

    if (error) {
      throw new Error(`Failed to create service profile: ${error.message}`);
    }

    return result;
  }

  /**
   * Update an existing service profile
   */
  async updateServiceProfile(
    profileId: string, 
    data: UpdateServiceProfileRequest
  ): Promise<void> {
    const { error } = await this.supabase.rpc('rpc_update_service_profile', {
      p_profile_id: profileId,
      p_taxonomy_code: data.taxonomy_code || null,
      p_populations: data.populations || null,
      p_eligibility: data.eligibility || null,
      p_hours: data.hours || null,
      p_description: data.description || null,
      p_curator_notes: data.curator_notes || null
    });

    if (error) {
      throw new Error(`Failed to update service profile: ${error.message}`);
    }
  }

  /**
   * Search service profiles with full-text search and filtering
   */
  async searchServiceProfiles(query: ServiceProfileSearchQuery): Promise<ServiceProfileSearchResult> {
    const { data: result, error } = await this.supabase.rpc('rpc_search_service_profiles', {
      p_search_term: query.search_term || null,
      p_populations: query.populations || [],
      p_eligibility_filter: query.eligibility_filter || {},
      p_claimed_only: query.claimed_only || null,
      p_org_id: query.org_id || null,
      p_limit: query.limit || 20,
      p_offset: query.offset || 0
    });

    if (error) {
      throw new Error(`Failed to search service profiles: ${error.message}`);
    }

    return result as ServiceProfileSearchResult;
  }

  /**
   * Get service profile details by ID
   */
  async getServiceProfile(profileId: string): Promise<ServiceProfileWithDetails> {
    const { data: result, error } = await this.supabase.rpc('rpc_get_service_profile', {
      p_profile_id: profileId
    });

    if (error) {
      throw new Error(`Failed to get service profile: ${error.message}`);
    }

    if (!result) {
      throw new Error('Service profile not found');
    }

    return result as ServiceProfileWithDetails;
  }

  /**
   * Claim a service location (affects all profiles for that location)
   */
  async claimServiceLocation(data: ClaimServiceLocationRequest): Promise<void> {
    const { error } = await this.supabase.rpc('rpc_claim_service_location', {
      p_location_id: data.location_id
    });

    if (error) {
      throw new Error(`Failed to claim service location: ${error.message}`);
    }
  }

  /**
   * Get service profiles for a specific location
   */
  async getLocationServiceProfiles(locationId: string): Promise<ServiceProfileWithDetails[]> {
    const searchResult = await this.searchServiceProfiles({
      limit: 100,
      offset: 0
    });

    // Filter by location_id on the client side since the RPC doesn't have location filtering
    return searchResult.profiles.filter(profile => profile.location_id === locationId);
  }

  /**
   * Get unclaimed service profiles (for curators)
   */
  async getUnclaimedServiceProfiles(
    limit: number = 20,
    offset: number = 0
  ): Promise<ServiceProfileSearchResult> {
    return this.searchServiceProfiles({
      claimed_only: false,
      limit,
      offset
    });
  }

  /**
   * Get service profiles by organization
   */
  async getOrganizationServiceProfiles(
    orgId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<ServiceProfileSearchResult> {
    return this.searchServiceProfiles({
      org_id: orgId,
      limit,
      offset
    });
  }

  /**
   * Search service profiles by population served
   */
  async searchByPopulation(
    populations: string[],
    limit: number = 20,
    offset: number = 0
  ): Promise<ServiceProfileSearchResult> {
    return this.searchServiceProfiles({
      populations,
      limit,
      offset
    });
  }

  /**
   * Search service profiles by eligibility criteria
   */
  async searchByEligibility(
    eligibilityFilter: Record<string, any>,
    limit: number = 20,
    offset: number = 0
  ): Promise<ServiceProfileSearchResult> {
    return this.searchServiceProfiles({
      eligibility_filter: eligibilityFilter,
      limit,
      offset
    });
  }

  /**
   * Full-text search service profiles
   */
  async fullTextSearch(
    searchTerm: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<ServiceProfileSearchResult> {
    return this.searchServiceProfiles({
      search_term: searchTerm,
      limit,
      offset
    });
  }
}