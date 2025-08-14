import { AuthorizationContext } from '@app/shared'
import { BaseContextBuilder } from './base-context-builder.js'

/**
 * Referral Context Builder
 * 
 * Specialized context builder for referral-related operations with
 * PHI detection and visibility scope handling.
 */
export class ReferralContextBuilder extends BaseContextBuilder {
  
  /**
   * Build context for referral operations with PHI detection and visibility scope
   */
  async buildReferralContext(
    userId: string,
    referralId: string,
    action: string,
    additionalContext?: Partial<AuthorizationContext>
  ): Promise<AuthorizationContext> {
    const baseContext = await this.buildBaseContext(userId, additionalContext)
    
    // Get referral information and classification
    const referralInfo = await this.getReferralInfo(referralId)
    
    // Check if user is the referral creator
    const isCreator = referralInfo.from_user_id === userId
    
    // Detect PHI content in referral
    const phiDetection = await this.detectPHIContent(referralId)
    
    // Get visibility scope context
    const visibilityContext = await this.getVisibilityContext(referralId, userId)
    
    // Check organizational relationships
    const orgRelationships = await this.getReferralOrganizationalContext(referralId, userId)
    
    // For PHI-containing referrals, check consent
    const consentContext = phiDetection.contains_phi 
      ? await this.checkReferralConsent(referralId, userId)
      : { consent_ok: true }
    
    return {
      tenant_root_id: referralInfo.tenant_root_id,
      ...baseContext,
      
      // PHI detection and consent
      contains_phi: phiDetection.contains_phi,
      consent_ok: consentContext.consent_ok,
      consent_id: consentContext.consent_id,
      
      // Creator context
      self_scope: isCreator,
      
      // Visibility scope
      same_org: visibilityContext.same_org,
      same_location: visibilityContext.same_location,
      in_network: visibilityContext.in_network,
      org_scope: visibilityContext.org_scoped,
      
      // Organizational relationships
      ...(orgRelationships.cross_org && {
        // Cross-org referrals have special handling
        org_scope: false,
        in_network: orgRelationships.in_network
      }),
      
      // Referral type context
      ...(referralInfo.referral_type === 'record_keeping' && {
        // Record-keeping referrals by helpers avoid PHI transmission
        contains_phi: false
      })
    }
  }
  
  /**
   * Get referral information including type and visibility
   */
  private async getReferralInfo(referralId: string): Promise<{
    tenant_root_id: string
    from_user_id: string
    to_location_id: string
    client_id?: string
    referral_type: 'direct' | 'record_keeping'
    visibility_scope: 'organization' | 'network' | 'public'
    status: string
  }> {
    // TODO: Replace with actual database query
    // SELECT 
    //   sl.org_id as tenant_root_id,
    //   r.from_user_id,
    //   r.to_location_id,
    //   r.client_id,
    //   r.referral_type,
    //   r.visibility_scope,
    //   r.status
    // FROM app.referrals r
    // JOIN app.service_locations sl ON sl.id = r.to_location_id
    // WHERE r.id = $1
    
    return {
      tenant_root_id: 'org_123',
      from_user_id: 'user_456',
      to_location_id: 'location_789',
      client_id: 'client_abc',
      referral_type: 'direct',
      visibility_scope: 'organization',
      status: 'pending'
    }
  }
  
  /**
   * Detect PHI content in referral
   */
  private async detectPHIContent(referralId: string): Promise<{
    contains_phi: boolean
    phi_fields: string[]
  }> {
    // TODO: Replace with actual PHI detection logic
    // This would analyze referral content for:
    // 1. Client identifying information
    // 2. Medical information
    // 3. Contact details
    // 4. Other sensitive data
    
    // Mock PHI detection
    const referralContent = await this.getReferralContent(referralId)
    
    // Simple heuristic - in real implementation, use more sophisticated detection
    const contains_phi = referralContent.includes_client_info || 
                        referralContent.includes_medical_info
    
    return {
      contains_phi,
      phi_fields: contains_phi ? ['client_name', 'diagnosis'] : []
    }
  }
  
