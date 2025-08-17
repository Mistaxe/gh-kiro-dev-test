# Implementation Plan

- [x] 1. Backend API Foundation
  - Create TypeScript Fastify API with plugin architecture and Zod validation
  - Implement Supabase JWT authentication plugin that decodes tokens and exposes req.user
  - Add Casbin authorization middleware with policy loading from model.conf and policy.csv
  - Create health check endpoint and basic error handling infrastructure
  - _Requirements: 6.1, 6.2, 6.3, 6.5_

  - [x] 1.5 Early Capabilities endpoint (execute task 4.1 now)
    - Implement GET /me/capabilities early to unblock Lab and role checks
    - _Cross-ref: 4.1_

- [x] 2. Authorization Infrastructure
  - [x] 2.0 Define AuthorizationContext (shared contract)
    - Freeze the ctx shape used by API and Lab 
    - Publish types to @app/shared for reuse
    - Add unit tests to validate ctx builder populates mandatory fields
    - _Dependencies: 1. Backend foundation_

  - [x] 2.1 Implement context builders for different resource types
    - Create context builder interface and base implementation
    - Build client context builder with consent evaluation and tenant scope checking
    - Build note context builder with assignment and program sharing logic
    - Build referral context builder with PHI detection and visibility scope
    - _Requirements: 1.2, 1.3, 2.1, 2.2_

  - [x] 2.2 Create policy simulation and hot-reload endpoints
    - Implement POST /dev/policy/simulate endpoint with context evaluation
    - Add POST /dev/policy/reload endpoint for development policy updates
    - Create audit logging for all authorization decisions with context snapshots
    - Expose policy **version** in `/health` and include `policy_version` in every audit entry
    - Policy simulator must **return matched policy row (or no match)** and echo the `ctx` snapshot used
    - _Requirements: 1.3, 5.2, 12.3_

  - [x] 2.3 Early Lab UI shell (execute task 7.1 now)
    - Build /lab shell + nav to validate contexts and simulator ASAP
    - Wire to /dev/policy/simulate for manual allow/deny probes
    - _Cross-ref: 7.1_

  - [x] 2.4 Implement consent evaluation engine
    - Create consent evaluator service with hierarchical consent logic
    - Implement platform vs organization vs location consent scope handling
    - Add purpose-of-use validation and grace period support
    - Build consent result caching with appropriate TTL
    - Prerequisite: **Apply DB deltas in task 3.1** (client_consents, client_links, availability.version, audit hash)
    - Return `{ consent_ok, consent_id, reason }`; include grace period logic
    - Unit tests: platform vs organization vs location scopes; expiry and revocation
    - _Requirements: 2.1, 2.2, 13.2, 14.2_

- [x] 3. Database Schema Extensions
  - [x] 3.1 Add missing tables for enhanced consent and linking
    - Create client_consents table with normalized consent structure
    - Add client_links table for cross-org client linking audit trail
    - Update availability table with version column for optimistic concurrency
    - Add hash chain column to audit_logs for tamper evidence
    - _Requirements: 13.1, 13.4, 14.1, 19.1, 20.3_

  - [x] 3.2 Implement SECURITY DEFINER RPC functions
    - Create rpc_upsert_availability with authorization checks and version control
    - Build rpc_create_note with helper vs provider classification
    - Implement rpc_create_referral with PHI detection and consent validation
    - Add rpc_link_client for cross-org client linking with audit
    - **Table DML denied-by-default; all writes go via SECURITY DEFINER RPCs**
    - RPCs re-apply the same policy checks as the service layer before DML
    - _Requirements: 7.1, 8.1, 8.2, 13.1, 21.2_

  - [x] 3.3 Create performance indexes and constraints
    - Add tenant_root_id indexes to all tenant-scoped tables
    - Create composite indexes for common query patterns
    - Add trigram indexes for fuzzy name matching
    - Implement PostGIS indexes for geospatial queries
    - _Requirements: 21.1, 21.3_

