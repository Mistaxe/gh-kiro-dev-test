-- Essential schema for capabilities endpoint
-- This is a minimal subset of the full schema needed for the capabilities functionality

-- Extensions
create extension if not exists pgcrypto;

-- Schemas
create schema if not exists app;

-- Users profile table
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

-- Regions / Networks / Orgs / Locations (minimal for role assignments)
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

-- Ensure tenant_root_id is set to id if null
update app.organizations set tenant_root_id = id where tenant_root_id is null;

create table if not exists app.service_locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references app.organizations(id) on delete cascade,
  name text not null,
  claimed boolean default false,
  claim_owner_user_id uuid references app.users_profile(id),
  attributes jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Roles and role assignments
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

-- Helper function to get current profile ID
create or replace function app.current_profile_id()
returns uuid
language sql stable as $$
  select id from app.users_profile where auth_user_id = auth.uid()
$$;

-- Client fingerprint generation function
create or replace function app.generate_client_fingerprint(
  first_name text,
  last_name text,
  dob date,
  region_salt text default 'default_salt'
) returns text
language plpgsql
as $
declare
  normalized_name text;
  dob_iso text;
  combined_string text;
begin
  -- Normalize names (lowercase, remove non-alphanumeric)
  normalized_name := lower(regexp_replace(coalesce(first_name, '') || coalesce(last_name, ''), '[^a-zA-Z0-9]', '', 'g'));
  
  -- Convert DOB to ISO format
  dob_iso := coalesce(dob::text, '');
  
  -- Combine with region salt
  combined_string := normalized_name || dob_iso || region_salt;
  
  -- Generate SHA256 hash
  return encode(digest(combined_string, 'sha256'), 'hex');
end;
$;

-- Capabilities function
create or replace function app.capabilities(scope_type text default null, scope uuid default null)
returns jsonb 
language plpgsql stable as $$
declare
  pid uuid := app.current_profile_id();
  caps jsonb := '{"member": false, "capabilities": []}'::jsonb;
  user_roles jsonb := '[]'::jsonb;
begin
  if pid is null then 
    return caps;
  end if;

  -- Get user roles
  select jsonb_agg(
    jsonb_build_object(
      'role', r.name,
      'scope_type', ra.scope_type,
      'scope_id', ra.scope_id,
      'expires_at', ra.expires_at
    )
  ) into user_roles
  from app.role_assignments ra
  join app.roles r on r.id = ra.role_id
  where ra.user_id = pid
    and (ra.expires_at is null or ra.expires_at > now())
    and (scope_type is null or ra.scope_type = scope_type)
    and (scope is null or ra.scope_id = scope);

  -- Check membership
  if jsonb_array_length(coalesce(user_roles, '[]'::jsonb)) > 0 then
    caps := caps || jsonb_build_object('member', true);
  end if;

  -- Add roles to response
  caps := caps || jsonb_build_object('roles', coalesce(user_roles, '[]'::jsonb));

  return caps;
end;
$$;

-- Insert some basic roles
insert into app.roles (name, scope_type, description) values
  ('SuperAdmin', 'global', 'Super administrator with all permissions'),
  ('OrgAdmin', 'org', 'Organization administrator'),
  ('CaseManager', 'org', 'Case manager with client access'),
  ('Provider', 'org', 'Healthcare provider'),
  ('LocationManager', 'location', 'Service location manager'),
  ('HelperVerified', 'org', 'Verified community helper'),
  ('HelperBasic', 'org', 'Basic community helper'),
  ('BasicAccount', 'org', 'Basic account holder')
on conflict do nothing;

-- RPC function for creating clients with fingerprint generation
create or replace function app.rpc_create_client(
  p_pii_ref jsonb,
  p_flags jsonb default '{}'::jsonb,
  p_primary_location_id uuid default null
) returns uuid
language plpgsql
security definer
as $
declare
  current_user_id uuid;
  user_org_id uuid;
  client_id uuid;
  fingerprint_val text;
begin
  -- Get current user
  current_user_id := app.current_profile_id();
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- Get user's organization (take first org assignment)
  select ra.scope_id into user_org_id
  from app.role_assignments ra
  join app.roles r on r.id = ra.role_id
  where ra.user_id = current_user_id 
    and ra.scope_type = 'org'
    and r.name in ('CaseManager', 'Provider', 'OrgAdmin')
    and (ra.expires_at is null or ra.expires_at > now())
  limit 1;

  if user_org_id is null then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  -- Generate fingerprint if PII is provided
  if p_pii_ref ? 'first_name' and p_pii_ref ? 'last_name' and p_pii_ref ? 'dob' then
    fingerprint_val := app.generate_client_fingerprint(
      p_pii_ref->>'first_name',
      p_pii_ref->>'last_name',
      (p_pii_ref->>'dob')::date,
      'region_salt_' || user_org_id::text
    );
  end if;

  -- Generate client ID
  client_id := gen_random_uuid();

  -- Insert client
  insert into app.clients (
    id,
    tenant_root_id,
    owner_org_id,
    primary_location_id,
    pii_ref,
    flags,
    fingerprint,
    created_at,
    updated_at
  ) values (
    client_id,
    user_org_id, -- tenant_root_id = owner_org_id for tenant isolation
    user_org_id,
    p_primary_location_id,
    p_pii_ref,
    p_flags,
    fingerprint_val,
    now(),
    now()
  );

  -- Log audit entry
  insert into app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) values (
    current_user_id,
    'create',
    'client',
    client_id,
    'allow',
    'Client created via RPC',
    jsonb_build_object(
      'tenant_root_id', user_org_id,
      'owner_org_id', user_org_id,
      'contains_phi', (p_pii_ref is not null and p_pii_ref != '{}'::jsonb),
      'fingerprint_generated', (fingerprint_val is not null)
    )
  );

  return client_id;
end;
$;

-- RPC function for searching clients with minimal candidate info
create or replace function app.rpc_search_clients(
  p_search_term text default null,
  p_fingerprint text default null,
  p_limit int default 20
) returns jsonb
language plpgsql
security definer
as $
declare
  current_user_id uuid;
  user_org_id uuid;
  result jsonb;
begin
  -- Get current user
  current_user_id := app.current_profile_id();
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- Get user's organization
  select ra.scope_id into user_org_id
  from app.role_assignments ra
  where ra.user_id = current_user_id 
    and ra.scope_type = 'org'
    and (ra.expires_at is null or ra.expires_at > now())
  limit 1;

  if user_org_id is null then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  -- Search clients with minimal candidate info (no PHI without consent)
  select jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'initials', case 
        when c.pii_ref ? 'first_name' and c.pii_ref ? 'last_name' then
          left(c.pii_ref->>'first_name', 1) || left(c.pii_ref->>'last_name', 1)
        else 'N/A'
      end,
      'approximate_age', case 
        when c.pii_ref ? 'dob' then
          (extract(year from age((c.pii_ref->>'dob')::date)) / 5)::int * 5
        else null
      end,
      'fingerprint_match', (p_fingerprint is not null and c.fingerprint = p_fingerprint),
      'same_org', (c.tenant_root_id = user_org_id),
      'created_at', c.created_at
    )
  ) into result
  from app.clients c
  where (
    -- Search within user's tenant or linked clients
    c.tenant_root_id = user_org_id or
    exists (
      select 1 from app.client_links cl
      where cl.client_id = c.id
        and (cl.from_org_id = user_org_id or cl.to_org_id = user_org_id)
        and cl.unlinked_at is null
    )
  )
  and (
    p_search_term is null or
    p_fingerprint is not null and c.fingerprint = p_fingerprint or
    (c.pii_ref->>'first_name' ilike '%' || p_search_term || '%' or
     c.pii_ref->>'last_name' ilike '%' || p_search_term || '%')
  )
  limit p_limit;

  -- Log audit entry for search
  insert into app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) values (
    current_user_id,
    'search',
    'client',
    null,
    'allow',
    'Client search performed',
    jsonb_build_object(
      'search_term', p_search_term,
      'fingerprint_search', (p_fingerprint is not null),
      'tenant_root_id', user_org_id,
      'results_count', jsonb_array_length(coalesce(result, '[]'::jsonb))
    )
  );

  return coalesce(result, '[]'::jsonb);
