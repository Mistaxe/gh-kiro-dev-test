import { authorize } from '../middleware/authorize.js';
import { CapabilitiesQuerySchema, CapabilitiesResponseSchema } from '../schemas/capabilities.js';
const capabilities = async (app) => {
    // GET /me/capabilities - Check user capabilities and membership
    app.get('/me/capabilities', {
        schema: {
            description: 'Get user capabilities and membership status',
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
                                    scope_id: { type: 'string' }
                                }
                            }
                        },
                        capabilities: {
                            type: 'array',
                            items: { type: 'string' }
                        }
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
                }
            }
        },
        preHandler: authorize() // Basic auth check, no specific authorization needed
    }, async (request, reply) => {
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
        // TODO: Query database for actual role assignments and capabilities
        // For now, return mock data based on JWT claims
        const mockRoles = [
            {
                role: request.user.role || 'BasicAccount',
                scope_type: 'org',
                scope_id: 'org_123'
            }
        ];
        // Check membership for requested scope
        let member = false;
        if (scopeType && scopeId) {
            member = mockRoles.some(role => role.scope_type === scopeType && role.scope_id === scopeId);
        }
        else {
            // If no specific scope requested, user is a member if they have any roles
            member = mockRoles.length > 0;
        }
        // TODO: Calculate actual capabilities based on roles and policies
        const mockCapabilities = member ? [
            'read:clients',
            'write:notes',
            'read:referrals'
        ] : [];
        const response = {
            user_id: request.user.auth_user_id,
            email: request.user.email,
            member,
            roles: mockRoles,
            capabilities: mockCapabilities
        };
        // Validate response with Zod schema
        const validatedResponse = CapabilitiesResponseSchema.parse(response);
        return validatedResponse;
    });
};
export default capabilities;
//# sourceMappingURL=capabilities.js.map