- [-] 4. Core Business Logic Implementation
  - [x] 4.1 Implement capabilities endpoint
    - Create GET /me/capabilities endpoint with scope-based filtering
    - Integrate with app.capabilities() database function
    - Add role assignment resolution and membership checking
    - Implement caching strategy for capability lookups
    - _Requirements: 1.4, 4.1, 4.2_

  - [x] 4.2 Build client management services
    - Create client CRUD operations with fingerprint generation
    - Implement duplicate client detection using privacy-preserving fingerprints
    - Add cross-org client linking with consent validation
    - Build client search with minimal candidate info display
    - Generate client **fingerprints** (region-salted) on create/update
    - Return **minimal candidates** (initials, approx age) pre-consent; no PHI leakage
    - Audit **link/unlink** events between orgs (who, when, from_org → to_org)
    - Test: **dedupe leak**—ensure zero PHI revealed pre-consent
    - _Requirements: 7.1, 7.2, 13.1, 13.2, 13.3_

  - [x] 4.3 Implement case management functionality
    - Create client case CRUD with assignment and program validation
    - Add caseload management with member access controls
    - Implement program-based access level enforcement
    - Build case closure workflow with audit trail
    - _Requirements: 7.2, 7.3, 7.5_

- [x] 5. Service Registry and Availability System
  - [x] 5.1 Build service profile management
    - Create service profile CRUD with claimed/unclaimed logic
    - Implement full-text search with PostgreSQL tsvector
    - Add JSONB attribute filtering for eligibility criteria
    - Build curator access controls for unclaimed services
    - _Requirements: 4.1, 4.3, 4.5_

  - [x] 5.2 Implement availability engine
    - Create availability CRUD with optimistic concurrency control
    - Build JSON predicate matching for client needs
    - Implement real-time availability updates with version checking
    - Add materialized views for availability aggregations
    - Require `If-Match: <version>` for updates; return **409** on version mismatch
    - Concurrent update test: exactly one succeeds, others 409
    - _Requirements: 4.2, 4.4, 20.1, 20.2, 20.3_

- [-] 6. Notes and Referral System
  - [ ] 6.1 Implement note management
    - Create note CRUD with helper vs provider classification
    - Add confidential note access with temporary grant support
    - Implement helper journal separation from provider case notes
    - Build note search and filtering with authorization
    - Provider note queries **exclude helper journals** by default
    - Access to **confidential** notes requires a temporary grant or explicit policy
    - _Requirements: 8.2, 8.3, 22.1, 22.2_

  - [x] 6.2 Build referral workflow
    - Create referral CRUD with direct vs record-keeping types
    - Implement PHI detection and consent validation for referrals
    - Add visibility scope controls and status tracking
    - Build referral search and matching functionality
    - _Requirements: 8.1, 8.4, 3.4, 3.5_

- [ ] 7. Lab/Test Harness Development
  - [x] 7.1 Create Lab UI shell and navigation
    - Build Next.js app with App Router and Tailwind CSS
    - Create lab layout with tab navigation for all components
    - Add shadcn/ui components for consistent styling
    - Implement responsive design for development workflows
    - _Requirements: 5.1_

  - [x] 7.2 Implement persona management and impersonation
    - Create dev endpoints for persona listing and impersonation
    - Build persona UI with role assignment display
    - Add session management for impersonated users
    - Implement active organization and location selection
    - _Requirements: 5.1, 5.5_

  - [-] 7.3 Build policy simulator interface
    - Create policy simulation UI with role, object, action inputs
    - Add context builder interface for testing scenarios
    - Implement real-time policy evaluation with decision display
    - Add policy reload functionality with success feedback
    - UI must display the **matched policy row** (or 'no match')
    - Echo the **ctx snapshot** used for the evaluation
    - _Requirements: 5.2, 12.3_

  - [ ] 7.4 Create RLS testing interface
    - Build RLS query interface with whitelisted table selection
    - Add filter builder for testing different query scenarios
    - Implement query execution with JWT context switching
    - Display results with row count validation
    - _Requirements: 5.3, 21.3_

- [ ] 8. Data Seeding and Generation
  - [ ] 8.1 Build comprehensive data seeder
    - Create idempotent seeder for regions, networks, organizations
    - Add realistic user generation with role assignments
    - Implement client and case generation with faker data
    - Build availability and referral seed data
    - _Requirements: 5.4, 12.4_

  - [ ] 8.2 Create seeder UI and controls
    - Build seeder interface with progress tracking
    - Add selective seeding options for different entity types
    - Implement seed data cleanup and reset functionality
    - Create seed data validation and verification
    - _Requirements: 5.4_

