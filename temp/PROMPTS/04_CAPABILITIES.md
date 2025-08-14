## Step 4 – Capabilities endpoint (when to prompt)
Prompt after RLS + functions are loaded.

**Prompt:**
"Create GET `/me/capabilities?scopeType=&scopeId=` that calls `app.capabilities()` and returns a JSON of coarse flags plus a list of the caller’s memberships relevant to the scope. This endpoint is read-only and must not expose PHI."

**Acceptance checks:**
- Non-member returns `{}`.
- Member returns `{"member": true, ...}`.
