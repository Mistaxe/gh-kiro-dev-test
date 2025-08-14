# DESIGN DELTAS (Patch Addendum)

> Paste these sections into your design doc. They refine cross‑org identity, consent normalization, availability semantics, RLS write paths, policy governance, de‑id, and API safety. Where a section name already exists, **replace** it; otherwise **add** it.

---

## 1) Cross‑Org Client Identity & Portability (Refinement)

**Decision:** *Cases* remain **tenant‑scoped** (per Org/Location). The **Client** record is **portable** across orgs with consent. Linking across orgs is audited and never exposes case contents without explicit allow + consent.

**Design updates**
- **Fingerprint:** derive a region‑salted key for privacy‑preserving candidate match. Example: `sha256(lower(ascii(name))+dob_iso+region_salt)`; store as `clients.fingerprint`.
- **Link audit:** add `client_links` to capture cross‑org link/unlink events and provenance.
- **Query fences:** APIs that join Client → Cases **must filter by tenant_root_id** and role; cross‑org link does *not* imply cross‑tenant case visibility.

**New table (DDL – append to schema):**
```sql
create table if not exists app.client_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references app.clients(id) on delete cascade,
  from_org_id uuid not null references app.organizations(id),
  to_org_id uuid not null references app.organizations(id),
  consent_id uuid, -- references app.client_consents(id) once created
  reason text,
  linked_by uuid not null references app.users_profile(id),
  linked_at timestamptz default now(),
  unlinked_at timestamptz
);
create index if not exists client_links_client_idx on app.client_links(client_id);
```

---

## 2) Consent Model & Scope (Normalization)

**Decision:** Normalize consent into its own table for layered, auditable control (platform vs org/location/helper/company). Enforce **future‑only revocation**.

**New table (DDL – append to schema):**
```sql
create table if not exists app.client_consents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references app.clients(id) on delete cascade,
  scope_type text not null check (scope_type in ('platform','organization','location','helper','company')),
  scope_id uuid,
  allowed_purposes text[] not null default '{}', -- e.g., {'care','billing','QA'}
  method text not null check (method in ('verbal','signature')),
  evidence_uri text,
  granted_by uuid references app.users_profile(id),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references app.users_profile(id),
  grace_period_minutes int not null default 0
);
create index if not exists client_consents_client_idx on app.client_consents(client_id);
```

**Evaluator (server‑side):**
- Input: `client_id`, `scope_type`, `scope_id`, `purpose`.
- Logic: most‑recent non‑revoked consent within scope hierarchy → platform AND (org OR location OR helper/company as applicable) → check `allowed_purposes` → consider `expires_at` and grace period.
- Output: `{ consent_ok: boolean, consent_id: uuid|null, reason }` → placed into `ctx` and **audited**.

---

## 3) Authorization Context (Expanded Fields)

**Decision:** Extend `ctx` to support assignment/program checks, org/network relations, and governance toggles.

```ts
export type AuthorizationContext = {
  purpose?: 'care'|'billing'|'QA'|'oversight'|'research';
  legal_basis?: boolean;
  dataset?: { deidentified: boolean };
  identified_ok?: boolean;
  org_scope?: boolean;          // request is confined to caller's org
  same_org?: boolean;
  same_location?: boolean;
  in_network?: boolean;
  delegated_fields?: string[];
  field?: string;

  service?: { claimed: boolean };
  assigned_to_user?: boolean;
  shares_program?: boolean;
  program_access_level?: 'view'|'write'|'full'|null;

  consent_ok?: boolean;
  consent_id?: string|null;
  contains_phi?: boolean;

  self_scope?: boolean;
  affiliated?: boolean;

  temp_grant?: boolean;
  two_person_rule?: boolean;

  bg?: boolean;                 // break‑glass active
  bg_expires_at?: string|null;  // ISO
};
```

**Rule:** break‑glass is **read‑only** unless a specific policy allows write.

---

## 4) RLS Write Strategy (Security Definer RPC)

**Decision:** Keep *table DML deny‑by‑default*. Perform INSERT/UPDATE/DELETE via **SECURITY DEFINER** RPCs that re‑apply policy checks.

**Pattern:**
- Expose `app.rpc_*` functions for each write path (e.g., `rpc_upsert_availability`, `rpc_create_note`).
- Inside the function, resolve subject roles, build `ctx`, run the same authorization checks as the service layer (or call a helper), then perform DML.

