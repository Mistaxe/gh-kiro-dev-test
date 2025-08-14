/**
 * Authorization Context - Shared contract between API and Lab
 * 
 * This interface defines the complete context object used for authorization
 * decisions across the platform. It includes all possible fields that may
 * be evaluated by Casbin policies.
 */
export interface AuthorizationContext {
  // Purpose and Legal Basis
  purpose?: 'care' | 'billing' | 'QA' | 'oversight' | 'research'
  legal_basis?: boolean
  
  // Dataset and PHI Classification
  dataset?: { deidentified: boolean }
  identified_ok?: boolean
  contains_phi?: boolean
  
  // Organizational Scope
  org_scope?: boolean          // request is confined to caller's org
  same_org?: boolean
  same_location?: boolean
  in_network?: boolean
  tenant_root_id: string       // REQUIRED: tenant isolation boundary
  
  // Delegation and Field-Level Access
  delegated_fields?: string[]
  field?: string
  
  // Service-Specific Context
  service?: { claimed: boolean }
  
  // Assignment and Program Context
  assigned_to_user?: boolean
  shares_program?: boolean
  program_access_level?: 'view' | 'write' | 'full' | null
  
  // Consent Management
  consent_ok?: boolean
  consent_id?: string | null
  
  // User Scope and Affiliation
  self_scope?: boolean
  affiliated?: boolean
  
  // Special Access Mechanisms
  temp_grant?: boolean
  two_person_rule?: boolean
  
  // Break-Glass Access
  bg?: boolean                 // break-glass active
  bg_expires_at?: string | null  // ISO timestamp
  
  // Audit and Tracking
  policy_version?: string      // policy version used for decision
  correlation_id?: string      // request correlation ID
}

/**
 * Context Builder Interface
 * 
 * Defines the contract for building authorization contexts for different
 * resource types. Each resource type may have specific context requirements.
 */
export interface ContextBuilder {
  /**
   * Build context for client-related operations
   */
  buildClientContext(
    userId: string,
    clientId: string,
    action: string,
    additionalContext?: Partial<AuthorizationContext>
  ): Promise<AuthorizationContext>
  
  /**
   * Build context for note-related operations
   */
  buildNoteContext(
    userId: string,
    noteId: string,
    action: string,
    additionalContext?: Partial<AuthorizationContext>
  ): Promise<AuthorizationContext>
  
  /**
   * Build context for referral-related operations
   */
  buildReferralContext(
    userId: string,
    referralId: string,
    action: string,
    additionalContext?: Partial<AuthorizationContext>
  ): Promise<AuthorizationContext>
  
  /**
   * Build context for report-related operations
   */
  buildReportContext(
    userId: string,
    reportType: string,
    action: string,
    additionalContext?: Partial<AuthorizationContext>
  ): Promise<AuthorizationContext>
  
  /**
   * Build base context with common fields
   */
  buildBaseContext(
    userId: string,
    additionalContext?: Partial<AuthorizationContext>
  ): Promise<Partial<AuthorizationContext>>
}

/**
 * Authorization Decision Result
 * 
 * Represents the result of an authorization decision with full context
 * for audit logging and debugging.
 */
export interface AuthorizationDecision {
  decision: 'allow' | 'deny'
  subject: { role: string; user_id: string }
  object: { type: string; id: string }
  action: string
  context: AuthorizationContext
  matched_policy?: string
  reasoning: string
  policy_version: string
  timestamp: string
  correlation_id: string
}

/**
 * Policy Simulation Result
 * 
 * Extended result for policy simulation that includes additional
 * debugging information.
 */
export interface PolicySimulationResult extends AuthorizationDecision {
  context_snapshot: AuthorizationContext
  evaluation_steps?: string[]
  warnings?: string[]
}

/**
 * Consent Evaluation Result
 * 
 * Result of consent evaluation for PHI access decisions.
 */
export interface ConsentResult {
  consent_ok: boolean
  consent_id?: string
  reason: string
  grace_period_active?: boolean
  expires_at?: string
  scope_type?: 'platform' | 'organization' | 'location' | 'helper' | 'company'
  allowed_purposes?: string[]
}

/**
 * Validation helpers for AuthorizationContext
 */
export class AuthorizationContextValidator {
  /**
   * Validate that mandatory fields are present in the context
   */
  static validateMandatoryFields(context: AuthorizationContext): string[] {
    const errors: string[] = []
    
    // tenant_root_id is always required for tenant isolation
    if (!context.tenant_root_id) {
      errors.push('tenant_root_id is required for all authorization contexts')
    }
    
    // PHI access requires consent validation
    if (context.contains_phi && context.consent_ok === undefined) {
      errors.push('consent_ok must be evaluated when contains_phi is true')
    }
    
    // Break-glass access requires expiration timestamp
    if (context.bg && !context.bg_expires_at) {
      errors.push('bg_expires_at is required when break-glass is active')
    }
    
    // Purpose is required for PHI access
    if (context.contains_phi && !context.purpose) {
      errors.push('purpose is required for PHI access')
    }
    
    return errors
  }
  
  /**
   * Validate context consistency
   */
  static validateConsistency(context: AuthorizationContext): string[] {
    const errors: string[] = []
    
    // Break-glass expiration should be in the future
    if (context.bg && context.bg_expires_at) {
      const expiresAt = new Date(context.bg_expires_at)
      if (expiresAt <= new Date()) {
        errors.push('break-glass access has expired')
      }
    }
    
    // Consent should have an ID if it's OK
    if (context.consent_ok && !context.consent_id) {
      errors.push('consent_id should be provided when consent_ok is true')
    }
    
    return errors
  }
}