import { describe, it, expect } from 'vitest'
import { 
  AuthorizationContext, 
  AuthorizationContextValidator,
  ConsentResult 
} from '../authorization.js'

describe('AuthorizationContextValidator', () => {
  describe('validateMandatoryFields', () => {
    it('should require tenant_root_id for all contexts', () => {
      const context: Partial<AuthorizationContext> = {
        purpose: 'care'
      }
      
      const errors = AuthorizationContextValidator.validateMandatoryFields(
        context as AuthorizationContext
      )
      
      expect(errors).toContain('tenant_root_id is required for all authorization contexts')
    })
    
    it('should require consent_ok evaluation when contains_phi is true', () => {
      const context: AuthorizationContext = {
        tenant_root_id: 'org_123',
        contains_phi: true,
        purpose: 'care'
      }
      
      const errors = AuthorizationContextValidator.validateMandatoryFields(context)
      
      expect(errors).toContain('consent_ok must be evaluated when contains_phi is true')
    })
    
    it('should require bg_expires_at when break-glass is active', () => {
      const context: AuthorizationContext = {
        tenant_root_id: 'org_123',
        bg: true
      }
      
      const errors = AuthorizationContextValidator.validateMandatoryFields(context)
      
      expect(errors).toContain('bg_expires_at is required when break-glass is active')
    })
    
    it('should require purpose for PHI access', () => {
      const context: AuthorizationContext = {
        tenant_root_id: 'org_123',
        contains_phi: true,
        consent_ok: true
      }
      
      const errors = AuthorizationContextValidator.validateMandatoryFields(context)
      
      expect(errors).toContain('purpose is required for PHI access')
    })
    
    it('should pass validation for valid context', () => {
      const context: AuthorizationContext = {
        tenant_root_id: 'org_123',
        contains_phi: true,
        consent_ok: true,
        purpose: 'care'
      }
      
      const errors = AuthorizationContextValidator.validateMandatoryFields(context)
      
      expect(errors).toHaveLength(0)
    })
    
    it('should pass validation for non-PHI context', () => {
      const context: AuthorizationContext = {
        tenant_root_id: 'org_123',
        contains_phi: false
      }
      
      const errors = AuthorizationContextValidator.validateMandatoryFields(context)
      
      expect(errors).toHaveLength(0)
    })
  })
  
  describe('validateConsistency', () => {
    it('should detect expired break-glass access', () => {
      const pastTime = new Date(Date.now() - 60000).toISOString() // 1 minute ago
      const context: AuthorizationContext = {
        tenant_root_id: 'org_123',
        bg: true,
        bg_expires_at: pastTime
      }
      
      const errors = AuthorizationContextValidator.validateConsistency(context)
      
      expect(errors).toContain('break-glass access has expired')
    })
    
    it('should accept future break-glass expiration', () => {
      const futureTime = new Date(Date.now() + 60000).toISOString() // 1 minute from now
      const context: AuthorizationContext = {
        tenant_root_id: 'org_123',
        bg: true,
        bg_expires_at: futureTime
      }
      
      const errors = AuthorizationContextValidator.validateConsistency(context)
      
      expect(errors).not.toContain('break-glass access has expired')
    })
    
    it('should warn when consent_ok is true but no consent_id', () => {
      const context: AuthorizationContext = {
        tenant_root_id: 'org_123',
        consent_ok: true
      }
      
      const errors = AuthorizationContextValidator.validateConsistency(context)
      
      expect(errors).toContain('consent_id should be provided when consent_ok is true')
    })
    
    it('should pass consistency validation for valid context', () => {
      const futureTime = new Date(Date.now() + 60000).toISOString()
      const context: AuthorizationContext = {
        tenant_root_id: 'org_123',
        bg: true,
        bg_expires_at: futureTime,
        consent_ok: true,
        consent_id: 'consent_123'
      }
      
      const errors = AuthorizationContextValidator.validateConsistency(context)
      
      expect(errors).toHaveLength(0)
    })
  })
})

describe('AuthorizationContext type safety', () => {
  it('should enforce required tenant_root_id at compile time', () => {
    // This test ensures TypeScript compilation catches missing tenant_root_id
    const validContext: AuthorizationContext = {
      tenant_root_id: 'org_123'
    }
    
    expect(validContext.tenant_root_id).toBe('org_123')
  })
  
  it('should support all purpose types', () => {
    const purposes: AuthorizationContext['purpose'][] = [
      'care', 'billing', 'QA', 'oversight', 'research'
    ]
    
    purposes.forEach(purpose => {
      const context: AuthorizationContext = {
        tenant_root_id: 'org_123',
        purpose
      }
      expect(context.purpose).toBe(purpose)
    })
  })
  
  it('should support all program access levels', () => {
    const accessLevels: AuthorizationContext['program_access_level'][] = [
      'view', 'write', 'full', null
    ]
    
    accessLevels.forEach(level => {
      const context: AuthorizationContext = {
        tenant_root_id: 'org_123',
        program_access_level: level
      }
      expect(context.program_access_level).toBe(level)
    })
  })
})

describe('ConsentResult', () => {
  it('should represent successful consent evaluation', () => {
    const result: ConsentResult = {
      consent_ok: true,
      consent_id: 'consent_123',
      reason: 'Valid consent found for care purpose',
      scope_type: 'organization',
      allowed_purposes: ['care', 'billing']
    }
    
    expect(result.consent_ok).toBe(true)
    expect(result.consent_id).toBe('consent_123')
    expect(result.allowed_purposes).toContain('care')
  })
  
  it('should represent failed consent evaluation', () => {
    const result: ConsentResult = {
      consent_ok: false,
      reason: 'No valid consent found for research purpose'
    }
    
    expect(result.consent_ok).toBe(false)
    expect(result.consent_id).toBeUndefined()
  })
  
  it('should support grace period information', () => {
    const result: ConsentResult = {
      consent_ok: true,
      consent_id: 'consent_123',
      reason: 'Consent valid within grace period',
      grace_period_active: true,
      expires_at: new Date(Date.now() + 300000).toISOString() // 5 minutes
    }
    
    expect(result.grace_period_active).toBe(true)
    expect(result.expires_at).toBeDefined()
  })
})