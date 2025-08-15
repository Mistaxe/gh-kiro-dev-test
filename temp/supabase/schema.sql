-- Extensions
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists postgis;

-- Schemas
create schema if not exists app;
create schema if not exists reporting;

-- Users
create table if not exists app.users_profile (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null,
  email text not null,
  display_name text,
  phone text,
  is_helper boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Regions / Networks / Orgs / Locations
create table if not exists app.regions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  jurisdiction jsonb default '{}'::jsonb,
  attributes jsonb default '{}'::jsonb
);

create table if not exists app.networks (
  id uuid primary key default gen_random_uuid(),
  region_id uuid references app.regions(id) on delete set null,
  name text not null,
  attributes jsonb default '{}'::jsonb
);

create table if not exists app.organizations (
  id uuid primary key default gen_random_uuid(),
  region_id uuid references app.regions(id) on delete set null,
  name text not null,
  org_type text,
  dba text,
  tenant_root_id uuid,
  attributes jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
update app.organizations set tenant_root_id = id where tenant_root_id is null;

create table if not exists app.service_locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references app.organizations(id) on delete cascade,
  name text not null,
  claimed boolean default false,
  claim_owner_user_id uuid references app.users_profile(id),
  geom geography(point),
  attributes jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Network memberships & delegations
create table if not exists app.network_memberships (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references app.networks(id) on delete cascade,
  org_id uuid references app.organizations(id) on delete cascade,
  location_id uuid references app.service_locations(id) on delete cascade,
  unique(network_id, org_id),
  unique(network_id, location_id)
);

create table if not exists app.network_delegations (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references app.networks(id) on delete cascade,
  delegated_fields text[] not null default '{}',
  edit_window tstzrange,
  audit_required boolean default true
);

-- Roles & Assignments
create table if not exists app.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  scope_type text not null,
  description text,
  baseline_permissions jsonb default '{}'::jsonb
);

create table if not exists app.role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app.users_profile(id) on delete cascade,
  role_id uuid not null references app.roles(id),
  scope_type text not null,
  scope_id uuid not null,
  source text,
  expires_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique(user_id, role_id, scope_type, scope_id)
);

-- Service Profiles & Availability
create table if not exists app.service_profiles (
  location_id uuid primary key references app.service_locations(id) on delete cascade,
  taxonomy_code text,
  populations jsonb default '[]'::jsonb,
  eligibility jsonb default '{}'::jsonb,
  hours jsonb default '{}'::jsonb,
  search_vector tsvector
);
create index if not exists service_profiles_fts on app.service_profiles using gin(search_vector);

create table if not exists app.availability (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references app.service_locations(id) on delete cascade,
  type text not null,
  attributes jsonb not null default '{}'::jsonb,
  total int not null default 0,
  available int not null default 0,
  updated_by uuid references app.users_profile(id),
  updated_at timestamptz default now()
);
create index if not exists availability_attr_gin on app.availability using gin (attributes jsonb_path_ops);

-- Clients / Cases / Programs / Caseloads
create table if not exists app.client_groups (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references app.service_locations(id) on delete cascade,
  name text not null,
  attributes jsonb default '{}'::jsonb
);

create table if not exists app.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_root_id uuid not null,
  owner_org_id uuid not null references app.organizations(id) on delete cascade,
  primary_location_id uuid references app.service_locations(id),
  pii_ref jsonb,
  flags jsonb default '{}'::jsonb,
  consent jsonb default '{}'::jsonb,
  fingerprint text,
  created_at timestamptz default now()
);
create index if not exists clients_tenant_idx on app.clients(tenant_root_id);
create index if not exists clients_fp_idx on app.clients(fingerprint);

create table if not exists app.client_cases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references app.clients(id) on delete cascade,
  location_id uuid not null references app.service_locations(id),
  status text not null default 'open',
  program_ids uuid[] default '{}',
  assigned_user_ids uuid[] default '{}',
  opened_at timestamptz default now(),
  closed_at timestamptz
);

