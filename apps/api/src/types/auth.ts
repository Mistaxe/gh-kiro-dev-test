// Re-export shared authorization types
export type {
  AuthorizationContext,
  ContextBuilder,
  AuthorizationDecision,
  PolicySimulationResult,
  ConsentResult
} from '@app/shared'

// Import for local use
import type { AuthorizationContext } from '@app/shared'

// User information from JWT
export interface User {
  auth_user_id: string;
  email: string;
  role?: string;
  app_metadata?: Record<string, any>;
  user_metadata?: Record<string, any>;
  purpose?: string;
}

// Authorization subject (role + scope)
export interface AuthSubject {
  role: string;
  scope_type?: 'region' | 'network' | 'org' | 'location' | 'global';
  scope_id?: string;
}

// Authorization object (resource being accessed)
export interface AuthObject {
  type: string;
  id: string;
  tenant_root_id?: string;
}

// Legacy authorization decision result for backward compatibility
export interface AuthDecision {
  decision: 'allow' | 'deny';
  reason: string;
  matchedPolicy?: string;
  contextSnapshot: AuthorizationContext;
  policyVersion: string;
}

// Legacy context builder function type for backward compatibility
export type LegacyContextBuilder = (
  req: any,
  resourceId?: string
) => Promise<AuthorizationContext>;