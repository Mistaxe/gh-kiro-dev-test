import { FastifyPluginAsync } from 'fastify';
import { jwtVerify, createRemoteJWKSet } from 'jose';

// Extend Fastify types
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      auth_user_id: string;
      email: string;
      role?: string;
      app_metadata?: Record<string, any>;
      user_metadata?: Record<string, any>;
      purpose?: string;
    };
  }
}

const subauth: FastifyPluginAsync = async (app) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET;
  
  if (!supabaseUrl || !supabaseJwtSecret) {
    app.log.warn('Supabase configuration missing, JWT validation will be skipped in development');
  }

  // Create JWKS for production JWT verification
  const JWKS = supabaseUrl ? createRemoteJWKSet(new URL(`${supabaseUrl}/rest/v1/jwks`)) : null;

  app.addHook('preHandler', async (req) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      // No token provided - this is OK for public endpoints
      return;
    }

    const token = auth.slice(7);

    try {
      let decoded: any;

      if (process.env.NODE_ENV === 'development' && !JWKS) {
        // Development mode - decode without verification (trust proxy)
        const jwt = await import('jsonwebtoken');
        decoded = jwt.decode(token) as any || {};
        app.log.debug('JWT decoded in development mode (no verification)');
      } else if (JWKS && supabaseJwtSecret) {
        // Production mode - verify JWT with JWKS
        const { payload } = await jwtVerify(token, JWKS, {
          issuer: supabaseUrl,
          audience: 'authenticated'
        });
        decoded = payload;
        app.log.debug('JWT verified with JWKS');
      } else if (supabaseJwtSecret) {
        // Fallback - verify with secret
        const jwt = await import('jsonwebtoken');
        decoded = jwt.verify(token, supabaseJwtSecret) as any;
        app.log.debug('JWT verified with secret');
      } else {
        throw new Error('No JWT verification method available');
      }

      // Extract user information from JWT
      req.user = {
        auth_user_id: decoded.sub,
        email: decoded.email,
        role: decoded.role || decoded.app_metadata?.role,
        app_metadata: decoded.app_metadata || {},
        user_metadata: decoded.user_metadata || {},
        purpose: req.headers['x-purpose-of-use'] as string | undefined
      };

      app.log.debug({ userId: req.user.auth_user_id, email: req.user.email }, 'User authenticated');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      app.log.warn({ error: errorMessage }, 'JWT verification failed');
      // Don't throw error - let authorization middleware handle unauthenticated requests
    }
  });
};

export default subauth;
