# Requirements Document

## Introduction

This document outlines the requirements for a comprehensive multi-tenant SaaS platform for behavioral health coordination. The platform enables secure collaboration between healthcare providers, helpers, and clients while maintaining strict PHI/PII protection through advanced authorization controls, consent management, and audit logging. The system supports a hierarchical tenancy model (Region → Network → Org → ServiceLocation) with hybrid RBAC/PBAC authorization and includes a comprehensive Lab/Test Harness for development and verification.

## Requirements

### Requirement 1: Multi-Tenant Authorization Framework

**User Story:** As a system administrator, I want a robust multi-tenant authorization system that supports both role-based and attribute-based access control, so that users can only access data and perform actions appropriate to their roles and organizational context.

#### Acceptance Criteria

1. WHEN a user makes a request THEN the system SHALL evaluate both RBAC baseline permissions and PBAC policy expressions using Casbin
2. WHEN evaluating policies THEN the system SHALL construct a rich context object including consent status, purpose-of-use, scope relationships, and break-glass state
3. WHEN a policy decision is made THEN the system SHALL log the decision, context snapshot, and reasoning to audit_logs table
4. IF a user has multiple organizational memberships THEN the system SHALL allow them to select an active organizational context
5. WHEN RLS policies are applied THEN the system SHALL enforce tenant isolation at the database level as defense-in-depth

### Requirement 2: PHI/PII Protection and Consent Management

**User Story:** As a healthcare provider, I want comprehensive PHI/PII protection with granular consent controls, so that client privacy is maintained while enabling necessary care coordination.

#### Acceptance Criteria

1. WHEN accessing PHI THEN the system SHALL require valid consent and appropriate purpose-of-use headers
2. WHEN consent is missing or expired THEN the system SHALL deny access and provide clear reasoning
3. WHEN break-glass access is needed THEN the system SHALL allow temporary access with user-supplied reason, 15-minute TTL, and comprehensive audit logging
4. WHEN displaying client information without consent THEN the system SHALL show only minimal candidate info (initials, approximate age)
5. WHEN duplicate clients are detected THEN the system SHALL require consent confirmation before linking records

### Requirement 3: Helper Ecosystem Support

**User Story:** As a community helper, I want to participate in the care coordination ecosystem with appropriate access levels, so that I can contribute to client care while respecting privacy boundaries.

#### Acceptance Criteria

1. WHEN a HelperBasic user registers THEN the system SHALL allow self-onboarding with access to non-PHI features only
2. WHEN a HelperVerified user is invited THEN the system SHALL require organizational affiliation and approval process
3. WHEN helpers create notes THEN the system SHALL store them separately from provider case notes with appropriate classification
4. WHEN helpers create referrals THEN the system SHALL support record-keeping referrals without requiring PHI access
5. WHEN helpers access client information THEN the system SHALL enforce consent requirements and purpose-of-use validation

### Requirement 4: Service Registry and Availability Management

**User Story:** As a care coordinator, I want to search for available services and track real-time availability, so that I can efficiently match clients with appropriate resources.

#### Acceptance Criteria

1. WHEN searching services THEN the system SHALL support full-text search with JSONB attribute filtering
2. WHEN querying availability THEN the system SHALL use JSON predicates to match client needs with service capabilities
3. WHEN services are claimed THEN the system SHALL restrict profile updates to authorized location managers
4. WHEN availability changes THEN the system SHALL update materialized views for real-time bed/slot tracking
5. WHEN unclaimed services exist THEN the system SHALL allow curators to manage profiles until claimed

### Requirement 5: Comprehensive Lab/Test Harness

**User Story:** As a developer, I want a comprehensive testing environment that allows me to verify complex multi-tenant authorization behaviors, so that I can ensure the system works correctly across all scenarios.

#### Acceptance Criteria

1. WHEN using the Lab THEN the system SHALL provide persona impersonation with seeded users and role assignments
2. WHEN testing policies THEN the system SHALL provide a policy simulator that matches real authorization decisions
3. WHEN testing RLS THEN the system SHALL allow whitelisted SELECT queries to verify row-level security
4. WHEN generating test data THEN the system SHALL provide an idempotent seeder with realistic faker data
5. WHEN switching contexts THEN the system SHALL persist scope selection (Region/Network/Org/Location) across Lab tabs

