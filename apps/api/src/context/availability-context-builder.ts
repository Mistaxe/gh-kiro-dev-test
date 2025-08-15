import { SupabaseClient } from '@supabase/supabase-js';
import type { AuthorizationContext } from '@app/shared';
import { BaseContextBuilder } from './base-context-builder.js';

export class AvailabilityContextBuilder extends BaseContextBuilder {
  constructor(supabase: SupabaseClient) {
    super(supabase);
  }

  /**
   * Build authorization context for availability operations
   */
  async buildAvailabilityContext(
    userId: string,
    availabilityId: string,
    action: string,
    additionalContext: Partial<AuthorizationContext> = {}
  ): Promise<AuthorizationContext> {
    const baseContext = await this.buildBaseContext(userId, additionalContext);

    // Get availability and location details
    const { data: availabilityData, error } = await this.supabase
      .from('availability')
      .select(`
        id,
        location_id,
        type,
        version,
        updated_by,
        service_locations!inner (
          id,
          org_id,
          claimed,
          organizations!inner (
            id,
            tenant_root_id
          )
        )
      `)
      .eq('id', availabilityId)
      .single();

    if (error || !availabilityData) {
      throw new Error(`Availability record not found: ${availabilityId}`);
    }

    const location = availabilityData.service_locations;
    const organization = location.organizations;

    // Check if user is the one who last updated this record
    const isUpdater = availabilityData.updated_by === userId;

    // Check if user's org matches the location's org
    const sameOrg = baseContext.tenant_root_id === organization.tenant_root_id;

    // Check if user has location manager role for this location
    const { data: locationManagerRoles } = await this.supabase
      .from('role_assignments')
      .select(`
        roles!inner (
          name
        )
      `)
      .eq('user_id', userId)
      .eq('scope_type', 'location')
      .eq('scope_id', availabilityData.location_id)
      .in('roles.name', ['LocationManager'])
      .is('expires_at', null)
      .or(`expires_at.gt.${new Date().toISOString()}`);

    const canManageLocation = locationManagerRoles && locationManagerRoles.length > 0;

    // Build availability-specific context
    const availabilityContext: AuthorizationContext = {
      ...baseContext,
      tenant_root_id: organization.tenant_root_id,
      same_org: sameOrg,
      same_location: true, // Availability is always location-scoped
      org_scope: sameOrg,
      self_scope: isUpdater,
      affiliated: sameOrg || canManageLocation,
      // Availability records don't contain PHI
      contains_phi: false,
      consent_ok: true,
      // Include version for optimistic concurrency control context
      field: action === 'update' ? 'version' : undefined
    };

    return availabilityContext;
  }

  /**
   * Build context for availability creation operations
   */
  async buildCreateAvailabilityContext(
    userId: string,
    locationId: string,
    action: string,
    additionalContext: Partial<AuthorizationContext> = {}
  ): Promise<AuthorizationContext> {
    const baseContext = await this.buildBaseContext(userId, additionalContext);

    // Get location details
    const { data: locationData, error } = await this.supabase
      .from('service_locations')
      .select(`
        id,
        org_id,
        claimed,
        organizations!inner (
          id,
          tenant_root_id
        )
      `)
      .eq('id', locationId)
      .single();

    if (error || !locationData) {
      throw new Error(`Service location not found: ${locationId}`);
    }

    const organization = locationData.organizations;

    // Check if user's org matches the location's org
    const sameOrg = baseContext.tenant_root_id === organization.tenant_root_id;

    // Check if user has appropriate role for this org/location
    const { data: managerRoles } = await this.supabase
      .from('role_assignments')
      .select(`
        roles!inner (
          name
        )
      `)
      .eq('user_id', userId)
      .eq('scope_type', 'org')
      .eq('scope_id', organization.id)
      .in('roles.name', ['LocationManager', 'OrgAdmin', 'Provider'])
      .is('expires_at', null)
      .or(`expires_at.gt.${new Date().toISOString()}`);

    const canManage = managerRoles && managerRoles.length > 0;

    // Build creation context
    const createContext: AuthorizationContext = {
      ...baseContext,
      tenant_root_id: organization.tenant_root_id,
      same_org: sameOrg,
      same_location: true,
      org_scope: sameOrg,
      affiliated: sameOrg && canManage,
      service: {
        claimed: locationData.claimed
      },
      contains_phi: false,
      consent_ok: true
    };

    return createContext;
  }

  /**
   * Build context for availability search operations
   */
  async buildSearchContext(
    userId: string,
    searchParams: Record<string, any>,
    additionalContext: Partial<AuthorizationContext> = {}
  ): Promise<AuthorizationContext> {
    const baseContext = await this.buildBaseContext(userId, additionalContext);

    // Availability search is generally allowed for authenticated users
    // No PHI concerns for availability data
    const searchContext: AuthorizationContext = {
      ...baseContext,
      org_scope: !!searchParams.org_id,
      same_org: searchParams.org_id === baseContext.tenant_root_id,
      contains_phi: false,
      consent_ok: true,
      // Search operations are read-only
      dataset: { deidentified: true },
      purpose: 'care' // Availability searches are typically for care coordination
    };

    return searchContext;
  }

  /**
   * Build context for availability summary operations
   */
  async buildSummaryContext(
    userId: string,
    orgId?: string,
    additionalContext: Partial<AuthorizationContext> = {}
  ): Promise<AuthorizationContext> {
    const baseContext = await this.buildBaseContext(userId, additionalContext);

    // Summary operations are typically for reporting/analytics
    const summaryContext: AuthorizationContext = {
      ...baseContext,
      org_scope: !!orgId,
      same_org: orgId === baseContext.tenant_root_id,
      contains_phi: false,
      consent_ok: true,
      dataset: { deidentified: true },
      purpose: 'oversight' // Summary data is typically for oversight/management
    };

    return summaryContext;
  }

  /**
   * Build context for client needs matching operations
   */
  async buildMatchingContext(
    userId: string,
    clientNeeds: Record<string, any>,
    additionalContext: Partial<AuthorizationContext> = {}
  ): Promise<AuthorizationContext> {
    const baseContext = await this.buildBaseContext(userId, additionalContext);

    // Client needs matching is for care coordination
    const matchingContext: AuthorizationContext = {
      ...baseContext,
      contains_phi: false, // Availability data itself doesn't contain PHI
      consent_ok: true,
      purpose: 'care', // Matching is for care coordination
      dataset: { deidentified: true } // Availability data is not PHI
    };

    return matchingContext;
  }

  /**
   * Build context for real-time availability updates
   */
  async buildRealTimeUpdateContext(
    userId: string,
    availabilityId: string,
    version: number,
    additionalContext: Partial<AuthorizationContext> = {}
  ): Promise<AuthorizationContext> {
    const baseContext = await this.buildAvailabilityContext(
      userId,
      availabilityId,
      'update',
      additionalContext
    );

    // Add specific context for real-time updates with version control
    const realTimeContext: AuthorizationContext = {
      ...baseContext,
      // Real-time updates require version checking for concurrency control
      field: 'version',
      // This is a time-sensitive operation
      purpose: 'care'
    };

    return realTimeContext;
  }
}