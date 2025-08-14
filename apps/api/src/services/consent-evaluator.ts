import { ConsentResult } from '@app/shared'

/**
 * Consent Evaluation Service
 * 
 * Implements hierarchical consent logic with platform vs organization vs location
 * consent scope handling, purpose-of-use validation, and grace period support.
 */
export class ConsentEvaluator {
  private readonly gracePeriodMinutes: number
  
  constructor(gracePeriodMinutes: number = 0) {
    this.gracePeriodMinutes = gracePeriodMinutes
  }
  
  /**
   * Evaluate consent for a client access request
   * 
   * Implements hierarchical consent evaluation:
   * 1. Platform-level consent (required for storage)
   * 2. Organization-level consent (required for org access)
   * 3. Location-level consent (for location-specific access)
   * 4. Helper-level consent (for helper access)
   */
  async evaluateConsent(
    clientId: string,
    scopeType: 'platform' | 'organization' | 'location' | 'helper' | 'company',
    scopeId: string | null,
    purpose: 'care' | 'billing' | 'QA' | 'oversight' | 'research'
  ): Promise<ConsentResult> {
    try {
      // Step 1: Check platform-level consent (always required)
      const platformConsent = await this.checkConsentLevel(clientId, 'platform', null, purpose)
      if (!platformConsent.valid) {
        return {
          consent_ok: false,
          reason: 'Platform-level consent required for data storage',
          scope_type: 'platform'
        }
      }
      
      // Step 2: Check scope-specific consent if not platform
      if (scopeType !== 'platform') {
        const scopeConsent = await this.checkConsentLevel(clientId, scopeType, scopeId, purpose)
        if (!scopeConsent.valid) {
          // Check if we're in grace period
          if (scopeConsent.grace_period_active) {
            return {
              consent_ok: true,
              consent_id: scopeConsent.consent_id,
              reason: `Access granted within grace period for ${scopeType} scope`,
              grace_period_active: true,
              expires_at: scopeConsent.expires_at,
              scope_type: scopeType,
              allowed_purposes: scopeConsent.allowed_purposes
            }
          }
          
          return {
            consent_ok: false,
            reason: `${this.capitalizeFirst(scopeType)}-level consent required for ${purpose} purpose`,
            scope_type: scopeType
          }
        }
        
        return {
          consent_ok: true,
          consent_id: scopeConsent.consent_id,
          reason: `Valid consent found for ${scopeType} scope and ${purpose} purpose`,
          scope_type: scopeType,
          allowed_purposes: scopeConsent.allowed_purposes,
          expires_at: scopeConsent.expires_at
        }
      }
      
      // Platform-only access
      return {
        consent_ok: true,
        consent_id: platformConsent.consent_id,
        reason: `Valid platform consent found for ${purpose} purpose`,
        scope_type: 'platform',
        allowed_purposes: platformConsent.allowed_purposes,
        expires_at: platformConsent.expires_at
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        consent_ok: false,
        reason: `Consent evaluation failed: ${errorMessage}`
      }
    }
  }
  
  /**
   * Check consent at a specific level
   * 
   * TODO: Replace with actual database queries when task 3.1 is completed
   * This would query the client_consents table:
   * 
   * SELECT id, allowed_purposes, expires_at, revoked_at, grace_period_minutes
   * FROM app.client_consents 
   * WHERE client_id = $1 AND scope_type = $2 AND (scope_id = $3 OR scope_id IS NULL)
   * AND (expires_at IS NULL OR expires_at > NOW())
   * AND revoked_at IS NULL
   * ORDER BY granted_at DESC
   * LIMIT 1
   */
  private async checkConsentLevel(
    clientId: string,
    scopeType: 'platform' | 'organization' | 'location' | 'helper' | 'company',
    scopeId: string | null,
    purpose: string
  ): Promise<{
    valid: boolean
    consent_id?: string
    allowed_purposes?: string[]
    expires_at?: string
    grace_period_active?: boolean
  }> {
    // Mock consent data - replace with database queries
    const mockConsents = this.getMockConsents(clientId)
    
    // Find matching consent
    const consent = mockConsents.find(c => 
      c.scope_type === scopeType && 
      (c.scope_id === scopeId || c.scope_id === null)
    )
    
    if (!consent) {
      return { valid: false }
    }
    
    // Check if consent is revoked
    if (consent.revoked_at) {
      return { valid: false }
    }
    
    // Check if purpose is allowed
    if (!consent.allowed_purposes.includes(purpose)) {
      return { valid: false }
    }
    
    // Check expiration
    const now = new Date()
    if (consent.expires_at && new Date(consent.expires_at) <= now) {
      // Check grace period
      if (consent.grace_period_minutes > 0) {
        const graceExpiry = new Date(new Date(consent.expires_at).getTime() + consent.grace_period_minutes * 60000)
        if (now <= graceExpiry) {
          return {
            valid: true,
            consent_id: consent.id,
            allowed_purposes: consent.allowed_purposes,
            expires_at: graceExpiry.toISOString(),
            grace_period_active: true
          }
        }
      }
      return { valid: false }
    }
    
    return {
      valid: true,
      consent_id: consent.id,
      allowed_purposes: consent.allowed_purposes,
      expires_at: consent.expires_at
    }
  }
  
  /**
   * Get mock consent data for testing
   * TODO: Remove when real database is connected
   */
  private getMockConsents(clientId: string) {
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year from now
    
    return [
      {
        id: 'consent_platform_123',
        client_id: clientId,
        scope_type: 'platform' as const,
        scope_id: null,
        allowed_purposes: ['care', 'billing', 'QA', 'oversight'], // No research at platform level
        method: 'signature' as const,
        granted_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
        expires_at: futureDate,
        revoked_at: null,
        grace_period_minutes: this.gracePeriodMinutes
      },
      {
        id: 'consent_org_456',
        client_id: clientId,
        scope_type: 'organization' as const,
        scope_id: 'org_123',
        allowed_purposes: ['care', 'billing'],
        method: 'verbal' as const,
        granted_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
        expires_at: futureDate,
        revoked_at: null,
        grace_period_minutes: this.gracePeriodMinutes
      },
      {
        id: 'consent_location_789',
        client_id: clientId,
        scope_type: 'location' as const,
        scope_id: 'location_456',
        allowed_purposes: ['care'],
        method: 'verbal' as const,
        granted_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        expires_at: futureDate,
        revoked_at: null,
        grace_period_minutes: this.gracePeriodMinutes
      }
    ]
  }
  
  /**
   * Capitalize first letter of a string
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }
  
  /**
   * Create a consent evaluator with caching
   * TODO: Implement Redis or in-memory caching with appropriate TTL
   */
  static createWithCaching(gracePeriodMinutes: number = 0): ConsentEvaluator {
    return new ConsentEvaluator(gracePeriodMinutes)
  }
}

/**
 * Default consent evaluator instance
 */
export const consentEvaluator = ConsentEvaluator.createWithCaching()