### Requirement 6: Backend API Infrastructure

**User Story:** As a system integrator, I want a well-structured TypeScript API with plugin architecture, so that the system is maintainable and extensible.

#### Acceptance Criteria

1. WHEN the API starts THEN the system SHALL initialize Fastify with Zod validation and plugin architecture
2. WHEN authenticating requests THEN the system SHALL decode Supabase JWT tokens and expose req.user
3. WHEN authorizing requests THEN the system SHALL apply Casbin middleware with context building per route
4. WHEN policies change THEN the system SHALL support hot-reloading via /dev/policy/reload endpoint
5. WHEN errors occur THEN the system SHALL provide structured error responses with appropriate HTTP status codes

### Requirement 7: Client and Case Management

**User Story:** As a case manager, I want to manage client records and cases with proper authorization controls, so that I can coordinate care while maintaining privacy compliance.

#### Acceptance Criteria

1. WHEN creating client records THEN the system SHALL generate fingerprints for duplicate detection
2. WHEN accessing client cases THEN the system SHALL verify user assignment or program sharing relationships
3. WHEN managing caseloads THEN the system SHALL support program-based access controls with configurable access levels
4. WHEN merging client records THEN the system SHALL require two-person rule and same-organization constraints
5. WHEN closing cases THEN the system SHALL maintain audit trail and historical access patterns

### Requirement 8: Referral and Note Management

**User Story:** As a healthcare provider, I want to create referrals and maintain case notes with appropriate visibility controls, so that care coordination is effective while respecting confidentiality.

#### Acceptance Criteria

1. WHEN creating referrals THEN the system SHALL support both direct referrals and record-keeping referrals
2. WHEN writing notes THEN the system SHALL classify content as standard, confidential, or helper journal
3. WHEN accessing notes THEN the system SHALL enforce assignment-based access and temporary grant mechanisms
4. WHEN referrals contain PHI THEN the system SHALL require consent validation before transmission
5. WHEN notes are confidential THEN the system SHALL require special permissions or temporary grants for access

### Requirement 9: Notification System

**User Story:** As a platform user, I want to receive relevant notifications through multiple channels, so that I stay informed about important events and updates.

#### Acceptance Criteria

1. WHEN notifications are generated THEN the system SHALL support in-app, email, and SMS channels
2. WHEN users set preferences THEN the system SHALL respect channel-specific notification settings
3. WHEN notifications are delivered THEN the system SHALL log delivery attempts and track read status
4. WHEN in development mode THEN the system SHALL log notification content instead of sending external messages
5. WHEN notifications contain PHI THEN the system SHALL apply appropriate redaction and consent checks

### Requirement 10: Reporting and Analytics

**User Story:** As a regional administrator, I want access to de-identified reports and analytics, so that I can monitor system performance and outcomes while protecting individual privacy.

#### Acceptance Criteria

1. WHEN generating regional reports THEN the system SHALL provide de-identified data by default
2. WHEN accessing identified reports THEN the system SHALL require appropriate organizational scope and legal basis
3. WHEN reports contain funding information THEN the system SHALL restrict access to finance managers and administrators
4. WHEN exporting data THEN the system SHALL validate purpose-of-use and consent requirements
5. WHEN creating materialized views THEN the system SHALL optimize for common reporting queries while maintaining security

### Requirement 11: Funding and Promotion Management

**User Story:** As a finance manager, I want to track funding relationships and promotional codes, so that billing and resource allocation are properly managed.

#### Acceptance Criteria

1. WHEN managing funding relationships THEN the system SHALL support Region/Network to Org/Location mappings
2. WHEN applying promo codes THEN the system SHALL validate feature access, seat limits, and expiration dates
3. WHEN tracking usage THEN the system SHALL increment counters and enforce maximum use limits
4. WHEN funding expires THEN the system SHALL restrict access to funded features appropriately
5. WHEN generating invoices THEN the system SHALL aggregate usage data with proper authorization checks

### Requirement 12: Development and Testing Infrastructure

**User Story:** As a development team, I want comprehensive testing tools and development aids, so that we can efficiently build and maintain the platform.

#### Acceptance Criteria

