import { newEnforcer } from 'casbin';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
let enforcerPromise = null;
let policyVersion = 'v1.0.0'; // TODO: Read from policy file metadata
function getEnforcer() {
    if (!enforcerPromise) {
        // For monorepo, go up two levels from apps/api to reach project root
        const projectRoot = path.resolve(process.cwd(), '../..');
        enforcerPromise = newEnforcer(path.join(projectRoot, 'docs/authz/casbin/model.conf'), path.join(projectRoot, 'docs/authz/casbin/policy.csv'));
    }
    return enforcerPromise;
}
// Audit logging function
async function auditAuthDecision(req, decision) {
    const auditEntry = {
        id: uuidv4(),
        ts: new Date().toISOString(),
        actor_user_id: req.user?.auth_user_id,
        action: req.action,
        resource_type: req.object?.type,
        resource_id: req.object?.id,
        decision: decision.decision,
        reason: decision.reasoning,
        matched_policy: decision.matched_policy,
        ctx: decision.context,
        policy_version: decision.policy_version,
        correlation_id: req.id
    };
    req.log.info(auditEntry, 'Authorization decision audited');
    // TODO: Store in audit_logs table
    // await storeAuditLog(auditEntry);
}
// Authorization middleware factory
export function authorize(contextBuilder) {
    return async (req, reply) => {
        try {
            // Ensure user is authenticated for protected routes
            if (!req.user) {
                const error = {
                    code: 'AUTHENTICATION_REQUIRED',
                    message: 'Authentication required',
                    reason: 'No valid JWT token provided',
                    correlationId: req.id
                };
                reply.code(401).send(error);
                return;
            }
            // Build authorization context if builder provided
            if (contextBuilder) {
                req.ctx = await contextBuilder(req);
                req.authContext = req.ctx; // Set authContext for backward compatibility
            }
            // Ensure required authorization properties are set
            if (!req.subject || !req.object || !req.action) {
                req.log.error({
                    subject: req.subject,
                    object: req.object,
                    action: req.action
                }, 'Missing required authorization properties');
                const error = {
                    code: 'AUTHORIZATION_ERROR',
                    message: 'Authorization configuration error',
                    reason: 'Missing subject, object, or action',
                    correlationId: req.id
                };
                reply.code(500).send(error);
                return;
            }
            // Validate tenant isolation for tenant-scoped resources
            if (req.object.tenant_root_id && !req.ctx?.tenant_root_id) {
                req.log.warn('Tenant-scoped resource accessed without tenant context');
                req.ctx = { ...req.ctx, tenant_root_id: req.object.tenant_root_id };
            }
            // Get Casbin enforcer and make decision
            const enforcer = await getEnforcer();
            const allowed = await enforcer.enforce(req.subject, req.object, req.action, req.ctx || {});
            // Create decision object
            const decision = {
                decision: allowed ? 'allow' : 'deny',
                subject: { role: req.subject.role, user_id: req.user.auth_user_id },
                object: { type: req.object.type, id: req.object.id },
                action: req.action,
                context: req.ctx || { tenant_root_id: req.object.tenant_root_id || 'unknown' },
                matched_policy: 'TODO: Extract matched policy', // TODO: Get from Casbin
                reasoning: allowed ? 'Policy allowed' : 'Policy denied',
                policy_version: policyVersion,
                timestamp: new Date().toISOString(),
                correlation_id: req.id
            };
            // Audit the decision
            await auditAuthDecision(req, decision);
            // Handle denial
            if (!allowed) {
                const error = {
                    code: 'INSUFFICIENT_PERMISSIONS',
                    message: 'Access denied: insufficient permissions',
                    reason: `User role ${req.subject.role} cannot perform action ${req.action} on resource type ${req.object.type}`,
                    hint: 'Contact your administrator for elevated permissions',
                    correlationId: req.id
                };
                reply.code(403).send(error);
                return;
            }
            req.log.debug({
                subject: req.subject,
                object: req.object,
                action: req.action,
                decision: decision.decision
            }, 'Authorization successful');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            req.log.error({ error: errorMessage }, 'Authorization middleware error');
            const errorResponse = {
                code: 'AUTHORIZATION_ERROR',
                message: 'Authorization system error',
                reason: errorMessage,
                correlationId: req.id
            };
            reply.code(500).send(errorResponse);
        }
    };
}
// Hot reload policies (development only)
export async function reloadPolicies() {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('Policy hot reload not allowed in production');
    }
    enforcerPromise = null; // Clear cached enforcer
    policyVersion = `v1.0.0-dev-${Date.now()}`; // Update version
}
export { policyVersion };
//# sourceMappingURL=authorize.js.map