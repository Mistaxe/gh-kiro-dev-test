# Lab (Test Harness) – How to use

1) Apply SQL in /supabase (order): schema.sql → rls.sql → functions.sql → seed.sql.
2) Start API and Web apps (your builder will scaffold these).
3) Navigate to `/lab` in the web app. Tabs:
   - Personas: impersonate seeded users (dev only).
   - Scope: set active Region/Network/Org/Location.
   - Capabilities: query `/me/capabilities` and run server-side allow/deny probes.
   - Context: set purpose-of-use, tweak consent, activate break-glass TTL.
   - Policies: simulate Casbin decisions and hot-reload policies in dev.
   - RLS Tester: run SELECTs via whitelisted RPC using your JWT.
   - Seeder: generate realistic data for quick testing.
   - Registry & Availability: search FTS + run JSON predicates.
   - Referrals & Notes: compare helper vs provider flows.
   - Notifications: test in-app/email/SMS records.

Use this Lab to verify multi-tenant RBAC/PBAC behavior, consent gates, break-glass, and claimed vs unclaimed logic.
