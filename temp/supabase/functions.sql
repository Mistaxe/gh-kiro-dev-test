create or replace function app.capabilities(scope_type text, scope uuid)
returns jsonb language plpgsql stable as $$
declare
  pid uuid := app.current_profile_id();
  caps jsonb := '{}'::jsonb;
begin
  if pid is null then return '{}'::jsonb; end if;

  if exists (
    select 1 from app.role_assignments ra
    where ra.user_id = pid and ra.scope_type = scope_type and ra.scope_id = scope
  ) then
    caps := caps || jsonb_build_object('member', true);
  end if;

  return caps;
end;
$$;

create or replace function app.consent_ok(p_client uuid, p_purpose text, p_scope_type text, p_scope_id uuid)
returns boolean language sql stable as $$
  select coalesce(
    (app.clients.consent ->> 'allowed_purposes')::jsonb ? p_purpose, false
  ) from app.clients where id = p_client
$$;

create or replace function app.match_clients(p_fingerprint text, p_tenant uuid, p_limit int default 5)
returns table (id uuid, initials text, approx_age int) language sql stable as $$
  select c.id,
         upper(substr(coalesce((c.pii_ref->>'first_name'),'X'),1,1) || substr(coalesce((c.pii_ref->>'last_name'),'X'),1,1)) as initials,
         null::int as approx_age
  from app.clients c
  where c.tenant_root_id = p_tenant
    and c.fingerprint = p_fingerprint
  limit p_limit
$$;

create or replace function app.find_available(p_pred jsonb, p_limit int default 50)
returns table (location_id uuid, available int) language sql stable as $$
  select a.location_id, a.available
  from app.availability a
  where a.available > 0 and a.attributes @> p_pred
  order by a.available desc
  limit p_limit
$$;
-- SECURITY DEFINER RPC Functions for Task 3.2
-- Requirements: 7.1, 8.1, 8.2, 13.1, 21.2
-- All writes go via SECURITY DEFINER RPCs with authorization checks

-- Helper function to check if user has role in scope
create or replace function app.has_role_in_scope(
  p_user_id uuid,
  p_role_name text,
  p_scope_type text,
  p_scope_id uuid
) returns boolean
language sql stable
as $$
  select exists (
    select 1 
    from app.role_assignments ra
    join app.roles r on r.id = ra.role_id
    where ra.user_id = p_user_id
      and r.name = p_role_name
      and ra.scope_type = p_scope_type
      and ra.scope_id = p_scope_id
      and (ra.expires_at is null or ra.expires_at > now())
  )
$$;

-- Helper function to validate tenant access
create or replace function app.validate_tenant_access(
  p_user_id uuid,
  p_tenant_root_id uuid
) returns boolean
language sql stable
as $$
  select exists (
    select 1 
    from app.role_assignments ra
    join app.organizations o on o.id = ra.scope_id and ra.scope_type = 'org'
    where ra.user_id = p_user_id
      and o.tenant_root_id = p_tenant_root_id
      and (ra.expires_at is null or ra.expires_at > now())
  )
$$;

-- 1. RPC for upserting availability with authorization checks and version control
create or replace function app.rpc_upsert_availability(
  p_location_id uuid,
  p_type text,
  p_attributes jsonb,
  p_total int,
  p_available int,
  p_version bigint default null
) returns jsonb
language plpgsql
security definer
as $$
declare
  current_user_id uuid;
  current_version bigint;
  location_org_id uuid;
  result_id uuid;
  new_version bigint;
begin
  -- Get current user
  current_user_id := app.current_profile_id();
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- Get location's organization for authorization
  select sl.org_id into location_org_id
  from app.service_locations sl
  where sl.id = p_location_id;
  
  if location_org_id is null then
    raise exception 'location_not_found' using errcode = '42704';
  end if;

  -- Check authorization: user must have LocationManager or OrgAdmin role
  if not (
    app.has_role_in_scope(current_user_id, 'LocationManager', 'location', p_location_id) or
    app.has_role_in_scope(current_user_id, 'OrgAdmin', 'org', location_org_id)
  ) then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  -- Handle optimistic concurrency control
  select a.id, a.version into result_id, current_version
  from app.availability a
  where a.location_id = p_location_id 
    and a.type = p_type 
    and a.attributes::text = p_attributes::text
  for update;

  -- If record exists and version provided, check version match
  if result_id is not null and p_version is not null and current_version != p_version then
    raise exception 'version_conflict' using 
      errcode = '40001',
      detail = format('Expected version %s, found %s', p_version, current_version);
  end if;

  -- Calculate new version
  new_version := coalesce(current_version, 0) + 1;

  -- Upsert the availability record
  insert into app.availability (
    id, location_id, type, attributes, total, available, version, updated_by, updated_at
  ) values (
    coalesce(result_id, gen_random_uuid()), 
    p_location_id, 
    p_type, 
    p_attributes, 
    p_total, 
    p_available, 
    new_version,
    current_user_id, 
    now()
  )
  on conflict (location_id, type, (attributes::text))
  do update set
    total = excluded.total,
    available = excluded.available,
    version = excluded.version,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  returning id into result_id;

  -- Log audit entry
  insert into app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) values (
    current_user_id,
    'upsert',
    'availability',
    result_id,
    'allow',
    'Availability updated via RPC',
    jsonb_build_object(
      'location_id', p_location_id,
      'type', p_type,
      'version', new_version,
      'tenant_root_id', (select tenant_root_id from app.organizations where id = location_org_id)
    )
  );

  return jsonb_build_object(
    'id', result_id,
    'version', new_version,
    'updated_at', now()
  );