create table if not exists app.programs (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references app.service_locations(id) on delete cascade,
  name text not null,
  access_level text not null default 'view'
);

create table if not exists app.caseloads (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references app.service_locations(id),
  name text not null,
  member_user_ids uuid[] default '{}'
);

-- Notes
create table if not exists app.notes (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id uuid not null,
  author_user_id uuid not null references app.users_profile(id),
  classification text default 'standard',
  contains_phi boolean default false,
  is_helper_journal boolean default false,
  content text not null,
  created_at timestamptz default now()
);

-- Referrals
create table if not exists app.referrals (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references app.users_profile(id),
  from_org_id uuid,
  to_location_id uuid references app.service_locations(id),
  client_id uuid,
  visibility_scope text default 'private',
  status text default 'sent',
  attributes jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  geom geography(point)
);

-- Claims
create table if not exists app.claims (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references app.service_locations(id),
  requested_by uuid not null references app.users_profile(id),
  verified_by uuid references app.users_profile(id),
  status text not null default 'pending',
  evidence jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Funding / Promotions
create table if not exists app.funding_relationships (
  id uuid primary key default gen_random_uuid(),
  funder_type text not null,
  funder_id uuid not null,
  beneficiary_type text not null,
  beneficiary_id uuid not null,
  coverage jsonb not null default '{}'::jsonb,
  constraints jsonb default '{}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  status text default 'active'
);

create table if not exists app.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  features jsonb default '[]'::jsonb,
  seats int,
  starts_at timestamptz,
  ends_at timestamptz,
  max_uses int,
  used int default 0
);

-- Notifications
create table if not exists app.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app.users_profile(id),
  title text not null,
  body text not null,
  channel text not null,
  read_at timestamptz,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists app.notification_prefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app.users_profile(id),
  channel text not null,
  enabled boolean default true,
  unique(user_id, channel)
);

-- Audit & Temporary Grants
create table if not exists app.temporary_grants (
  id uuid primary key default gen_random_uuid(),
  granted_by uuid references app.users_profile(id),
  user_id uuid not null references app.users_profile(id),
  resource_selector jsonb not null,
  verbs text[] not null,
  expires_at timestamptz not null
);

create table if not exists app.audit_logs (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz default now(),
  actor_user_id uuid,
  action text,
  resource_type text,
  resource_id uuid,
  decision text,
  reason text,
  ctx jsonb,
  request_meta jsonb
);

-- Indexes
create index if not exists notes_subject_idx on app.notes(subject_type, subject_id);
create index if not exists referrals_to_loc_idx on app.referrals(to_location_id);

-- Schema Extensions for Task 3.1: Enhanced Consent and Linking
-- Requirements: 13.1, 13.4, 14.1, 19.1, 20.3

-- 1. Create client_consents table with normalized consent structure
-- Supports layered consent (platform, organization, location, helper, company)
-- with purpose-of-use validation and grace periods
create table if not exists app.client_consents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references app.clients(id) on delete cascade,
  scope_type text not null check (scope_type in ('platform', 'organization', 'location', 'helper', 'company')),
  scope_id uuid, -- nullable for platform-level consent
  allowed_purposes text[] not null default '{}' check (
    allowed_purposes <@ array['care', 'billing', 'QA', 'oversight', 'research']
  ),
  method text not null check (method in ('verbal', 'signature')),
  evidence_uri text, -- link to signed consent form or recording
  granted_by uuid not null references app.users_profile(id),
  granted_at timestamptz not null default now(),
  expires_at timestamptz, -- nullable for indefinite consent
  revoked_at timestamptz,
  revoked_by uuid references app.users_profile(id),
  grace_period_minutes int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Ensure revocation fields are consistent
  check ((revoked_at is null and revoked_by is null) or (revoked_at is not null and revoked_by is not null)),
  
  -- Unique constraint to prevent duplicate consents for same scope
  unique(client_id, scope_type, scope_id)
);

