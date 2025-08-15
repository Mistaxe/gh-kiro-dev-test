import { FastifyPluginAsync } from 'fastify';
import { ServiceProfileService } from '../services/service-profile-service.js';
import { ServiceProfileContextBuilder } from '../context/service-profile-context-builder.js';
import { authorize } from '../middleware/authorize.js';
import {
  CreateServiceProfileSchema,
  UpdateServiceProfileSchema,
  ServiceProfileSearchSchema,
  ClaimServiceLocationSchema
} from '../schemas/service-profile.js';
import { ErrorResponseSchema } from '../schemas/common.js';

const serviceProfileRoutes: FastifyPluginAsync = async (fastify) => {
  const serviceProfileService = new ServiceProfileService(fastify.supabase);
  const contextBuilder = new ServiceProfileContextBuilder(fastify.supabase);

  // Create service profile
  fastify.post('/service-profiles', {
    schema: {
      body: {
        type: 'object',
        required: ['location_id'],
        properties: {
          location_id: { type: 'string', format: 'uuid' },
          taxonomy_code: { type: 'string', maxLength: 50 },
          populations: { 
            type: 'array', 
            items: { 
              type: 'string',
              enum: ['adults', 'adolescents', 'children', 'families', 'seniors', 'veterans']
            },
            default: []
          },
          eligibility: { type: 'object', default: {} },
          hours: { type: 'object', default: {} },
          description: { type: 'string', maxLength: 2000 }
        }
      },
      response: {
        201: { type: 'object', properties: { id: { type: 'string' } } },
        400: { 
          type: 'object',
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            reason: { type: 'string' },
            correlationId: { type: 'string' }
          }
        },
        403: { 
          type: 'object',
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            reason: { type: 'string' },
            correlationId: { type: 'string' }
          }
        },
        500: { 
          type: 'object',
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            reason: { type: 'string' },
            correlationId: { type: 'string' }
          }
        }
      },
      tags: ['Service Profiles'],
      summary: 'Create a new service profile',
      description: 'Create a service profile for a location with claimed/unclaimed logic'
    },
    preHandler: authorize(
      { role: 'LocationManager' },
      { type: 'service_location', id: 'body.location_id' },
      'create',
      async (req) => {
        return contextBuilder.buildLocationClaimContext(
          req.user.auth_user_id,
          req.body.location_id,
          'create'
        );
      }
    )
  }, async (request, reply) => {
    try {
      // Validate request body with Zod
      const validatedData = CreateServiceProfileSchema.parse(request.body);
      const profileId = await serviceProfileService.createServiceProfile(validatedData);
      
      reply.status(201).send({ id: profileId });
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
          message: 'Failed to create service profile',
          reason: error instanceof Error ? error.message : 'Unknown error',
          correlationId: request.id
        });
      }
    }
  });

  // Update service profile
  fastify.put('/service-profiles/:profileId', {
    schema: {
      params: { 
        type: 'object', 
        properties: { profileId: { type: 'string', format: 'uuid' } }, 
        required: ['profileId'] 
      },
      body: {
        type: 'object',
        properties: {
          taxonomy_code: { type: 'string', maxLength: 50 },
          populations: { 
            type: 'array', 
            items: { 
              type: 'string',
              enum: ['adults', 'adolescents', 'children', 'families', 'seniors', 'veterans']
            }
          },
          eligibility: { type: 'object' },
          hours: { type: 'object' },
          description: { type: 'string', maxLength: 2000 },
          curator_notes: { type: 'string', maxLength: 1000 }
        }
      },
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
        400: { 
          type: 'object',
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            reason: { type: 'string' },
            correlationId: { type: 'string' }
          }
        },
        403: { 
          type: 'object',
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            reason: { type: 'string' },
            correlationId: { type: 'string' }
          }
        },
        404: { 
          type: 'object',
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            reason: { type: 'string' },
            correlationId: { type: 'string' }
          }
        },
        500: { 
          type: 'object',
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            reason: { type: 'string' },
            correlationId: { type: 'string' }
          }
        }
      },
      tags: ['Service Profiles'],
      summary: 'Update a service profile',
      description: 'Update service profile with claimed/unclaimed access controls'
    },
    preHandler: authorize(
      { role: 'LocationManager' },
      { type: 'service_profile', id: 'params.profileId' },
      'update',
      async (req) => {
        return contextBuilder.buildServiceProfileContext(
          req.user.auth_user_id,
          req.params.profileId,
          'update'
        );
      }
    )
  }, async (request, reply) => {
    try {
      // Validate request body with Zod
      const validatedData = UpdateServiceProfileSchema.parse(request.body);
      await serviceProfileService.updateServiceProfile(
        request.params.profileId,
        validatedData
      );
      
      reply.send({ success: true });
    } catch (error) {
      fastify.log.error(error);
      
      if (error instanceof Error && error.name === 'ZodError') {
        reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          reason: error.message,
          correlationId: request.id
        });
      } else if (error instanceof Error && error.message.includes('not found')) {
        reply.status(404).send({
          code: 'PROFILE_NOT_FOUND',
          message: 'Service profile not found',
          reason: error.message,
          correlationId: request.id
        });
      } else {
        reply.status(500).send({
          code: 'INTERNAL_ERROR',
          message: 'Failed to update service profile',
          reason: error instanceof Error ? error.message : 'Unknown error',
          correlationId: request.id
        });
      }
    }
  });

  // Get service profile details
  fastify.get('/service-profiles/:profileId', {
    schema: {
      params: { 
        type: 'object', 
        properties: { profileId: { type: 'string', format: 'uuid' } }, 
        required: ['profileId'] 
      },
      tags: ['Service Profiles'],
      summary: 'Get service profile details',
      description: 'Get detailed information about a service profile'
    },
    preHandler: authorize(
      { role: 'BasicAccount' },
      { type: 'service_profile', id: 'params.profileId' },
      'read',
      async (req) => {
        return contextBuilder.buildServiceProfileContext(
          req.user.auth_user_id,
          req.params.profileId,
          'read'
        );
      }
    )
  }, async (request, reply) => {
    try {
      const profile = await serviceProfileService.getServiceProfile(request.params.profileId);
      reply.send(profile);
    } catch (error) {
      fastify.log.error(error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        reply.status(404).send({
          code: 'PROFILE_NOT_FOUND',
          message: 'Service profile not found',
          reason: error.message,
          correlationId: request.id
        });
      } else {
        reply.status(500).send({
          code: 'INTERNAL_ERROR',
          message: 'Failed to get service profile',
          reason: error instanceof Error ? error.message : 'Unknown error',
          correlationId: request.id
        });
      }
    }
  });

  // Search service profiles
  fastify.get('/service-profiles', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          search_term: { type: 'string', maxLength: 200 },
          populations: { 
            type: 'array', 
            items: { 
              type: 'string',
              enum: ['adults', 'adolescents', 'children', 'families', 'seniors', 'veterans']
            }
          },
          eligibility_filter: { type: 'object' },
          claimed_only: { type: 'boolean' },
          org_id: { type: 'string', format: 'uuid' },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'number', minimum: 0, default: 0 }
        }
      },
      tags: ['Service Profiles'],
      summary: 'Search service profiles',
      description: 'Search service profiles with full-text search and JSONB filtering'
    },
    preHandler: authorize(
      { role: 'BasicAccount' },
      { type: 'service_profile', id: 'search' },
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
      // Validate query parameters with Zod
      const validatedQuery = ServiceProfileSearchSchema.parse(request.query);
      const results = await serviceProfileService.searchServiceProfiles(validatedQuery);
      reply.send(results);
    } catch (error) {
      fastify.log.error(error);
      
      if (error instanceof Error && error.name === 'ZodError') {
        reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          reason: error.message,
          correlationId: request.id
        });
      } else {
        reply.status(500).send({
          code: 'INTERNAL_ERROR',
          message: 'Failed to search service profiles',
          reason: error instanceof Error ? error.message : 'Unknown error',
          correlationId: request.id
        });
      }
    }
  });

  // Claim service location
  fastify.post('/service-locations/claim', {
    schema: {
      body: {
        type: 'object',
        required: ['location_id'],
        properties: {
          location_id: { type: 'string', format: 'uuid' }
        }
      },
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } }
      },
      tags: ['Service Profiles'],
      summary: 'Claim a service location',
      description: 'Claim an unclaimed service location and its profiles'
    },
    preHandler: authorize(
      { role: 'LocationManager' },
      { type: 'service_location', id: 'body.location_id' },
      'claim',
      async (req) => {
        return contextBuilder.buildLocationClaimContext(
          req.user.auth_user_id,
          req.body.location_id,
          'claim'
        );
      }
    )
  }, async (request, reply) => {
    try {
      // Validate request body with Zod
      const validatedData = ClaimServiceLocationSchema.parse(request.body);
      await serviceProfileService.claimServiceLocation(validatedData);
      reply.send({ success: true });
    } catch (error) {
      fastify.log.error(error);
      
      if (error instanceof Error && error.name === 'ZodError') {
        reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          reason: error.message,
          correlationId: request.id
        });
      } else if (error instanceof Error) {
        if (error.message.includes('not found')) {
          reply.status(404).send({
            code: 'LOCATION_NOT_FOUND',
            message: 'Service location not found',
            reason: error.message,
            correlationId: request.id
          });
        } else if (error.message.includes('already_claimed')) {
          reply.status(409).send({
            code: 'ALREADY_CLAIMED',
            message: 'Service location is already claimed',
            reason: error.message,
            correlationId: request.id
          });
        } else {
          reply.status(500).send({
            code: 'INTERNAL_ERROR',
            message: 'Failed to claim service location',
            reason: error.message,
            correlationId: request.id
          });
        }
      } else {
        reply.status(500).send({
          code: 'INTERNAL_ERROR',
          message: 'Failed to claim service location',
          reason: 'Unknown error',
          correlationId: request.id
        });
      }
    }
  });

  // Get unclaimed service profiles (for curators)
  fastify.get('/service-profiles/unclaimed', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'number', minimum: 0, default: 0 }
        }
      },
      tags: ['Service Profiles'],
      summary: 'Get unclaimed service profiles',
      description: 'Get unclaimed service profiles for curator management'
    },
    preHandler: authorize(
      { role: 'OrgAdmin' },
      { type: 'service_profile', id: 'unclaimed' },
      'read',
      async (req) => {
        return contextBuilder.buildCuratorContext(
          req.user.auth_user_id,
          'read'
        );
      }
    )
  }, async (request, reply) => {
    try {
      const results = await serviceProfileService.getUnclaimedServiceProfiles(
        request.query.limit,
        request.query.offset
      );
      reply.send(results);
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Failed to get unclaimed service profiles',
        reason: error instanceof Error ? error.message : 'Unknown error',
        correlationId: request.id
      });
    }
  });

  // Get service profiles by organization
  fastify.get('/organizations/:orgId/service-profiles', {
    schema: {
      params: { 
        type: 'object', 
        properties: { orgId: { type: 'string', format: 'uuid' } }, 
        required: ['orgId'] 
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'number', minimum: 0, default: 0 }
        }
      },
      tags: ['Service Profiles'],
      summary: 'Get organization service profiles',
      description: 'Get all service profiles for a specific organization'
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
      const results = await serviceProfileService.getOrganizationServiceProfiles(
        request.params.orgId,
        request.query.limit,
        request.query.offset
      );
      reply.send(results);
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Failed to get organization service profiles',
        reason: error instanceof Error ? error.message : 'Unknown error',
        correlationId: request.id
      });
    }
  });
};

export default serviceProfileRoutes;