- [ ] 9. Notification System
  - [ ] 9.1 Implement notification infrastructure
    - Create notification CRUD with channel support
    - Add notification preferences management
    - Implement PHI protection for external channels
    - Build notification delivery with provider abstraction
    - **Email/SMS must not contain PHI**; send a secure link back to in-app content
    - _Requirements: 9.1, 9.2, 9.5_

  - [ ] 9.2 Build notification UI and testing
    - Create notification listing and mark-read functionality
    - Add notification preferences interface
    - Implement dev notification triggers for testing
    - Build notification content preview and management
    - _Requirements: 9.3, 9.4_

- [ ] 10. Reporting and Analytics
  - [ ] 10.1 Implement de-identified reporting
    - Create reporting views with small-cell suppression
    - Add statistical disclosure controls and value rounding
    - Implement regional and network aggregate reports
    - Build export controls with purpose validation
    - Config: `reporting.k_min` (default 11) used by small-cell suppression
    - Audit each export with **purpose-of-use** and **policy version**
    - _Requirements: 10.1, 10.4, 10.5_

  - [ ] 10.2 Build identified reporting with authorization
    - Create identified report access with legal basis validation
    - Add organizational scope reporting with consent checks
    - Implement finance reporting with role-based access
    - Build audit trail for all report generation
    - Audit each **identified** export with **purpose-of-use** and **policy version**
    - _Requirements: 10.2, 10.3, 10.4_

- [ ] 11. Helper Ecosystem Features
  - [ ] 11.1 Implement helper registration and verification
    - Create HelperBasic self-registration workflow
    - Add HelperVerified invitation and approval process
    - Implement helper profile management
    - Build helper access level transitions with audit
    - _Requirements: 3.1, 3.2, 22.3_

  - [ ] 11.2 Build helper-specific workflows
    - Create helper journal functionality separate from case notes
    - Implement record-keeping referral creation for helpers
    - Add helper client linking with minimal info display
    - Build helper dashboard with appropriate feature access
    - _Requirements: 3.3, 3.4, 22.1, 22.4_

- [ ] 12. Funding and Promotion Management
  - [ ] 12.1 Implement funding relationship tracking
    - Create funding relationship CRUD with region/network to org mapping
    - Add coverage and constraint validation
    - Implement funding expiration and access restriction
    - Build funding usage tracking and reporting
    - _Requirements: 11.1, 11.4_

  - [ ] 12.2 Build promotion code system
    - Create promo code CRUD with feature and seat limits
    - Add promo code validation and usage tracking
    - Implement feature access enforcement based on active promos
    - Build promo code expiration and cleanup
    - _Requirements: 11.2, 11.3_

- [ ] 13. JWT & Header Conventions
  - [ ] 13.1 Implement custom JWT claims and header validation
    - Add custom JWT claims: active_org_id, active_location_id, purpose, bg_exp
    - Implement X-Purpose-Of-Use header validation for PHI routes
    - Add X-Idempotency-Key header support for mutating operations
    - Build If-Match header validation for optimistic concurrency
    - Server-side validation of purpose and break-glass TTL (clients cannot force authorization)
    - _Requirements: 18.5, 20.3_

- [ ] 14. API Safety and Performance
  - [ ] 14.1 Implement API safety rails
    - Add idempotency key support for all mutating endpoints
    - Implement cursor pagination for all list endpoints
    - Add rate limiting per IP and per user
    - Create ETag support for cacheable non-PHI endpoints
    - _Requirements: 18.1, 18.2, 18.6_

  - [ ] 14.2 Build error handling and validation
    - Implement standardized error response format
    - Add purpose-of-use header validation for PHI routes
    - Create clear error messages with remediation hints
    - Build correlation ID tracking for debugging
    - _Requirements: 18.4, 18.5_

- [ ] 15. Network Management and Delegations
  - [ ] 15.1 Implement network membership system
    - Create network membership CRUD linking networks to orgs/locations
    - Add network membership validation and authorization
    - Build network-scoped role assignments and permissions
    - Implement network admin capabilities for member management
    - _Requirements: 1.4_

  - [ ] 15.2 Build network delegation features
    - Create network delegation system for field-level permissions
    - Add delegated field validation and edit window enforcement
    - Implement audit requirements for delegated operations
    - Build delegation UI for network administrators
    - _Requirements: 1.4_

