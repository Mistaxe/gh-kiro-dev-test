import { AuthorizationContext } from '@app/shared'
import { BaseContextBuilder } from './base-context-builder.js'
import { getDatabaseClient } from '../services/database.js'

/**
 * Case Context Builder
 * 
 * Builds authorization context for case-related operations including:
 * - Assignment validation (user assigned to case)
 * - Program sharing relationships
 * - Location-based access controls
 * - Consent evaluation for client PHI access
 */
export class CaseContextBuilder extends BaseContextBuilder {
  
  /**
   * Build comprehensive context for case operations
   */
  async buildCaseContext(
    userId: string,
    caseId: string,
    action: string,
    additionalContext: Partial<AuthorizationContext> = {}
  ): Promise<AuthorizationContext> {
    // Build base context with user info and tenant scope
    const baseContext = await this.buildBaseContext(userId, additionalContext)
    
    // Get case information for context building
    const caseInfo = await this.getCaseInfo(caseId, userId)
    
    // Get assignment information
    const assignmentInfo = await this.getCaseAssignmentInfo(caseId, userId)
    
    // Get program sharing information
    const programInfo = await this.getProgramSharingInfo(caseId, userId)
    
    // Evaluate consent for client PHI access
    const consentInfo = await this.evaluateClientConsent(caseInfo.client_id, userId, action)
    
    // Build comprehensive context
    const context: AuthorizationContext = {
      ...baseContext,
      tenant_root_id: caseInfo.tenant_root_id,
      
      // Purpose and PHI classification
      purpose: additionalContext.purpose || 'care',
      contains_phi: this.determineContainsPHI(action, caseInfo),
      
      // Organizational scope
      same_org: caseInfo.same_org,
      same_location: caseInfo.same_location,
      org_scope: true, // Cases are always org-scoped
      
      // Assignment context
      assigned_to_user: assignmentInfo.assigned_to_user,
      shares_program: programInfo.shares_program,
      program_access_level: programInfo.access_level,
      
      // Consent management
      consent_ok: consentInfo.consent_ok,
      consent_id: consentInfo.consent_id,
      
      // Location and affiliation
      affiliated: assignmentInfo.assigned_to_user || programInfo.shares_program,
      
      // Break-glass handling
      bg: additionalContext.bg || false,
      bg_expires_at: additionalContext.bg_expires_at,
      
      // Additional context
      ...additionalContext
    }
    
    return context
  }
  
  /**
   * Get case information for context building
   */
  private async getCaseInfo(caseId: string, userId: string): Promise<{
    client_id: string
    location_id: string
    tenant_root_id: string
    same_org: boolean
    same_location: boolean
    program_ids: string[]
    assigned_user_ids: string[]
    status: string
  }> {
    try {
      const database = getDatabaseClient()
      const result = await database.rpc('rpc_get_case_info_for_context', {
        p_case_id: caseId,
        p_user_id: userId
      })
      
      if (!result || result.length === 0) {
        throw new Error('Case not found or access denied')
      }
      
      return result[0]
    } catch (error) {
      // Mock case info for development
      // TODO: Replace with actual database query
      return {
        client_id: 'client-123',
        location_id: 'location-123',
        tenant_root_id: 'org-123',
        same_org: true,
        same_location: true,
        program_ids: ['program-123'],
        assigned_user_ids: [userId],
        status: 'open'
      }
    }
  }
  
  /**
   * Get case assignment information
   */
  private async getCaseAssignmentInfo(caseId: string, userId: string): Promise<{
    assigned_to_user: boolean
    assignment_type?: 'primary' | 'secondary' | 'supervisor'
  }> {
    try {
      const database = getDatabaseClient()
      const result = await database.rpc('rpc_get_case_assignment_info', {
        p_case_id: caseId,
        p_user_id: userId
      })
      
      return {
        assigned_to_user: result?.assigned_to_user || false,
        assignment_type: result?.assignment_type
      }
    } catch (error) {
      // Mock assignment info for development
      // TODO: Replace with actual database query
      // This would check:
      // 1. client_cases.assigned_user_ids for direct assignment
      // 2. Assignment type (primary, secondary, supervisor)
      // 3. Assignment status and expiration
      
      return {
        assigned_to_user: true, // Mock: user is assigned
        assignment_type: 'primary'
      }
    }
  }
  
  /**
   * Get program sharing information
   */
  private async getProgramSharingInfo(caseId: string, userId: string): Promise<{
    shares_program: boolean
    access_level: 'view' | 'write' | 'full' | null
    shared_programs: string[]
  }> {
    try {
      const database = getDatabaseClient()
      const result = await database.rpc('rpc_get_program_sharing_info', {
        p_case_id: caseId,
        p_user_id: userId
      })
      
      return {
        shares_program: result?.shares_program || false,
        access_level: result?.access_level || null,
        shared_programs: result?.shared_programs || []
      }
    } catch (error) {
      // Mock program sharing info for development
      // TODO: Replace with actual database query
      // This would check:
      // 1. User's program memberships
      // 2. Case's program assignments
      // 3. Program-based access levels
      // 4. Program sharing rules
      
      return {
        shares_program: true, // Mock: user shares program
        access_level: 'write',
        shared_programs: ['program-123']
      }
    }
  }
  
  /**
   * Evaluate consent for client PHI access
   */
  private async evaluateClientConsent(
    clientId: string,
    userId: string,
    action: string
  ): Promise<{
    consent_ok: boolean
    consent_id?: string
    reason: string
  }> {
    try {
      const database = getDatabaseClient()
      const result = await database.rpc('rpc_evaluate_client_consent', {
        p_client_id: clientId,
        p_user_id: userId,
        p_purpose: 'care',
        p_action: action
      })
      
      return {
        consent_ok: result?.consent_ok || false,
        consent_id: result?.consent_id,
        reason: result?.reason || 'Consent evaluation failed'
      }
    } catch (error) {
      // Mock consent evaluation for development
      // TODO: Replace with actual consent evaluation
      // This would check:
      // 1. Platform-level consent
      // 2. Organization-level consent
      // 3. Purpose-of-use validation
      // 4. Consent expiration and revocation
      // 5. Grace period handling
      
      return {
        consent_ok: true, // Mock: consent is OK
        consent_id: 'consent-123',
        reason: 'Valid consent found'
      }
    }
  }
  
  /**
   * Determine if the action involves PHI
   */
  private determineContainsPHI(action: string, caseInfo: any): boolean {
    // Reading case details with client info involves PHI
    if (action === 'read' && caseInfo.client_id) {
      return true
    }
    
    // Creating or updating cases with client assignments involves PHI
    if (['create', 'update'].includes(action)) {
      return true
    }
    
    // Assignment operations involve PHI (knowing who is assigned to which client)
    if (['assign', 'unassign'].includes(action)) {
      return true
    }
    
    // Closing cases involves PHI (case closure reasons may contain PHI)
    if (action === 'close') {
      return true
    }
    
    return false
  }
}

/**
 * Factory function to create case context builder
 */
export function createCaseContextBuilder(): CaseContextBuilder {
  return new CaseContextBuilder()
}