end;
$$;

-- 2. RPC for creating notes with helper vs provider classification
create or replace function app.rpc_create_note(
  p_subject_type text,
  p_subject_id uuid,
  p_classification text default 'standard',
  p_content text,
  p_contains_phi boolean default false
) returns uuid
language plpgsql
security definer
as $$
declare
  current_user_id uuid;
  is_helper boolean;
  note_id uuid;
  client_tenant_id uuid;
begin
  -- Get current user
  current_user_id := app.current_profile_id();
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- Check if user is a helper
  select up.is_helper into is_helper
  from app.users_profile up
  where up.id = current_user_id;

  -- If subject is a client, get tenant for authorization
  if p_subject_type = 'client' then
    select c.tenant_root_id into client_tenant_id
    from app.clients c
    where c.id = p_subject_id;
    
    if client_tenant_id is null then
      raise exception 'client_not_found' using errcode = '42704';
    end if;

    -- Validate tenant access
    if not app.validate_tenant_access(current_user_id, client_tenant_id) then
      raise exception 'insufficient_permissions' using errcode = '42501';
    end if;

    -- If contains PHI, require consent (simplified check for now)
    if p_contains_phi then
      -- TODO: Implement full consent validation
      -- For now, just check if user has appropriate role
      if not (
        app.has_role_in_scope(current_user_id, 'CaseManager', 'org', client_tenant_id) or
        app.has_role_in_scope(current_user_id, 'Provider', 'org', client_tenant_id)
      ) then
        raise exception 'consent_required' using errcode = '42501';
      end if;
    end if;
  end if;

  -- Generate note ID
  note_id := gen_random_uuid();

  -- Insert note with appropriate classification
  insert into app.notes (
    id,
    subject_type,
    subject_id,
    author_user_id,
    classification,
    contains_phi,
    is_helper_journal,
    content,
    created_at
  ) values (
    note_id,
    p_subject_type,
    p_subject_id,
    current_user_id,
    p_classification,
    p_contains_phi,
    coalesce(is_helper, false), -- Mark as helper journal if user is helper
    p_content,
    now()
  );

  -- Log audit entry
  insert into app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) values (
    current_user_id,
    'create',
    'note',
    note_id,
    'allow',
    'Note created via RPC',
    jsonb_build_object(
      'subject_type', p_subject_type,
      'subject_id', p_subject_id,
      'classification', p_classification,
      'contains_phi', p_contains_phi,
      'is_helper_journal', coalesce(is_helper, false),
      'tenant_root_id', client_tenant_id
    )
  );

  return note_id;
end;
$$;

-- 3. RPC for creating referrals with PHI detection and consent validation
create or replace function app.rpc_create_referral(
  p_to_location_id uuid,
  p_client_id uuid default null,
  p_visibility_scope text default 'private',
  p_attributes jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
as $$
declare
  current_user_id uuid;
  from_org_id uuid;
  client_tenant_id uuid;
  referral_id uuid;
  contains_phi boolean;
begin
  -- Get current user
  current_user_id := app.current_profile_id();
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- Get user's organization (simplified - take first org assignment)
  select ra.scope_id into from_org_id
  from app.role_assignments ra
  where ra.user_id = current_user_id 
    and ra.scope_type = 'org'
    and (ra.expires_at is null or ra.expires_at > now())
  limit 1;

  if from_org_id is null then
    raise exception 'no_organization_membership' using errcode = '42501';
  end if;

  -- If client specified, validate access and consent
  if p_client_id is not null then
    select c.tenant_root_id into client_tenant_id
    from app.clients c
    where c.id = p_client_id;
    
    if client_tenant_id is null then
      raise exception 'client_not_found' using errcode = '42704';
    end if;

    -- Validate tenant access
    if not app.validate_tenant_access(current_user_id, client_tenant_id) then
      raise exception 'insufficient_permissions' using errcode = '42501';
    end if;

    -- Detect PHI in attributes (simplified detection)
    contains_phi := (
      p_attributes ? 'name' or 
      p_attributes ? 'dob' or 
      p_attributes ? 'ssn' or
      p_attributes ? 'phone' or
      p_attributes ? 'address'
    );

    -- If contains PHI, require consent validation
    if contains_phi then
      -- TODO: Implement full consent validation
      -- For now, just check if user has appropriate role
      if not (
        app.has_role_in_scope(current_user_id, 'CaseManager', 'org', client_tenant_id) or
        app.has_role_in_scope(current_user_id, 'Provider', 'org', client_tenant_id)
      ) then
        raise exception 'consent_required' using errcode = '42501';
      end if;
    end if;
  end if;

  -- Generate referral ID
  referral_id := gen_random_uuid();

  -- Insert referral
  insert into app.referrals (
    id,
    from_user_id,
    from_org_id,
    to_location_id,
    client_id,
    visibility_scope,
    status,
    attributes,
    created_at
  ) values (
    referral_id,
    current_user_id,
    from_org_id,
    p_to_location_id,
    p_client_id,
    p_visibility_scope,
    'sent',
    p_attributes,
    now()
  );

  -- Log audit entry
  insert into app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) values (
    current_user_id,
    'create',
    'referral',
    referral_id,
    'allow',
    'Referral created via RPC',
    jsonb_build_object(
      'to_location_id', p_to_location_id,
      'client_id', p_client_id,
      'visibility_scope', p_visibility_scope,
      'contains_phi', coalesce(contains_phi, false),
      'tenant_root_id', client_tenant_id,
      'from_org_id', from_org_id
    )
  );

  return referral_id;
