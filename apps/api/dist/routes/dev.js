import { reloadPolicies, policyVersion } from '../middleware/authorize.js';
import { newEnforcer } from 'casbin';
import path from 'path';
import { PersonaService } from '../services/persona-service.js';
import { v4 as uuidv4 } from 'uuid';
// Audit policy simulation for development tracking
async function auditPolicySimulation(request, result) {
    const auditEntry = {
        id: uuidv4(),
        ts: new Date().toISOString(),
        actor_user_id: 'dev_simulator',
        action: 'policy_simulation',
        resource_type: 'policy_decision',
        resource_id: result.correlation_id,
        decision: result.decision,
        reason: result.reasoning,
        matched_policy: result.matched_policy,
        ctx: result.context,
        policy_version: result.policy_version,
        correlation_id: result.correlation_id,
        simulation_context: {
            subject: result.subject,
            object: result.object,
            action: result.action,
            evaluation_steps: result.evaluation_steps
        }
    };
    request.log.info(auditEntry, 'Policy simulation audited');
    // TODO: Store in audit_logs table when database is available
    // await storeAuditLog(auditEntry);
}
const dev = async (app) => {
    // Only register dev routes in development
    if (process.env.NODE_ENV === 'production') {
        return;
    }
    const personaService = new PersonaService();
    // POST /dev/policy/simulate - Simulate policy decisions
    app.post('/dev/policy/simulate', {
        schema: {
            description: 'Simulate authorization policy decision',
            tags: ['Development'],
            body: {
                type: 'object',
                required: ['subject', 'object', 'action'],
                properties: {
                    subject: {
                        type: 'object',
                        required: ['role'],
                        properties: {
                            role: { type: 'string' },
                            scope_type: { type: 'string' },
                            scope_id: { type: 'string' }
                        }
                    },
                    object: {
                        type: 'object',
                        required: ['type', 'id'],
                        properties: {
                            type: { type: 'string' },
                            id: { type: 'string' },
                            tenant_root_id: { type: 'string' }
                        }
                    },
                    action: { type: 'string' },
                    context: {
                        type: 'object',
                        properties: {
                            purpose: { type: 'string', enum: ['care', 'billing', 'QA', 'oversight', 'research'] },
                            consent_ok: { type: 'boolean' },
                            contains_phi: { type: 'boolean' },
                            same_org: { type: 'boolean' },
                            assigned_to_user: { type: 'boolean' },
                            bg: { type: 'boolean' },
                            tenant_root_id: { type: 'string' }
                        }
                    }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        decision: { type: 'string', enum: ['allow', 'deny'] },
                        subject: {
                            type: 'object',
                            additionalProperties: true
                        },
                        object: {
                            type: 'object',
                            additionalProperties: true
                        },
                        action: { type: 'string' },
                        context: {
                            type: 'object',
                            additionalProperties: true
                        },
                        matched_policy: { type: 'string' },
                        reasoning: { type: 'string' },
                        policy_version: { type: 'string' },
                        timestamp: { type: 'string' },
                        correlation_id: { type: 'string' },
                        context_snapshot: {
                            type: 'object',
                            additionalProperties: true
                        },
                        evaluation_steps: {
                            type: 'array',
                            items: { type: 'string' }
                        }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const { subject, object, action, context = {} } = request.body;
        try {
            // For monorepo, go up two levels from apps/api to reach project root
            const projectRoot = path.resolve(process.cwd(), '../..');
            const enforcer = await newEnforcer(path.join(projectRoot, 'docs/authz/casbin/model.conf'), path.join(projectRoot, 'docs/authz/casbin/policy.csv'));
            // Ensure context has required tenant_root_id
            const fullContext = {
                tenant_root_id: context.tenant_root_id || object.tenant_root_id || 'unknown',
                correlation_id: request.id,
                ...context
            };
            // Make authorization decision
            const allowed = await enforcer.enforce(subject, object, action, fullContext);
            // Create comprehensive simulation result
            const result = {
                decision: allowed ? 'allow' : 'deny',
                subject: { role: subject.role, user_id: 'simulation_user' },
                object: { type: object.type, id: object.id },
                action,
                context: fullContext,
                matched_policy: 'TODO: Extract matched policy rule', // TODO: Get actual matched policy
                reasoning: allowed ? 'Policy evaluation allowed access' : 'Policy evaluation denied access',
                policy_version: policyVersion,
                timestamp: new Date().toISOString(),
                correlation_id: request.id,
                context_snapshot: fullContext,
                evaluation_steps: [
                    `Evaluated subject: ${subject.role}`,
                    `Against object: ${object.type}:${object.id}`,
                    `For action: ${action}`,
                    `With context: ${JSON.stringify(fullContext, null, 2)}`,
                    `Result: ${allowed ? 'ALLOW' : 'DENY'}`
                ]
            };
            // Audit the simulation
            await auditPolicySimulation(request, result);
            request.log.info({
                subject,
                object,
                action,
                context: fullContext,
                result
            }, 'Policy simulation completed');
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            request.log.error({ error: errorMessage }, 'Policy simulation failed');
            return reply.code(500).send({
                code: 'SIMULATION_ERROR',
                message: 'Policy simulation failed',
                reason: errorMessage,
                correlationId: request.id
            });
        }
    });
    // POST /dev/policy/reload - Hot reload policies (development only)
    app.post('/dev/policy/reload', {
        schema: {
            description: 'Hot reload authorization policies (development only)',
            tags: ['Development'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        policy_version: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            await reloadPolicies();
            const result = {
                success: true,
                message: 'Policies reloaded successfully',
                policy_version: policyVersion
            };
            request.log.info(result, 'Policies hot reloaded');
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            request.log.error({ error: errorMessage }, 'Policy reload failed');
            return reply.code(500).send({
                code: 'RELOAD_ERROR',
                message: 'Policy reload failed',
                reason: errorMessage,
                correlationId: request.id
            });
        }
    });
    // GET /dev/personas - List all available personas
    app.get('/dev/personas', {
        schema: {
            description: 'List all available personas for testing',
            tags: ['Development', 'Personas'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        personas: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    auth_user_id: { type: 'string' },
                                    email: { type: 'string' },
                                    display_name: { type: 'string' },
                                    phone: { type: 'string' },
                                    is_helper: { type: 'boolean' },
                                    roles: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                id: { type: 'string' },
                                                role: { type: 'string' },
                                                scope_type: { type: 'string' },
                                                scope_id: { type: 'string' },
                                                expires_at: { type: 'string' }
                                            }
                                        }
                                    },
                                    organizations: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                id: { type: 'string' },
                                                name: { type: 'string' },
                                                tenant_root_id: { type: 'string' }
                                            }
                                        }
                                    },
                                    locations: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                id: { type: 'string' },
                                                name: { type: 'string' },
                                                org_id: { type: 'string' }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        total: { type: 'number' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const result = await personaService.listPersonas();
            request.log.info({ count: result.total }, 'Listed personas for lab testing');
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            request.log.error({ error: errorMessage }, 'Failed to list personas');
            return reply.code(500).send({
                code: 'PERSONA_LIST_ERROR',
                message: 'Failed to list personas',
                reason: errorMessage,
                correlationId: request.id
            });
        }
    });
    // POST /dev/personas/impersonate - Start impersonation session
    app.post('/dev/personas/impersonate', {
        schema: {
            description: 'Start impersonation session for a persona',
            tags: ['Development', 'Personas'],
            body: {
                type: 'object',
                required: ['persona_id'],
                properties: {
                    persona_id: { type: 'string' },
                    active_org_id: { type: 'string' },
                    active_location_id: { type: 'string' },
                    purpose: {
                        type: 'string',
                        enum: ['care', 'billing', 'QA', 'oversight', 'research']
                    }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        session: {
                            type: 'object',
                            properties: {
                                persona_id: { type: 'string' },
                                active_org_id: { type: 'string' },
                                active_location_id: { type: 'string' },
                                purpose: { type: 'string' },
                                session_started_at: { type: 'string' }
                            }
                        },
                        message: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { persona_id, active_org_id, active_location_id, purpose } = request.body;
            const session = await personaService.startImpersonation(persona_id, active_org_id, active_location_id, purpose);
            const response = {
                success: true,
                session,
                message: 'Impersonation session started successfully'
            };
            request.log.info({
                persona_id,
                active_org_id,
                active_location_id,
                purpose
            }, 'Started persona impersonation session');
            return response;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            request.log.error({ error: errorMessage }, 'Failed to start impersonation');
            return reply.code(400).send({
                code: 'IMPERSONATION_ERROR',
                message: 'Failed to start impersonation session',
                reason: errorMessage,
                correlationId: request.id
            });
        }
    });
    // PUT /dev/personas/:personaId/scope - Update scope selection
    app.put('/dev/personas/:personaId/scope', {
        schema: {
            description: 'Update scope selection for current persona session',
            tags: ['Development', 'Personas'],
            params: {
                type: 'object',
                properties: {
                    personaId: { type: 'string' }
                }
            },
            body: {
                type: 'object',
                properties: {
                    active_org_id: { type: 'string' },
                    active_location_id: { type: 'string' },
                    purpose: {
                        type: 'string',
                        enum: ['care', 'billing', 'QA', 'oversight', 'research']
                    }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        session: {
                            type: 'object',
                            properties: {
                                persona_id: { type: 'string' },
                                active_org_id: { type: 'string' },
                                active_location_id: { type: 'string' },
                                purpose: { type: 'string' },
                                session_started_at: { type: 'string' }
                            }
                        },
                        message: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { personaId } = request.params;
            const { active_org_id, active_location_id, purpose } = request.body;
            const session = await personaService.updateScopeSelection(personaId, active_org_id, active_location_id, purpose);
            const response = {
                success: true,
                session,
                message: 'Scope selection updated successfully'
            };
            request.log.info({
                persona_id: personaId,
                active_org_id,
                active_location_id,
                purpose
            }, 'Updated persona scope selection');
            return response;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            request.log.error({ error: errorMessage }, 'Failed to update scope selection');
            return reply.code(400).send({
                code: 'SCOPE_UPDATE_ERROR',
                message: 'Failed to update scope selection',
                reason: errorMessage,
                correlationId: request.id
            });
        }
    });
    // GET /dev/personas/:personaId/session - Get current session
    app.get('/dev/personas/:personaId/session', {
        schema: {
            description: 'Get current session for a persona',
            tags: ['Development', 'Personas'],
            params: {
                type: 'object',
                properties: {
                    personaId: { type: 'string' }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        session: {
                            type: 'object',
                            properties: {
                                persona_id: { type: 'string' },
                                active_org_id: { type: 'string' },
                                active_location_id: { type: 'string' },
                                purpose: { type: 'string' },
                                session_started_at: { type: 'string' }
                            }
                        }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { personaId } = request.params;
            const session = await personaService.getCurrentSession(personaId);
            if (!session) {
                return reply.code(404).send({
                    code: 'SESSION_NOT_FOUND',
                    message: 'No active session found for persona',
                    correlationId: request.id
                });
            }
            return { session };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            request.log.error({ error: errorMessage }, 'Failed to get current session');
            return reply.code(500).send({
                code: 'SESSION_ERROR',
                message: 'Failed to get current session',
                reason: errorMessage,
                correlationId: request.id
            });
        }
    });
    // DELETE /dev/personas/:personaId/session - End impersonation session
    app.delete('/dev/personas/:personaId/session', {
        schema: {
            description: 'End impersonation session for a persona',
            tags: ['Development', 'Personas'],
            params: {
                type: 'object',
                properties: {
                    personaId: { type: 'string' }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { personaId } = request.params;
            await personaService.endImpersonation(personaId);
            request.log.info({ persona_id: personaId }, 'Ended persona impersonation session');
            return {
                success: true,
                message: 'Impersonation session ended successfully'
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            request.log.error({ error: errorMessage }, 'Failed to end impersonation session');
            return reply.code(500).send({
                code: 'SESSION_END_ERROR',
                message: 'Failed to end impersonation session',
                reason: errorMessage,
                correlationId: request.id
            });
        }
    });
};
export default dev;
//# sourceMappingURL=dev.js.map