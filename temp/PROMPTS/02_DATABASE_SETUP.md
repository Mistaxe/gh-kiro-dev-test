## Step 2 – Database setup (when to prompt)
Prompt before the API depends on RLS or functions.

**Prompt:**
"Connect to Subabase Postgres and run /supabase/schema.sql, then /supabase/rls.sql, /supabase/functions.sql, /supabase/seed.sql in order.
Verify all tables exist; verify RLS is enabled on critical tables; list created roles."

**Acceptance checks:**
- Tables created; indexes exist.
- RLS enabled on users_profile, organizations, service_locations, clients, client_cases, notes, referrals.
- `app.capabilities()` callable.
