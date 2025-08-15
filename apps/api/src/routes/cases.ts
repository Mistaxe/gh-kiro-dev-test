import { FastifyPluginAsync } from 'fastify'
import { authorize } from '../middleware/authorize.js'
import { caseService } from '../services/case-service.js'
import { createCaseContextBuilder } from '../context/case-context-builder.js'
import {
  CreateCaseSchema,
  UpdateCaseSchema,
  CloseCaseSchema,
  CaseAssignmentSchema,
  CaseloadQuerySchema,
  type CreateCaseRequest,
  type UpdateCaseRequest,
  type CloseCaseRequest,
  type CaseAssignmentRequest,
  type CaseloadQuery
} from '../schemas/cases.js'

const caseContextBuilder = createCaseContextBuilder()

/**
 * Case Management Routes
 * 
 * Implements RESTful API for case management with:
 * - CRUD operations with assignment and program validation
 * - Caseload management with member access controls
 * - Program-based access level enforcement
 * - Case closure workflow with audit trail
 */
const router: FastifyPluginAsync = async (app) => {

  /**
   * POST /cases - Create a new case
   */
  app.post('/cases', {
    schema: {
      description: 'Create a new client case with assignment validation',
      tags: ['Cases'],
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        properties: {
          client_id: { type: 'string', format: 'uuid' },
          location_id: { type: 'string', format: 'uuid' },
          program_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
          assigned_user_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
          status: { type: 'string', enum: ['open', 'active', 'on_hold', 'closed', 'transferred'] }
        },
        required: ['client_id', 'location_id']
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    preHandler: authorize(async (req) => {
      const body = req.body as CreateCaseRequest
      const userId = req.user?.auth_user_id
      
      if (!userId) {
        throw new Error('Authentication required')
      }

      // Build context for case creation
      return await caseContextBuilder.buildCaseContext(
        userId,
        'new', // Special case ID for creation
        'create',
        {
          purpose: (req.headers['x-purpose-of-use'] as any) || 'care',
          contains_phi: true, // Case creation involves PHI (client assignment)
          tenant_root_id: 'temp' // Will be determined by user's org membership
        }
      )
    })
  }, async (req, reply) => {
    const body = req.body as CreateCaseRequest
    const userId = req.user?.auth_user_id

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    try {
      const result = await caseService.createCase(userId, body)
      
      reply.code(201).send(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      
      if (message.includes('authentication_required')) {
        return reply.code(401).send({ error: 'Authentication required' })
      }
      if (message.includes('insufficient_permissions')) {
        return reply.code(403).send({ error: 'Insufficient permissions' })
      }
      if (message.includes('client_not_found')) {
        return reply.code(404).send({ error: 'Client not found' })
      }
      if (message.includes('location_not_found')) {
        return reply.code(404).send({ error: 'Location not found' })
      }
      
      return reply.code(500).send({ error: message })
    }
  })

  /**
   * GET /cases/:id - Get case details with assignment validation
   */
  app.get('/cases/:id', {
    schema: {
      description: 'Get case details with assignment and program validation',
      tags: ['Cases'],
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            client_id: { type: 'string', format: 'uuid' },
            location_id: { type: 'string', format: 'uuid' },
            status: { type: 'string' },
            program_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
            assigned_user_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
            opened_at: { type: 'string' },
            closed_at: { type: 'string', nullable: true },
            access_level: { type: 'string', enum: ['full', 'limited', 'minimal'] },
            client_info: { type: 'object', nullable: true },
            location_info: { type: 'object', nullable: true },
            assigned_users: { type: 'array', items: { type: 'object' } }
          }
        }
      }
    },
    preHandler: authorize(async (req) => {
      const { id } = req.params as { id: string }
      const userId = req.user?.auth_user_id
      
      if (!userId) {
        throw new Error('Authentication required')
      }

      // Build comprehensive case context
      return await caseContextBuilder.buildCaseContext(
        userId,
        id,
        'read',
        {
          purpose: (req.headers['x-purpose-of-use'] as any) || 'care'
        }
      )
    })
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const userId = req.user?.auth_user_id

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    try {
      const caseDetails = await caseService.getCase(userId, id, req.authContext!)
      reply.send(caseDetails)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      
      if (message.includes('not found')) {
        return reply.code(404).send({ error: 'Case not found' })
      }
      if (message.includes('insufficient_permissions')) {
        return reply.code(403).send({ error: 'Insufficient permissions' })
      }
      
      return reply.code(500).send({ error: message })
    }
  })

  /**
   * PUT /cases/:id - Update case information
   */
  app.put('/cases/:id', {
    schema: {
      description: 'Update case with assignment and program validation',
      tags: ['Cases'],
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['open', 'active', 'on_hold', 'closed', 'transferred'] },
          program_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
          assigned_user_ids: { type: 'array', items: { type: 'string', format: 'uuid' } }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }
          }
        }
      }
    },
    preHandler: authorize(async (req) => {
      const { id } = req.params as { id: string }
      const userId = req.user?.auth_user_id
      
      if (!userId) {
        throw new Error('Authentication required')
      }

      // Build context for case update
      return await caseContextBuilder.buildCaseContext(
        userId,
        id,
        'update',
        {
          purpose: (req.headers['x-purpose-of-use'] as any) || 'care',
          contains_phi: true // Case updates involve PHI
        }
      )
    })
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as UpdateCaseRequest
    const userId = req.user?.auth_user_id

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    try {
      await caseService.updateCase(userId, id, body, req.authContext!)
      reply.send({ success: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      
      if (message.includes('not found')) {
        return reply.code(404).send({ error: 'Case not found' })
      }
      if (message.includes('insufficient_permissions')) {
        return reply.code(403).send({ error: 'Insufficient permissions' })
      }
      if (message.includes('invalid_status_transition')) {
        return reply.code(400).send({ error: 'Invalid status transition' })
      }
      
      return reply.code(500).send({ error: message })
    }
  })

  /**
   * POST /cases/:id/close - Close case with audit trail
   */
  app.post('/cases/:id/close', {
    schema: {
      description: 'Close case with audit trail',
      tags: ['Cases'],
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          reason: { type: 'string', minLength: 1, maxLength: 500 }
        },
        required: ['reason']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }
          }
        }
      }
    },
    preHandler: authorize(async (req) => {
      const { id } = req.params as { id: string }
      const userId = req.user?.auth_user_id
      
      if (!userId) {
        throw new Error('Authentication required')
      }

      // Build context for case closure
      return await caseContextBuilder.buildCaseContext(
        userId,
        id,
        'close',
        {
          purpose: (req.headers['x-purpose-of-use'] as any) || 'care',
          contains_phi: true // Case closure involves PHI
        }
      )
    })
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as CloseCaseRequest
    const userId = req.user?.auth_user_id

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    try {
      await caseService.closeCase(userId, id, body.reason, req.authContext!)
      reply.send({ success: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      
      if (message.includes('not found')) {
        return reply.code(404).send({ error: 'Case not found' })
      }
      if (message.includes('insufficient_permissions')) {
        return reply.code(403).send({ error: 'Insufficient permissions' })
      }
      if (message.includes('already_closed')) {
        return reply.code(400).send({ error: 'Case is already closed' })
      }
      
      return reply.code(500).send({ error: message })
    }
  })

  /**
   * GET /cases/caseload - Get user's caseload
   */
  app.get('/cases/caseload', {
    schema: {
      description: 'Get user caseload with member access controls',
      tags: ['Cases'],
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['open', 'active', 'on_hold', 'closed', 'transferred'] },
          program_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
          location_id: { type: 'string', format: 'uuid' },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'number', minimum: 0, default: 0 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            cases: { type: 'array', items: { type: 'object' } },
            total_count: { type: 'number' },
            has_more: { type: 'boolean' }
          }
        }
      }
    },
    preHandler: authorize(async (req) => {
      const userId = req.user?.auth_user_id
      
      if (!userId) {
        throw new Error('Authentication required')
      }

      // Build context for caseload access
      return {
        purpose: (req.headers['x-purpose-of-use'] as any) || 'care',
        contains_phi: true, // Caseload involves PHI (client assignments)
        self_scope: true, // User accessing their own caseload
        tenant_root_id: 'temp' // Will be determined by user's org membership
      }
    })
  }, async (req, reply) => {
    const query = req.query as CaseloadQuery
    const userId = req.user?.auth_user_id

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    try {
      const caseload = await caseService.getUserCaseload(userId, query)
      reply.send(caseload)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      
      if (message.includes('insufficient_permissions')) {
        return reply.code(403).send({ error: 'Insufficient permissions' })
      }
      
      return reply.code(500).send({ error: message })
    }
  })

  /**
   * GET /clients/:clientId/cases - Get cases for a specific client
   */
  app.get('/clients/:clientId/cases', {
    schema: {
      description: 'Get cases for a specific client',
      tags: ['Cases'],
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        properties: {
          clientId: { type: 'string', format: 'uuid' }
        },
        required: ['clientId']
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              location_id: { type: 'string', format: 'uuid' },
              status: { type: 'string' },
              program_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
              assigned_user_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
              opened_at: { type: 'string' },
              closed_at: { type: 'string', nullable: true },
              location_info: { type: 'object', nullable: true },
              access_level: { type: 'string', enum: ['full', 'limited', 'minimal'] }
            }
          }
        }
      }
    },
    preHandler: authorize(async (req) => {
      const { clientId } = req.params as { clientId: string }
      const userId = req.user?.auth_user_id
      
      if (!userId) {
        throw new Error('Authentication required')
      }

      // Build context for client case access
      // This uses client context builder since we're accessing client-related data
      const clientContextBuilder = await import('../context/client-context-builder.js')
      return await clientContextBuilder.createClientContextBuilder().buildClientContext(
        userId,
        clientId,
        'read',
        {
          purpose: (req.headers['x-purpose-of-use'] as any) || 'care'
        }
      )
    })
  }, async (req, reply) => {
    const { clientId } = req.params as { clientId: string }
    const userId = req.user?.auth_user_id

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    try {
      const cases = await caseService.getClientCases(userId, clientId, req.authContext!)
      reply.send(cases)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      
      if (message.includes('not found')) {
        return reply.code(404).send({ error: 'Client not found' })
      }
      if (message.includes('insufficient_permissions')) {
        return reply.code(403).send({ error: 'Insufficient permissions' })
      }
      
      return reply.code(500).send({ error: message })
    }
  })

  /**
   * POST /cases/:id/assign - Assign users to a case
   */
  app.post('/cases/:id/assign', {
    schema: {
      description: 'Assign users to a case with validation',
      tags: ['Cases'],
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          user_ids: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1 },
          reason: { type: 'string', minLength: 1, maxLength: 500 }
        },
        required: ['user_ids', 'reason']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }
          }
        }
      }
    },
    preHandler: authorize(async (req) => {
      const { id } = req.params as { id: string }
      const userId = req.user?.auth_user_id
      
      if (!userId) {
        throw new Error('Authentication required')
      }

      // Build context for case assignment
      return await caseContextBuilder.buildCaseContext(
        userId,
        id,
        'assign',
        {
          purpose: (req.headers['x-purpose-of-use'] as any) || 'care',
          contains_phi: true // Assignment involves PHI
        }
      )
    })
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as CaseAssignmentRequest
    const userId = req.user?.auth_user_id

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    try {
      await caseService.assignUsersToCase(userId, id, body.user_ids, body.reason)
      reply.send({ success: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      
      if (message.includes('not found')) {
        return reply.code(404).send({ error: 'Case not found' })
      }
      if (message.includes('insufficient_permissions')) {
        return reply.code(403).send({ error: 'Insufficient permissions' })
      }
      if (message.includes('invalid_user')) {
        return reply.code(400).send({ error: 'One or more user IDs are invalid' })
      }
      
      return reply.code(500).send({ error: message })
    }
  })

  /**
   * POST /cases/:id/unassign - Unassign users from a case
   */
  app.post('/cases/:id/unassign', {
    schema: {
      description: 'Unassign users from a case with audit trail',
      tags: ['Cases'],
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          user_ids: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1 },
          reason: { type: 'string', minLength: 1, maxLength: 500 }
        },
        required: ['user_ids', 'reason']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }
          }
        }
      }
    },
    preHandler: authorize(async (req) => {
      const { id } = req.params as { id: string }
      const userId = req.user?.auth_user_id
      
      if (!userId) {
        throw new Error('Authentication required')
      }

      // Build context for case unassignment
      return await caseContextBuilder.buildCaseContext(
        userId,
        id,
        'unassign',
        {
          purpose: (req.headers['x-purpose-of-use'] as any) || 'care',
          contains_phi: true // Unassignment involves PHI
        }
      )
    })
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as CaseAssignmentRequest
    const userId = req.user?.auth_user_id

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    try {
      await caseService.unassignUsersFromCase(userId, id, body.user_ids, body.reason)
      reply.send({ success: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      
      if (message.includes('not found')) {
        return reply.code(404).send({ error: 'Case not found' })
      }
      if (message.includes('insufficient_permissions')) {
        return reply.code(403).send({ error: 'Insufficient permissions' })
      }
      if (message.includes('user_not_assigned')) {
        return reply.code(400).send({ error: 'One or more users are not assigned to this case' })
      }
      
      return reply.code(500).send({ error: message })
    }
  })

  /**
   * GET /cases/:id/assignments - Get case assignment history
   */
  app.get('/cases/:id/assignments', {
    schema: {
      description: 'Get case assignment history for audit purposes',
      tags: ['Cases'],
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              case_id: { type: 'string', format: 'uuid' },
              user_id: { type: 'string', format: 'uuid' },
              assigned_by: { type: 'string', format: 'uuid' },
              assigned_at: { type: 'string' },
              unassigned_at: { type: 'string', nullable: true },
              unassigned_by: { type: 'string', format: 'uuid', nullable: true },
              reason: { type: 'string' }
            }
          }
        }
      }
    },
    preHandler: authorize(async (req) => {
      const { id } = req.params as { id: string }
      const userId = req.user?.auth_user_id
      
      if (!userId) {
        throw new Error('Authentication required')
      }

      // Build context for assignment history access (audit access)
      return await caseContextBuilder.buildCaseContext(
        userId,
        id,
        'read',
        {
          purpose: 'oversight', // Assignment history is for oversight/audit purposes
          contains_phi: false // Assignment history metadata doesn't contain PHI
        }
      )
    })
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const userId = req.user?.auth_user_id

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    try {
      const history = await caseService.getCaseAssignmentHistory(userId, id)
      reply.send(history)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      
      if (message.includes('not found')) {
        return reply.code(404).send({ error: 'Case not found' })
      }
      if (message.includes('insufficient_permissions')) {
        return reply.code(403).send({ error: 'Insufficient permissions' })
      }
      
      return reply.code(500).send({ error: message })
    }
  })
}

export default router