1. WHEN running policy tests THEN the system SHALL test all golden personas against expected allow/deny outcomes
2. WHEN testing endpoints THEN the system SHALL verify consent and claimed/unclaimed service paths
3. WHEN troubleshooting authorization THEN the system SHALL provide detailed decision explanations
4. WHEN seeding test data THEN the system SHALL generate realistic data across all entity types
5. WHEN policy changes are made THEN the system SHALL validate that test outcomes change as expected

# Requirements Addendum

The following items extend the core Requirements Document. Numbering continues from the existing set.



### Requirement 13: Cross-Org Client Identity & Portability

**User Story:** As a helper or provider, I want client records to be linkable across organizations (with consent) so I can avoid duplicate data entry while keeping each organization’s **cases** tenant-scoped.

#### Acceptance Criteria

1. WHEN creating or updating a client THEN the system SHALL generate a privacy-preserving **fingerprint** (e.g., hash of normalized name+dob with a region-scoped salt) for candidate matching.  
2. WHEN a user searches for an existing client THEN the system SHALL return **minimal candidate info** (e.g., initials, approximate age) until consent is verified.  
3. WHEN linking a client found in another org THEN the system SHALL require valid consent and SHALL audit the link (who, when, from org A ↔ org B).  
4. WHEN viewing cases across orgs THEN the system SHALL restrict visibility to **tenant-scoped cases only**; cross-org linking SHALL NOT expose case contents without appropriate policies and consent.  
5. WHEN unlinking is requested THEN the system SHALL preserve each org’s historical cases and audit all unlink events.  
6. GIVEN a future client portal (out of scope) THEN the data model SHALL support client self-access to their **root client record** and per-case access controls later.



### Requirement 14: Consent Model & Scope

**User Story:** As a privacy officer, I want explicit, layered consent so that storage by the platform and access by providers are independently controlled and auditable.

#### Acceptance Criteria

1. WHEN storing any client PHI THEN the system SHALL require **platform-level** consent (to store with the company) recorded with: method (`verbal` or `signature`), timestamp, and actor.  
2. WHEN a provider organization accesses PHI THEN the system SHALL require **organization-level** consent aligned to one or more **purposes of use** (`care`, `billing`, `QA`, `oversight`, `research`).  
3. WHEN consent is revoked THEN the system SHALL apply **future-only revocation**: historical records remain accessible to the originating org where required by law; all future access MUST be denied unless a new consent is captured.  
4. WHEN consent is evaluated THEN the system SHALL consider **scope** (Org, Location, Helper, Company) and **purposes**; evaluation outcomes SHALL be auditable.  
5. The system SHALL support a configurable **grace period** (default `0 minutes`) for in-flight operations; value and rationale SHALL be recorded in system configuration and audit when used.  
6. WHEN consent has expired THEN the system SHALL deny access and provide a clear, user-readable reason with remediation guidance (e.g., “renew consent”).



### Requirement 15: Break-Glass (Lightweight, Read-Biased)

**User Story:** As a clinician in time-critical situations, I need a safe, temporary way to access PHI when consent isn’t present, with strong oversight.

#### Acceptance Criteria

1. WHEN break-glass is activated THEN access SHALL be **read-only by default**, unless an explicit policy grants write actions.  
2. Break-glass SHALL require either a **user-entered reason** or an **inferred reason** from the endpoint; both SHALL be recorded in audit logs.  
3. Break-glass access SHALL have a configurable **TTL** (default `15 minutes`) enforced server-side; the UI SHALL display a visible countdown banner.  
4. All break-glass accesses SHALL be **audited** with `bg=true`, reason, TTL, and full policy context; reports SHALL be available to compliance users.  
5. WHEN TTL expires THEN the system SHALL terminate access and require a fresh evaluation to continue.



### Requirement 16: Policy Governance & Change Management

**User Story:** As a super admin, I need controlled, auditable changes to authorization policies.

#### Acceptance Criteria

1. ONLY **Super Admins** SHALL be able to modify policies.  
2. Policies SHALL be **versioned artifacts** (code-reviewed, PR’d) with staging validation before production.  
3. The system SHALL provide a **policy simulator** usable in non-prod and prod (dry-run), showing matched rules and evaluation context.  
4. WHEN policies are updated THEN the system SHALL support **hot reload** and SHALL emit a policy change audit event.



