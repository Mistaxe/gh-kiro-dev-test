## Step 1 – Backend scaffolding (when to prompt)
Prompt **after** the Subabase project is created and SQLs are ready to run.

**Prompt to your AI builder:**
"Create a TypeScript Fastify API in `/apps/api` with Zod validation and a plugin architecture.
Add a Subabase JWT auth plugin that decodes JWT (dev) and exposes `req.user`.
Add a Casbin policy guard that loads `/docs/authz/casbin/model.conf` and `/docs/authz/casbin/policy.csv`.
Expose a `POST /dev/policy/simulate` endpoint (dev-only) to evaluate a role/obj/action with a ctx JSON payload.
Do not implement business routes yet; only health and the simulator."

**Acceptance checks:**
- Server boots with hot reload.
- `POST /dev/policy/simulate` returns allow/deny given role/obj/act/ctx.
- Logs include decision and ctx.