**Example (skeleton):**
```sql
-- SECURITY DEFINER requires owner to be a role with necessary rights
create or replace function app.rpc_upsert_availability(
  p_location uuid, p_type text, p_attrs jsonb, p_total int, p_available int, p_version bigint
) returns void
language plpgsql security definer as $$
declare
  current_version bigint;
begin
  -- optimistic concurrency (see §5)
  select version into current_version from app.availability
   where location_id=p_location and type=p_type and attributes @> p_attrs
   limit 1 for update;

  if current_version is not null and current_version <> p_version then
    raise exception 'version_conflict' using errcode = '40001';
  end if;

  -- TODO: apply authz checks here (role & ctx)
  -- upsert...
end;
$$;
```

---

## 5) Availability Engine Semantics & Concurrency

**Decisions:**
- Attributes support **booleans** (e.g., `female`, `pregnant`) and **ranges** (`min_age`, `max_age`).
- Add `version bigint not null default 0` to `app.availability` and require `If-Match` semantics for updates.

**DDL delta:**
```sql
alter table app.availability add column if not exists version bigint not null default 0;
create index if not exists availability_loc_type_idx on app.availability(location_id, type);
```

**Update flow:**
- Client sends `If-Match: <version>`; server compares with row’s `version`, increments on success; return `409` on mismatch.

**Predicate mapping (JSON → SQL):**
- `{ "female": true, "pregnant": true }` → `attributes @> '{"female":true,"pregnant":true}'`
- `{ "max_age": {"$lte": 17} }` → `(attributes->>'max_age')::int <= 17`
- Always combine with `available > 0` and scope filters.

---

## 6) Policy Governance & Change Management

**Decisions:**
- Policies are **versioned artifacts** (PR + code review). Dev/staging allow hot reload; prod rolls via versioned bundles.
- Provide a **policy simulator** in Admin (dry‑run against current prod policy).

**Operational rules:**
- Only **Super Admin** can publish policy bundles.
- Emit an **audit event** on publish (old→new version, changelog, actor).

---

## 7) De‑Identified Reporting Rules

**Decisions:**
- Enforce **small‑cell suppression** (configurable `k`, default 11) and optional rounding.
- Identified exports require **purpose‑of‑use**, consent, and role checks.

**Design notes:**
- Reporting views should carry a `suppressed` flag and aggregate “<k” buckets.
- Export jobs capture policy version and `ctx` snapshot in audit entries.

---

## 8) JWT & Header Conventions

**Decisions:**
- Custom claims: `active_org_id`, `active_location_id` (optional), `purpose` (optional), `bg_exp` (optional).
- PHI routes must receive `X-Purpose-Of-Use` (or claim). Reject if missing.

**Notes:**
- Server still derives/validates purpose and break‑glass TTL; clients cannot force allow.

---

## 9) Helper vs Provider Data Fences

**Decisions:**
- Helper journals are distinct: `notes.is_helper_journal=true`.
- Provider case note queries **exclude helper journals** unless explicitly allowed.

**Flows:**
- During helper→client link, return only **minimal candidates** until consent passes (initials, approx age).

---

## 10) Notifications & PHI Handling

**Decisions:**
- Email/SMS **MUST NOT** include PHI. Send a link to in‑app content.
- Store full content in `notifications` for in‑app channel; external channels get redacted summaries.

---

## 11) Indexing & Performance Additions

**Tenancy & search:**
- Add `(tenant_root_id)` indexes to all hot tables (clients, client_cases, notes, referrals).
- Trigram index on name fields used for matching (if stored): `create extension if not exists pg_trgm;`
- Use PostGIS for distance filters on `service_locations.geom`.

---

## 12) Audit Immutability & Forensics

**Decisions:**
- Add a **hash chain** to `audit_logs` or periodic export to WORM storage.
- Audit entries must include **policy version** and the exact `ctx` snapshot used for the decision.

**DDL sketch (optional):**
```sql
alter table app.audit_logs add column if not exists row_hash text;
-- Application computes row_hash = sha256(prev.row_hash || current_row_json)
```

---

## 13) API Safety Rails

**Decisions:**
- Mutating endpoints support **Idempotency-Key** header.
- Lists use **cursor pagination** with max page size.
- Safe reads may use **ETag/If-None-Match** (no PHI). 
- Apply **rate limits** per IP and per user on search & availability updates.

---

### Notes for the Technical Design Spec
- Update the **AuthorizationContext** type and ctx‑builder responsibilities.
- Add RPC‑based write path diagrams for availability, notes, referrals.
- Specify the consent evaluator and link it into PHI routes.
- Document policy versioning, publish workflow, and admin simulator.