end;
$;

-- Grant execute permissions
grant execute on function app.rpc_create_client to authenticated;
grant execute on function app.rpc_search_clients to authenticated;

-- Service Profiles and Availability System
-- Service profiles with claimed/unclaimed logic and full-text search

create table if not exists app.service_profiles (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references app.service_locations(id) on delete cascade,
  taxonomy_code text,
  populations text[] default '{}' check (
    populations <@ array['adults', 'adolescents', 'children', 'families', 'seniors', 'veterans']
  ),
  eligibility jsonb default '{}'::jsonb,
  hours jsonb default '{}'::jsonb,
  description text,
  search_vector tsvector,
  claimed boolean default false,
  claim_owner_user_id uuid references app.users_profile(id),
  curator_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Ensure claimed profiles have an owner
  check ((claimed = false and claim_owner_user_id is null) or (claimed = true and claim_owner_user_id is not null))
);

-- Availability tracking with optimistic concurrency control
create table if not exists app.availability (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references app.service_locations(id) on delete cascade,
  type text not null check (type in ('beds', 'slots', 'appointments')),
  attributes jsonb default '{}'::jsonb,
  total int not null default 0 check (total >= 0),
  available int not null default 0 check (available >= 0 and available <= total),
  version bigint not null default 1,
  updated_by uuid not null references app.users_profile(id),
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  
  unique(location_id, type, attributes)
);

-- Materialized view for availability aggregations
create materialized view if not exists app.availability_summary as
select 
  sl.org_id,
  sl.id as location_id,
  sl.name as location_name,
  a.type,
  sum(a.total) as total_capacity,
  sum(a.available) as total_available,
  count(*) as availability_records,
  max(a.updated_at) as last_updated
from app.service_locations sl
left join app.availability a on a.location_id = sl.id
group by sl.org_id, sl.id, sl.name, a.type;

-- Create indexes for performance
create index if not exists service_profiles_location_idx on app.service_profiles(location_id);
create index if not exists service_profiles_claimed_idx on app.service_profiles(claimed);
create index if not exists service_profiles_search_idx on app.service_profiles using gin(search_vector);
create index if not exists service_profiles_eligibility_idx on app.service_profiles using gin(eligibility);
create index if not exists service_profiles_populations_idx on app.service_profiles using gin(populations);

create index if not exists availability_location_type_idx on app.availability(location_id, type);
create index if not exists availability_attributes_idx on app.availability using gin(attributes);
create index if not exists availability_version_idx on app.availability(version);
create index if not exists availability_updated_at_idx on app.availability(updated_at);

-- Function to update search vector automatically
create or replace function app.update_service_profile_search_vector()
returns trigger
language plpgsql
as $
begin
  NEW.search_vector := to_tsvector('english', 
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.taxonomy_code, '') || ' ' ||
    coalesce(array_to_string(NEW.populations, ' '), '') || ' ' ||
    coalesce((select name from app.service_locations where id = NEW.location_id), '')
  );
  NEW.updated_at := now();
  return NEW;
end;
$;

-- Trigger to automatically update search vector
drop trigger if exists service_profile_search_vector_trigger on app.service_profiles;
create trigger service_profile_search_vector_trigger
  before insert or update on app.service_profiles
  for each row execute function app.update_service_profile_search_vector();

-- Clients and client management tables
create table if not exists app.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_root_id uuid not null,
  owner_org_id uuid not null references app.organizations(id) on delete cascade,
  primary_location_id uuid references app.service_locations(id),
  pii_ref jsonb,
  flags jsonb default '{}'::jsonb,
  fingerprint text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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

-- Client consents table for consent management
create table if not exists app.client_consents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references app.clients(id) on delete cascade,
  scope_type text not null check (scope_type in ('platform', 'organization', 'location', 'helper', 'company')),
  scope_id uuid,
  allowed_purposes text[] not null default '{}' check (
    allowed_purposes <@ array['care', 'billing', 'QA', 'oversight', 'research']
  ),
  method text not null check (method in ('verbal', 'signature')),
  evidence_uri text,
  granted_by uuid not null references app.users_profile(id),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references app.users_profile(id),
  grace_period_minutes int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  check ((revoked_at is null and revoked_by is null) or (revoked_at is not null and revoked_by is not null)),
  unique(client_id, scope_type, scope_id)
);

-- Client links table for cross-org linking
create table if not exists app.client_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references app.clients(id) on delete cascade,
  from_org_id uuid not null references app.organizations(id),
  to_org_id uuid not null references app.organizations(id),
  consent_id uuid references app.client_consents(id),
  reason text not null,
  linked_by uuid not null references app.users_profile(id),
  linked_at timestamptz not null default now(),
  unlinked_at timestamptz,
  unlinked_by uuid references app.users_profile(id),
  unlink_reason text,
  created_at timestamptz default now(),
  
  check (from_org_id != to_org_id),
  check ((unlinked_at is null and unlinked_by is null and unlink_reason is null) or 
         (unlinked_at is not null and unlinked_by is not null and unlink_reason is not null))
);

-- Create indexes for performance
create index if not exists users_profile_auth_user_id_idx on app.users_profile(auth_user_id);
create index if not exists role_assignments_user_id_idx on app.role_assignments(user_id);
create index if not exists role_assignments_scope_idx on app.role_assignments(scope_type, scope_id);
create index if not exists organizations_tenant_root_id_idx on app.organizations(tenant_root_id);

-- Client-related indexes
create index if not exists clients_tenant_idx on app.clients(tenant_root_id);
create index if not exists clients_fingerprint_idx on app.clients(fingerprint) where fingerprint is not null;
create index if not exists clients_owner_org_idx on app.clients(owner_org_id);
create index if not exists client_cases_client_idx on app.client_cases(client_id);
create index if not exists client_cases_location_idx on app.client_cases(location_id);
create index if not exists client_cases_assigned_users_idx on app.client_cases using gin(assigned_user_ids);
create index if not exists client_consents_client_idx on app.client_consents(client_id);
create index if not exists client_consents_active_idx on app.client_consents(client_id, scope_type, scope_id) where revoked_at is null;
create index if not exists client_links_client_idx on app.client_links(client_id);
create index if not exists client_links_active_idx on app.client_links(client_id, from_org_id, to_org_id) where unlinked_at is null;
-- Case Management RPC Functions
-- These functions implement case CRUD operations with proper authorization and audit logging

-- RPC function for creating cases with assignment validation
create or replace function app.rpc_create_case(
  p_client_id uuid,
  p_location_id uuid,
  p_program_ids uuid[] default '{}',
  p_assigned_user_ids uuid[] default '{}',
  p_status text default 'open'
) returns uuid
language plpgsql
security definer
as $
declare
  current_user_id uuid;
  user_org_id uuid;
  case_id uuid;
  client_tenant_id uuid;
