# Implementation Plan

- [ ] 1. Backend API Foundation
  - Create TypeScript Fastify API with plugin architecture and Zod validation
  - Implement Supabase JWT authentication plugin that decodes tokens and exposes req.user
  - Add Casbin authorization middleware with policy loading from model.conf and policy.csv
  - Create health check endpoint with policy version exposure and basic error handling infrastructure
  - _Requirements: 6.1, 6.2, 6.3, 6.5_

- [ ] 2. Database Schema Extensions (Priority - Unblocks Everything)
  - [ ] 2.1 Add missing tables for enhanced consent and linking
    - Create client_consents table with normalized consent structure
    - Add client_links table for cross-org client linking audit trail
    - Update availability table with version column for optimistic concurrency
    - Add hash chain column to audit_logs for tamper evidence
    - _Requirements: 13.1, 13.4, 14.1, 19.1, 20.3_

  - [ ] 2.2 Implement SECURITY DEFINER RPC functions (Table DML denied-by-default rule)
    - Establish rule: all table DML denied-by-default; all writes via SECURITY DEFINER RPCs
    - Create rpc_upsert_availability with authorization checks and version control
    - Build rpc_create_note with helper vs provider classification
    - Implement rpc_create_referral with PHI detection and consent validation
    - Add rpc_link_client for cross-org client linking with audit
    - _Requirements: 7.1, 8.1, 8.2, 13.1, 21.2_

  - [ ] 2.3 Create performance indexes and constraints
    - Add tenant_root_id indexes to all tenant-scoped tables
    - Create composite indexes for common query patterns
    - Add trigram indexes for fuzzy name matching
    - Implement PostGIS indexes for geospatial queries
    - _Requirements: 21.1, 21.3_

- [ ] 3. Authorization Context Contract
  - Define and freeze AuthorizationContext interface with all expanded fields
  - Create shared TypeScript types for API and Lab consistency
  - Document context builder contract and field semantics
  - Export context types for cross-module usage
  - _Requirements: 1.2, 1.3_

- [ ] 4. Core Capabilities Endpoint (Early Unblock)
  - Create GET /me/capabilities endpoint with scope-based filtering
  - Integrate with app.capabilities() database function
  - Add role assignment resolution and membership checking
  - Implement caching strategy for capability lookups
  - _Requirements: 1.4, 4.1, 4.2_

- [ ] 5. Lab UI Shell (Early Testing Infrastructure)
  - Build Next.js app with App Router and Tailwind CSS
  - Create lab layout with tab navigation for all components
  - Add shadcn/ui components for consistent styling
  - Implement responsive design for development workflows
  - _Requirements: 5.1_

- [ ] 6. Authorization Infrastructure
  - [ ] 6.1 Create policy simulation and hot-reload endpoints
    - Implement POST /dev/policy/simulate endpoint with context evaluation
    - Add POST /dev/policy/reload endpoint for development policy updates
    - Record policy version in every audit entry and expose on /health endpoint
    - Must show matched policy row (or "no match") and ctx snapshot used
    - _Requirements: 1.3, 5.2, 12.3_

  - [ ] 6.2 Build policy simulator interface (Early Testing)
    - Create policy simulation UI with role, object, action inputs
    - Add context builder interface for testing scenarios
    - Implement real-time policy evaluation with decision display
    - Add policy reload functionality with success feedback
    - _Requirements: 5.2, 12.3_

  - [ ] 6.3 Implement consent evaluation engine
    - Create consent evaluator service with hierarchical consent logic
    - Must return {consent_ok, consent_id, reason} with grace period logic
    - Implement platform vs organization vs location consent scope handling
    - Add unit tests for platform vs org vs location scope scenarios
    - _Requirements: 2.1, 2.2, 13.2, 14.2_

  - [ ] 6.4 Implement context builders for different resource types
    - Create context builder interface and base implementation using frozen AuthorizationContext
    - Build client context builder with consent evaluation and tenant scope checking
    - Build note context builder with assignment and program sharing logic
    - Build referral context builder with PHI detection and visibility scope
    - _Requirements: 1.2, 1.3, 2.1, 2.2_

- [ ] 7. Persona Management (Early Lab Feature)
  - Create dev endpoints for persona listing and impersonation
  - Build persona UI with role assignment display
  - Add session management for impersonated users
  - Implement active organization and location selection
  - _Requirements: 5.1, 5.5_

- [ ] 8. Core Business Logic Implementation
  - [ ] 8.1 Build client management services
    - Fingerprint generation + minimal-candidate returns before consent
    - Implement duplicate client detection using privacy-preserving fingerprints
    - Add cross-org client linking with consent validation
    - Cross-org link audit on every link/unlink operation
    - _Requirements: 7.1, 7.2, 13.1, 13.2, 13.3_

  - [ ] 8.2 Implement case management functionality
    - Create client case CRUD with assignment and program validation
    - Add caseload management with member access controls
    - Implement program-based access level enforcement
    - Build case closure workflow with audit trail
    - _Requirements: 7.2, 7.3, 7.5_

- [ ] 9. Service Registry and Availability System
  - [ ] 9.1 Build service profile management
    - Create service profile CRUD with claimed/unclaimed logic
    - Implement full-text search with PostgreSQL tsvector
    - Add JSONB attribute filtering for eligibility criteria
    - Build curator access controls for unclaimed services
    - _Requirements: 4.1, 4.3, 4.5_

  - [ ] 9.2 Implement availability engine
    - API must require If-Match: <version> and return 409 on mismatch
    - Create availability CRUD with optimistic concurrency control
    - Build JSON predicate matching for client needs
    - Add materialized views for availability aggregations
    - _Requirements: 4.2, 4.4, 20.1, 20.2, 20.3_

