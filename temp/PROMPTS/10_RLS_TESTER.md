## Step 10 – RLS Tester (when to prompt)
**Prompt:**
"Create `/dev/rls-run` to perform whitelisted SELECTs using caller JWT via RPC. Build `/lab/rls` to pick a table, add filters, and run."

**Acceptance checks:**
- Non-member sees 0 rows for tenant-scoped tables.
- Member sees rows within tenant only.
