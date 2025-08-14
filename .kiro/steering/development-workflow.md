# Development Workflow & Quality Gates

## Pre-Action Checklist

Before starting any development task:

1. **Load Context**: Review cross-references from `tasks.md` for Requirements/Design anchors and SQL files
2. **Identify Invariants**: Confirm which security/privacy invariants are relevant to the change
3. **Authorization Planning**: If touching authz/PHI, ensure required `AuthorizationContext` fields are defined
4. **Database Planning**: If writing to DB, verify RPC pattern and RLS policies; plan optimistic concurrency
5. **Reporting Planning**: If affecting reports/exports, verify small-cell suppression and audit requirements

## Post-Action Checklist

After completing any development task:

1. **Testing**: Run unit tests, golden-persona policy tests, and RLS smoke tests
2. **Audit Verification**: Verify audit logs contain policy version + context snapshot
3. **Route Validation**: For new routes, check rate limits, idempotency, pagination, error schema
4. **UI Validation**: Assert server-driven capabilities via `/me/capabilities` are respected

## Pre-Commit Gates (Blocking)

Before any commit:

1. **Security Check**: No `.env` files or secrets staged; only `.env.example` allowed
2. **Quality Check**: Lint/typecheck pass; migrations compile; SQL formatted
3. **Documentation**: `tasks.md` DoD items checked off with requirement ID links
4. **Policy Changes**: Include policy simulator screenshot or decision diff in PR notes

## Git Commit Guidelines

### Commit Message Format
Follow the PR template structure for commit messages:

```
feat: Brief description of changes

Summary:
What changed and why in human-readable terms.

Cross-Refs:
- Requirements: [REQ-XX if applicable]
- Design/Delta: [Design section if applicable]
- SQL/Migrations: [File names if applicable]

Security/Privacy:
- Tenant isolation preserved: Yes
- Consent gate touched: No/Yes (details if yes)
- Break-glass affected: No/Yes (read-only default upheld)

AuthZ:
- Casbin rules changed: No/Yes (policy version if yes)
- Decision validation: Completed/N/A

DB:
- Writes via SECURITY DEFINER RPC: Yes/N/A
- RLS updated: No/Yes (explanation if yes)

API Safety:
- Idempotency-Key on mutations: Yes/N/A
- Pagination/rate limits: Yes/N/A

Tests:
- Policy tests: X passed / 0 failed
- RLS smoke: Non-member sees 0 rows
```

### Commit Frequency
- Commit after each logical set of changes
- Each commit should represent a complete, working state
- Include all related files (code, tests, documentation) in the same commit

## Auto-Abort Conditions

Development must stop immediately if:

- Any change broadens RLS to non-tenant scope
- Consent gate removed or bypassed on PHI endpoint
- Email/SMS template includes PHI tokens
- Availability update ignores `If-Match` version requirement
- Policy change without version bump and simulator proof

## Development Patterns

### Authorization Context Building
```typescript
// Always include these patterns when building authorization context
interface AuthorizationContext {
  purpose?: 'care' | 'billing' | 'QA' | 'oversight' | 'research'
  consent_ok?: boolean
  contains_phi?: boolean
  tenant_root_id: string  // REQUIRED for all tenant-scoped operations
  bg?: boolean           // break-glass active
  bg_expires_at?: string // ISO timestamp
}
```

### Database Write Pattern
```sql
-- All writes must use SECURITY DEFINER RPC pattern
CREATE OR REPLACE FUNCTION app.rpc_operation_name(...)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Validate authorization context
  -- 2. Apply tenant isolation filters
  -- 3. Perform operation with audit logging
END;
$$;
```

### PHI Handling Pattern
```typescript
// Before showing any client data
if (!context.consent_ok && containsPHI) {
  return {
    // Only minimal candidate info allowed
    initials: client.first_name?.[0] + client.last_name?.[0],
    approximate_age: Math.floor(client.age / 5) * 5, // rounded to 5-year bands
    id: client.id // for linking purposes only
  };
}
```

## Testing Requirements

### Policy Testing
- Golden persona tests for all authorization scenarios
- Policy simulator validation for changes
- RLS smoke tests proving tenant isolation

### Integration Testing
- Consent flow validation
- Break-glass TTL enforcement
- Audit log completeness
- Rate limiting behavior

### Security Testing
- Cross-tenant data leakage prevention
- PHI redaction verification
- Authorization bypass attempts