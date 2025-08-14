# Technology Stack

## Build System & Package Management

- **Package Manager**: npm with workspaces
- **Node.js**: >=20.0.0 (specified in engines)
- **TypeScript**: 5.4.5+ with strict mode enabled
- **Monorepo Structure**: Workspaces for `apps/*` and `packages/*`

## Backend Stack

- **Runtime**: Node.js with TypeScript
- **API Framework**: Fastify with plugin architecture
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **Authorization**: Casbin for RBAC/PBAC policy evaluation
- **Authentication**: Supabase Auth with JWT tokens

## Frontend Stack

- **Framework**: Next.js (App Router)
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS (inferred from typical Next.js setup)

## Development Tools

- **Linting**: ESLint with TypeScript support and Prettier integration
- **Formatting**: Prettier with specific configuration
- **Concurrency**: concurrently for running multiple dev servers

## Common Commands

### Development
- Before running npm run, check if the api and web servers are already running. If they are running, DO NOT run npm run dev. 
```bash
# Start both API and web in development
npm run dev

# Start individual apps
npm run dev -w apps/api
npm run dev -w apps/web
```

### Building
```bash
# Build all applications
npm run build

# Build individual apps
npm run build -w apps/api
npm run build -w apps/web
```

### Testing & Quality
```bash
# Run tests across all workspaces
npm run test

# Run linting across all workspaces
npm run lint

# Format all code
npm run format
```

## TypeScript Configuration

- **Target**: ES2022 with DOM libraries
- **Module System**: NodeNext for API, standard for web
- **Strict Mode**: Enabled with `useUnknownInCatchVariables`
- **Path Resolution**: Workspace-relative imports supported

## Database Architecture

- **Primary Database**: Supabase PostgreSQL
- **Security**: Row Level Security (RLS) policies for tenant isolation
- **Functions**: SECURITY DEFINER stored procedures for write operations
- **Audit**: Immutable audit logs with hash chain integrity

## Critical Development Rules

### Database & Security Invariants
- **Tenant Isolation**: Every data path MUST filter by `tenant_root_id`
- **RLS Policy**: Deny-by-default; no broad 'TRUE' policies allowed
- **Write Operations**: All writes through SECURITY DEFINER RPCs only
- **Authorization**: PBAC/RBAC decisions are authoritative at service layer
- **PHI Access**: Requires `consent_ok=true` AND purpose-of-use header
- **Break-glass**: Read-only by default with server-side TTL enforcement

### API Safety Requirements
- **Idempotency**: All mutation endpoints support `Idempotency-Key`
- **Pagination**: List endpoints use cursor pagination
- **Concurrency**: Availability updates require `If-Match: <version>`
- **Rate Limiting**: Applied per IP and per user on search/availability
- **Error Schema**: Standardized with code, message, reason, hint, correlationId

### Audit & Governance
- **Decision Logging**: Every allow/deny with subject, object, action, context, policy version
- **Policy Versioning**: Changes are versioned artifacts requiring PR review
- **Export Controls**: Identified exports require purpose-of-use + consent + role checks
- **Small-cell Suppression**: De-identified reports enforce k_min >= 11

### Forbidden Actions
- Queries omitting `tenant_root_id` filters on tenant-scoped tables
- Relaxing RLS to permit cross-tenant SELECTs
- Email/SMS content containing PHI
- Bypassing Casbin authorization checks
- Committing secrets, .env files, or raw PHI test data