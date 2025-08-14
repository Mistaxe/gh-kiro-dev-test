# Architecture Overview

## Modules
- **API (Fastify/TS)**: AuthN (Subabase JWT), AuthZ (Casbin + PBAC ctx), business services, audit, notifications.
- **Web (Next.js/Tailwind)**: Public registry, claims, helper onboarding, provider console, admin console, reports, notifications.
- **Subabase (Postgres)**: Core schema, RLS, SQL functions, job queue/pg_cron, storage.
- **AuthZ**: RBAC baselines (roles/verbs), PBAC via policy expressions, Postgres RLS for tenant isolation.
- **Search/Availability**: Postgres FTS + JSONB attribute filters; materialized views for bed/slot availability.

## Identity & Memberships
- `auth.users` (Subabase) → `app.users_profile` (one per human).
- `app.memberships` not required; we use `app.role_assignments` to bind users to scopes/roles.
- User may hold multiple org memberships. UI lets user pick an **active org context**.

## Consent & Break-Glass
- `clients.consent` JSON stores {level, allowed_purposes[], method=`verbal|signature`, expires_at}.
- PHI reads require `consent_ok` and `purpose_of_use` header/claim.
- Break-glass: `bg=true` flag on request; optional reason; TTL ~15 min; audited and bannered in UI.

## Helpers
- `HelperBasic`: self-onboard, track own client notes (non-PHI by default), send record-keeping referrals.
- `HelperVerified`: affiliated to org (invite/approval), can access org-scoped tools/policies.
- Helper journals are separate from provider case notes.

## Notifications
- Channels: in-app, email, SMS at launch; providers (e.g., Postmark/Twilio) can be added later.
- Tables: `notifications`, `notification_prefs`.

## Funding & Promotions
- `funding_relationships` (Region/Network → Org/Location/UserRole), `promo_codes` (features, seats, expiration).

## Reporting
- De-id reports for Region/Network; identified for Org/Location (policy-gated).
- `reporting` schema with materialized views.

## Environments
- dev, staging, prod. Seed demo orgs/locations/users/roles for the Lab.
