import { z } from 'zod';
// Common UUID schema
export const UuidSchema = z.string().uuid();
// Common pagination schema
export const PaginationQuerySchema = z.object({
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(20)
});
// Common error response schema
export const ErrorResponseSchema = z.object({
    code: z.string(),
    message: z.string(),
    reason: z.string(),
    hint: z.string().optional(),
    correlationId: z.string(),
    details: z.record(z.any()).optional()
});
// Purpose of use schema
export const PurposeOfUseSchema = z.enum(['care', 'billing', 'QA', 'oversight', 'research']);
// Scope type schema
export const ScopeTypeSchema = z.enum(['region', 'network', 'org', 'location', 'global']);
// Standard headers schema
export const StandardHeadersSchema = z.object({
    'x-purpose-of-use': PurposeOfUseSchema.optional(),
    'x-idempotency-key': z.string().optional(),
    'if-match': z.string().optional()
});
//# sourceMappingURL=common.js.map