begin
  -- Get current user
  current_user_id := app.current_profile_id();
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- Get user's organization
  select ra.scope_id into user_org_id
  from app.role_assignments ra
  join app.roles r on r.id = ra.role_id
  where ra.user_id = current_user_id 
    and ra.scope_type = 'org'
    and r.name in ('CaseManager', 'Provider', 'OrgAdmin')
    and (ra.expires_at is null or ra.expires_at > now())
  limit 1;

  if user_org_id is null then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  -- Validate client exists and user has access
  select tenant_root_id into client_tenant_id
  from app.clients
  where id = p_client_id and tenant_root_id = user_org_id;

  if client_tenant_id is null then
    raise exception 'client_not_found' using errcode = '42704';
  end if;

  -- Validate location exists and belongs to user's org
  if not exists (
    select 1 from app.service_locations sl
    join app.organizations o on o.id = sl.org_id
    where sl.id = p_location_id and o.id = user_org_id
  ) then
    raise exception 'location_not_found' using errcode = '42704';
  end if;

  -- Generate case ID
  case_id := gen_random_uuid();

  -- Insert case
  insert into app.client_cases (
    id,
    client_id,
    location_id,
    status,
    program_ids,
    assigned_user_ids,
    opened_at
  ) values (
    case_id,
    p_client_id,
    p_location_id,
    p_status,
    p_program_ids,
    p_assigned_user_ids,
    now()
  );

  -- Log audit entry
  insert into app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) values (
    current_user_id,
    'create',
    'case',
    case_id,
    'allow',
    'Case created via RPC',
    jsonb_build_object(
      'client_id', p_client_id,
      'location_id', p_location_id,
      'tenant_root_id', user_org_id,
      'program_ids', p_program_ids,
      'assigned_user_ids', p_assigned_user_ids,
      'status', p_status
    )
  );

  return case_id;
end;
$;

-- RPC function for getting case details with authorization
create or replace function app.rpc_get_case(
  p_case_id uuid
) returns jsonb
language plpgsql
security definer
as $
declare
  current_user_id uuid;
  user_org_id uuid;
  result jsonb;
begin
  -- Get current user
  current_user_id := app.current_profile_id();
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- Get user's organization
  select ra.scope_id into user_org_id
  from app.role_assignments ra
  where ra.user_id = current_user_id 
    and ra.scope_type = 'org'
    and (ra.expires_at is null or ra.expires_at > now())
  limit 1;

  if user_org_id is null then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  -- Get case details with client and location info
  select jsonb_build_array(
    jsonb_build_object(
      'id', cc.id,
      'client_id', cc.client_id,
      'location_id', cc.location_id,
      'status', cc.status,
      'program_ids', cc.program_ids,
      'assigned_user_ids', cc.assigned_user_ids,
      'opened_at', cc.opened_at,
      'closed_at', cc.closed_at,
      'client_info', jsonb_build_object(
        'id', c.id,
        'pii_ref', c.pii_ref,
        'flags', c.flags
      ),
      'location_info', jsonb_build_object(
        'id', sl.id,
        'name', sl.name,
        'org_id', sl.org_id
      ),
      'assigned_users', coalesce(
        (select jsonb_agg(
          jsonb_build_object(
            'id', up.id,
            'display_name', up.display_name,
            'role', r.name
          )
        )
        from unnest(cc.assigned_user_ids) as user_id
        join app.users_profile up on up.id = user_id
        left join app.role_assignments ra on ra.user_id = up.id and ra.scope_type = 'org' and ra.scope_id = user_org_id
        left join app.roles r on r.id = ra.role_id
        ), '[]'::jsonb
      )
    )
  ) into result
  from app.client_cases cc
  join app.clients c on c.id = cc.client_id
  join app.service_locations sl on sl.id = cc.location_id
  join app.organizations o on o.id = sl.org_id
  where cc.id = p_case_id 
    and c.tenant_root_id = user_org_id;

  if result is null then
    raise exception 'case_not_found' using errcode = '42704';
  end if;

  return result;
end;
$;

-- RPC function for updating cases
create or replace function app.rpc_update_case(
  p_case_id uuid,
  p_status text default null,
  p_program_ids uuid[] default null,
  p_assigned_user_ids uuid[] default null
) returns void
language plpgsql
security definer
as $
declare
  current_user_id uuid;
  user_org_id uuid;
  old_status text;
begin
  -- Get current user
  current_user_id := app.current_profile_id();
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- Get user's organization and validate case access
  select c.tenant_root_id, cc.status into user_org_id, old_status
  from app.client_cases cc
  join app.clients c on c.id = cc.client_id
  where cc.id = p_case_id;

  if user_org_id is null then
    raise exception 'case_not_found' using errcode = '42704';
  end if;

  -- Validate user has access to this org
  if not exists (
    select 1 from app.role_assignments ra
    where ra.user_id = current_user_id 
      and ra.scope_type = 'org'
      and ra.scope_id = user_org_id
      and (ra.expires_at is null or ra.expires_at > now())
  ) then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  -- Update case
  update app.client_cases
  set 
    status = coalesce(p_status, status),
    program_ids = coalesce(p_program_ids, program_ids),
    assigned_user_ids = coalesce(p_assigned_user_ids, assigned_user_ids),
    closed_at = case when p_status = 'closed' and status != 'closed' then now() else closed_at end
  where id = p_case_id;

  -- Log audit entry
  insert into app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) values (
    current_user_id,
    'update',
    'case',
    p_case_id,
    'allow',
    'Case updated via RPC',
    jsonb_build_object(
      'old_status', old_status,
      'new_status', p_status,
      'program_ids', p_program_ids,
      'assigned_user_ids', p_assigned_user_ids,
      'tenant_root_id', user_org_id
    )
  );
end;
$;

-- RPC function for closing cases with audit trail
create or replace function app.rpc_close_case(
  p_case_id uuid,
  p_reason text
) returns void
language plpgsql
security definer
as $
declare
  current_user_id uuid;
  user_org_id uuid;
  current_status text;
begin
  -- Get current user
  current_user_id := app.current_profile_id();
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- Get case status and validate access
  select c.tenant_root_id, cc.status into user_org_id, current_status
  from app.client_cases cc
  join app.clients c on c.id = cc.client_id
  where cc.id = p_case_id;

  if user_org_id is null then
    raise exception 'case_not_found' using errcode = '42704';
  end if;

  if current_status = 'closed' then
    raise exception 'already_closed' using errcode = '23505';
  end if;

  -- Validate user has access
  if not exists (
    select 1 from app.role_assignments ra
    where ra.user_id = current_user_id 
      and ra.scope_type = 'org'
      and ra.scope_id = user_org_id
      and (ra.expires_at is null or ra.expires_at > now())
  ) then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  -- Close case
  update app.client_cases
  set 
    status = 'closed',
    closed_at = now()
  where id = p_case_id;

  -- Log audit entry with closure reason
  insert into app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) values (
    current_user_id,
    'close',
    'case',
    p_case_id,
    'allow',
    p_reason,
    jsonb_build_object(
      'old_status', current_status,
      'closure_reason', p_reason,
      'tenant_root_id', user_org_id,
      'closed_at', now()
    )
  );
end;
$;

