import { authorize } from '../middleware/authorize.js';
import { CapabilitiesQuerySchema, CapabilitiesResponseSchema } from '../schemas/capabilities.js';
import { getCapabilitiesService } from '../services/capabilities.js';
const capabilities = async (app) => {
    const capabilitiesService = getCapabilitiesService();
    // GET /me/capabilities - Check user capabilities and membership
    app.get('/me/capabilities', {
        schema: {
            description: 'Get user capabilities and membership status with scope-based filtering',
            tags: ['User'],
            security: [{ Bearer: [] }],
            querystring: {
                type: 'object',
                properties: {
                    scopeType: {
                        type: 'string',
                        enum: ['region', 'network', 'org', 'location', 'global'],
                        description: 'Scope type to check membership for'
                    },
                    scopeId: {
                        type: 'string',
                        description: 'Scope ID to check membership for'
                    }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        user_id: { type: 'string' },
                        email: { type: 'string' },
                        member: { type: 'boolean' },
                        roles: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    role: { type: 'string' },
                                    scope_type: { type: 'string' },
                                    scope_id: { type: 'string' },
                                    expires_at: { type: 'string', nullable: true }
                                }
                            }
                        },
                        capabilities: {
                            type: 'array',
                            items: { type: 'string' }
                        }
                    }
                },
                400: {
                    type: 'object',
                    properties: {
                        code: { type: 'string' },
                        message: { type: 'string' },
                        reason: { type: 'string' },
                        correlationId: { type: 'string' }
                    }
                },
                401: {
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
            }
        },
        preHandler: authorize() // Basic auth check, no specific authorization needed
    }, async (request, reply) => {
        try {
            // Validate query parameters with Zod
            const queryResult = CapabilitiesQuerySchema.safeParse(request.query);
            if (!queryResult.success) {
                return reply.code(400).send({
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid query parameters',
                    reason: queryResult.error.message,
                    correlationId: request.id
                });
            }
            const { scopeType, scopeId } = queryResult.data;
            if (!request.user) {
                return reply.code(401).send({
                    code: 'AUTHENTICATION_REQUIRED',
                    message: 'Authentication required',
                    reason: 'No valid JWT token provided',
                    correlationId: request.id
                });
            }
            // Get capabilities from service
            const result = await capabilitiesService.getUserCapabilities(request.user, scopeType, scopeId);
            // Validate response with Zod schema
            const validatedResponse = CapabilitiesResponseSchema.parse(result);
            request.log.debug({
                userId: request.user.auth_user_id,
                scopeType,
                scopeId,
                member: result.member,
                rolesCount: result.roles.length,
                capabilitiesCount: result.capabilities.length
            }, 'Capabilities retrieved successfully');
            return validatedResponse;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            request.log.error({
                error: errorMessage,
                userId: request.user?.auth_user_id,
                correlationId: request.id
            }, 'Failed to retrieve capabilities');
            return reply.code(500).send({
                code: 'CAPABILITIES_ERROR',
                message: 'Failed to retrieve user capabilities',
                reason: errorMessage,
                correlationId: request.id
            });
        }
    });
    // GET /me/capabilities/cache - Get cache statistics (development only)
    if (process.env.NODE_ENV === 'development') {
        app.get('/me/capabilities/cache', {
            schema: {
                description: 'Get capabilities cache statistics (development only)',
                tags: ['Development'],
                security: [{ Bearer: [] }],
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            size: { type: 'number' },
                            keys: { type: 'array', items: { type: 'string' } }
                        }
                    }
                }
            },
            preHandler: authorize()
        }, async (request, reply) => {
            const stats = capabilitiesService.getCacheStats();
            return stats;
        });
        // DELETE /me/capabilities/cache - Clear capabilities cache (development only)
        app.delete('/me/capabilities/cache', {
            schema: {
                description: 'Clear capabilities cache (development only)',
                tags: ['Development'],
                security: [{ Bearer: [] }],
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            message: { type: 'string' }
                        }
                    }
                }
            },
            preHandler: authorize()
        }, async (request, reply) => {
            capabilitiesService.clearCache(request.user?.auth_user_id);
            return { message: 'Cache cleared successfully' };
        });
    }
};
export default capabilities;
//# sourceMappingURL=capabilities.js.map