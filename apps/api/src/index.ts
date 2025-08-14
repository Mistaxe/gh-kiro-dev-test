import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

// Plugins
import subauth from './plugins/subauth.js';
import validation from './plugins/validation.js';

// Routes
import exampleClients from './routes/example.clients.js';
import capabilities from './routes/capabilities.js';
import dev from './routes/dev.js';

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname'
      }
    } : undefined
  }
});

// Register core plugins
await app.register(cors, {
  origin: process.env.NODE_ENV === 'development' ? true : process.env.CORS_ORIGIN?.split(',') || false,
  credentials: true
});

await app.register(sensible);

await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  skipOnError: true
});

// Register Swagger for API documentation
await app.register(swagger, {
  swagger: {
    info: {
      title: 'Behavioral Health Platform API',
      description: 'Multi-tenant behavioral health coordination platform',
      version: '0.1.0'
    },
    host: process.env.API_HOST || 'localhost:3001',
    schemes: ['http', 'https'],
    consumes: ['application/json'],
    produces: ['application/json'],
    securityDefinitions: {
      Bearer: {
        type: 'apiKey',
        name: 'Authorization',
        in: 'header',
        description: 'Bearer token from Supabase Auth'
      }
    }
  }
});

await app.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false
  }
});

// Register plugins
await app.register(validation);
await app.register(subauth);

// Health check endpoint
app.get('/health', {
  schema: {
    description: 'Health check endpoint with system status',
    tags: ['System'],
    response: {
      200: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          timestamp: { type: 'string' },
          version: { type: 'string' },
          policy_version: { type: 'string' }
        }
      }
    }
  }
}, async (request, reply) => {
  const { policyVersion } = await import('./middleware/authorize.js');
  
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    policy_version: policyVersion
  };
});

// Register business routes
await app.register(capabilities, { prefix: '/api' });
await app.register(exampleClients, { prefix: '/api' });
await app.register(dev, { prefix: '/api' });

// Global error handler
app.setErrorHandler(async (error, request, reply) => {
  const correlationId = request.id;
  
  request.log.error({
    error: error.message,
    stack: error.stack,
    correlationId
  }, 'Request error');

  // Standardized error response format
  const errorResponse = {
    code: error.code || 'INTERNAL_ERROR',
    message: error.message || 'An unexpected error occurred',
    reason: error.cause || 'Internal server error',
    correlationId,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  };

  const statusCode = error.statusCode || 500;
  reply.code(statusCode).send(errorResponse);
});

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001', 10);
    const host = process.env.HOST || '0.0.0.0';
    
    await app.listen({ port, host });
    app.log.info(`Server listening on http://${host}:${port}`);
    app.log.info(`API documentation available at http://${host}:${port}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();