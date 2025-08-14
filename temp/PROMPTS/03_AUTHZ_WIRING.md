## Step 3 – Authorization wiring (when to prompt)
Prompt once API is up and DB is seeded.

**Prompt:**
"Implement an authorization middleware with Casbin that expects `req.subject = {role}`, `req.object = {type,id}`, `req.action = 'read|update|...'`, and `req.ctx` from a builder function per route. Add a `POST /dev/policy/reload` to hot-reload policies from disk. Add audit logging for every decision."

**Acceptance checks:**
- Deny-by-default behavior verified with a dummy route.
- Reload returns success and subsequent decisions reflect changes.
- Audit log entries written with decision and ctx snapshot (even to console in dev).
