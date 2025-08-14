import Fastify from 'fastify';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Build the app for testing
export async function build() {
    const app = Fastify({
        logger: false // Disable logging in tests
    });
    // Register plugins that would normally be in index.ts
    await app.register(import('@fastify/sensible'));
    // Register dev routes for testing
    await app.register(import('../src/routes/dev.js'));
    // Add health endpoint for testing
    app.get('/health', async () => {
        const { policyVersion } = await import('../src/middleware/authorize.js');
        return {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '0.1.0',
            policy_version: policyVersion
        };
    });
    return app;
}
//# sourceMappingURL=helper.js.map