-- RPC function for getting user's caseload
create or replace function app.rpc_get_user_caseload(
  p_status text default null,
  p_program_ids uuid[] default '{}',
  p_location_id uuid default null,
  p_limit int default 50,
  p_offset int default 0
) returns jsonb
language plpgsql
security definer
as $
declare
  current_user_id uuid;
  user_org_id uuid;
  result jsonb;
  total_count int;
begin
  -- Get current user
  current_user_id := app.current_profile_id();
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- Get user's organization
  select ra.scope_id into user_org_id
  from app.role_assignments ra
  where ra.user_id = current_user_id 
    and ra.scope_type = 'org'
    and (ra.expires_at is null or ra.expires_at > now())
  limit 1;

  if user_org_id is null then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  -- Get total count for pagination
  select count(*) into total_count
  from app.client_cases cc
  join app.clients c on c.id = cc.client_id
  join app.service_locations sl on sl.id = cc.location_id
  where c.tenant_root_id = user_org_id
    and (current_user_id = any(cc.assigned_user_ids))
    and (p_status is null or cc.status = p_status)
    and (array_length(p_program_ids, 1) is null or cc.program_ids && p_program_ids)
    and (p_location_id is null or cc.location_id = p_location_id);

  -- Get caseload with pagination
  select jsonb_build_object(
    'cases', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', cc.id,
          'location_id', cc.location_id,
          'status', cc.status,
          'program_ids', cc.program_ids,
          'assigned_user_ids', cc.assigned_user_ids,
          'opened_at', cc.opened_at,
          'closed_at', cc.closed_at,
          'location_info', jsonb_build_object(
            'id', sl.id,
            'name', sl.name,
            'org_id', sl.org_id
          )
        )
      ), '[]'::jsonb
    ),
    'total_count', total_count,
    'has_more', (total_count > p_offset + p_limit)
  ) into result
  from app.client_cases cc
  join app.clients c on c.id = cc.client_id
  join app.service_locations sl on sl.id = cc.location_id
  where c.tenant_root_id = user_org_id
    and (current_user_id = any(cc.assigned_user_ids))
    and (p_status is null or cc.status = p_status)
    and (array_length(p_program_ids, 1) is null or cc.program_ids && p_program_ids)
    and (p_location_id is null or cc.location_id = p_location_id)
  order by cc.opened_at desc
  limit p_limit offset p_offset;

  return result;
end;
$;

-- RPC function for getting client cases
create or replace function app.rpc_get_client_cases(
  p_client_id uuid
) returns jsonb
language plpgsql
security definer
as $
declare
  current_user_id uuid;
  user_org_id uuid;
  result jsonb;
begin
  -- Get current user
  current_user_id := app.current_profile_id();
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- Get user's organization
  select ra.scope_id into user_org_id
  from app.role_assignments ra
  where ra.user_id = current_user_id 
    and ra.scope_type = 'org'
    and (ra.expires_at is null or ra.expires_at > now())
  limit 1;

  if user_org_id is null then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  -- Validate client access
  if not exists (
    select 1 from app.clients c
    where c.id = p_client_id and c.tenant_root_id = user_org_id
  ) then
    raise exception 'client_not_found' using errcode = '42704';
  end if;

  -- Get client cases
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', cc.id,
        'location_id', cc.location_id,
        'status', cc.status,
        'program_ids', cc.program_ids,
        'assigned_user_ids', cc.assigned_user_ids,
        'opened_at', cc.opened_at,
        'closed_at', cc.closed_at,
        'location_info', jsonb_build_object(
          'id', sl.id,
          'name', sl.name,
          'org_id', sl.org_id
        )
      )
    ), '[]'::jsonb
  ) into result
  from app.client_cases cc
  join app.service_locations sl on sl.id = cc.location_id
  where cc.client_id = p_client_id
  order by cc.opened_at desc;

  return result;
end;
$;

-- RPC function for assigning users to cases
create or replace function app.rpc_assign_users_to_case(
  p_case_id uuid,
  p_user_ids uuid[],
  p_reason text
) returns void
language plpgsql
security definer
as $
declare
  current_user_id uuid;
  user_org_id uuid;
  current_assigned_users uuid[];
  new_assigned_users uuid[];
begin
  -- Get current user
  current_user_id := app.current_profile_id();
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- Get case info and validate access
  select c.tenant_root_id, cc.assigned_user_ids into user_org_id, current_assigned_users
  from app.client_cases cc
  join app.clients c on c.id = cc.client_id
  where cc.id = p_case_id;

  if user_org_id is null then
    raise exception 'case_not_found' using errcode = '42704';
  end if;

  -- Validate user has access
  if not exists (
    select 1 from app.role_assignments ra
    where ra.user_id = current_user_id 
      and ra.scope_type = 'org'
      and ra.scope_id = user_org_id
      and (ra.expires_at is null or ra.expires_at > now())
  ) then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  -- Validate all user IDs exist and belong to the same org
  if exists (
    select 1 from unnest(p_user_ids) as user_id
    where not exists (
      select 1 from app.role_assignments ra
      where ra.user_id = user_id
        and ra.scope_type = 'org'
        and ra.scope_id = user_org_id
        and (ra.expires_at is null or ra.expires_at > now())
    )
  ) then
    raise exception 'invalid_user' using errcode = '42704';
  end if;

  -- Merge current and new assigned users (remove duplicates)
  select array_agg(distinct user_id) into new_assigned_users
  from (
    select unnest(current_assigned_users) as user_id
    union
    select unnest(p_user_ids) as user_id
  ) as combined_users;

  -- Update case assignments
  update app.client_cases
  set assigned_user_ids = new_assigned_users
  where id = p_case_id;

  -- Log audit entry
  insert into app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) values (
    current_user_id,
    'assign',
    'case',
    p_case_id,
    'allow',
    p_reason,
    jsonb_build_object(
      'assigned_user_ids', p_user_ids,
      'previous_assigned_users', current_assigned_users,
      'new_assigned_users', new_assigned_users,
      'tenant_root_id', user_org_id
    )
  );
end;
$;

-- RPC function for unassigning users from cases
create or replace function app.rpc_unassign_users_from_case(
  p_case_id uuid,
  p_user_ids uuid[],
  p_reason text
) returns void
language plpgsql
security definer
as $
declare
  current_user_id uuid;
  user_org_id uuid;
  current_assigned_users uuid[];
  new_assigned_users uuid[];
begin
  -- Get current user
  current_user_id := app.current_profile_id();
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- Get case info and validate access
  select c.tenant_root_id, cc.assigned_user_ids into user_org_id, current_assigned_users
  from app.client_cases cc
  join app.clients c on c.id = cc.client_id
  where cc.id = p_case_id;

  if user_org_id is null then
    raise exception 'case_not_found' using errcode = '42704';
  end if;

  -- Validate user has access
  if not exists (
    select 1 from app.role_assignments ra
    where ra.user_id = current_user_id 
      and ra.scope_type = 'org'
      and ra.scope_id = user_org_id
      and (ra.expires_at is null or ra.expires_at > now())
  ) then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  -- Check if users are actually assigned
  if not (current_assigned_users && p_user_ids) then
    raise exception 'user_not_assigned' using errcode = '42704';
  end if;

  -- Remove specified users from assignments
  select array_agg(user_id) into new_assigned_users
  from unnest(current_assigned_users) as user_id
  where not (user_id = any(p_user_ids));

  -- Update case assignments
  update app.client_cases
  set assigned_user_ids = coalesce(new_assigned_users, '{}')
  where id = p_case_id;

  -- Log audit entry
  insert into app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) values (
    current_user_id,
    'unassign',
    'case',
    p_case_id,
    'allow',
    p_reason,
    jsonb_build_object(
      'unassigned_user_ids', p_user_ids,
      'previous_assigned_users', current_assigned_users,
      'new_assigned_users', new_assigned_users,
      'tenant_root_id', user_org_id
    )
  );
