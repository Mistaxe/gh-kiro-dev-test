import { SupabaseClient } from '@supabase/supabase-js';
import type { AuthorizationContext } from '@app/shared';
import { BaseContextBuilder } from './base-context-builder.js';

export class ServiceProfileContextBuilder extends BaseContextBuilder {
  constructor(supabase: SupabaseClient) {
    super(supabase);
  }

  /**
   * Build authorization context for service profile operations
   */
  async buildServiceProfileContext(
    userId: string,
    profileId: string,
    action: string,
    additionalContext: Partial<AuthorizationContext> = {}
  ): Promise<AuthorizationContext> {
    const baseContext = await this.buildBaseContext(userId, additionalContext);

    // Get service profile and location details
    const { data: profileData, error } = await this.supabase
      .from('service_profiles')
      .select(`
        id,
        location_id,
        claimed,
        claim_owner_user_id,
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
      .eq('id', profileId)
      .single();

    if (error || !profileData) {
      throw new Error(`Service profile not found: ${profileId}`);
    }

    const location = profileData.service_locations;
    const organization = location.organizations;

    // Check if user is the claim owner
    const isClaimOwner = profileData.claim_owner_user_id === userId;

    // Check if user has curator role (SuperAdmin or OrgAdmin)
    const { data: curatorRoles } = await this.supabase
      .from('role_assignments')
      .select(`
        roles!inner (
          name
        )
      `)
      .eq('user_id', userId)
      .in('roles.name', ['SuperAdmin', 'OrgAdmin'])
      .is('expires_at', null)
      .or(`expires_at.gt.${new Date().toISOString()}`);

    const isCurator = curatorRoles && curatorRoles.length > 0;

    // Check if user's org matches the location's org
    const sameOrg = baseContext.tenant_root_id === organization.tenant_root_id;

    // Build service-specific context
    const serviceContext: AuthorizationContext = {
      ...baseContext,
      tenant_root_id: organization.tenant_root_id,
      same_org: sameOrg,
      org_scope: sameOrg,
      service: {
        claimed: profileData.claimed
      },
      self_scope: isClaimOwner,
      affiliated: sameOrg || isCurator,
      // For unclaimed services, curators can manage them
      temp_grant: !profileData.claimed && isCurator,
      // Service profiles don't typically contain PHI
      contains_phi: false,
      consent_ok: true // No consent required for service profiles
    };

    return serviceContext;
  }

  /**
   * Build context for service location claiming operations
   */
  async buildLocationClaimContext(
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
        claim_owner_user_id,
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

    // Check if user has location manager role
    const { data: locationManagerRoles } = await this.supabase
      .from('role_assignments')
      .select(`
        roles!inner (
          name
        )
      `)
      .eq('user_id', userId)
      .eq('scope_type', 'org')
      .eq('scope_id', organization.id)
      .in('roles.name', ['LocationManager', 'OrgAdmin'])
      .is('expires_at', null)
      .or(`expires_at.gt.${new Date().toISOString()}`);

    const canManageLocation = locationManagerRoles && locationManagerRoles.length > 0;

    // Build location claim context
    const claimContext: AuthorizationContext = {
      ...baseContext,
      tenant_root_id: organization.tenant_root_id,
      same_org: sameOrg,
      org_scope: sameOrg,
      service: {
        claimed: locationData.claimed
      },
      affiliated: sameOrg && canManageLocation,
      // Location claiming doesn't involve PHI
      contains_phi: false,
      consent_ok: true
    };

    return claimContext;
  }

  /**
   * Build context for service profile search operations
   */
  async buildSearchContext(
    userId: string,
    searchParams: Record<string, any>,
    additionalContext: Partial<AuthorizationContext> = {}
  ): Promise<AuthorizationContext> {
    const baseContext = await this.buildBaseContext(userId, additionalContext);

    // Service profile search is generally allowed for authenticated users
    // No specific PHI concerns for service profiles
    const searchContext: AuthorizationContext = {
      ...baseContext,
      org_scope: !!searchParams.org_id,
      same_org: searchParams.org_id === baseContext.tenant_root_id,
      contains_phi: false,
      consent_ok: true,
      // Search operations are generally read-only
      dataset: { deidentified: true }
    };

    return searchContext;
  }

  /**
   * Build context for curator operations on unclaimed services
   */
  async buildCuratorContext(
    userId: string,
    action: string,
    additionalContext: Partial<AuthorizationContext> = {}
  ): Promise<AuthorizationContext> {
    const baseContext = await this.buildBaseContext(userId, additionalContext);

    // Check if user has curator role
    const { data: curatorRoles } = await this.supabase
      .from('role_assignments')
      .select(`
        roles!inner (
          name
        )
      `)
      .eq('user_id', userId)
      .in('roles.name', ['SuperAdmin', 'OrgAdmin'])
      .is('expires_at', null)
      .or(`expires_at.gt.${new Date().toISOString()}`);

    const isCurator = curatorRoles && curatorRoles.length > 0;

    // Build curator context
    const curatorContext: AuthorizationContext = {
      ...baseContext,
      affiliated: isCurator,
      temp_grant: isCurator, // Curators have special access to unclaimed services
      service: {
        claimed: false // Curator operations are typically on unclaimed services
      },
      contains_phi: false,
      consent_ok: true
    };

    return curatorContext;
  }
}