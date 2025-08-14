import { describe, it, expect, beforeEach } from 'vitest'
import { BaseContextBuilder } from '../base-context-builder.js'
import { AuthorizationContextValidator } from '@app/shared'

describe('BaseContextBuilder', () => {
  let builder: BaseContextBuilder
  
  beforeEach(() => {
    builder = new BaseContextBuilder()
  })
  
  describe('buildBaseContext', () => {
    it('should build base context with correlation ID', async () => {
      const context = await builder.buildBaseContext('user_123', {
        correlation_id: 'test_correlation'
      })
      
      expect(context.correlation_id).toBe('test_correlation')
      expect(context.purpose).toBe('care') // default purpose
    })
    
    it('should use provided purpose', async () => {
      const context = await builder.buildBaseContext('user_123', {
        purpose: 'billing'
      })
      
      expect(context.purpose).toBe('billing')
    })
  })
  
  describe('buildClientContext', () => {
    it('should build valid client context with mandatory fields', async () => {
      const context = await builder.buildClientContext('user_123', 'client_456', 'read')
      
      // Validate mandatory fields
      const errors = AuthorizationContextValidator.validateMandatoryFields(context)
      expect(errors).toHaveLength(0)
      
      // Check required fields are present
      expect(context.tenant_root_id).toBeDefined()
      expect(context.contains_phi).toBeDefined()
      expect(context.consent_ok).toBeDefined()
    })
    
    it('should include assignment context', async () => {
      const context = await builder.buildClientContext('user_123', 'client_456', 'read')
      
      expect(context.assigned_to_user).toBeDefined()
      expect(context.shares_program).toBeDefined()
      expect(context.program_access_level).toBeDefined()
    })
    
    it('should include organizational scope', async () => {
      const context = await builder.buildClientContext('user_123', 'client_456', 'read')
      
      expect(context.same_org).toBeDefined()
      expect(context.org_scope).toBeDefined()
    })
  })
  
  describe('buildNoteContext', () => {
    it('should build valid note context with mandatory fields', async () => {
      const context = await builder.buildNoteContext('user_123', 'note_456', 'read')
      
      // Validate mandatory fields
      const errors = AuthorizationContextValidator.validateMandatoryFields(context)
      expect(errors).toHaveLength(0)
      
      expect(context.tenant_root_id).toBeDefined()
    })
    
    it('should include self_scope for author context', async () => {
      const context = await builder.buildNoteContext('user_123', 'note_456', 'read')
      
      expect(context.self_scope).toBeDefined()
    })
  })
  
  describe('buildReferralContext', () => {
    it('should build valid referral context with mandatory fields', async () => {
      const context = await builder.buildReferralContext('user_123', 'referral_456', 'read')
      
      // Validate mandatory fields
      const errors = AuthorizationContextValidator.validateMandatoryFields(context)
      expect(errors).toHaveLength(0)
      
      expect(context.tenant_root_id).toBeDefined()
    })
    
    it('should include PHI detection context', async () => {
      const context = await builder.buildReferralContext('user_123', 'referral_456', 'read')
      
      expect(context.contains_phi).toBeDefined()
      if (context.contains_phi) {
        expect(context.consent_ok).toBeDefined()
      }
    })
  })
  
  describe('buildReportContext', () => {
    it('should build valid report context with mandatory fields', async () => {
      const context = await builder.buildReportContext('user_123', 'financial_report', 'read')
      
      // Validate mandatory fields
      const errors = AuthorizationContextValidator.validateMandatoryFields(context)
      expect(errors).toHaveLength(0)
      
      expect(context.tenant_root_id).toBeDefined()
    })
    
    it('should set appropriate dataset classification', async () => {
      const identifiedContext = await builder.buildReportContext('user_123', 'identified_report', 'read')
      const deidentifiedContext = await builder.buildReportContext('user_123', 'summary_report', 'read')
      
      expect(identifiedContext.identified_ok).toBe(true)
      expect(identifiedContext.dataset?.deidentified).toBe(false)
      
      expect(deidentifiedContext.dataset?.deidentified).toBe(true)
    })
  })
  
  describe('context validation', () => {
    it('should pass consistency validation for all context types', async () => {
      const contexts = await Promise.all([
        builder.buildClientContext('user_123', 'client_456', 'read'),
        builder.buildNoteContext('user_123', 'note_456', 'read'),
        builder.buildReferralContext('user_123', 'referral_456', 'read'),
        builder.buildReportContext('user_123', 'report_type', 'read')
      ])
      
      contexts.forEach(context => {
        const errors = AuthorizationContextValidator.validateConsistency(context)
        expect(errors).toHaveLength(0)
      })
    })
    
    it('should handle break-glass context properly', async () => {
      const futureTime = new Date(Date.now() + 900000).toISOString() // 15 minutes
      const context = await builder.buildClientContext('user_123', 'client_456', 'read', {
        bg: true,
        bg_expires_at: futureTime
      })
      
      expect(context.bg).toBe(true)
      expect(context.bg_expires_at).toBe(futureTime)
      
      const errors = AuthorizationContextValidator.validateConsistency(context)
      expect(errors).toHaveLength(0)
    })
  })
})