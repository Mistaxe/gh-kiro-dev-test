You are building a greenfield multi-tenant SaaS for social/behavioral health coordination.

## Tech & scope
- Stack: Node.js, TypeScript, Fastify (REST), Zod, Next.js (App Router), Tailwind, Subbase/Supabase (Postgres + Auth + Storage + Functions).
- AuthZ: Hybrid RBAC (baseline) + PBAC/ABAC via node-casbin at the service layer + Postgres RLS for defense-in-depth.
- Tenancy: `tenant_root_id = org_id`, with Region → Network → Org → ServiceLocation → (ClientGroup) → Client → ClientCase hierarchy.
- Users can have multiple org memberships and different roles per scope. Keep user identity (human) distinct from memberships.
- Public/Unauth flows: public service registry search, claim requests, helper signup.
- MVP features (feature-flagged): claiming & service profiles, live availability, referrals (direct + record-keeping),
  helpers (basic+verified), client/case+notes (providers), basic client/case+notes (helpers), caseloads/programs,
  de-id reports (Region/Network), identified reports (Org/Location), audit logs, consent, simple break-glass (no MFA),
  Super Admin for ABAC, funding/billing (plus promo codes/vouchers), notifications (in-app, email, SMS), geolocation.

## Security/Privacy
- PHI/PII redaction by default. Access to PHI requires consent gates and purpose-of-use.
- Simple break-glass: optional user-supplied reason (if omitted, infer from endpoint), short TTL (e.g., 15 min), audited.
- Duplicate client matching: show minimal candidate info until consent (e.g., initials, approximate age), then link after confirmation.

## What to generate
1) /docs/README-ARCH.md — architecture, flows, environments.
2) /docs/authz/casbin/model.conf + /docs/authz/casbin/policy.csv + /docs/authz/contexts.md.
3) /supabase/schema.sql, /supabase/rls.sql, /supabase/functions.sql, /supabase/seed.sql.
4) /apps/api — Fastify app (later).  /apps/web — Next.js app (later).
5) /packages/shared — Zod types, enums (later).
6) /tests — policy tests (later).

Coding standards: type-safe (Zod), deny-by-default RLS, server-authoritative authz, /me/capabilities endpoint for UX.
