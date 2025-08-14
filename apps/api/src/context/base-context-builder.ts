import { FastifyRequest } from 'fastify'
import { AuthorizationContext, ContextBuilder } from '@app/shared'
import { User } from '../types/auth.js'

/**
 * Base Context Builder Implementation
 * 
 * Provides common context building functionality that can be extended
 * by specific resource type builders.
 */
export class BaseContextBuilder implements ContextBuilder {
  
  /**
   * Build base context with common fields populated from request
   */
  async buildBaseContext(
    userId: string,
    additionalContext?: Partial<AuthorizationContext>
  ): Promise<Partial<AuthorizationContext>> {
    // TODO: In a real implementation, this would query the database
    // to get user roles, organizational memberships, etc.
    
    const baseContext: Partial<AuthorizationContext> = {
      // Extract purpose from JWT claims or headers
      purpose: this.extractPurposeOfUse(additionalContext),
      
      // Set correlation ID for audit trail
      correlation_id: additionalContext?.correlation_id || `ctx_${Date.now()}`,
      
      // Policy version will be set by authorization middleware
      policy_version: additionalContext?.policy_version,
      
      // Merge any additional context provided
      ...additionalContext
    }
    
    return baseContext
  }
  
  /**
   * Build context for client-related operations
   */
  async buildClientContext(
    userId: string,
    clientId: string,
    action: string,
    additionalContext?: Partial<AuthorizationContext>
  ): Promise<AuthorizationContext> {
    const baseContext = await this.buildBaseContext(userId, additionalContext)
    
    // TODO: Query database for client-specific context
    const clientContext = await this.getClientSpecificContext(clientId, userId, action)
    
    return {
      ...baseContext,
      ...clientContext,
      tenant_root_id: clientContext.tenant_root_id
    }
  }
  
  /**
   * Build context for note-related operations
   */
  async buildNoteContext(
    userId: string,
    noteId: string,
    action: string,
    additionalContext?: Partial<AuthorizationContext>
  ): Promise<AuthorizationContext> {
    const baseContext = await this.buildBaseContext(userId, additionalContext)
    
    // TODO: Query database for note-specific context
    const noteContext = await this.getNoteSpecificContext(noteId, userId, action)
    
    return {
      ...baseContext,
      ...noteContext,
      tenant_root_id: noteContext.tenant_root_id
    }
  }
  
  /**
   * Build context for referral-related operations
   */
  async buildReferralContext(
    userId: string,
    referralId: string,
    action: string,
    additionalContext?: Partial<AuthorizationContext>
  ): Promise<AuthorizationContext> {
    const baseContext = await this.buildBaseContext(userId, additionalContext)
    
    // TODO: Query database for referral-specific context
    const referralContext = await this.getReferralSpecificContext(referralId, userId, action)
    
    return {
      ...baseContext,
      ...referralContext,
      tenant_root_id: referralContext.tenant_root_id
    }
  }
  
  /**
   * Build context for report-related operations
   */
  async buildReportContext(
    userId: string,
    reportType: string,
    action: string,
    additionalContext?: Partial<AuthorizationContext>
  ): Promise<AuthorizationContext> {
    const baseContext = await this.buildBaseContext(userId, additionalContext)
    
    // TODO: Query database for report-specific context
    const reportContext = await this.getReportSpecificContext(reportType, userId, action)
    
    return {
      ...baseContext,
      ...reportContext,
      tenant_root_id: reportContext.tenant_root_id
    }
  }
  
  /**
   * Extract purpose of use from request context
   */
  private extractPurposeOfUse(context?: Partial<AuthorizationContext>): AuthorizationContext['purpose'] {
    // Priority: explicit context > default to 'care'
    return context?.purpose || 'care'
  }
  
  /**
   * Get client-specific authorization context
   * This would typically query the database for:
   * - Tenant isolation (tenant_root_id)
   * - Consent status
   * - Assignment relationships
   * - Program sharing
   */
  private async getClientSpecificContext(
    clientId: string,
    userId: string,
    action: string
  ): Promise<Partial<AuthorizationContext> & { tenant_root_id: string }> {
    // TODO: Replace with actual database queries
    // This is a placeholder implementation
    
    // Mock client lookup - in real implementation, query clients table
    const mockClient = {
      id: clientId,
      tenant_root_id: 'org_123', // This would come from database
      contains_phi: true
    }
    
    // Mock consent evaluation - in real implementation, query client_consents
    const mockConsent = await this.evaluateConsent(clientId, userId, action)
    
    // Mock assignment check - in real implementation, query role_assignments and client_cases
    const mockAssignment = await this.checkAssignment(clientId, userId)
    
    return {
      tenant_root_id: mockClient.tenant_root_id,
      contains_phi: mockClient.contains_phi,
      consent_ok: mockConsent.consent_ok,
      consent_id: mockConsent.consent_id,
      assigned_to_user: mockAssignment.assigned,
      shares_program: mockAssignment.shares_program,
      program_access_level: mockAssignment.access_level,
      same_org: true, // TODO: Calculate based on user's org vs client's org
      org_scope: true
    }
  }
  