end;
$;

-- Grant execute permissions on case management functions
grant execute on function app.rpc_create_case to authenticated;
grant execute on function app.rpc_get_case to authenticated;
grant execute on function app.rpc_update_case to authenticated;
grant execute on function app.rpc_close_case to authenticated;
grant execute on function app.rpc_get_user_caseload to authenticated;
grant execute on function app.rpc_get_client_cases to authenticated;
grant execute on function app.rpc_assign_users_to_case to authenticated;
grant execute on function app.rpc_unassign_users_from_case to authenticated;

-- Add audit logs table if not exists
create table if not exists app.audit_logs (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz default now(),
  actor_user_id uuid references app.users_profile(id),
  action text not null,
  resource_type text not null,
  resource_id uuid,
  decision text not null check (decision in ('allow', 'deny')),
  reason text,
  ctx jsonb default '{}'::jsonb,
  policy_version text,
  row_hash text,
  created_at timestamptz default now()
);

-- Create audit logs index
create index if not exists audit_logs_actor_idx on app.audit_logs(actor_user_id);
create index if not exists audit_logs_resource_idx on app.audit_logs(resource_type, resource_id);
create index if not exists audit_logs_ts_idx on app.audit_logs(ts);
-
- Service Profile Management RPC Functions
-- These functions implement service profile CRUD with claimed/unclaimed logic and curator controls

-- RPC function for creating service profiles
create or replace function app.rpc_create_service_profile(
  p_location_id uuid,
  p_taxonomy_code text default null,
  p_populations text[] default '{}',
  p_eligibility jsonb default '{}',
  p_hours jsonb default '{}',
  p_description text default null
) returns uuid
language plpgsql
security definer
as $
declare
  current_user_id uuid;
  user_org_id uuid;
  profile_id uuid;
  location_org_id uuid;
  location_claimed boolean;
begin
  -- Get current user
  current_user_id := app.current_profile_id();
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- Get user's organization
  select ra.scope_id into user_org_id
  from app.role_assignments ra
  join app.roles r on r.id = ra.role_id
  where ra.user_id = current_user_id 
    and ra.scope_type = 'org'
    and r.name in ('LocationManager', 'OrgAdmin', 'SuperAdmin')
    and (ra.expires_at is null or ra.expires_at > now())
  limit 1;

  if user_org_id is null then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  -- Validate location exists and get its org and claimed status
  select sl.org_id, sl.claimed into location_org_id, location_claimed
  from app.service_locations sl
  where sl.id = p_location_id;

  if location_org_id is null then
    raise exception 'location_not_found' using errcode = '42704';
  end if;

  -- Check if user can manage this location
  if location_claimed and location_org_id != user_org_id then
    -- For claimed locations, user must be from the same org
    raise exception 'insufficient_permissions' using errcode = '42501';
  elsif not location_claimed then
    -- For unclaimed locations, check if user has curator role
    if not exists (
      select 1 from app.role_assignments ra
      join app.roles r on r.id = ra.role_id
      where ra.user_id = current_user_id 
        and r.name in ('SuperAdmin', 'OrgAdmin')
        and (ra.expires_at is null or ra.expires_at > now())
    ) then
      raise exception 'curator_access_required' using errcode = '42501';
    end if;
  end if;

  -- Generate profile ID
  profile_id := gen_random_uuid();

  -- Insert service profile
  insert into app.service_profiles (
    id,
    location_id,
    taxonomy_code,
    populations,
    eligibility,
    hours,
    description,
    claimed,
    claim_owner_user_id,
    created_at,
    updated_at
  ) values (
    profile_id,
    p_location_id,
    p_taxonomy_code,
    p_populations,
    p_eligibility,
    p_hours,
    p_description,
    location_claimed,
    case when location_claimed then current_user_id else null end,
    now(),
    now()
  );

  -- Log audit entry
  insert into app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) values (
    current_user_id,
    'create',
    'service_profile',
    profile_id,
    'allow',
    'Service profile created via RPC',
    jsonb_build_object(
      'location_id', p_location_id,
      'location_claimed', location_claimed,
      'tenant_root_id', user_org_id,
      'taxonomy_code', p_taxonomy_code,
      'populations', p_populations
    )
  );

  return profile_id;
end;
$;

-- RPC function for updating service profiles with claimed/unclaimed logic
create or replace function app.rpc_update_service_profile(
  p_profile_id uuid,
  p_taxonomy_code text default null,
  p_populations text[] default null,
  p_eligibility jsonb default null,
  p_hours jsonb default null,
  p_description text default null,
  p_curator_notes text default null
) returns void
language plpgsql
security definer
as $
declare
  current_user_id uuid;
  user_org_id uuid;
  profile_location_id uuid;
  location_org_id uuid;
  location_claimed boolean;
  is_curator boolean := false;
begin
  -- Get current user
  current_user_id := app.current_profile_id();
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- Get user's organization
  select ra.scope_id into user_org_id
  from app.role_assignments ra
  where ra.user_id = current_user_id 
    and ra.scope_type = 'org'
    and (ra.expires_at is null or ra.expires_at > now())
  limit 1;

  if user_org_id is null then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  -- Check if user has curator role
  select exists (
    select 1 from app.role_assignments ra
    join app.roles r on r.id = ra.role_id
    where ra.user_id = current_user_id 
      and r.name in ('SuperAdmin', 'OrgAdmin')
      and (ra.expires_at is null or ra.expires_at > now())
  ) into is_curator;

  -- Get profile and location info
  select sp.location_id, sl.org_id, sl.claimed 
  into profile_location_id, location_org_id, location_claimed
  from app.service_profiles sp
  join app.service_locations sl on sl.id = sp.location_id
  where sp.id = p_profile_id;

  if profile_location_id is null then
    raise exception 'profile_not_found' using errcode = '42704';
  end if;

  -- Check permissions
  if location_claimed then
    -- For claimed locations, user must be from the same org or be the claim owner
    if location_org_id != user_org_id and not exists (
      select 1 from app.service_profiles sp
      where sp.id = p_profile_id and sp.claim_owner_user_id = current_user_id
    ) then
      raise exception 'insufficient_permissions' using errcode = '42501';
    end if;
  else
    -- For unclaimed locations, user must be a curator
    if not is_curator then
      raise exception 'curator_access_required' using errcode = '42501';
    end if;
  end if;

  -- Update service profile
  update app.service_profiles
  set 
    taxonomy_code = coalesce(p_taxonomy_code, taxonomy_code),
    populations = coalesce(p_populations, populations),
    eligibility = coalesce(p_eligibility, eligibility),
    hours = coalesce(p_hours, hours),
    description = coalesce(p_description, description),
    curator_notes = case when is_curator then coalesce(p_curator_notes, curator_notes) else curator_notes end,
    updated_at = now()
  where id = p_profile_id;

  -- Log audit entry
  insert into app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) values (
    current_user_id,
    'update',
    'service_profile',
    p_profile_id,
    'allow',
    'Service profile updated via RPC',
    jsonb_build_object(
      'location_id', profile_location_id,
      'location_claimed', location_claimed,
      'is_curator', is_curator,
      'tenant_root_id', user_org_id,
      'curator_notes_updated', (p_curator_notes is not null and is_curator)
    )
  );
