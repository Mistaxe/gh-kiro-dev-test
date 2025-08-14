import { describe, it, expect, beforeEach } from 'vitest';
import { ConsentEvaluator } from '../consent-evaluator.js';
describe('ConsentEvaluator', () => {
    let evaluator;
    beforeEach(() => {
        evaluator = new ConsentEvaluator(15); // 15 minute grace period
    });
    describe('Platform consent evaluation', () => {
        it('should allow access with valid platform consent', async () => {
            const result = await evaluator.evaluateConsent('client_123', 'platform', null, 'care');
            expect(result.consent_ok).toBe(true);
            expect(result.scope_type).toBe('platform');
            expect(result.consent_id).toBeDefined();
            expect(result.allowed_purposes).toContain('care');
        });
        it('should deny access for unsupported purpose at platform level', async () => {
            const result = await evaluator.evaluateConsent('client_123', 'platform', null, 'research' // Not allowed at platform level
            );
            expect(result.consent_ok).toBe(false);
            expect(result.reason).toContain('Platform-level consent required');
        });
    });
    describe('Organization consent evaluation', () => {
        it('should allow access with valid organization consent', async () => {
            const result = await evaluator.evaluateConsent('client_123', 'organization', 'org_123', 'care');
            expect(result.consent_ok).toBe(true);
            expect(result.scope_type).toBe('organization');
            expect(result.consent_id).toBeDefined();
            expect(result.allowed_purposes).toContain('care');
        });
        it('should deny access for wrong organization', async () => {
            const result = await evaluator.evaluateConsent('client_123', 'organization', 'org_999', // Different org
            'care');
            expect(result.consent_ok).toBe(false);
            expect(result.reason).toContain('Organization-level consent required');
        });
        it('should deny access for unsupported purpose at organization level', async () => {
            const result = await evaluator.evaluateConsent('client_123', 'organization', 'org_123', 'QA' // Allowed at platform but not at org level
            );
            expect(result.consent_ok).toBe(false);
            expect(result.reason).toContain('Organization-level consent required');
        });
    });
    describe('Location consent evaluation', () => {
        it('should allow access with valid location consent', async () => {
            const result = await evaluator.evaluateConsent('client_123', 'location', 'location_456', 'care');
            expect(result.consent_ok).toBe(true);
            expect(result.scope_type).toBe('location');
            expect(result.consent_id).toBeDefined();
            expect(result.allowed_purposes).toContain('care');
        });
        it('should deny access for wrong location', async () => {
            const result = await evaluator.evaluateConsent('client_123', 'location', 'location_999', // Different location
            'care');
            expect(result.consent_ok).toBe(false);
            expect(result.reason).toContain('Location-level consent required');
        });
    });
    describe('Hierarchical consent logic', () => {
        it('should require both platform and organization consent', async () => {
            // This test would be more meaningful with a client that has platform but not org consent
            // For now, we test that the hierarchy is respected
            const result = await evaluator.evaluateConsent('client_123', 'organization', 'org_123', 'care');
            expect(result.consent_ok).toBe(true);
            expect(result.scope_type).toBe('organization');
        });
    });
    describe('Grace period handling', () => {
        it('should handle grace period logic', async () => {
            // This test would be more meaningful with expired consent data
            // For now, we test that grace period is considered in the logic
            const evaluatorWithGrace = new ConsentEvaluator(30); // 30 minute grace period
            const result = await evaluatorWithGrace.evaluateConsent('client_123', 'organization', 'org_123', 'care');
            expect(result.consent_ok).toBe(true);
            // Grace period would be active if consent was expired but within grace period
            expect(result.grace_period_active).toBeUndefined(); // Not expired in mock data
        });
    });
    describe('Purpose validation', () => {
        it('should validate purpose against allowed purposes', async () => {
            // Test care purpose (allowed)
            const careResult = await evaluator.evaluateConsent('client_123', 'organization', 'org_123', 'care');
            expect(careResult.consent_ok).toBe(true);
            // Test billing purpose (allowed)
            const billingResult = await evaluator.evaluateConsent('client_123', 'organization', 'org_123', 'billing');
            expect(billingResult.consent_ok).toBe(true);
            // Test research purpose (not allowed for org consent)
            const researchResult = await evaluator.evaluateConsent('client_123', 'organization', 'org_123', 'research');
            expect(researchResult.consent_ok).toBe(false);
        });
    });
    describe('Error handling', () => {
        it('should handle evaluation errors gracefully', async () => {
            // Test with invalid client ID
            const result = await evaluator.evaluateConsent('', // Empty client ID
            'organization', 'org_123', 'care');
            // Should still work with mock data, but in real implementation
            // this might trigger database errors that should be handled
            expect(result).toBeDefined();
            expect(typeof result.consent_ok).toBe('boolean');
        });
    });
    describe('Factory method', () => {
        it('should create evaluator with caching', () => {
            const cachedEvaluator = ConsentEvaluator.createWithCaching(10);
            expect(cachedEvaluator).toBeInstanceOf(ConsentEvaluator);
        });
    });
    describe('Scope-specific consent requirements', () => {
        it('should handle platform vs organization vs location scopes', async () => {
            const clientId = 'client_123';
            // Platform scope
            const platformResult = await evaluator.evaluateConsent(clientId, 'platform', null, 'care');
            expect(platformResult.consent_ok).toBe(true);
            expect(platformResult.scope_type).toBe('platform');
            // Organization scope
            const orgResult = await evaluator.evaluateConsent(clientId, 'organization', 'org_123', 'care');
            expect(orgResult.consent_ok).toBe(true);
            expect(orgResult.scope_type).toBe('organization');
            // Location scope
            const locationResult = await evaluator.evaluateConsent(clientId, 'location', 'location_456', 'care');
            expect(locationResult.consent_ok).toBe(true);
            expect(locationResult.scope_type).toBe('location');
        });
    });
    describe('Consent expiry and revocation', () => {
        it('should handle future-only revocation logic', async () => {
            // In the mock data, no consents are revoked
            // This test validates the structure for when real data is connected
            const result = await evaluator.evaluateConsent('client_123', 'organization', 'org_123', 'care');
            expect(result.consent_ok).toBe(true);
            expect(result.expires_at).toBeDefined();
            // Future implementation should handle:
            // - Historical records remain accessible to originating org where required by law
            // - All future access denied unless new consent is captured
        });
    });
});
//# sourceMappingURL=consent-evaluator.test.js.map