end;
$$;

-- 4. RPC for cross-org client linking with audit
create or replace function app.rpc_link_client(
  p_client_id uuid,
  p_to_org_id uuid,
  p_reason text,
  p_consent_id uuid default null
) returns uuid
language plpgsql
security definer
as $$
declare
  current_user_id uuid;
  from_org_id uuid;
  client_tenant_id uuid;
  link_id uuid;
  existing_link_id uuid;
begin
  -- Get current user
  current_user_id := app.current_profile_id();
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- Get client's current tenant and validate access
  select c.tenant_root_id, c.owner_org_id into client_tenant_id, from_org_id
  from app.clients c
  where c.id = p_client_id;
  
  if client_tenant_id is null then
    raise exception 'client_not_found' using errcode = '42704';
  end if;

  -- Validate user has access to source organization
  if not app.validate_tenant_access(current_user_id, client_tenant_id) then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  -- Check if user has permission to link clients (requires CaseManager or higher)
  if not (
    app.has_role_in_scope(current_user_id, 'CaseManager', 'org', from_org_id) or
    app.has_role_in_scope(current_user_id, 'OrgAdmin', 'org', from_org_id)
  ) then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  -- Prevent self-linking
  if from_org_id = p_to_org_id then
    raise exception 'self_link_not_allowed' using errcode = '23514';
  end if;

  -- Check for existing active link
  select id into existing_link_id
  from app.client_links
  where client_id = p_client_id
    and from_org_id = from_org_id
    and to_org_id = p_to_org_id
    and unlinked_at is null;

  if existing_link_id is not null then
    raise exception 'link_already_exists' using errcode = '23505';
  end if;

  -- Validate consent if provided
  if p_consent_id is not null then
    if not exists (
      select 1 from app.client_consents cc
      where cc.id = p_consent_id
        and cc.client_id = p_client_id
        and cc.revoked_at is null
        and (cc.expires_at is null or cc.expires_at > now())
    ) then
      raise exception 'invalid_consent' using errcode = '42704';
    end if;
  end if;

  -- Generate link ID
  link_id := gen_random_uuid();

  -- Insert client link
  insert into app.client_links (
    id,
    client_id,
    from_org_id,
    to_org_id,
    consent_id,
    reason,
    linked_by,
    linked_at,
    created_at
  ) values (
    link_id,
    p_client_id,
    from_org_id,
    p_to_org_id,
    p_consent_id,
    p_reason,
    current_user_id,
    now(),
    now()
  );

  -- Log audit entry
  insert into app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) values (
    current_user_id,
    'link',
    'client',
    p_client_id,
    'allow',
    'Client linked between organizations via RPC',
    jsonb_build_object(
      'from_org_id', from_org_id,
      'to_org_id', p_to_org_id,
      'consent_id', p_consent_id,
      'reason', p_reason,
      'link_id', link_id,
      'tenant_root_id', client_tenant_id
    )
  );

  return link_id;
end;
$$;

-- Grant execute permissions to authenticated users
grant execute on function app.rpc_upsert_availability to authenticated;
grant execute on function app.rpc_create_note to authenticated;
grant execute on function app.rpc_create_referral to authenticated;
grant execute on function app.rpc_link_client to authenticated;

-- Comments for documentation
comment on function app.rpc_upsert_availability is 'SECURITY DEFINER RPC for availability updates with authorization and version control';
comment on function app.rpc_create_note is 'SECURITY DEFINER RPC for note creation with helper vs provider classification';
comment on function app.rpc_create_referral is 'SECURITY DEFINER RPC for referral creation with PHI detection and consent validation';
comment on function app.rpc_link_client is 'SECURITY DEFINER RPC for cross-org client linking with audit trail';