end;
$;

-- RPC function for searching service profiles with full-text search and JSONB filtering
create or replace function app.rpc_search_service_profiles(
  p_search_term text default null,
  p_populations text[] default '{}',
  p_eligibility_filter jsonb default '{}',
  p_claimed_only boolean default null,
  p_org_id uuid default null,
  p_limit int default 20,
  p_offset int default 0
) returns jsonb
language plpgsql
security definer
as $
declare
  current_user_id uuid;
  user_org_id uuid;
  result jsonb;
  total_count int;
begin
  -- Get current user
  current_user_id := app.current_profile_id();
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- Get user's organization
  select ra.scope_id into user_org_id
  from app.role_assignments ra
  where ra.user_id = current_user_id 
    and ra.scope_type = 'org'
    and (ra.expires_at is null or ra.expires_at > now())
  limit 1;

  if user_org_id is null then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  -- Get total count for pagination
  select count(*) into total_count
  from app.service_profiles sp
  join app.service_locations sl on sl.id = sp.location_id
  join app.organizations o on o.id = sl.org_id
  where (
    -- Search term matching
    p_search_term is null or 
    sp.search_vector @@ plainto_tsquery('english', p_search_term)
  )
  and (
    -- Population filtering
    array_length(p_populations, 1) is null or 
    sp.populations && p_populations
  )
  and (
    -- Eligibility JSONB filtering
    p_eligibility_filter = '{}' or 
    sp.eligibility @> p_eligibility_filter
  )
  and (
    -- Claimed status filtering
    p_claimed_only is null or 
    sp.claimed = p_claimed_only
  )
  and (
    -- Organization filtering
    p_org_id is null or 
    sl.org_id = p_org_id
  );

  -- Search service profiles with full-text search and JSONB filtering
  select jsonb_build_object(
    'profiles', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', sp.id,
          'location_id', sp.location_id,
          'taxonomy_code', sp.taxonomy_code,
          'populations', sp.populations,
          'eligibility', sp.eligibility,
          'hours', sp.hours,
          'description', sp.description,
          'claimed', sp.claimed,
          'claim_owner_user_id', sp.claim_owner_user_id,
          'curator_notes', case 
            when exists (
              select 1 from app.role_assignments ra
              join app.roles r on r.id = ra.role_id
              where ra.user_id = current_user_id 
                and r.name in ('SuperAdmin', 'OrgAdmin')
                and (ra.expires_at is null or ra.expires_at > now())
            ) then sp.curator_notes
            else null
          end,
          'created_at', sp.created_at,
          'updated_at', sp.updated_at,
          'location_info', jsonb_build_object(
            'id', sl.id,
            'name', sl.name,
            'org_id', sl.org_id,
            'claimed', sl.claimed,
            'attributes', sl.attributes
          ),
          'organization_info', jsonb_build_object(
            'id', o.id,
            'name', o.name,
            'org_type', o.org_type
          ),
          'search_rank', case 
            when p_search_term is not null then 
              ts_rank(sp.search_vector, plainto_tsquery('english', p_search_term))
            else 0
          end
        )
        order by 
          case when p_search_term is not null then 
            ts_rank(sp.search_vector, plainto_tsquery('english', p_search_term)) 
          else 0 
          end desc,
          sp.updated_at desc
      ), '[]'::jsonb
    ),
    'total_count', total_count,
    'has_more', (total_count > p_offset + p_limit)
  ) into result
  from app.service_profiles sp
  join app.service_locations sl on sl.id = sp.location_id
  join app.organizations o on o.id = sl.org_id
  where (
    -- Search term matching
    p_search_term is null or 
    sp.search_vector @@ plainto_tsquery('english', p_search_term)
  )
  and (
    -- Population filtering
    array_length(p_populations, 1) is null or 
    sp.populations && p_populations
  )
  and (
    -- Eligibility JSONB filtering
    p_eligibility_filter = '{}' or 
    sp.eligibility @> p_eligibility_filter
  )
  and (
    -- Claimed status filtering
    p_claimed_only is null or 
    sp.claimed = p_claimed_only
  )
  and (
    -- Organization filtering
    p_org_id is null or 
    sl.org_id = p_org_id
  )
  limit p_limit offset p_offset;

  -- Log audit entry for search
  insert into app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) values (
    current_user_id,
    'search',
    'service_profile',
    null,
    'allow',
    'Service profile search performed',
    jsonb_build_object(
      'search_term', p_search_term,
      'populations', p_populations,
      'eligibility_filter', p_eligibility_filter,
      'claimed_only', p_claimed_only,
      'org_id', p_org_id,
      'tenant_root_id', user_org_id,
      'results_count', jsonb_array_length((result->'profiles'))
    )
  );

  return result;
end;
$;

-- RPC function for getting service profile details
create or replace function app.rpc_get_service_profile(
  p_profile_id uuid
) returns jsonb
language plpgsql
security definer
as $
declare
  current_user_id uuid;
  user_org_id uuid;
  result jsonb;
  is_curator boolean := false;
begin
  -- Get current user
  current_user_id := app.current_profile_id();
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- Get user's organization
  select ra.scope_id into user_org_id
  from app.role_assignments ra
  where ra.user_id = current_user_id 
    and ra.scope_type = 'org'
    and (ra.expires_at is null or ra.expires_at > now())
  limit 1;

  if user_org_id is null then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  -- Check if user has curator role
  select exists (
    select 1 from app.role_assignments ra
    join app.roles r on r.id = ra.role_id
    where ra.user_id = current_user_id 
      and r.name in ('SuperAdmin', 'OrgAdmin')
      and (ra.expires_at is null or ra.expires_at > now())
  ) into is_curator;

  -- Get service profile details
  select jsonb_build_object(
    'id', sp.id,
    'location_id', sp.location_id,
    'taxonomy_code', sp.taxonomy_code,
    'populations', sp.populations,
    'eligibility', sp.eligibility,
    'hours', sp.hours,
    'description', sp.description,
    'claimed', sp.claimed,
    'claim_owner_user_id', sp.claim_owner_user_id,
    'curator_notes', case when is_curator then sp.curator_notes else null end,
    'created_at', sp.created_at,
    'updated_at', sp.updated_at,
    'location_info', jsonb_build_object(
      'id', sl.id,
      'name', sl.name,
      'org_id', sl.org_id,
      'claimed', sl.claimed,
      'attributes', sl.attributes
    ),
    'organization_info', jsonb_build_object(
      'id', o.id,
      'name', o.name,
      'org_type', o.org_type
    ),
    'claim_owner_info', case 
      when sp.claim_owner_user_id is not null then
        jsonb_build_object(
          'id', up.id,
          'display_name', up.display_name,
          'email', up.email
        )
      else null
    end
  ) into result
  from app.service_profiles sp
  join app.service_locations sl on sl.id = sp.location_id
  join app.organizations o on o.id = sl.org_id
  left join app.users_profile up on up.id = sp.claim_owner_user_id
  where sp.id = p_profile_id;

  if result is null then
    raise exception 'profile_not_found' using errcode = '42704';
  end if;

  return result;
end;
$;

-- RPC function for claiming service locations (affects profile management)
create or replace function app.rpc_claim_service_location(
  p_location_id uuid
) returns void
language plpgsql
security definer
as $
declare
  current_user_id uuid;
  user_org_id uuid;
  location_org_id uuid;
  already_claimed boolean;
