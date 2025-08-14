import { authorize } from '../middleware/authorize.js';
const router = async (app) => {
    app.get('/clients/:id', {
        schema: {
            description: 'Get client by ID',
            tags: ['Clients'],
            security: [{ Bearer: [] }],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' }
                },
                required: ['id']
            }
        },
        preHandler: authorize(async (req) => {
            const { id } = req.params;
            // TODO: Load actual client data, org, assignments, consent from database
            // For now, return mock context
            return {
                purpose: req.user?.purpose || 'care',
                consent_ok: true, // TODO: derive via consent evaluation
                assigned_to_user: true, // TODO: derive from assignments
                contains_phi: true,
                tenant_root_id: 'org_123' // TODO: derive from client data
            };
        })
    }, async (req, reply) => {
        const { id } = req.params;
        // Set authorization properties
        req.subject = { role: req.user?.role || 'CaseManager' }; // TODO: derive from memberships
        req.object = { type: 'Client', id, tenant_root_id: 'org_123' };
        req.action = 'read';
        // Return mock client data (authorization already checked by preHandler)
        reply.send({
            id,
            first_name: 'John',
            last_name: 'Doe',
            // TODO: Apply field-level redaction based on authorization context
        });
    });
};
export default router;
//# sourceMappingURL=example.clients.js.map