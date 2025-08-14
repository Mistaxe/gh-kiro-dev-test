import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { build } from '../../../test/helper.js';
describe('Dev Routes', () => {
    let app;
    beforeEach(async () => {
        // Set NODE_ENV to development to enable dev routes
        process.env.NODE_ENV = 'development';
        app = await build();
    });
    afterEach(async () => {
        await app.close();
        delete process.env.NODE_ENV;
    });
    describe('POST /dev/policy/simulate', () => {
        it('should simulate policy decision with valid input', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/dev/policy/simulate',
                payload: {
                    subject: {
                        role: 'CaseManager'
                    },
                    object: {
                        type: 'Client',
                        id: 'client_123',
                        tenant_root_id: 'org_456'
                    },
                    action: 'read',
                    context: {
                        purpose: 'care',
                        consent_ok: true,
                        contains_phi: true,
                        same_org: true,
                        assigned_to_user: true,
                        tenant_root_id: 'org_456'
                    }
                }
            });
            expect(response.statusCode).toBe(200);
            const result = response.json();
            expect(result).toHaveProperty('decision');
            expect(result.decision).toMatch(/^(allow|deny)$/);
            expect(result).toHaveProperty('reasoning');
            expect(result).toHaveProperty('policy_version');
            expect(result).toHaveProperty('context_snapshot');
            expect(result).toHaveProperty('correlation_id');
            expect(result).toHaveProperty('evaluation_steps');
            // Verify context snapshot includes required fields
            expect(result.context_snapshot).toBeDefined();
            expect(result.context_snapshot).toHaveProperty('tenant_root_id');
            expect(result.context_snapshot.tenant_root_id).toBe('org_456');
        });
        it('should handle missing tenant_root_id in context', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/dev/policy/simulate',
                payload: {
                    subject: {
                        role: 'CaseManager'
                    },
                    object: {
                        type: 'Client',
                        id: 'client_123',
                        tenant_root_id: 'org_456'
                    },
                    action: 'read',
                    context: {
                        purpose: 'care',
                        consent_ok: true
                    }
                }
            });
            expect(response.statusCode).toBe(200);
            const result = response.json();
            // Should use object.tenant_root_id as fallback
            expect(result.context_snapshot.tenant_root_id).toBe('org_456');
        });
        it('should require mandatory fields', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/dev/policy/simulate',
                payload: {
                    subject: {
                        role: 'CaseManager'
                    },
                    // Missing object and action
                }
            });
            expect(response.statusCode).toBe(400);
        });
        it('should include evaluation steps for debugging', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/dev/policy/simulate',
                payload: {
                    subject: {
                        role: 'CaseManager'
                    },
                    object: {
                        type: 'Client',
                        id: 'client_123'
                    },
                    action: 'read'
                }
            });
            expect(response.statusCode).toBe(200);
            const result = response.json();
            expect(result.evaluation_steps).toBeInstanceOf(Array);
            expect(result.evaluation_steps.length).toBeGreaterThan(0);
            expect(result.evaluation_steps[0]).toContain('Evaluated subject: CaseManager');
        });
    });
    describe('POST /dev/policy/reload', () => {
        it('should reload policies successfully', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/dev/policy/reload'
            });
            expect(response.statusCode).toBe(200);
            const result = response.json();
            expect(result).toHaveProperty('success', true);
            expect(result).toHaveProperty('message');
            expect(result).toHaveProperty('policy_version');
            expect(result.message).toContain('reloaded successfully');
        });
    });
    describe('GET /health', () => {
        it('should include policy version in health check', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/health'
            });
            expect(response.statusCode).toBe(200);
            const result = response.json();
            expect(result).toHaveProperty('status', 'healthy');
            expect(result).toHaveProperty('policy_version');
            expect(result.policy_version).toBeDefined();
            expect(typeof result.policy_version).toBe('string');
        });
    });
    describe('Production environment', () => {
        it('should not register dev routes in production', async () => {
            await app.close();
            // Set production environment
            process.env.NODE_ENV = 'production';
            app = await build();
            const simulateResponse = await app.inject({
                method: 'POST',
                url: '/dev/policy/simulate',
                payload: {
                    subject: { role: 'CaseManager' },
                    object: { type: 'Client', id: 'client_123' },
                    action: 'read'
                }
            });
            const reloadResponse = await app.inject({
                method: 'POST',
                url: '/dev/policy/reload'
            });
            // Both should return 404 in production
            expect(simulateResponse.statusCode).toBe(404);
            expect(reloadResponse.statusCode).toBe(404);
        });
    });
});
//# sourceMappingURL=dev.test.js.map