## Step 6 – Personas & impersonation (when to prompt)
Prompt when Lab shell exists.

**Prompt:**
"Add dev-only endpoints `/dev/personas` and `/dev/impersonate`. Personas returns seeded users and their role_assignments. Impersonate sets a dev session/cookie with a selected user. Update `/lab/personas` to list personas and let me impersonate and set active org/location."

**Acceptance checks:**
- Persona list loads.
- Impersonation updates session and visible header identity.
