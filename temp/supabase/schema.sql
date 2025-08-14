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