-- Indexes for consent lookups
create index if not exists client_consents_client_idx on app.client_consents(client_id);
create index if not exists client_consents_scope_idx on app.client_consents(scope_type, scope_id);
create index if not exists client_consents_active_idx on app.client_consents(client_id, scope_type, scope_id) 
  where revoked_at is null;

-- 2. Add client_links table for cross-org client linking audit trail
-- Tracks all linking/unlinking events between organizations with full audit
create table if not exists app.client_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references app.clients(id) on delete cascade,
  from_org_id uuid not null references app.organizations(id),
  to_org_id uuid not null references app.organizations(id),
  consent_id uuid references app.client_consents(id), -- consent that authorized the link
  reason text not null, -- business reason for linking
  linked_by uuid not null references app.users_profile(id),
  linked_at timestamptz not null default now(),
  unlinked_at timestamptz,
  unlinked_by uuid references app.users_profile(id),
  unlink_reason text,
  created_at timestamptz default now(),
  
  -- Prevent self-linking
  check (from_org_id != to_org_id),
  
  -- Ensure unlink fields are consistent
  check ((unlinked_at is null and unlinked_by is null and unlink_reason is null) or 
         (unlinked_at is not null and unlinked_by is not null and unlink_reason is not null))
);

-- Indexes for link history and active links
create index if not exists client_links_client_idx on app.client_links(client_id);
create index if not exists client_links_orgs_idx on app.client_links(from_org_id, to_org_id);
create index if not exists client_links_active_idx on app.client_links(client_id, from_org_id, to_org_id) 
  where unlinked_at is null;

-- 3. Update availability table with version column for optimistic concurrency
-- Add version column to existing availability table
alter table app.availability 
  add column if not exists version bigint not null default 1;

-- Create unique constraint for availability records to support optimistic concurrency
-- Each location can have multiple availability records for different types/attributes
create unique index if not exists availability_unique_idx 
  on app.availability(location_id, type, (attributes::text));

-- 4. Add hash chain column to audit_logs for tamper evidence
-- Add hash chain columns to existing audit_logs table
alter table app.audit_logs 
  add column if not exists policy_version text,
  add column if not exists row_hash text,
  add column if not exists prev_hash text;

-- Create index for hash chain verification
create index if not exists audit_logs_hash_chain_idx on app.audit_logs(id, row_hash, prev_hash);
create index if not exists audit_logs_ts_idx on app.audit_logs(ts);

-- Function to generate hash for audit log entries
create or replace function app.generate_audit_hash(
  p_id uuid,
  p_ts timestamptz,
  p_actor_user_id uuid,
  p_action text,
  p_resource_type text,
  p_resource_id uuid,
  p_decision text,
  p_reason text,
  p_ctx jsonb,
  p_policy_version text,
  p_prev_hash text
) returns text
language plpgsql
as $$
begin
  return encode(
    digest(
      concat(
        p_id::text,
        extract(epoch from p_ts)::text,
        coalesce(p_actor_user_id::text, ''),
        coalesce(p_action, ''),
        coalesce(p_resource_type, ''),
        coalesce(p_resource_id::text, ''),
        coalesce(p_decision, ''),
        coalesce(p_reason, ''),
        coalesce(p_ctx::text, '{}'),
        coalesce(p_policy_version, ''),
        coalesce(p_prev_hash, '')
      ),
      'sha256'
    ),
    'hex'
  );
end;
$$;

-- Trigger to automatically generate hash chain for new audit log entries
create or replace function app.audit_log_hash_trigger()
returns trigger
language plpgsql
as $$
declare
  prev_hash_val text;
begin
  -- Get the hash of the most recent audit log entry
  select row_hash into prev_hash_val
  from app.audit_logs
  order by ts desc, id desc
  limit 1;
  
  -- Generate hash for this entry
  new.prev_hash := prev_hash_val;
  new.row_hash := app.generate_audit_hash(
    new.id,
    new.ts,
    new.actor_user_id,
    new.action,
    new.resource_type,
    new.resource_id,
    new.decision,
    new.reason,
    new.ctx,
    new.policy_version,
    new.prev_hash
  );
  
  return new;
