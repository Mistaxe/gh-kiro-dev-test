// Authorization types and interfaces
export type {
  AuthorizationContext,
  ContextBuilder,
  AuthorizationDecision,
  PolicySimulationResult,
  ConsentResult
} from './types/authorization.js'

export { AuthorizationContextValidator } from './types/authorization.js'

// Persona management types
export type {
  Persona,
  PersonaSession,
  RoleAssignment,
  Organization,
  ServiceLocation,
  PersonaListResponse,
  ImpersonationRequest,
  ImpersonationResponse,
  ScopeSelectionRequest,
  ScopeSelectionResponse
} from './types/persona.js'

// Re-export common types that will be shared across the platform
export * from './types/authorization.js'
export * from './types/persona.js'