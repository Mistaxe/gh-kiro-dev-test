import { FastifyPluginAsync } from 'fastify';
import { reloadPolicies, policyVersion } from '../middleware/authorize.js';
import { newEnforcer } from 'casbin';
import path from 'path';
import fs from 'fs';
import { AuthorizationContext, PolicySimulationResult } from '@app/shared'
import { AuthSubject, AuthObject } from '../types/auth.js'
import { v4 as uuidv4 } from 'uuid'

// Audit policy simulation for development tracking
async function auditPolicySimulation(
  request: any,
  result: PolicySimulationResult
): Promise<void> {
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
  }

  request.log.info(auditEntry, 'Policy simulation audited')
  
  // TODO: Store in audit_logs table when database is available
  // await storeAuditLog(auditEntry);
}

const dev: FastifyPluginAsync = async (app) => {
  // Only register dev routes in development
  if (process.env.NODE_ENV === 'production') {
    return;
  }

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
    const { subject, object, action, context = {} } = request.body as {
      subject: AuthSubject;
      object: AuthObject;
      action: string;
      context?: AuthorizationContext;
    };

    try {
      // For monorepo, go up two levels from apps/api to reach project root
      const projectRoot = path.resolve(process.cwd(), '../..');
      
      const enforcer = await newEnforcer(
        path.join(projectRoot, 'docs/authz/casbin/model.conf'),
        path.join(projectRoot, 'docs/authz/casbin/policy.csv')
      );

      // Ensure context has required tenant_root_id
      const fullContext: AuthorizationContext = {
        tenant_root_id: (context as any).tenant_root_id || object.tenant_root_id || 'unknown',
        correlation_id: request.id,
        ...context
      }

      // Make authorization decision
      const allowed = await enforcer.enforce(subject, object, action, fullContext);

      // Create comprehensive simulation result
      const result: PolicySimulationResult = {
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
      }

      // Audit the simulation
      await auditPolicySimulation(request, result)

      request.log.info({
        subject,
        object,
        action,
        context: fullContext,
        result
      }, 'Policy simulation completed');

      return result;
    } catch (error) {
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
    } catch (error) {
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
};

export default dev;