end;
$$;

-- Create trigger for hash chain generation
drop trigger if exists audit_log_hash_trigger on app.audit_logs;
create trigger audit_log_hash_trigger
  before insert on app.audit_logs
  for each row
  execute function app.audit_log_hash_trigger();

-- Comments for documentation
comment on table app.client_consents is 'Normalized consent management with layered scopes and purpose-of-use validation';
comment on table app.client_links is 'Audit trail for cross-organizational client record linking';
comment on column app.availability.version is 'Version number for optimistic concurrency control';
comment on column app.audit_logs.row_hash is 'SHA256 hash of current row for tamper evidence';
comment on column app.audit_logs.prev_hash is 'Hash of previous audit log entry for chain integrity';
-- Performance Indexes and Constraints for Task 3.3
-- Requirements: 21.1, 21.3
-- Optimizes query performance for tenant isolation, search, and geospatial operations

-- 1. Tenant isolation indexes - CRITICAL for performance and security
-- Add tenant_root_id indexes to all tenant-scoped tables

-- Clients table (already has basic tenant index, add composite ones)
create index if not exists clients_tenant_created_idx on app.clients(tenant_root_id, created_at desc);
create index if not exists clients_tenant_fingerprint_idx on app.clients(tenant_root_id, fingerprint) where fingerprint is not null;

-- Client cases table
create index if not exists client_cases_tenant_idx on app.client_cases(
  (select tenant_root_id from app.clients where id = client_cases.client_id)
);
create index if not exists client_cases_location_status_idx on app.client_cases(location_id, status);
create index if not exists client_cases_assigned_users_idx on app.client_cases using gin(assigned_user_ids);

-- Notes table - tenant isolation via subject
create index if not exists notes_tenant_subject_idx on app.notes(
  subject_type, 
  subject_id,
  (case when subject_type = 'client' then 
    (select tenant_root_id from app.clients where id = notes.subject_id)
   else null end)
) where subject_type = 'client';
create index if not exists notes_author_created_idx on app.notes(author_user_id, created_at desc);
create index if not exists notes_helper_journal_idx on app.notes(is_helper_journal, subject_type, subject_id) where is_helper_journal = true;

-- Referrals table - tenant isolation via client or organization
create index if not exists referrals_tenant_idx on app.referrals(
  (case when client_id is not null then 
    (select tenant_root_id from app.clients where id = referrals.client_id)
   else from_org_id end)
);
create index if not exists referrals_to_location_status_idx on app.referrals(to_location_id, status);
create index if not exists referrals_from_user_created_idx on app.referrals(from_user_id, created_at desc);

-- 2. Composite indexes for common query patterns

-- Role assignments - critical for authorization
create index if not exists role_assignments_user_scope_idx on app.role_assignments(user_id, scope_type, scope_id);
create index if not exists role_assignments_scope_role_idx on app.role_assignments(scope_type, scope_id, role_id);
create index if not exists role_assignments_active_idx on app.role_assignments(user_id, scope_type, scope_id) 
  where expires_at is null or expires_at > now();

-- Service locations with organization
create index if not exists service_locations_org_claimed_idx on app.service_locations(org_id, claimed);
create index if not exists service_locations_claimed_owner_idx on app.service_locations(claimed, claim_owner_user_id) 
  where claimed = true;

-- Availability with location and type
create index if not exists availability_location_type_available_idx on app.availability(location_id, type, available desc) 
  where available > 0;
create index if not exists availability_updated_idx on app.availability(updated_at desc, updated_by);

-- Audit logs for forensics and compliance
create index if not exists audit_logs_actor_action_idx on app.audit_logs(actor_user_id, action, ts desc);
create index if not exists audit_logs_resource_idx on app.audit_logs(resource_type, resource_id, ts desc);
create index if not exists audit_logs_decision_idx on app.audit_logs(decision, ts desc) where decision = 'deny';

-- Temporary grants for break-glass and special access
create index if not exists temp_grants_user_expires_idx on app.temporary_grants(user_id, expires_at) 
  where expires_at > now();
