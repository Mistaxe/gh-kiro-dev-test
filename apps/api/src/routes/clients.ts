import { FastifyPluginAsync } from 'fastify'
import { authorize } from '../middleware/authorize.js'
import { clientService } from '../services/client-service.js'
import { createClientContextBuilder } from '../context/client-context-builder.js'
import {
  CreateClientSchema,
  UpdateClientSchema,
  SearchClientsSchema,
  LinkClientSchema,
  type CreateClientRequest,
  type UpdateClientRequest,
  type SearchClientsQuery,
  type LinkClientRequest
} from '../schemas/clients.js'

const clientContextBuilder = createClientContextBuilder()

/**
 * Client Management Routes
 * 
 * Implements RESTful API for client management with:
 * - CRUD operations with fingerprint generation
 * - Duplicate detection using privacy-preserving fingerprints
 * - Cross-org client linking with consent validation
 * - Search with minimal candidate info display
 * - PHI protection with consent gates
 */
const router: FastifyPluginAsync = async (app) => {



  /**
   * POST /clients - Create a new client
   */
  app.post('/clients', {
    schema: {
      description: 'Create a new client with fingerprint generation',
      tags: ['Clients'],
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        properties: {
          pii_ref: {
            type: 'object',
            properties: {
              first_name: { type: 'string' },
              last_name: { type: 'string' },
              dob: { type: 'string' },
              ssn_last4: { type: 'string' },
              phone: { type: 'string' },
              email: { type: 'string' }
            }
          },
          flags: { type: 'object' },
          primary_location_id: { type: 'string', format: 'uuid' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            fingerprint: { type: 'string' }
          }
        }
      }
    },
    preHandler: authorize(async (req) => {
      const body = req.body as CreateClientRequest
      
      // Build context for client creation
      return {
        purpose: (req.headers['x-purpose-of-use'] as any) || 'care',
        contains_phi: !!(body.pii_ref && Object.keys(body.pii_ref).length > 0),
        consent_ok: true, // For creation, we assume consent is handled at UI level
        tenant_root_id: 'temp' // Will be set by the RPC function based on user's org
      }
    })
  }, async (req, reply) => {
    const body = req.body as CreateClientRequest
    const userId = req.user?.auth_user_id

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    try {
      const result = await clientService.createClient(userId, body)
      
      reply.code(201).send(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      
      if (message.includes('authentication_required')) {
        return reply.code(401).send({ error: 'Authentication required' })
      }
      if (message.includes('insufficient_permissions')) {
        return reply.code(403).send({ error: 'Insufficient permissions' })
      }
      
      return reply.code(500).send({ error: message })
    }
  })

  /**
   * GET /clients/search - Search for clients with minimal candidate info
   */
  app.get('/clients/search', {
    schema: {
      description: 'Search for clients with minimal candidate info display',
      tags: ['Clients'],
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          search_term: { type: 'string' },
          fingerprint: { type: 'string' },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 }
        }
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              initials: { type: 'string' },
              approximate_age: { type: 'number', nullable: true },
              fingerprint_match: { type: 'boolean' },
              same_org: { type: 'boolean' },
              created_at: { type: 'string' }
            }
          }
        }
      }
    },
    preHandler: authorize(async (req) => {
      // Search doesn't require specific consent, but is logged
      return {
        purpose: (req.headers['x-purpose-of-use'] as any) || 'care',
        contains_phi: false, // Search returns minimal info only
        consent_ok: false, // No consent needed for minimal candidate info
        tenant_root_id: 'temp' // Will be determined by user's org membership
      }
    })
  }, async (req, reply) => {
    const query = req.query as SearchClientsQuery
    const userId = req.user?.auth_user_id

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    try {
      const results = await clientService.searchClients(userId, query)
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
   * GET /clients/:id - Get client details with consent validation
   */
  app.get('/clients/:id', {
    schema: {
      description: 'Get client details with consent validation',
      tags: ['Clients'],
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
            id: { type: 'string' },
            access_level: { type: 'string', enum: ['full', 'minimal'] },
            // Full access properties
            tenant_root_id: { type: 'string' },
            owner_org_id: { type: 'string' },
            primary_location_id: { type: 'string', nullable: true },
            pii_ref: { type: 'object' },
            flags: { type: 'object' },
            fingerprint: { type: 'string' },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
            // Minimal access properties
            initials: { type: 'string' },
            approximate_age: { type: 'number', nullable: true },
            consent_required: { type: 'boolean' }
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

      // Build comprehensive client context
      return await clientContextBuilder.buildClientContext(
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
      const client = await clientService.getClient(userId, id, req.authContext!)
      reply.send(client)
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
   * PUT /clients/:id - Update client information
   */
  app.put('/clients/:id', {
    schema: {
      description: 'Update client information with consent validation',
      tags: ['Clients'],
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
          pii_ref: { type: 'object' },
          flags: { type: 'object' },
          primary_location_id: { type: 'string', format: 'uuid' }
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
      const body = req.body as UpdateClientRequest
      const userId = req.user?.auth_user_id
      
      if (!userId) {
        throw new Error('Authentication required')
      }

      // Build context for client update
      return await clientContextBuilder.buildClientContext(
        userId,
        id,
        'update',
        {
          purpose: (req.headers['x-purpose-of-use'] as any) || 'care',
          contains_phi: !!(body.pii_ref && Object.keys(body.pii_ref).length > 0)
        }
      )
    })
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as UpdateClientRequest
    const userId = req.user?.auth_user_id

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    try {
      await clientService.updateClient(userId, id, body, req.authContext!)
      reply.send({ success: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      
      if (message.includes('not found')) {
        return reply.code(404).send({ error: 'Client not found' })
      }
      if (message.includes('Consent required')) {
        return reply.code(403).send({ 
          error: 'Consent required for PHI updates',
          code: 'CONSENT_REQUIRED'
        })
      }
      if (message.includes('insufficient_permissions')) {
        return reply.code(403).send({ error: 'Insufficient permissions' })
      }
      
      return reply.code(500).send({ error: message })
    }
  })

  /**
   * POST /clients/:id/link - Link client to another organization
   */
  app.post('/clients/:id/link', {
    schema: {
      description: 'Link client to another organization with consent validation',
      tags: ['Clients'],
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
          to_org_id: { type: 'string', format: 'uuid' },
          reason: { type: 'string', minLength: 1 },
          consent_id: { type: 'string', format: 'uuid' }
        },
        required: ['to_org_id', 'reason']
      },
      response: {
        201: {
          type: 'object',
          properties: {
            link_id: { type: 'string' }
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

      // Build context for client linking (requires consent for cross-org access)
      return await clientContextBuilder.buildClientContext(
        userId,
        id,
        'link',
        {
          purpose: (req.headers['x-purpose-of-use'] as any) || 'care',
          contains_phi: true, // Linking involves PHI access
          two_person_rule: false // Could be enabled for high-security environments
        }
      )
    })
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as LinkClientRequest
    const userId = req.user?.auth_user_id

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    try {
      const result = await clientService.linkClient(
        userId,
        id,
        body.to_org_id,
        body.reason,
        body.consent_id
      )
      
      reply.code(201).send(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      
      if (message.includes('not found')) {
        return reply.code(404).send({ error: 'Client not found' })
      }
      if (message.includes('insufficient_permissions')) {
        return reply.code(403).send({ error: 'Insufficient permissions' })
      }
      if (message.includes('self_link_not_allowed')) {
        return reply.code(400).send({ error: 'Cannot link client to same organization' })
      }
      if (message.includes('link_already_exists')) {
        return reply.code(409).send({ error: 'Link already exists between these organizations' })
      }
      
      return reply.code(500).send({ error: message })
    }
  })

  /**
   * GET /clients/:id/links - Get client link history
   */
  app.get('/clients/:id/links', {
    schema: {
      description: 'Get client link history for audit purposes',
      tags: ['Clients'],
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
              id: { type: 'string' },
              client_id: { type: 'string' },
              from_org_id: { type: 'string' },
              to_org_id: { type: 'string' },
              consent_id: { type: 'string', nullable: true },
              reason: { type: 'string' },
              linked_by: { type: 'string' },
              linked_at: { type: 'string' },
              unlinked_at: { type: 'string', nullable: true },
              unlinked_by: { type: 'string', nullable: true },
              unlink_reason: { type: 'string', nullable: true }
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

      // Build context for viewing link history (audit access)
      return await clientContextBuilder.buildClientContext(
        userId,
        id,
        'read',
        {
          purpose: 'oversight', // Link history is for oversight/audit purposes
          contains_phi: false // Link history doesn't contain PHI
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
      const links = await clientService.getClientLinks(userId, id)
      reply.send(links)
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
   * GET /clients/duplicates/:fingerprint - Detect duplicate clients
   */
  app.get('/clients/duplicates/:fingerprint', {
    schema: {
      description: 'Detect duplicate clients using fingerprint matching',
      tags: ['Clients'],
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        properties: {
          fingerprint: { type: 'string' }
        },
        required: ['fingerprint']
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              initials: { type: 'string' },
              approximate_age: { type: 'number', nullable: true },
              fingerprint_match: { type: 'boolean' },
              same_org: { type: 'boolean' },
              created_at: { type: 'string' }
            }
          }
        }
      }
    },
    preHandler: authorize(async (req) => {
      // Duplicate detection returns minimal info only
      return {
        purpose: 'care',
        contains_phi: false,
        consent_ok: false,
        tenant_root_id: 'temp'
      }
    })
  }, async (req, reply) => {
    const { fingerprint } = req.params as { fingerprint: string }
    const userId = req.user?.auth_user_id

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    try {
      const duplicates = await clientService.detectDuplicates(userId, fingerprint)
      reply.send(duplicates)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return reply.code(500).send({ error: message })
    }
  })
}

export default router