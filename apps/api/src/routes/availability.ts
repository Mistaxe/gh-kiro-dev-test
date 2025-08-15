import { FastifyPluginAsync } from 'fastify';
import { AvailabilityService } from '../services/availability-service.js';
import { AvailabilityContextBuilder } from '../context/availability-context-builder.js';
import { authorize } from '../middleware/authorize.js';
import {
  CreateAvailabilitySchema,
  UpdateAvailabilitySchema
} from '../schemas/service-profile.js';

const availabilityRoutes: FastifyPluginAsync = async (fastify) => {
  const availabilityService = new AvailabilityService(fastify.supabase);
  const contextBuilder = new AvailabilityContextBuilder(fastify.supabase);

  // Create availability record
  fastify.post('/availability', {
    schema: {
      body: {
        type: 'object',
        required: ['location_id', 'type', 'total', 'available'],
        properties: {
          location_id: { type: 'string', format: 'uuid' },
          type: { type: 'string', enum: ['beds', 'slots', 'appointments'] },
          attributes: { type: 'object', default: {} },
          total: { type: 'number', minimum: 0 },
          available: { type: 'number', minimum: 0 }
        }
      },
      response: {
        201: { type: 'object', properties: { id: { type: 'string' } } }
      },
      tags: ['Availability'],
      summary: 'Create availability record',
      description: 'Create a new availability record for a service location'
    },
    preHandler: authorize(
      { role: 'LocationManager' },
      { type: 'service_location', id: 'body.location_id' },
      'create',
      async (req) => {
        return contextBuilder.buildCreateAvailabilityContext(
          req.user.auth_user_id,
          req.body.location_id,
          'create'
        );
      }
    )
  }, async (request, reply) => {
    try {
      // Validate request body with Zod
      const validatedData = CreateAvailabilitySchema.parse(request.body);
      const availabilityId = await availabilityService.createAvailability(validatedData);
      
      reply.status(201).send({ id: availabilityId });
    } catch (error) {
      fastify.log.error(error);
      
      if (error instanceof Error && error.name === 'ZodError') {
        reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          reason: error.message,
          correlationId: request.id
        });
      } else if (error instanceof Error && error.message.includes('already exists')) {
        reply.status(409).send({
          code: 'AVAILABILITY_EXISTS',
          message: 'Availability record already exists',
          reason: error.message,
          correlationId: request.id
        });
      } else {
        reply.status(500).send({
          code: 'INTERNAL_ERROR',
          message: 'Failed to create availability record',
          reason: error instanceof Error ? error.message : 'Unknown error',
          correlationId: request.id
        });
      }
    }
  });

  // Update availability record with optimistic concurrency control
  fastify.put('/availability/:availabilityId', {
    schema: {
      params: { 
        type: 'object', 
        properties: { availabilityId: { type: 'string', format: 'uuid' } }, 
        required: ['availabilityId'] 
      },
      headers: {
        type: 'object',
        properties: {
          'if-match': { type: 'string' }
        },
        required: ['if-match']
      },
      body: {
        type: 'object',
        properties: {
          total: { type: 'number', minimum: 0 },
          available: { type: 'number', minimum: 0 }
        }
      },
      response: {
        200: { 
          type: 'object', 
          properties: { 
            success: { type: 'boolean' },
            version: { type: 'number' },
            total: { type: 'number' },
            available: { type: 'number' },
            updated_at: { type: 'string' }
          } 
        },
        409: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            reason: { type: 'string' },
            current_version: { type: 'number' },
            provided_version: { type: 'number' },
            correlationId: { type: 'string' }
          }
        }
      },
      tags: ['Availability'],
      summary: 'Update availability record',
      description: 'Update availability with optimistic concurrency control using If-Match header'
    },
    preHandler: authorize(
      { role: 'LocationManager' },
      { type: 'availability', id: 'params.availabilityId' },
      'update',
      async (req) => {
        const version = parseInt(req.headers['if-match'] as string, 10);
        return contextBuilder.buildRealTimeUpdateContext(
          req.user.auth_user_id,
          req.params.availabilityId,
          version
        );
      }
    )
  }, async (request, reply) => {
    try {
      // Extract version from If-Match header
      const version = parseInt(request.headers['if-match'] as string, 10);
      if (isNaN(version)) {
        reply.status(400).send({
          code: 'INVALID_VERSION',
          message: 'Invalid If-Match header',
          reason: 'If-Match header must contain a valid version number',
          correlationId: request.id
        });
        return;
      }

      // Validate request body with Zod
      const validatedData = UpdateAvailabilitySchema.parse({
        ...request.body,
        version
      });

      const result = await availabilityService.updateAvailability(
        request.params.availabilityId,
        validatedData
      );

      if (!result.success) {
        reply.status(409).send({
          code: 'VERSION_CONFLICT',
          message: 'Availability record has been modified',
          reason: result.message || 'Version conflict detected',
          current_version: result.current_version,
          provided_version: result.provided_version,
          correlationId: request.id
        });
      } else {
        reply.send({
          success: true,
          version: result.version,
          total: result.total,
          available: result.available,
          updated_at: result.updated_at
        });
      }
    } catch (error) {
      fastify.log.error(error);
      
      if (error instanceof Error && error.name === 'ZodError') {
        reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          reason: error.message,
          correlationId: request.id
        });
      } else {
        reply.status(500).send({
          code: 'INTERNAL_ERROR',
          message: 'Failed to update availability record',
          reason: error instanceof Error ? error.message : 'Unknown error',
          correlationId: request.id
        });
      }
    }
  });

  // Get availability record details
  fastify.get('/availability/:availabilityId', {
    schema: {
      params: { 
        type: 'object', 
        properties: { availabilityId: { type: 'string', format: 'uuid' } }, 
        required: ['availabilityId'] 
      },
      tags: ['Availability'],
      summary: 'Get availability record',
      description: 'Get detailed information about an availability record'
    },
    preHandler: authorize(
      { role: 'BasicAccount' },
      { type: 'availability', id: 'params.availabilityId' },
      'read',
      async (req) => {
        return contextBuilder.buildAvailabilityContext(
          req.user.auth_user_id,
          req.params.availabilityId,
          'read'
        );
      }
    )
  }, async (request, reply) => {
    try {
      const availability = await availabilityService.getAvailability(request.params.availabilityId);
      reply.send(availability);
    } catch (error) {
      fastify.log.error(error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        reply.status(404).send({
          code: 'AVAILABILITY_NOT_FOUND',
          message: 'Availability record not found',
          reason: error.message,
          correlationId: request.id
        });
      } else {
        reply.status(500).send({
          code: 'INTERNAL_ERROR',
          message: 'Failed to get availability record',
          reason: error instanceof Error ? error.message : 'Unknown error',
          correlationId: request.id
        });
      }
    }
  });

  // Search availability records
  fastify.get('/availability', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          location_ids: { 
            type: 'array', 
            items: { type: 'string', format: 'uuid' }
          },
          type: { type: 'string', enum: ['beds', 'slots', 'appointments'] },
          attribute_predicates: { type: 'object' },
          min_available: { type: 'number', minimum: 0 },
          org_id: { type: 'string', format: 'uuid' },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'number', minimum: 0, default: 0 }
        }
      },
      tags: ['Availability'],
      summary: 'Search availability records',
      description: 'Search availability records with JSON predicate matching'
    },
    preHandler: authorize(
      { role: 'BasicAccount' },
      { type: 'availability', id: 'search' },
      'search',
      async (req) => {
        return contextBuilder.buildSearchContext(
          req.user.auth_user_id,
          req.query,
          { purpose: 'care' }
        );
      }
    )
  }, async (request, reply) => {
    try {
      const results = await availabilityService.searchAvailability(request.query);
      reply.send(results);
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Failed to search availability records',
        reason: error instanceof Error ? error.message : 'Unknown error',
        correlationId: request.id
      });
    }
  });

  // Get availability summary
  fastify.get('/availability/summary', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          org_id: { type: 'string', format: 'uuid' },
          location_ids: { 
            type: 'array', 
            items: { type: 'string', format: 'uuid' }
          },
          type: { type: 'string', enum: ['beds', 'slots', 'appointments'] }
        }
      },
      tags: ['Availability'],
      summary: 'Get availability summary',
      description: 'Get aggregated availability summary from materialized view'
    },
    preHandler: authorize(
      { role: 'BasicAccount' },
      { type: 'availability', id: 'summary' },
      'read',
      async (req) => {
        return contextBuilder.buildSummaryContext(
          req.user.auth_user_id,
          req.query.org_id,
          { purpose: 'oversight' }
        );
      }
    )
  }, async (request, reply) => {
    try {
      const summary = await availabilityService.getAvailabilitySummary(
        request.query.org_id,
        request.query.location_ids,
        request.query.type
      );
      reply.send(summary);
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Failed to get availability summary',
        reason: error instanceof Error ? error.message : 'Unknown error',
        correlationId: request.id
      });
    }
  });

  // Match client needs with available services
  fastify.post('/availability/match', {
    schema: {
      body: {
        type: 'object',
        required: ['client_needs'],
        properties: {
          client_needs: { type: 'object' },
          min_available: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 }
        }
      },
      tags: ['Availability'],
      summary: 'Match client needs',
      description: 'Match client needs with available services using JSON predicates'
    },
    preHandler: authorize(
      { role: 'CaseManager' },
      { type: 'availability', id: 'match' },
      'search',
      async (req) => {
        return contextBuilder.buildMatchingContext(
          req.user.auth_user_id,
          req.body.client_needs,
          { purpose: 'care' }
        );
      }
    )
  }, async (request, reply) => {
    try {
      const matches = await availabilityService.matchClientNeeds(
        request.body.client_needs,
        request.body.min_available,
        request.body.limit
      );
      reply.send({ matches });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Failed to match client needs',
        reason: error instanceof Error ? error.message : 'Unknown error',
        correlationId: request.id
      });
    }
  });

  // Get availability by location
  fastify.get('/locations/:locationId/availability', {
    schema: {
      params: { 
        type: 'object', 
        properties: { locationId: { type: 'string', format: 'uuid' } }, 
        required: ['locationId'] 
      },
      querystring: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['beds', 'slots', 'appointments'] }
        }
      },
      tags: ['Availability'],
      summary: 'Get location availability',
      description: 'Get all availability records for a specific location'
    },
    preHandler: authorize(
      { role: 'BasicAccount' },
      { type: 'service_location', id: 'params.locationId' },
      'read',
      async (req) => {
        return contextBuilder.buildSearchContext(
          req.user.auth_user_id,
          { location_ids: [req.params.locationId] },
          { purpose: 'care' }
        );
      }
    )
  }, async (request, reply) => {
    try {
      const availability = await availabilityService.getLocationAvailability(
        request.params.locationId,
        request.query.type
      );
      reply.send(availability);
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Failed to get location availability',
        reason: error instanceof Error ? error.message : 'Unknown error',
        correlationId: request.id
      });
    }
  });

  // Get availability by organization
  fastify.get('/organizations/:orgId/availability', {
    schema: {
      params: { 
        type: 'object', 
        properties: { orgId: { type: 'string', format: 'uuid' } }, 
        required: ['orgId'] 
      },
      querystring: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['beds', 'slots', 'appointments'] },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'number', minimum: 0, default: 0 }
        }
      },
      tags: ['Availability'],
      summary: 'Get organization availability',
      description: 'Get all availability records for a specific organization'
    },
    preHandler: authorize(
      { role: 'BasicAccount' },
      { type: 'organization', id: 'params.orgId' },
      'read',
      async (req) => {
        return contextBuilder.buildSearchContext(
          req.user.auth_user_id,
          { org_id: req.params.orgId },
          { purpose: 'care' }
        );
      }
    )
  }, async (request, reply) => {
    try {
      const results = await availabilityService.getOrganizationAvailability(
        request.params.orgId,
        request.query.type,
        request.query.limit,
        request.query.offset
      );
      reply.send(results);
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Failed to get organization availability',
        reason: error instanceof Error ? error.message : 'Unknown error',
        correlationId: request.id
      });
    }
  });
};

export default availabilityRoutes;