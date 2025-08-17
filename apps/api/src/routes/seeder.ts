import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DataSeeder } from '../services/seeder.js';

interface SeederRequest {
  Body: {
    regions?: number;
    networksPerRegion?: number;
    orgsPerNetwork?: number;
    locationsPerOrg?: number;
    usersPerOrg?: number;
    clientsPerOrg?: number;
    casesPerClient?: number;
    availabilityPerLocation?: number;
    referralsPerOrg?: number;
  };
}

interface SeederActionRequest {
  Params: {
    action: 'seed' | 'cleanup' | 'validate';
  };
}

// JSON Schema for seeder configuration
const seederConfigSchema = {
  type: 'object',
  properties: {
    regions: { type: 'integer', minimum: 1, maximum: 10, default: 3 },
    networksPerRegion: { type: 'integer', minimum: 1, maximum: 5, default: 2 },
    orgsPerNetwork: { type: 'integer', minimum: 1, maximum: 10, default: 4 },
    locationsPerOrg: { type: 'integer', minimum: 1, maximum: 5, default: 2 },
    usersPerOrg: { type: 'integer', minimum: 1, maximum: 20, default: 8 },
    clientsPerOrg: { type: 'integer', minimum: 1, maximum: 50, default: 15 },
    casesPerClient: { type: 'integer', minimum: 1, maximum: 3, default: 1 },
    availabilityPerLocation: { type: 'integer', minimum: 1, maximum: 10, default: 3 },
    referralsPerOrg: { type: 'integer', minimum: 1, maximum: 20, default: 5 }
  },
  additionalProperties: false
};

const seederActionSchema = {
  type: 'object',
  properties: {
    action: { 
      type: 'string', 
      enum: ['seed', 'cleanup', 'validate'] 
    }
  },
  required: ['action'],
  additionalProperties: false
};

export default async function seederRoutes(fastify: FastifyInstance) {
  // Get seeder status and configuration
  fastify.get('/seeder/status', {
    schema: {
      description: 'Get current seeder status and data counts',
      tags: ['seeder'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            data_counts: {
              type: 'object',
              properties: {
                regions: { type: 'integer' },
                networks: { type: 'integer' },
                organizations: { type: 'integer' },
                locations: { type: 'integer' },
                users: { type: 'integer' },
                clients: { type: 'integer' },
                cases: { type: 'integer' },
                availability: { type: 'integer' },
                referrals: { type: 'integer' },
                consents: { type: 'integer' }
              }
            },
            last_seeded: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const seeder = new DataSeeder({
        supabaseUrl: process.env.SUPABASE_URL!,
        supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!
      });
      
      const dataCounts = await seeder.validateSeededData();
      
      return {
        status: 'ready',
        data_counts: dataCounts,
        last_seeded: new Date().toISOString()
      };
    } catch (error) {
      fastify.log.error('Error getting seeder status:', error as Error);
      reply.status(500);
      return {
        error: 'Failed to get seeder status',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Start seeding process
  fastify.post('/seeder/seed', {
    schema: {
      description: 'Start comprehensive data seeding process',
      tags: ['seeder'],
      body: seederConfigSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            job_id: { type: 'string' },
            config: seederConfigSchema
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<SeederRequest>, reply: FastifyReply) => {
    try {
      const config = {
        supabaseUrl: process.env.SUPABASE_URL!,
        supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        ...request.body
      };
      
      const jobId = `seed_${Date.now()}`;
      
      // Start seeding in background
      const seeder = new DataSeeder(config, (progress) => {
        fastify.log.info(`Seeding progress [${progress.step}]: ${progress.current}/${progress.total} - ${progress.message}`);
      });
      
      // Run seeding asynchronously
      seeder.seedAll()
        .then(() => {
          fastify.log.info(`Seeding job ${jobId} completed successfully`);
        })
        .catch((error) => {
          fastify.log.error(`Seeding job ${jobId} failed:`, error);
        });
      
      return {
        message: 'Seeding process started',
        job_id: jobId,
        config: request.body || {}
      };
    } catch (error) {
      fastify.log.error('Error starting seeder:', error as Error);
      reply.status(500);
      return {
        error: 'Failed to start seeding',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Cleanup seeded data
  fastify.delete('/seeder/cleanup', {
    schema: {
      description: 'Clean up all seeded data',
      tags: ['seeder'],
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            cleaned_tables: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const seeder = new DataSeeder({
        supabaseUrl: process.env.SUPABASE_URL!,
        supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!
      });
      
      await seeder.cleanup();
      
      return {
        message: 'Cleanup completed successfully',
        cleaned_tables: [
          'client_consents', 'client_cases', 'clients', 'referrals', 
          'availability', 'role_assignments', 'users_profile', 
          'service_locations', 'organizations', 'networks', 'regions'
        ]
      };
    } catch (error) {
      fastify.log.error('Error during cleanup:', error as Error);
      reply.status(500);
      return {
        error: 'Cleanup failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Validate seeded data
  fastify.get('/seeder/validate', {
    schema: {
      description: 'Validate and count seeded data',
      tags: ['seeder'],
      response: {
        200: {
          type: 'object',
          properties: {
            validation_results: {
              type: 'object',
              properties: {
                regions: { type: 'integer' },
                networks: { type: 'integer' },
                organizations: { type: 'integer' },
                locations: { type: 'integer' },
                users: { type: 'integer' },
                clients: { type: 'integer' },
                cases: { type: 'integer' },
                availability: { type: 'integer' },
                referrals: { type: 'integer' },
                consents: { type: 'integer' }
              }
            },
            total_records: { type: 'integer' },
            validation_time: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const seeder = new DataSeeder({
        supabaseUrl: process.env.SUPABASE_URL!,
        supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!
      });
      
      const validationResults = await seeder.validateSeededData();
      const totalRecords = Object.values(validationResults).reduce((sum: number, count: number) => sum + count, 0);
      
      return {
        validation_results: validationResults,
        total_records: totalRecords,
        validation_time: new Date().toISOString()
      };
    } catch (error) {
      fastify.log.error('Error during validation:', error as Error);
      reply.status(500);
      return {
        error: 'Validation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Seed specific entity types
  fastify.post('/seeder/seed/:entityType', {
    schema: {
      description: 'Seed specific entity type',
      tags: ['seeder'],
      params: {
        type: 'object',
        properties: {
          entityType: { 
            type: 'string', 
            enum: ['regions', 'networks', 'organizations', 'locations', 'users', 'clients', 'cases', 'availability', 'referrals', 'consents'] 
          }
        },
        required: ['entityType']
      },
      body: {
        type: 'object',
        properties: {
          count: { type: 'integer', minimum: 1, maximum: 100, default: 10 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            entity_type: { type: 'string' },
            count: { type: 'integer' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{
    Params: { entityType: string };
    Body: { count?: number };
  }>, reply: FastifyReply) => {
    try {
      const { entityType } = request.params;
      const { count = 10 } = request.body || {};
      
      // This would require implementing individual seeding methods
      // For now, return a placeholder response
      return {
        message: `Selective seeding for ${entityType} is not yet implemented`,
        entity_type: entityType,
        count
      };
    } catch (error) {
      fastify.log.error(`Error seeding ${request.params.entityType}:`, error as Error);
      reply.status(500);
      return {
        error: 'Selective seeding failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
}