begin
  -- Get current user
  current_user_id := app.current_profile_id();
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- Get user's organization
  select ra.scope_id into user_org_id
  from app.role_assignments ra
  join app.roles r on r.id = ra.role_id
  where ra.user_id = current_user_id 
    and ra.scope_type = 'org'
    and r.name in ('LocationManager', 'OrgAdmin')
    and (ra.expires_at is null or ra.expires_at > now())
  limit 1;

  if user_org_id is null then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  -- Get location info
  select sl.org_id, sl.claimed into location_org_id, already_claimed
  from app.service_locations sl
  where sl.id = p_location_id;

  if location_org_id is null then
    raise exception 'location_not_found' using errcode = '42704';
  end if;

  if already_claimed then
    raise exception 'already_claimed' using errcode = '23505';
  end if;

  -- User must be from the same org as the location
  if location_org_id != user_org_id then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  -- Claim the location
  update app.service_locations
  set 
    claimed = true,
    claim_owner_user_id = current_user_id
  where id = p_location_id;

  -- Update all service profiles for this location to be claimed
  update app.service_profiles
  set 
    claimed = true,
    claim_owner_user_id = current_user_id,
    updated_at = now()
  where location_id = p_location_id;

  -- Log audit entry
  insert into app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) values (
    current_user_id,
    'claim',
    'service_location',
    p_location_id,
    'allow',
    'Service location claimed via RPC',
    jsonb_build_object(
      'location_id', p_location_id,
      'tenant_root_id', user_org_id,
      'profiles_updated', (select count(*) from app.service_profiles where location_id = p_location_id)
    )
  );
end;
$;

-- Grant execute permissions for service profile functions
grant execute on function app.rpc_create_service_profile to authenticated;
grant execute on function app.rpc_update_service_profile to authenticated;
grant execute on function app.rpc_search_service_profiles to authenticated;
grant execute on function app.rpc_get_service_profile to authenticated;
grant execute on function app.rpc_claim_service_location to authenticated;-- Availa
bility Engine RPC Functions
-- These functions implement availability CRUD with optimistic concurrency control and JSON predicate matching

-- RPC function for creating availability records
create or replace function app.rpc_create_availability(
  p_location_id uuid,
  p_type text,
  p_attributes jsonb default '{}',
  p_total int,
  p_available int
) returns uuid
language plpgsql
security definer
as $
declare
  current_user_id uuid;
  user_org_id uuid;
  location_org_id uuid;
  availability_id uuid;
begin
  -- Get current user
  current_user_id := app.current_profile_id();
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- Get user's organization
  select ra.scope_id into user_org_id
  from app.role_assignments ra
  join app.roles r on r.id = ra.role_id
  where ra.user_id = current_user_id 
    and ra.scope_type = 'org'
    and r.name in ('LocationManager', 'OrgAdmin', 'Provider')
    and (ra.expires_at is null or ra.expires_at > now())
  limit 1;

  if user_org_id is null then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  -- Validate location exists and user has access
  select sl.org_id into location_org_id
  from app.service_locations sl
  where sl.id = p_location_id;

  if location_org_id is null then
    raise exception 'location_not_found' using errcode = '42704';
  end if;

  if location_org_id != user_org_id then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  -- Validate availability constraints
  if p_available > p_total then
    raise exception 'invalid_availability' using errcode = '23514';
  end if;

  -- Check for existing availability record with same location, type, and attributes
  if exists (
    select 1 from app.availability
    where location_id = p_location_id 
      and type = p_type 
      and attributes = p_attributes
  ) then
    raise exception 'availability_exists' using errcode = '23505';
  end if;

  -- Generate availability ID
  availability_id := gen_random_uuid();

  -- Insert availability record
  insert into app.availability (
    id,
    location_id,
    type,
    attributes,
    total,
    available,
    version,
    updated_by,
    updated_at,
    created_at
  ) values (
    availability_id,
    p_location_id,
    p_type,
    p_attributes,
    p_total,
    p_available,
    1, -- Initial version
    current_user_id,
    now(),
    now()
  );

  -- Refresh materialized view
  refresh materialized view app.availability_summary;

  -- Log audit entry
  insert into app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) values (
    current_user_id,
    'create',
    'availability',
    availability_id,
    'allow',
    'Availability record created via RPC',
    jsonb_build_object(
      'location_id', p_location_id,
      'type', p_type,
      'attributes', p_attributes,
      'total', p_total,
      'available', p_available,
      'tenant_root_id', user_org_id,
      'version', 1
    )
  );

  return availability_id;
end;
$;

-- RPC function for updating availability with optimistic concurrency control
create or replace function app.rpc_update_availability(
  p_availability_id uuid,
  p_total int default null,
  p_available int default null,
  p_version bigint
) returns jsonb
language plpgsql
security definer
as $
declare
  current_user_id uuid;
  user_org_id uuid;
  location_org_id uuid;
  current_version bigint;
  new_version bigint;
  old_total int;
  old_available int;
  new_total int;
  new_available int;
begin
  -- Get current user
  current_user_id := app.current_profile_id();
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- Get user's organization
  select ra.scope_id into user_org_id
  from app.role_assignments ra
  join app.roles r on r.id = ra.role_id
  where ra.user_id = current_user_id 
    and ra.scope_type = 'org'
    and r.name in ('LocationManager', 'OrgAdmin', 'Provider')
    and (ra.expires_at is null or ra.expires_at > now())
  limit 1;

  if user_org_id is null then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  -- Get current availability record and validate access
  select a.version, a.total, a.available, sl.org_id
  into current_version, old_total, old_available, location_org_id
  from app.availability a
  join app.service_locations sl on sl.id = a.location_id
  where a.id = p_availability_id
  for update; -- Lock the row for update

  if current_version is null then
    raise exception 'availability_not_found' using errcode = '42704';
  end if;

  if location_org_id != user_org_id then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  -- Check optimistic concurrency control
  if current_version != p_version then
    return jsonb_build_object(
      'success', false,
      'error', 'version_conflict',
      'current_version', current_version,
      'provided_version', p_version,
      'message', 'Availability record has been modified by another user'
    );
  end if;

  -- Calculate new values
  new_total := coalesce(p_total, old_total);
  new_available := coalesce(p_available, old_available);

  -- Validate availability constraints
  if new_available > new_total then
    raise exception 'invalid_availability' using errcode = '23514';
  end if;

  -- Increment version
  new_version := current_version + 1;

  -- Update availability record
  update app.availability
  set 
    total = new_total,
    available = new_available,
    version = new_version,
    updated_by = current_user_id,
    updated_at = now()
  where id = p_availability_id;

  -- Refresh materialized view
  refresh materialized view app.availability_summary;

  -- Log audit entry
  insert into app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) values (
    current_user_id,
    'update',
    'availability',
    p_availability_id,
    'allow',
    'Availability record updated via RPC',
    jsonb_build_object(
      'old_total', old_total,
      'new_total', new_total,
      'old_available', old_available,
      'new_available', new_available,
      'old_version', current_version,
      'new_version', new_version,
      'tenant_root_id', user_org_id
    )
  );

  return jsonb_build_object(
    'success', true,
    'version', new_version,
    'total', new_total,
    'available', new_available,
    'updated_at', now()
  );
end;
$;