### Requirement 17: Data Lifecycle, Retention, and De-Identification

**User Story:** As a data steward, I want clear lifecycle rules that respect legal retention and minimize re-identification risk.

#### Acceptance Criteria

1. The system SHALL support **soft-delete** with restore and **hard-delete** workflows (where legally permissible), both audited.  
2. The system SHALL store **retention rules** per entity/jurisdiction and enforce them on exports and deletions.  
3. De-identified reporting SHALL implement **small-cell suppression** (configurable threshold, e.g., k≥11) and/or value rounding.  
4. WHEN exporting identified data THEN the system SHALL validate **purpose-of-use**, consent, and policy constraints before issuing the file.



### Requirement 18: API Contracts & Safety Rails

**User Story:** As an integrator, I want predictable, safe APIs.

#### Acceptance Criteria

1. All POST/PUT/PATCH endpoints handling state changes SHALL support **idempotency keys**.  
2. All list endpoints SHALL use **cursor pagination** with a sane max page size.  
3. Read endpoints SHOULD support **ETag/If-None-Match** for caching where safe (no PHI leakage).  
4. All responses SHALL follow a standard **error schema** (`code`, `message`, `reason`, `hint`, `correlationId`).  
5. The API SHALL enforce **purpose-of-use** headers on PHI-touching routes.  
6. The API SHALL implement **rate limits** per IP and per user for search and availability mutation endpoints.



### Requirement 19: Audit Immutability & Forensics

**User Story:** As a compliance officer, I want tamper-evident audit logs and reliable incident review.

#### Acceptance Criteria

1. The system SHALL write **append-only** audit entries with full decision context (RBAC result, PBAC ctx, request meta).  
2. Audit logs SHALL include a **hash chain** (hash of previous row + current row) or be periodically exported to **WORM** storage.  
3. The system SHALL provide queries/reports to reconstruct a user’s access timeline and policy state at decision time.



### Requirement 20: Availability Engine Semantics & Concurrency

**User Story:** As a location manager, I need accurate, concurrent updates to availability and powerful matching.

#### Acceptance Criteria

1. Availability attributes SHALL support **booleans** (e.g., `female`, `pregnant`) and **ranges** (e.g., `max_age`, `min_age`).  
2. Matching SHALL accept JSON predicates and translate them to efficient SQL (e.g., JSON containment and range checks).  
3. Availability updates SHALL use **optimistic concurrency** (e.g., `If-Match` with version) and return `409` on conflicts.  
4. All availability changes SHALL capture `updated_by`, source (manual/API), and timestamps in audit.



### Requirement 21: RLS Performance & Tenant Isolation Guarantees

**User Story:** As a platform engineer, I need hard guarantees that tenant data cannot leak and the DB remains fast.

#### Acceptance Criteria

1. All tenant-scoped queries SHALL filter by **tenant_root_id** first; appropriate indexes SHALL exist on this column.  
2. RLS policies SHALL be **deny-by-default** and validated with automated tests.  
3. A recurring **RLS smoke test** suite SHALL prove non-members see `0` rows and members see only in-tenant rows.



### Requirement 22: Helper vs Provider Data Fences

**User Story:** As a product manager, I need clear separation between helper journals and provider case notes.

#### Acceptance Criteria

1. Helper journal entries SHALL be stored distinctly (`is_helper_journal=true`) and SHALL NOT be returned in provider case note queries unless a policy explicitly permits.  
2. WHEN a helper attempts to link a client THEN the system SHALL show only minimal candidates until consent is verified.  
3. WHEN a helper becomes **HelperVerified** (org-affiliated) THEN access SHALL upgrade only according to org policies and consent; all transitions SHALL be audited.  
4. Record-keeping referrals by helpers SHALL avoid PHI transmission unless consent is present and policy allows.



### Requirement 23: Client Self-Access Readiness (Future Portal)

**User Story:** As a future client-portal product owner, I want the core platform to be ready for client self-access without schema rewrites.

#### Acceptance Criteria

1. The data model SHALL support **client-scoped access grants** (linking a human identity to a client record) without breaking tenant isolation of **cases**.  
2. The system SHALL support per-case share flags and access logs suitable for a client portal later.  
3. All consent records SHALL be attributable to the client and revocable by them (future UI), with server-side enforcement.