import { z } from 'zod';
// Query schema for capabilities endpoint
export const CapabilitiesQuerySchema = z.object({
    scopeType: z.enum(['region', 'network', 'org', 'location', 'global']).optional(),
    scopeId: z.string().optional()
});
// Response schema for capabilities endpoint
export const CapabilitiesResponseSchema = z.object({
    user_id: z.string(),
    email: z.string(),
    member: z.boolean(),
    roles: z.array(z.object({
        role: z.string(),
        scope_type: z.string(),
        scope_id: z.string(),
        expires_at: z.string().optional()
    })),
    capabilities: z.array(z.string())
});
//# sourceMappingURL=capabilities.js.map