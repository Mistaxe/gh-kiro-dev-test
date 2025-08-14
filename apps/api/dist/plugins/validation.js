import { ZodError } from 'zod';
const validation = async (app) => {
    // Add validation helper to request object
    app.decorateRequest('validate', function (schema, data) {
        try {
            return schema.parse(data);
        }
        catch (error) {
            if (error instanceof ZodError) {
                const validationError = new Error('Validation failed');
                validationError.code = 'VALIDATION_ERROR';
                validationError.statusCode = 400;
                validationError.cause = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
                throw validationError;
            }
            throw error;
        }
    });
    // Global error handler for validation errors
    app.setErrorHandler(async (error, request, reply) => {
        if (error.code === 'VALIDATION_ERROR') {
            const errorResponse = {
                code: 'VALIDATION_ERROR',
                message: 'Request validation failed',
                reason: error.cause || error.message,
                correlationId: request.id
            };
            request.log.warn({
                error: error.message,
                cause: error.cause,
                correlationId: request.id
            }, 'Validation error');
            return reply.code(400).send(errorResponse);
        }
        // Re-throw other errors to be handled by the main error handler
        throw error;
    });
};
export default validation;
//# sourceMappingURL=validation.js.map