-- RPC function for searching availability with JSON predicate matching
create or replace function app.rpc_search_availability(
  p_location_ids uuid[] default '{}',
  p_type text default null,
  p_attribute_predicates jsonb default '{}',
  p_min_available int default null,
  p_org_id uuid default null,
  p_limit int default 20,
  p_offset int default 0
) returns jsonb
language plpgsql
security definer
as $
declare
  current_user_id uuid;
  user_org_id uuid;
  result jsonb;
  total_count int;
  where_clause text := '';
  predicate_key text;
  predicate_value jsonb;
begin
  -- Get current user
  current_user_id := app.current_profile_id();
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- Get user's organization
  select ra.scope_id into user_org_id
  from app.role_assignments ra
  where ra.user_id = current_user_id 
    and ra.scope_type = 'org'
    and (ra.expires_at is null or ra.expires_at > now())
  limit 1;

  if user_org_id is null then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  -- Get total count for pagination
  select count(*) into total_count
  from app.availability a
  join app.service_locations sl on sl.id = a.location_id
  join app.organizations o on o.id = sl.org_id
  where (
    -- Location filtering
    array_length(p_location_ids, 1) is null or 
    a.location_id = any(p_location_ids)
  )
  and (
    -- Type filtering
    p_type is null or 
    a.type = p_type
  )
  and (
    -- Attribute predicate matching (JSON containment and range checks)
    p_attribute_predicates = '{}' or 
    a.attributes @> p_attribute_predicates
  )
  and (
    -- Minimum available filtering
    p_min_available is null or 
    a.available >= p_min_available
  )
  and (
    -- Organization filtering
    p_org_id is null or 
    sl.org_id = p_org_id
  );

  -- Search availability records with JSON predicate matching
  select jsonb_build_object(
    'availability', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'location_id', a.location_id,
          'type', a.type,
          'attributes', a.attributes,
          'total', a.total,
          'available', a.available,
          'version', a.version,
          'updated_by', a.updated_by,
          'updated_at', a.updated_at,
          'created_at', a.created_at,
          'location_info', jsonb_build_object(
            'id', sl.id,
            'name', sl.name,
            'org_id', sl.org_id,
            'claimed', sl.claimed,
            'attributes', sl.attributes
          ),
          'organization_info', jsonb_build_object(
            'id', o.id,
            'name', o.name,
            'org_type', o.org_type
          ),
          'updated_by_info', jsonb_build_object(
            'id', up.id,
            'display_name', up.display_name
          )
        )
        order by a.updated_at desc
      ), '[]'::jsonb
    ),
    'total_count', total_count,
    'has_more', (total_count > p_offset + p_limit)
  ) into result
  from app.availability a
  join app.service_locations sl on sl.id = a.location_id
  join app.organizations o on o.id = sl.org_id
  join app.users_profile up on up.id = a.updated_by
  where (
    -- Location filtering
    array_length(p_location_ids, 1) is null or 
    a.location_id = any(p_location_ids)
  )
  and (
    -- Type filtering
    p_type is null or 
    a.type = p_type
  )
  and (
    -- Attribute predicate matching
    p_attribute_predicates = '{}' or 
    a.attributes @> p_attribute_predicates
  )
  and (
    -- Minimum available filtering
    p_min_available is null or 
    a.available >= p_min_available
  )
  and (
    -- Organization filtering
    p_org_id is null or 
    sl.org_id = p_org_id
  )
  limit p_limit offset p_offset;

  -- Log audit entry for search
  insert into app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) values (
    current_user_id,
    'search',
    'availability',
    null,
    'allow',
    'Availability search performed',
    jsonb_build_object(
      'location_ids', p_location_ids,
      'type', p_type,
      'attribute_predicates', p_attribute_predicates,
      'min_available', p_min_available,
      'org_id', p_org_id,
      'tenant_root_id', user_org_id,
      'results_count', jsonb_array_length((result->'availability'))
    )
  );

  return result;
end;
$;

-- RPC function for getting availability details
create or replace function app.rpc_get_availability(
  p_availability_id uuid
) returns jsonb
language plpgsql
security definer
as $
declare
  current_user_id uuid;
  user_org_id uuid;
  result jsonb;
begin
  -- Get current user
  current_user_id := app.current_profile_id();
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- Get user's organization
  select ra.scope_id into user_org_id
  from app.role_assignments ra
  where ra.user_id = current_user_id 
    and ra.scope_type = 'org'
    and (ra.expires_at is null or ra.expires_at > now())
  limit 1;

  if user_org_id is null then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  -- Get availability details
  select jsonb_build_object(
    'id', a.id,
    'location_id', a.location_id,
    'type', a.type,
    'attributes', a.attributes,
    'total', a.total,
    'available', a.available,
    'version', a.version,
    'updated_by', a.updated_by,
    'updated_at', a.updated_at,
    'created_at', a.created_at,
    'location_info', jsonb_build_object(
      'id', sl.id,
      'name', sl.name,
      'org_id', sl.org_id,
      'claimed', sl.claimed,
      'attributes', sl.attributes
    ),
    'organization_info', jsonb_build_object(
      'id', o.id,
      'name', o.name,
      'org_type', o.org_type
    ),
    'updated_by_info', jsonb_build_object(
      'id', up.id,
      'display_name', up.display_name,
      'email', up.email
    )
  ) into result
  from app.availability a
  join app.service_locations sl on sl.id = a.location_id
  join app.organizations o on o.id = sl.org_id
  join app.users_profile up on up.id = a.updated_by
  where a.id = p_availability_id;

  if result is null then
    raise exception 'availability_not_found' using errcode = '42704';
  end if;

  return result;
end;
$;

-- RPC function for getting availability summary (materialized view)
create or replace function app.rpc_get_availability_summary(
  p_org_id uuid default null,
  p_location_ids uuid[] default '{}',
  p_type text default null
) returns jsonb
language plpgsql
security definer
as $
declare
  current_user_id uuid;
  user_org_id uuid;
  result jsonb;
begin
  -- Get current user
  current_user_id := app.current_profile_id();
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- Get user's organization
  select ra.scope_id into user_org_id
  from app.role_assignments ra
  where ra.user_id = current_user_id 
    and ra.scope_type = 'org'
    and (ra.expires_at is null or ra.expires_at > now())
  limit 1;

  if user_org_id is null then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  -- Get availability summary from materialized view
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'org_id', avs.org_id,
        'location_id', avs.location_id,
        'location_name', avs.location_name,
        'type', avs.type,
        'total_capacity', avs.total_capacity,
        'total_available', avs.total_available,
        'availability_records', avs.availability_records,
        'last_updated', avs.last_updated,
        'utilization_rate', case 
          when avs.total_capacity > 0 then 
            round((avs.total_capacity - avs.total_available)::numeric / avs.total_capacity::numeric * 100, 2)
          else 0
        end
      )
    ), '[]'::jsonb
  ) into result
  from app.availability_summary avs
  where (
    -- Organization filtering
    p_org_id is null or 
    avs.org_id = p_org_id
  )
  and (
    -- Location filtering
    array_length(p_location_ids, 1) is null or 
    avs.location_id = any(p_location_ids)
  )
  and (
    -- Type filtering
    p_type is null or 
    avs.type = p_type
  )
  order by avs.location_name, avs.type;

  return result;
end;
$;

-- Grant execute permissions for availability functions
grant execute on function app.rpc_create_availability to authenticated;
grant execute on function app.rpc_update_availability to authenticated;
grant execute on function app.rpc_search_availability to authenticated;
grant execute on function app.rpc_get_availability to authenticated;
grant execute on function app.rpc_get_availability_summary to authenticated;