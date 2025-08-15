import Fastify, { FastifyInstance } from 'fastify'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Mock user for testing
const mockUser = {
  auth_user_id: 'auth_user_123',
  email: 'test@example.com',
  role: 'CaseManager'
}

// Build the app for testing
export async function build(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false // Disable logging in tests
  })

  // Register plugins that would normally be in index.ts
  await app.register(import('@fastify/sensible'))
  
  // Mock authentication plugin for testing
  app.addHook('preHandler', async (req) => {
    if (req.headers.authorization?.startsWith('Bearer ')) {
      req.user = mockUser
    }
  })
  
  // Register routes for testing
  await app.register(import('../src/routes/capabilities.js'), { prefix: '/api' })
  
  // Add health endpoint for testing
  app.get('/health', async () => {
    try {
      const { policyVersion } = await import('../src/middleware/authorize.js')
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        policy_version: policyVersion
      }
    } catch (error) {
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        policy_version: 'test-version'
      }
    }
  })
  
  return app
}