  /**
   * Get referral content for PHI analysis
   */
  private async getReferralContent(referralId: string): Promise<{
    includes_client_info: boolean
    includes_medical_info: boolean
    content_summary: string
  }> {
    // TODO: Replace with actual database query
    // SELECT content, client_info_included, medical_info_included
    // FROM app.referrals WHERE id = $1
    
    return {
      includes_client_info: true,
      includes_medical_info: false,
      content_summary: 'Referral for behavioral health services'
    }
  }
  
  /**
   * Get visibility context based on referral scope
   */
  private async getVisibilityContext(
    referralId: string,
    userId: string
  ): Promise<{
    same_org: boolean
    same_location: boolean
    in_network: boolean
    org_scoped: boolean
  }> {
    const referralInfo = await this.getReferralInfo(referralId)
    
    // TODO: Replace with actual database queries to check:
    // 1. User's organizational memberships
    // 2. Referral's target location organization
    // 3. Network relationships
    
    const userOrgInfo = await this.getUserOrganizationalInfo(userId)
    const targetLocationInfo = await this.getLocationOrganizationalInfo(referralInfo.to_location_id)
    
    const same_org = userOrgInfo.org_id === targetLocationInfo.org_id
    const same_location = userOrgInfo.location_ids.includes(referralInfo.to_location_id)
    const in_network = userOrgInfo.network_ids.some(nid => 
      targetLocationInfo.network_ids.includes(nid)
    )
    
    // Determine if referral is org-scoped based on visibility setting
    const org_scoped = referralInfo.visibility_scope === 'organization'
    
    return {
      same_org,
      same_location,
      in_network,
      org_scoped
    }
  }
  
  /**
   * Get user's organizational information
   */
  private async getUserOrganizationalInfo(userId: string): Promise<{
    org_id: string
    location_ids: string[]
    network_ids: string[]
  }> {
    // TODO: Replace with actual database query
    // SELECT DISTINCT 
    //   ra.scope_id as org_id,
    //   array_agg(DISTINCT sl.id) as location_ids,
    //   array_agg(DISTINCT o.network_id) as network_ids
    // FROM app.role_assignments ra
    // JOIN app.organizations o ON o.id = ra.scope_id
    // LEFT JOIN app.service_locations sl ON sl.org_id = o.id
    // WHERE ra.user_id = $1 AND ra.scope_type = 'org'
    
    return {
      org_id: 'org_123',
      location_ids: ['location_456', 'location_789'],
      network_ids: ['network_abc']
    }
  }
  
  /**
   * Get location's organizational information
   */
  private async getLocationOrganizationalInfo(locationId: string): Promise<{
    org_id: string
    network_ids: string[]
  }> {
    // TODO: Replace with actual database query
    // SELECT 
    //   sl.org_id,
    //   array_agg(DISTINCT o.network_id) as network_ids
    // FROM app.service_locations sl
    // JOIN app.organizations o ON o.id = sl.org_id
    // WHERE sl.id = $1
    
    return {
      org_id: 'org_456',
      network_ids: ['network_abc', 'network_def']
    }
  }
  
  /**
   * Get organizational context for referral
   */
  private async getReferralOrganizationalContext(
    referralId: string,
    userId: string
  ): Promise<{
    cross_org: boolean
    in_network: boolean
  }> {
    const visibilityContext = await this.getVisibilityContext(referralId, userId)
    
    return {
      cross_org: !visibilityContext.same_org,
      in_network: visibilityContext.in_network
    }
  }
  
  /**
   * Check consent for PHI-containing referrals
   */
  private async checkReferralConsent(
    referralId: string,
    userId: string
  ): Promise<{
    consent_ok: boolean
    consent_id?: string
  }> {
    const referralInfo = await this.getReferralInfo(referralId)
    
    if (!referralInfo.client_id) {
      // No client associated, no consent needed
      return { consent_ok: true }
    }
    
    // TODO: Replace with actual consent evaluation
    // This would check client consent for referral sharing
    // considering the target organization and purpose
    
    return {
      consent_ok: true,
      consent_id: 'consent_referral_123'
    }
  }
}

/**
 * Factory function for referral context builder
 */
export function createReferralContextBuilder(): ReferralContextBuilder {
  return new ReferralContextBuilder()
}