# Project Structure

## Monorepo Organization

The project follows a monorepo structure with npm workspaces:

```
behavioral-health-platform/
├── apps/                    # Application workspaces
│   ├── api/                # Backend API (Fastify + TypeScript)
│   └── web/                # Frontend web app (Next.js)
├── packages/               # Shared packages
│   └── shared/             # Common types, utilities, validation schemas
├── docs/                   # Documentation
│   ├── authz/              # Authorization documentation
│   └── README-ARCH.md      # Architecture overview
├── temp/                   # Temporary files and design documents
│   ├── DESIGN_DELTAS.md    # Design changes tracking
│   ├── PROMPTS/            # AI prompts and templates
│   └── supabase/           # Database schema and migrations
└── .kiro/                  # Kiro configuration
    ├── specs/              # Feature specifications
    └── steering/           # AI assistant guidance (this file)
```

## Application Structure

### Backend API (`apps/api/`)
```
apps/api/
├── src/
│   ├── plugins/            # Fastify plugins (auth, validation)
│   ├── middleware/         # Authorization middleware
│   ├── context/            # Context builders for authorization
│   ├── routes/             # API route handlers
│   ├── services/           # Business logic services
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utility functions
├── dist/                   # Compiled JavaScript output
└── tsconfig.json           # TypeScript configuration
```

### Frontend Web App (`apps/web/`)
```
apps/web/
├── app/                    # Next.js App Router
│   ├── (public)/           # Public routes (no auth required)
│   ├── (authenticated)/    # Protected routes
│   └── lab/                # Development Lab/Test Harness
├── components/             # React components
│   ├── ui/                 # shadcn/ui base components
│   ├── forms/              # Form components
│   ├── tables/             # Data table components
│   └── lab/                # Lab-specific components
├── lib/                    # Utility libraries
│   ├── api.ts              # API client
│   ├── auth.ts             # Authentication helpers
│   └── types.ts            # Shared TypeScript types
└── public/                 # Static assets
```

## Key Directories

### `.kiro/specs/`
Contains feature specifications with requirements, design, and implementation tasks. Each spec is a structured approach to building complex features with AI assistance.

### `temp/`
Temporary workspace for design documents, database schemas, and development artifacts. Not part of the main codebase but useful for development.

### `docs/`
Project documentation including architecture decisions and authorization patterns.

## Naming Conventions

- **Files**: kebab-case for most files (`user-service.ts`)
- **Components**: PascalCase for React components (`UserProfile.tsx`)
- **Directories**: kebab-case for directories (`user-management/`)
- **Database**: snake_case for tables and columns (`user_profiles`, `created_at`)
- **API Routes**: RESTful with kebab-case (`/api/user-profiles`)

## Import Patterns

- **Relative imports** within the same workspace
- **Workspace imports** using npm workspace names
- **Shared types** from `packages/shared`
- **Absolute imports** for Next.js app directory

## Configuration Files

- **Root level**: Package management, TypeScript base config, formatting
- **App level**: App-specific TypeScript and build configurations
- **Kiro level**: AI assistant configuration and specifications