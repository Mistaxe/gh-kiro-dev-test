import { AuthorizationContext } from '@app/shared'
import { BaseContextBuilder } from './base-context-builder.js'
import { consentEvaluator } from '../services/consent-evaluator.js'

/**
 * Client Context Builder
 * 
 * Specialized context builder for client-related operations with
 * comprehensive consent evaluation and tenant scope checking.
 */
export class ClientContextBuilder extends BaseContextBuilder {
  
  /**
   * Build context for client operations with enhanced consent and assignment logic
   */
  async buildClientContext(
    userId: string,
    clientId: string,
    action: string,
    additionalContext?: Partial<AuthorizationContext>
  ): Promise<AuthorizationContext> {
    const baseContext = await this.buildBaseContext(userId, additionalContext)
    
    // Get client information and tenant isolation
    const clientInfo = await this.getClientInfo(clientId)
    
    // Evaluate consent with hierarchical logic
    const consentResult = await this.evaluateHierarchicalConsent(
      clientId, 
      userId, 
      baseContext.purpose || 'care'
    )
    
    // Check assignment and program relationships
    const assignmentInfo = await this.getAssignmentInfo(clientId, userId)
    
    // Check organizational relationships
    const orgRelationships = await this.getOrganizationalRelationships(clientId, userId)
    
    // Determine if this is a cross-org access scenario
    const crossOrgAccess = !orgRelationships.same_org
    
    return {
      tenant_root_id: clientInfo.tenant_root_id,
      ...baseContext,
      
      // PHI and consent context
      contains_phi: clientInfo.contains_phi,
      consent_ok: consentResult.consent_ok,
      consent_id: consentResult.consent_id,
      
      // Assignment context
      assigned_to_user: assignmentInfo.assigned_to_user,
      shares_program: assignmentInfo.shares_program,
      program_access_level: assignmentInfo.program_access_level,
      
      // Organizational scope
      same_org: orgRelationships.same_org,
      same_location: orgRelationships.same_location,
      in_network: orgRelationships.in_network,
      org_scope: !crossOrgAccess,
      
      // Special handling for cross-org scenarios
      ...(crossOrgAccess && {
        // Cross-org access requires explicit consent and may show limited info
        consent_ok: consentResult.consent_ok && consentResult.cross_org_approved,
        // Show minimal candidate info if no consent
        dataset: consentResult.consent_ok ? undefined : { deidentified: true }
      })
    }
  }
  
  /**
   * Get client information including tenant isolation and PHI classification
   */
  private async getClientInfo(clientId: string): Promise<{
    tenant_root_id: string
    contains_phi: boolean
    fingerprint?: string
  }> {
    // TODO: Replace with actual database query
    // SELECT tenant_root_id, (pii_ref IS NOT NULL) as contains_phi, fingerprint
    // FROM app.clients WHERE id = $1
    
    return {
      tenant_root_id: 'org_123',
      contains_phi: true,
      fingerprint: 'fp_abc123'
    }
  }
  
  /**
   * Evaluate hierarchical consent (platform -> organization -> location -> helper)
   */
  private async evaluateHierarchicalConsent(
    clientId: string,
    userId: string,
    purpose: 'care' | 'billing' | 'QA' | 'oversight' | 'research'
  ): Promise<{
    consent_ok: boolean
    consent_id?: string
    cross_org_approved?: boolean
    grace_period_active?: boolean
  }> {
    // Use the consent evaluator service for organization-level consent
    // TODO: Determine the correct scope and scope_id based on user context
    const orgId = 'org_123' // TODO: Get from user's active organization
    
    const consentResult = await consentEvaluator.evaluateConsent(
      clientId,
      'organization',
      orgId,
      purpose
    )
    
    return {
      consent_ok: consentResult.consent_ok,
      consent_id: consentResult.consent_id,
      cross_org_approved: true, // TODO: Implement cross-org logic
      grace_period_active: consentResult.grace_period_active
    }
  }
  

  
  /**
   * Get assignment information for the user and client
   */
  private async getAssignmentInfo(
    clientId: string,
    userId: string
  ): Promise<{
    assigned_to_user: boolean
    shares_program: boolean
    program_access_level: AuthorizationContext['program_access_level']
  }> {
    // TODO: Replace with actual database queries
    // This would check:
    // 1. client_cases.assigned_user_ids for direct assignment
    // 2. Program sharing relationships
    // 3. Access levels based on role and program configuration
    
    return {
      assigned_to_user: true,
      shares_program: false,
      program_access_level: 'full'
    }
  }
  
  /**
   * Get organizational relationships between user and client
   */
  private async getOrganizationalRelationships(
    clientId: string,
    userId: string
  ): Promise<{
    same_org: boolean
    same_location: boolean
    in_network: boolean
  }> {
    // TODO: Replace with actual database queries
    // This would check:
    // 1. User's organizational memberships
    // 2. Client's owning organization
    // 3. Network relationships
    
    return {
      same_org: true,
      same_location: false,
      in_network: true
    }
  }
}

/**
 * Factory function for client context builder
 */
export function createClientContextBuilder(): ClientContextBuilder {
  return new ClientContextBuilder()
}