create index if not exists temp_grants_expires_cleanup_idx on app.temporary_grants(expires_at) 
  where expires_at <= now();

-- 3. Trigram indexes for fuzzy name matching
-- Enable fuzzy search on names and text fields

-- Organizations and locations for search
create index if not exists organizations_name_trgm_idx on app.organizations using gin(name gin_trgm_ops);
create index if not exists service_locations_name_trgm_idx on app.service_locations using gin(name gin_trgm_ops);

-- User profiles for search
create index if not exists users_profile_name_trgm_idx on app.users_profile using gin(display_name gin_trgm_ops) 
  where display_name is not null;
create index if not exists users_profile_email_trgm_idx on app.users_profile using gin(email gin_trgm_ops);

-- Client search (careful with PHI - only for authorized searches)
-- Note: This index should only be used with proper consent validation
create index if not exists clients_pii_search_idx on app.clients using gin(
  (coalesce(pii_ref->>'first_name', '') || ' ' || coalesce(pii_ref->>'last_name', '')) gin_trgm_ops
) where pii_ref is not null;

-- 4. PostGIS indexes for geospatial queries
-- Enable efficient location-based searches

-- Service locations geospatial index
create index if not exists service_locations_geom_idx on app.service_locations using gist(geom) 
  where geom is not null;

-- Referrals geospatial index (for location-based referral matching)
create index if not exists referrals_geom_idx on app.referrals using gist(geom) 
  where geom is not null;

-- 5. JSONB indexes for attribute filtering and search

-- Service profiles eligibility and attributes
create index if not exists service_profiles_eligibility_idx on app.service_profiles using gin(eligibility);
create index if not exists service_profiles_populations_idx on app.service_profiles using gin(populations);

-- Client flags for filtering
create index if not exists clients_flags_idx on app.clients using gin(flags) where flags != '{}'::jsonb;

-- Organization and location attributes
create index if not exists organizations_attributes_idx on app.organizations using gin(attributes) 
  where attributes != '{}'::jsonb;
create index if not exists service_locations_attributes_idx on app.service_locations using gin(attributes) 
  where attributes != '{}'::jsonb;

-- 6. Constraints for data integrity

-- Ensure tenant_root_id consistency in organizations
alter table app.organizations 
  add constraint if not exists organizations_tenant_root_self_check 
  check (tenant_root_id = id);

-- 7. Partial indexes for common filtered queries

-- Active role assignments only
create index if not exists role_assignments_active_only_idx on app.role_assignments(user_id, role_id, scope_type, scope_id) 
  where expires_at is null or expires_at > now();

-- Open client cases only
create index if not exists client_cases_open_only_idx on app.client_cases(client_id, location_id, assigned_user_ids) 
  where status = 'open';

-- Available availability records only
create index if not exists availability_available_only_idx on app.availability(location_id, type, attributes, available) 
  where available > 0;

-- Claimed service locations only
create index if not exists service_locations_claimed_only_idx on app.service_locations(org_id, claim_owner_user_id) 
  where claimed = true;

-- Active consents only
create index if not exists client_consents_active_only_idx on app.client_consents(client_id, scope_type, scope_id, allowed_purposes) 
  where revoked_at is null and (expires_at is null or expires_at > now());

-- Active client links only
create index if not exists client_links_active_only_idx on app.client_links(client_id, from_org_id, to_org_id) 
  where unlinked_at is null;

-- Comments for documentation
comment on index app.clients_tenant_created_idx is 'Composite index for tenant-scoped client queries with time ordering';
comment on index app.role_assignments_user_scope_idx is 'Critical index for authorization queries';
comment on index app.availability_location_type_available_idx is 'Optimizes availability searches for matching';
comment on index app.service_locations_geom_idx is 'PostGIS spatial index for location-based queries';
comment on index app.organizations_name_trgm_idx is 'Trigram index for fuzzy organization name search';
comment on index app.audit_logs_actor_action_idx is 'Forensic index for user activity analysis';