- [ ] 16. Temporary Grant System
  - [ ] 16.1 Implement temporary grant infrastructure
    - Create temporary grant CRUD with resource selector and verb specification
    - Add grant expiration enforcement and automatic cleanup
    - Implement grant-based access evaluation in authorization context
    - Build temporary grant audit logging and tracking
    - _Requirements: 8.3, 15.2_

  - [ ] 16.2 Build temporary grant UI and management
    - Create temporary grant request and approval workflow
    - Add grant management interface for administrators
    - Implement grant status tracking and notifications
    - Build grant usage reporting and analytics
    - _Requirements: 8.3_

- [ ] 17. Data Lifecycle and Retention Management
  - [ ] 17.1 Implement data retention and lifecycle policies
    - Create retention rule system per entity type and jurisdiction
    - Add soft-delete workflow with restore capabilities
    - Implement hard-delete workflow where legally permissible
    - Build retention policy enforcement and automated cleanup
    - _Requirements: 17.1, 17.2_

  - [ ] 17.2 Build data lifecycle UI and controls
    - Create data retention policy management interface
    - Add soft-delete and restore functionality
    - Implement data export validation with retention constraints
    - Build data lifecycle reporting and compliance tracking
    - _Requirements: 17.1, 17.2_

- [ ] 18. Client Portal Readiness (Future-Proofing)
  - [ ] 18.1 Prepare data model for client self-access
    - Design client-scoped access grant system without breaking tenant isolation
    - Add per-case share flags and access logging for future portal
    - Ensure consent records are attributable and revocable by clients
    - Build client identity linking system for future authentication
    - _Requirements: 23.1, 23.2, 23.3_

  - [ ] 18.2 Build client portal foundation
    - Create client portal authentication preparation
    - Add client-facing consent management foundation
    - Implement client data access logging and audit trail
    - Build client portal API endpoints (read-only foundation)
    - _Requirements: 23.1, 23.2, 23.3_

- [ ] 19. Security and Audit Features
  - [ ] 19.1 Implement break-glass functionality
    - Create break-glass activation with TTL enforcement
    - Add break-glass UI banner with countdown display
    - Implement read-only break-glass access by default
    - Build comprehensive break-glass audit logging
    - **Read-only by default**; writes require explicit policy
    - Server-enforced **TTL** with visible banner countdown in UI
    - Audit `bg=true` with reason (inferred from page event (e.g. clicking a button to confirm intent to open record)) and TTL window
    - _Requirements: 2.4, 15.1, 15.2, 15.5_

  - [ ] 19.2 Build audit immutability features
    - Implement hash chain for audit log integrity
    - Add periodic export to WORM storage
    - Create forensic query capabilities
    - Build audit log verification and tamper detection
    - _Requirements: 19.1, 19.2, 19.3_

- [ ] 20. Testing and Quality Assurance
  - [ ] 20.1 Create comprehensive policy tests
    - Build policy test framework with golden personas
    - Implement automated testing for all role combinations
    - Add consent and claimed/unclaimed service path testing
    - Create policy change validation tests
    - _Requirements: 12.1, 12.2, 12.5_

  - [ ] 20.2 Build RLS and endpoint testing
    - Create RLS smoke tests for tenant isolation
    - Add endpoint authorization tests for all business routes
    - Implement integration tests for complex workflows
    - Build performance tests for authorization overhead
    - Non-member sees **0 rows** for tenant tables; members see **only in-tenant rows**
    - _Requirements: 12.1, 12.2, 21.2_

  - [ ] 20.3 Create troubleshooting and debugging tools
    - Build authorization decision explanation tools
    - Add role assignment debugging interface
    - Create policy evaluation dry-run capabilities
    - Implement context inspection and validation tools
    - _Requirements: 12.3, 12.4_

- [ ] 21. Production Readiness
  - [ ] 21.1 Implement monitoring and observability
    - Add application performance monitoring integration
    - Create custom dashboards for authorization metrics
    - Implement security monitoring and alerting
    - Build business metrics tracking and reporting
    - _Requirements: 12.4_

  - [ ] 21.2 Build deployment and configuration management
    - Create environment-specific configuration management
    - Add database migration and rollback procedures
    - Implement policy versioning and deployment pipeline
    - Build health checks and readiness probes
    - _Requirements: 16.1, 16.2_

  - [ ] 21.3 Create operational procedures
    - Build incident response procedures for authorization failures
    - Add data retention and cleanup procedures
    - Create backup and disaster recovery procedures
    - Implement compliance reporting and audit procedures
    - _Requirements: 17.1, 17.2_