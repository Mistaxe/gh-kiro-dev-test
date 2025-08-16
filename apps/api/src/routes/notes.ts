import { FastifyPluginAsync } from 'fastify'
import { authorize } from '../middleware/authorize.js'
import { noteService } from '../services/note-service.js'
import { createNoteContextBuilder } from '../context/note-context-builder.js'
import {
  CreateNoteSchema,
  UpdateNoteSchema,
  SearchNotesSchema,
  GrantNoteAccessSchema,
  NoteResponseSchema,
  SearchNotesResponseSchema,
  type CreateNoteRequest,
  type UpdateNoteRequest,
  type SearchNotesQuery,
  type GrantNoteAccessRequest
} from '../schemas/notes.js'

const noteContextBuilder = createNoteContextBuilder()

/**
 * Note Management Routes
 * 
 * Implements RESTful API for note management with:
 * - CRUD operations with helper vs provider classification
 * - Confidential note access with temporary grant support
 * - Helper journal separation from provider case notes
 * - Note search and filtering with authorization
 */
const router: FastifyPluginAsync = async (app) => {

  /**
   * POST /notes - Create a new note
   */
  app.post('/notes', {
    schema: {
      description: 'Create a new note with proper classification',
      tags: ['Notes'],
      security: [{ Bearer: [] }],
      body: CreateNoteSchema,
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
      const body = req.body as CreateNoteRequest
      
      // Build context for note creation
      return {
        purpose: (req.headers['x-purpose-of-use'] as any) || 'care',
        contains_phi: body.contains_phi || false,
        consent_ok: true, // For creation, consent is handled at UI level
        tenant_root_id: 'temp' // Will be set by the RPC function based on subject
      }
    })
  }, async (req, reply) => {
    const body = req.body as CreateNoteRequest
    const userId = req.user?.auth_user_id

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    try {
      const result = await noteService.createNote(userId, body)
      reply.code(201).send(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      
      if (message.includes('authentication_required')) {
        return reply.code(401).send({ error: 'Authentication required' })
      }
      if (message.includes('insufficient_permissions')) {
        return reply.code(403).send({ error: 'Insufficient permissions' })
      }
      if (message.includes('subject_not_found')) {
        return reply.code(404).send({ error: 'Subject not found' })
      }
      
      return reply.code(500).send({ error: message })
    }
  })

  /**
   * GET /notes/search - Search notes with authorization filtering
   */
  app.get('/notes/search', {
    schema: {
      description: 'Search notes with authorization filtering',
      tags: ['Notes'],
      security: [{ Bearer: [] }],
      querystring: SearchNotesSchema,
      response: {
        200: SearchNotesResponseSchema
      }
    },
    preHandler: authorize(async (req) => {
      const query = req.query as SearchNotesQuery
      
      // Search context - PHI access depends on individual note consent
      return {
        purpose: (req.headers['x-purpose-of-use'] as any) || 'care',
        contains_phi: false, // Will be evaluated per note
        consent_ok: false, // Will be evaluated per note
        tenant_root_id: 'temp' // Will be determined by user's org membership
      }
    })
  }, async (req, reply) => {
    const query = req.query as SearchNotesQuery
    const userId = req.user?.auth_user_id

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    try {
      const results = await noteService.searchNotes(userId, query)
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
   * GET /notes/:id - Get specific note with authorization
   */
  app.get('/notes/:id', {
    schema: {
      description: 'Get specific note with authorization',
      tags: ['Notes'],
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      response: {
        200: NoteResponseSchema
      }
    },
    preHandler: authorize(async (req) => {
      const { id } = req.params as { id: string }
      const userId = req.user?.auth_user_id
      
      if (!userId) {
        throw new Error('Authentication required')
      }

      // Build comprehensive note context
      return await noteContextBuilder.buildNoteContext(
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
      const note = await noteService.getNote(userId, id, req.authContext!)
      reply.send(note)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      
      if (message.includes('not found')) {
        return reply.code(404).send({ error: 'Note not found' })
      }
      if (message.includes('insufficient_permissions')) {
        return reply.code(403).send({ error: 'Insufficient permissions' })
      }
      
      return reply.code(500).send({ error: message })
    }
  })

  /**
   * PUT /notes/:id - Update note (author only)
   */
  app.put('/notes/:id', {
    schema: {
      description: 'Update note (author only)',
      tags: ['Notes'],
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      body: UpdateNoteSchema,
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
      const body = req.body as UpdateNoteRequest
      const userId = req.user?.auth_user_id
      
      if (!userId) {
        throw new Error('Authentication required')
      }

      // Build context for note update
      return await noteContextBuilder.buildNoteContext(
        userId,
        id,
        'update',
        {
          purpose: (req.headers['x-purpose-of-use'] as any) || 'care',
          contains_phi: body.contains_phi
        }
      )
    })
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as UpdateNoteRequest
    const userId = req.user?.auth_user_id

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    try {
      await noteService.updateNote(userId, id, body, req.authContext!)
      reply.send({ success: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      
      if (message.includes('not found')) {
        return reply.code(404).send({ error: 'Note not found' })
      }
      if (message.includes('Only the note author')) {
        return reply.code(403).send({ error: 'Only the note author can update the note' })
      }
      if (message.includes('insufficient_permissions')) {
        return reply.code(403).send({ error: 'Insufficient permissions' })
      }
      
      return reply.code(500).send({ error: message })
    }
  })

  /**
   * DELETE /notes/:id - Delete note (author only)
   */
  app.delete('/notes/:id', {
    schema: {
      description: 'Delete note (author only)',
      tags: ['Notes'],
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

      // Build context for note deletion
      return await noteContextBuilder.buildNoteContext(
        userId,
        id,
        'delete',
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
      await noteService.deleteNote(userId, id, req.authContext!)
      reply.send({ success: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      
      if (message.includes('not found')) {
        return reply.code(404).send({ error: 'Note not found' })
      }
      if (message.includes('Only the note author')) {
        return reply.code(403).send({ error: 'Only the note author can delete the note' })
      }
      if (message.includes('insufficient_permissions')) {
        return reply.code(403).send({ error: 'Insufficient permissions' })
      }
      
      return reply.code(500).send({ error: message })
    }
  })

  /**
   * POST /notes/:id/grant-access - Grant temporary access to confidential note
   */
  app.post('/notes/:id/grant-access', {
    schema: {
      description: 'Grant temporary access to confidential note',
      tags: ['Notes'],
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      body: GrantNoteAccessSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            grant_id: { type: 'string', format: 'uuid' }
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

      // Build context for granting access (requires author access)
      return await noteContextBuilder.buildNoteContext(
        userId,
        id,
        'grant_access',
        {
          purpose: 'oversight' // Granting access is an oversight action
        }
      )
    })
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as GrantNoteAccessRequest
    const userId = req.user?.auth_user_id

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    try {
      const result = await noteService.grantNoteAccess(userId, id, body)
      reply.code(201).send(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      
      if (message.includes('note_not_found_or_not_author')) {
        return reply.code(404).send({ error: 'Note not found or you are not the author' })
      }
      if (message.includes('target_user_not_found')) {
        return reply.code(404).send({ error: 'Target user not found in your organization' })
      }
      if (message.includes('insufficient_permissions')) {
        return reply.code(403).send({ error: 'Insufficient permissions' })
      }
      
      return reply.code(500).send({ error: message })
    }
  })

  /**
   * GET /notes/subject/:type/:id - Get notes for a specific subject
   */
  app.get('/notes/subject/:type/:id', {
    schema: {
      description: 'Get notes for a specific subject (client, case, etc.)',
      tags: ['Notes'],
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['client', 'case', 'referral', 'service'] },
          id: { type: 'string', format: 'uuid' }
        },
        required: ['type', 'id']
      },
      querystring: {
        type: 'object',
        properties: {
          include_helper_journals: { type: 'boolean', default: false }
        }
      },
      response: {
        200: SearchNotesResponseSchema
      }
    },
    preHandler: authorize(async (req) => {
      const { type, id } = req.params as { type: string; id: string }
      
      // Subject-specific note access
      return {
        purpose: (req.headers['x-purpose-of-use'] as any) || 'care',
        contains_phi: false, // Will be evaluated per note
        consent_ok: false, // Will be evaluated per note
        tenant_root_id: 'temp' // Will be determined by subject's tenant
      }
    })
  }, async (req, reply) => {
    const { type, id } = req.params as { type: string; id: string }
    const { include_helper_journals } = req.query as { include_helper_journals?: boolean }
    const userId = req.user?.auth_user_id

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    try {
      const results = await noteService.getNotesForSubject(
        userId,
        type,
        id,
        include_helper_journals || false
      )
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
   * GET /notes/my-recent - Get user's recent notes
   */
  app.get('/notes/my-recent', {
    schema: {
      description: 'Get user\'s recent notes',
      tags: ['Notes'],
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 }
        }
      },
      response: {
        200: SearchNotesResponseSchema
      }
    },
    preHandler: authorize(async (req) => {
      // User's own notes - minimal context needed
      return {
        purpose: 'care',
        contains_phi: false,
        consent_ok: true,
        tenant_root_id: 'temp'
      }
    })
  }, async (req, reply) => {
    const { limit } = req.query as { limit?: number }
    const userId = req.user?.auth_user_id

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    try {
      const results = await noteService.getUserRecentNotes(userId, limit || 20)
      reply.send(results)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return reply.code(500).send({ error: message })
    }
  })
}

export default router