  /**
   * Get note-specific authorization context
   */
  private async getNoteSpecificContext(
    noteId: string,
    userId: string,
    action: string
  ): Promise<Partial<AuthorizationContext> & { tenant_root_id: string }> {
    // TODO: Replace with actual database queries
    
    // Mock note lookup
    const mockNote = {
      id: noteId,
      tenant_root_id: 'org_123',
      classification: 'standard' as 'standard' | 'confidential',
      is_helper_journal: false,
      contains_phi: true,
      author_user_id: userId
    }
    
    // Check if user is the author
    const self_scope = mockNote.author_user_id === userId
    
    return {
      tenant_root_id: mockNote.tenant_root_id,
      contains_phi: mockNote.contains_phi,
      consent_ok: mockNote.contains_phi ? true : undefined, // Mock consent for PHI
      consent_id: mockNote.contains_phi ? 'consent_note_123' : undefined,
      self_scope,
      // For confidential notes, would need temp_grant or special permissions
      temp_grant: mockNote.classification === 'confidential' ? false : undefined,
      same_org: true,
      org_scope: true
    }
  }
  
  /**
   * Get referral-specific authorization context
   */
  private async getReferralSpecificContext(
    referralId: string,
    userId: string,
    action: string
  ): Promise<Partial<AuthorizationContext> & { tenant_root_id: string }> {
    // TODO: Replace with actual database queries
    
    // Mock referral lookup
    const mockReferral = {
      id: referralId,
      tenant_root_id: 'org_123',
      visibility_scope: 'organization' as const,
      contains_phi: true,
      from_user_id: userId
    }
    
    // PHI detection based on referral content
    const contains_phi = mockReferral.contains_phi
    
    // Check if user created the referral
    const self_scope = mockReferral.from_user_id === userId
    
    return {
      tenant_root_id: mockReferral.tenant_root_id,
      contains_phi,
      consent_ok: contains_phi ? true : undefined, // Mock consent for PHI
      consent_id: contains_phi ? 'consent_referral_123' : undefined,
      self_scope,
      same_org: mockReferral.visibility_scope === 'organization',
      org_scope: true
    }
  }
  
  /**
   * Get report-specific authorization context
   */
  private async getReportSpecificContext(
    reportType: string,
    userId: string,
    action: string
  ): Promise<Partial<AuthorizationContext> & { tenant_root_id: string }> {
    // TODO: Replace with actual database queries
    
    // Determine if report contains identified data
    const isIdentifiedReport = reportType.includes('identified') || reportType.includes('finance')
    
    return {
      tenant_root_id: 'org_123', // TODO: Get from user's active org
      dataset: { deidentified: !isIdentifiedReport },
      identified_ok: isIdentifiedReport,
      legal_basis: isIdentifiedReport, // Identified reports require legal basis
      org_scope: true,
      purpose: 'oversight' // Reports typically for oversight purposes
    }
  }
  
  /**
   * Evaluate consent for client access
   * TODO: Implement actual consent evaluation logic
   */
  private async evaluateConsent(
    clientId: string,
    userId: string,
    action: string
  ): Promise<{ consent_ok: boolean; consent_id?: string }> {
    // Mock consent evaluation - in real implementation, this would:
    // 1. Query client_consents table
    // 2. Check hierarchical consent (platform -> org -> location)
    // 3. Validate purpose of use
    // 4. Check expiration and grace periods
    // 5. Handle revocation logic
    
    return {
      consent_ok: true,
      consent_id: 'consent_123'
    }
  }
  
  /**
   * Check user assignment to client
   * TODO: Implement actual assignment checking logic
   */
  private async checkAssignment(
    clientId: string,
    userId: string
  ): Promise<{ 
    assigned: boolean; 
    shares_program: boolean; 
    access_level: AuthorizationContext['program_access_level'] 
  }> {
    // Mock assignment check - in real implementation, this would:
    // 1. Query client_cases table for assigned_user_ids
    // 2. Check program sharing relationships
    // 3. Determine access level based on role and program
    
    return {
      assigned: true,
      shares_program: false,
      access_level: 'full'
    }
  }
}

/**
 * Factory function to create context builder instances
 */
export function createContextBuilder(): ContextBuilder {
  return new BaseContextBuilder()
}

/**
 * Legacy context builder adapter for backward compatibility
 */
export function createLegacyContextBuilder(
  resourceType: 'client' | 'note' | 'referral' | 'report'
) {
  const builder = new BaseContextBuilder()
  
  return async (req: FastifyRequest & { user?: User }, resourceId?: string): Promise<AuthorizationContext> => {
    if (!req.user) {
      throw new Error('User not authenticated')
    }
    
    if (!resourceId) {
      throw new Error('Resource ID required for context building')
    }
    
    const additionalContext: Partial<AuthorizationContext> = {
      correlation_id: req.id,
      purpose: req.headers['x-purpose-of-use'] as AuthorizationContext['purpose'] || 'care'
    }
    
    switch (resourceType) {
      case 'client':
        return builder.buildClientContext(req.user.auth_user_id, resourceId, 'read', additionalContext)
      case 'note':
        return builder.buildNoteContext(req.user.auth_user_id, resourceId, 'read', additionalContext)
      case 'referral':
        return builder.buildReferralContext(req.user.auth_user_id, resourceId, 'read', additionalContext)
      case 'report':
        return builder.buildReportContext(req.user.auth_user_id, resourceId, 'read', additionalContext)
      default:
        throw new Error(`Unknown resource type: ${resourceType}`)
    }
  }
}