import { FastifyPluginAsync } from 'fastify'
import { authorize } from '../middleware/authorize.js'
import { referralService } from '../services/referral-service.js'
import { createReferralContextBuilder } from '../context/referral-context-builder.js'
import {
  CreateReferralSchema,
  UpdateReferralSchema,
  SearchReferralsSchema,
  RespondToReferralSchema,
  ReferralResponseSchema,
  SearchReferralsResponseSchema,
  ServiceMatchResponseSchema,
  type CreateReferralRequest,
  type UpdateReferralRequest,
  type SearchReferralsQuery,
  type RespondToReferralRequest
} from '../schemas/referrals.js'

const referralContextBuilder = createReferralContextBuilder()

/**
 * Referral Management Routes
 * 
 * Implements RESTful API for referral workflow with:
 * - CRUD operations with direct vs record-keeping types
 * - PHI detection and consent validation for referrals
 * - Visibility scope controls and status tracking
 * - Referral search and matching functionality
 */
const router: FastifyPluginAsync = async (app) => {

  /**
   * POST /referrals - Create a new referral
   */
  app.post('/referrals', {
    schema: {
      description: 'Create a new referral with PHI detection and consent validation',
      tags: ['Referrals'],
      security: [{ Bearer: [] }],
      body: CreateReferralSchema,
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
      const body = req.body as CreateReferralRequest
      
      // Build context for referral creation
      return {
        purpose: (req.headers['x-purpose-of-use'] as any) || 'care',
        contains_phi: !!(body.client_id), // Assume PHI if client is associated
        consent_ok: !!(body.consent_id), // Consent provided if consent_id present
        tenant_root_id: 'temp' // Will be set by the RPC function based on user's org
      }
    })
  }, async (req, reply) => {
    const body = req.body as CreateReferralRequest
    const userId = req.user?.auth_user_id

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    try {
      const result = await referralService.createReferral(userId, body)
      reply.code(201).send(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      
      if (message.includes('authentication_required')) {
        return reply.code(401).send({ error: 'Authentication required' })
      }
      if (message.includes('insufficient_permissions')) {
        return reply.code(403).send({ error: 'Insufficient permissions' })
      }
      if (message.includes('target_location_not_found')) {
        return reply.code(404).send({ error: 'Target location not found' })
      }
      if (message.includes('client_not_found')) {
        return reply.code(404).send({ error: 'Client not found' })
      }
      if (message.includes('consent_required_for_phi')) {
        return reply.code(400).send({ 
          error: 'Consent required for PHI-containing referrals',
          code: 'CONSENT_REQUIRED'
        })
      }
      if (message.includes('invalid_consent')) {
        return reply.code(400).send({ error: 'Invalid or expired consent' })
      }
      
      return reply.code(500).send({ error: message })
    }
  })

  /**
   * GET /referrals/search - Search referrals with visibility controls
   */
  app.get('/referrals/search', {
    schema: {
      description: 'Search referrals with visibility controls',
      tags: ['Referrals'],
      security: [{ Bearer: [] }],
      querystring: SearchReferralsSchema,
      response: {
        200: SearchReferralsResponseSchema
      }
    },
    preHandler: authorize(async (req) => {
      // Search context - PHI access depends on individual referral visibility
      return {
        purpose: (req.headers['x-purpose-of-use'] as any) || 'care',
        contains_phi: false, // Will be evaluated per referral
        consent_ok: false, // Will be evaluated per referral
        tenant_root_id: 'temp' // Will be determined by user's org membership
      }
    })
  }, async (req, reply) => {
    const query = req.query as SearchReferralsQuery
    const userId = req.user?.auth_user_id

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    try {
      const results = await referralService.searchReferrals(userId, query)
      reply.send(results)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      
      if (message.includes('insufficient_permissions')) {
        return reply.code(403).send({ error: 'Insufficient permissions' })
      }
      
      return reply.code(500).send({ error: message })
    }
  })

  /**
   * GET /referrals/:id - Get specific referral with authorization
   */
  app.get('/referrals/:id', {
    schema: {
      description: 'Get specific referral with authorization',
      tags: ['Referrals'],
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      response: {
        200: ReferralResponseSchema
      }
    },
    preHandler: authorize(async (req) => {
      const { id } = req.params as { id: string }
      const userId = req.user?.auth_user_id
      
      if (!userId) {
        throw new Error('Authentication required')
      }

      // Build comprehensive referral context
      return await referralContextBuilder.buildReferralContext(
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
      const referral = await referralService.getReferral(userId, id, req.authContext!)
      reply.send(referral)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      
      if (message.includes('not found')) {
        return reply.code(404).send({ error: 'Referral not found' })
      }
      if (message.includes('insufficient_permissions')) {
        return reply.code(403).send({ error: 'Insufficient permissions' })
      }
      
      return reply.code(500).send({ error: message })
    }
  })

  /**
   * PUT /referrals/:id - Update referral (creator only, pending only)
   */
  app.put('/referrals/:id', {
    schema: {
      description: 'Update referral (creator only, pending only)',
      tags: ['Referrals'],
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      body: UpdateReferralSchema,
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

      // Build context for referral update
      return await referralContextBuilder.buildReferralContext(
        userId,
        id,
        'update',
        {
          purpose: (req.headers['x-purpose-of-use'] as any) || 'care'
        }
      )
    })
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as UpdateReferralRequest
    const userId = req.user?.auth_user_id

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    try {
      await referralService.updateReferral(userId, id, body, req.authContext!)
      reply.send({ success: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      
      if (message.includes('not found')) {
        return reply.code(404).send({ error: 'Referral not found' })
      }
      if (message.includes('Only the referral creator')) {
        return reply.code(403).send({ error: 'Only the referral creator can update the referral' })
      }
      if (message.includes('Only pending referrals')) {
        return reply.code(400).send({ error: 'Only pending referrals can be updated' })
      }
      if (message.includes('insufficient_permissions')) {
        return reply.code(403).send({ error: 'Insufficient permissions' })
      }
      
      return reply.code(500).send({ error: message })
    }
  })

  /**
   * POST /referrals/:id/respond - Respond to referral (accept/decline)
   */
  app.post('/referrals/:id/respond', {
    schema: {
      description: 'Respond to referral (accept/decline)',
      tags: ['Referrals'],
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      body: RespondToReferralSchema,
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

      // Build context for referral response
      return await referralContextBuilder.buildReferralContext(
        userId,
        id,
        'respond',
        {
          purpose: (req.headers['x-purpose-of-use'] as any) || 'care'
        }
      )
    })
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as RespondToReferralRequest
    const userId = req.user?.auth_user_id

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    try {
      await referralService.respondToReferral(userId, id, body)
      reply.send({ success: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      
      if (message.includes('referral_not_found_or_no_access')) {
        return reply.code(404).send({ error: 'Referral not found or no access to respond' })
      }
      if (message.includes('invalid_status_transition')) {
        return reply.code(400).send({ error: 'Invalid status transition' })
      }
      if (message.includes('insufficient_permissions')) {
        return reply.code(403).send({ error: 'Insufficient permissions' })
      }
      
      return reply.code(500).send({ error: message })
    }
  })

  /**
   * POST /referrals/:id/cancel - Cancel referral (creator only)
   */
  app.post('/referrals/:id/cancel', {
    schema: {
      description: 'Cancel referral (creator only)',
      tags: ['Referrals'],
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

      // Build context for referral cancellation
      return await referralContextBuilder.buildReferralContext(
        userId,
        id,
        'cancel',
        {
          purpose: (req.headers['x-purpose-of-use'] as any) || 'care'
        }
      )
    })
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { reason } = req.body as { reason: string }
    const userId = req.user?.auth_user_id

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    try {
      await referralService.cancelReferral(userId, id, reason, req.authContext!)
      reply.send({ success: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      
      if (message.includes('not found')) {
        return reply.code(404).send({ error: 'Referral not found' })
      }
      if (message.includes('Only the referral creator')) {
        return reply.code(403).send({ error: 'Only the referral creator can cancel the referral' })
      }
      if (message.includes('Only pending referrals')) {
        return reply.code(400).send({ error: 'Only pending referrals can be cancelled' })
      }
      if (message.includes('insufficient_permissions')) {
        return reply.code(403).send({ error: 'Insufficient permissions' })
      }
      
      return reply.code(500).send({ error: message })
    }
  })

  /**
   * GET /referrals/:id/match-services - Match referral to available services
   */
  app.get('/referrals/:id/match-services', {
    schema: {
      description: 'Match referral to available services',
      tags: ['Referrals'],
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      response: {
        200: ServiceMatchResponseSchema
      }
    },
    preHandler: authorize(async (req) => {
      const { id } = req.params as { id: string }
      const userId = req.user?.auth_user_id
      
      if (!userId) {
        throw new Error('Authentication required')
      }

      // Build context for service matching
      return await referralContextBuilder.buildReferralContext(
        userId,
        id,
        'match_services',
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
      const matches = await referralService.matchReferralServices(userId, id)
      reply.send(matches)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      
      if (message.includes('referral_not_found')) {
        return reply.code(404).send({ error: 'Referral not found' })
      }
      if (message.includes('insufficient_permissions')) {
        return reply.code(403).send({ error: 'Insufficient permissions' })
      }
      
      return reply.code(500).send({ error: message })
    }
  })

  /**
   * GET /referrals/sent - Get referrals sent by user
   */
  app.get('/referrals/sent', {
    schema: {
      description: 'Get referrals sent by user',
      tags: ['Referrals'],
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'accepted', 'declined', 'completed', 'cancelled'] },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 50 }
        }
      },
      response: {
        200: SearchReferralsResponseSchema
      }
    },
    preHandler: authorize(async (req) => {
      // User's own sent referrals
      return {
        purpose: 'care',
        contains_phi: false, // Will be evaluated per referral
        consent_ok: true,
        tenant_root_id: 'temp'
      }
    })
  }, async (req, reply) => {
    const { status, limit } = req.query as { status?: string; limit?: number }
    const userId = req.user?.auth_user_id

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    try {
      const results = await referralService.getSentReferrals(userId, status, limit || 50)
      reply.send(results)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return reply.code(500).send({ error: message })
    }
  })

  /**
   * GET /referrals/received - Get referrals received by user's locations
   */
  app.get('/referrals/received', {
    schema: {
      description: 'Get referrals received by user\'s locations',
      tags: ['Referrals'],
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'accepted', 'declined', 'completed', 'cancelled'] },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 50 }
        }
      },
      response: {
        200: SearchReferralsResponseSchema
      }
    },
    preHandler: authorize(async (req) => {
      // Received referrals for user's locations
      return {
        purpose: 'care',
        contains_phi: false, // Will be evaluated per referral
        consent_ok: false, // Will be evaluated per referral
        tenant_root_id: 'temp'
      }
    })
  }, async (req, reply) => {
    const { status, limit } = req.query as { status?: string; limit?: number }
    const userId = req.user?.auth_user_id

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    try {
      const results = await referralService.getReceivedReferrals(userId, status, limit || 50)
      reply.send(results)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return reply.code(500).send({ error: message })
    }
  })

  /**
   * GET /referrals/stats - Get referral statistics for user
   */
  app.get('/referrals/stats', {
    schema: {
      description: 'Get referral statistics for user',
      tags: ['Referrals'],
      security: [{ Bearer: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            sent: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                pending: { type: 'number' },
                accepted: { type: 'number' },
                declined: { type: 'number' }
              }
            },
            received: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                pending: { type: 'number' },
                accepted: { type: 'number' },
                declined: { type: 'number' }
              }
            }
          }
        }
      }
    },
    preHandler: authorize(async (req) => {
      // Statistics don't contain PHI
      return {
        purpose: 'oversight',
        contains_phi: false,
        consent_ok: true,
        tenant_root_id: 'temp'
      }
    })
  }, async (req, reply) => {
    const userId = req.user?.auth_user_id

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    try {
      const stats = await referralService.getReferralStats(userId)
      reply.send(stats)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return reply.code(500).send({ error: message })
    }
  })
}

export default router