- [ ] 10. Notes and Referral System
  - [ ] 10.1 Implement note management
    - Provider note queries exclude helper journals by default
    - Confidential notes require temp grant or explicit policy
    - Create note CRUD with helper vs provider classification
    - Build note search and filtering with authorization
    - _Requirements: 8.2, 8.3, 22.1, 22.2_

  - [ ] 10.2 Build referral workflow
    - Create referral CRUD with direct vs record-keeping types
    - Implement PHI detection and consent validation for referrals
    - Add visibility scope controls and status tracking
    - Build referral search and matching functionality
    - _Requirements: 8.1, 8.4, 3.4, 3.5_

- [ ] 11. Lab/Test Harness Development
  - [ ] 11.1 Create RLS testing interface
    - Build RLS query interface with whitelisted table selection
    - Add filter builder for testing different query scenarios
    - Implement query execution with JWT context switching
    - Display results with row count validation
    - _Requirements: 5.3, 21.3_

- [ ] 12. Data Seeding and Generation
  - [ ] 12.1 Build comprehensive data seeder
    - Create idempotent seeder for regions, networks, organizations
    - Add realistic user generation with role assignments
    - Implement client and case generation with faker data
    - Build availability and referral seed data
    - _Requirements: 5.4, 12.4_

  - [ ] 12.2 Create seeder UI and controls
    - Build seeder interface with progress tracking
    - Add selective seeding options for different entity types
    - Implement seed data cleanup and reset functionality
    - Create seed data validation and verification
    - _Requirements: 5.4_

- [ ] 13. Notification System
  - [ ] 13.1 Implement notification infrastructure
    - Email/SMS never contain PHI; send link to in-app content
    - Create notification CRUD with channel support
    - Add notification preferences management
    - Build notification delivery with provider abstraction
    - _Requirements: 9.1, 9.2, 9.5_

  - [ ] 13.2 Build notification UI and testing
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
    - _Requirements: 10.1, 10.4, 10.5_

  - [ ] 10.2 Build identified reporting with authorization
    - Create identified report access with legal basis validation
    - Add organizational scope reporting with consent checks
    - Implement finance reporting with role-based access
    - Build audit trail for all report generation
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

- [ ] 13. API Safety and Performance
  - [ ] 13.1 Implement API safety rails
    - Add idempotency key support for all mutating endpoints
    - Implement cursor pagination for all list endpoints
    - Add rate limiting per IP and per user
    - Create ETag support for cacheable non-PHI endpoints
    - _Requirements: 18.1, 18.2, 18.6_

  - [ ] 13.2 Build error handling and validation
    - Implement standardized error response format
    - Add purpose-of-use header validation for PHI routes
    - Create clear error messages with remediation hints
    - Build correlation ID tracking for debugging
    - _Requirements: 18.4, 18.5_

- [ ] 14. Security and Audit Features
  - [ ] 14.1 Implement break-glass functionality
    - Create break-glass activation with TTL enforcement
    - Add break-glass UI banner with countdown display
    - Implement read-only break-glass access by default
    - Build comprehensive break-glass audit logging
    - _Requirements: 2.3, 15.1, 15.2, 15.5_

  - [ ] 14.2 Build audit immutability features
    - Implement hash chain for audit log integrity
    - Add periodic export to WORM storage
    - Create forensic query capabilities
    - Build audit log verification and tamper detection
    - _Requirements: 19.1, 19.2, 19.3_

- [ ] 15. Testing and Quality Assurance
  - [ ] 15.1 Create comprehensive policy tests
    - Build policy test framework with golden personas
    - Implement automated testing for all role combinations
    - Add consent and claimed/unclaimed service path testing
    - Create policy change validation tests
    - _Requirements: 12.1, 12.2, 12.5_

  - [ ] 15.2 Build RLS and endpoint testing
    - Create RLS smoke tests for tenant isolation
    - Add endpoint authorization tests for all business routes
    - Implement integration tests for complex workflows
    - Build performance tests for authorization overhead
    - _Requirements: 12.1, 12.2, 21.2_

  - [ ] 15.3 Create troubleshooting and debugging tools
    - Build authorization decision explanation tools
    - Add role assignment debugging interface
    - Create policy evaluation dry-run capabilities
    - Implement context inspection and validation tools
    - _Requirements: 12.3, 12.4_

- [ ] 16. Production Readiness
  - [ ] 16.1 Implement monitoring and observability
    - Add application performance monitoring integration
    - Create custom dashboards for authorization metrics
    - Implement security monitoring and alerting
    - Build business metrics tracking and reporting
    - _Requirements: 12.4_

  - [ ] 16.2 Build deployment and configuration management
    - Create environment-specific configuration management
    - Add database migration and rollback procedures
    - Implement policy versioning and deployment pipeline
    - Build health checks and readiness probes
    - _Requirements: 16.1, 16.2_

  - [ ] 16.3 Create operational procedures
    - Build incident response procedures for authorization failures
    - Add data retention and cleanup procedures
    - Create backup and disaster recovery procedures
    - Implement compliance reporting and audit procedures
    - _Requirements: 17.1, 17.2_