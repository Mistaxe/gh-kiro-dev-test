-- Add persona management functions for Lab/Test Harness

-- Function to get all personas with their roles and organizational context
create or replace function app.get_lab_personas()
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb := '[]'::jsonb;
  persona_record record;
  role_assignments jsonb;
  organizations jsonb;
  locations jsonb;
begin
  -- Get all users with their basic info
  for persona_record in
    select 
      up.id,
      up.auth_user_id,
      up.email,
      up.display_name,
      up.phone,
      up.is_helper,
      up.created_at,
      up.updated_at
    from app.users_profile up
    order by up.email
    limit 50
  loop
    -- Get role assignments for this user
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', ra.id,
        'role', r.name,
        'scope_type', ra.scope_type,
        'scope_id', ra.scope_id,
        'expires_at', ra.expires_at,
        'source', ra.source,
        'metadata', ra.metadata
      )
    ), '[]'::jsonb) into role_assignments
    from app.role_assignments ra
    join app.roles r on r.id = ra.role_id
    where ra.user_id = persona_record.id
      and (ra.expires_at is null or ra.expires_at > now());

    -- Get organizations this user has access to
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'name', o.name,
        'org_type', o.org_type,
        'dba', o.dba,
        'tenant_root_id', o.tenant_root_id,
        'region_id', o.region_id,
        'region_name', reg.name
      )
    ), '[]'::jsonb) into organizations
    from app.role_assignments ra
    join app.organizations o on o.id = ra.scope_id
    left join app.regions reg on reg.id = o.region_id
    where ra.user_id = persona_record.id
      and ra.scope_type = 'org'
      and (ra.expires_at is null or ra.expires_at > now());

    -- Get locations this user has access to
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', sl.id,
        'name', sl.name,
        'org_id', sl.org_id,
        'org_name', o.name,
        'claimed', sl.claimed,
        'claim_owner_user_id', sl.claim_owner_user_id
      )
    ), '[]'::jsonb) into locations
    from app.role_assignments ra
    join app.service_locations sl on sl.id = ra.scope_id
    join app.organizations o on o.id = sl.org_id
    where ra.user_id = persona_record.id
      and ra.scope_type = 'location'
      and (ra.expires_at is null or ra.expires_at > now());

    -- Add this persona to the result
    result := result || jsonb_build_object(
      'id', persona_record.id,
      'auth_user_id', persona_record.auth_user_id,
      'email', persona_record.email,
      'display_name', persona_record.display_name,
      'phone', persona_record.phone,
      'is_helper', persona_record.is_helper,
      'roles', role_assignments,
      'organizations', organizations,
      'locations', locations,
      'created_at', persona_record.created_at,
      'updated_at', persona_record.updated_at
    );
  end loop;

  return result;
end;
$$;

-- Function to get a specific persona by ID
create or replace function app.get_persona_by_id(persona_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  persona_record record;
  role_assignments jsonb;
  organizations jsonb;
  locations jsonb;
begin
  -- Get user basic info
  select 
    up.id,
    up.auth_user_id,
    up.email,
    up.display_name,
    up.phone,
    up.is_helper,
    up.created_at,
    up.updated_at
  into persona_record
  from app.users_profile up
  where up.id = persona_id;

  if not found then
    return null;
  end if;

  -- Get role assignments for this user
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', ra.id,
      'role', r.name,
      'scope_type', ra.scope_type,
      'scope_id', ra.scope_id,
      'expires_at', ra.expires_at,
      'source', ra.source,
      'metadata', ra.metadata
    )
  ), '[]'::jsonb) into role_assignments
  from app.role_assignments ra
  join app.roles r on r.id = ra.role_id
  where ra.user_id = persona_record.id
    and (ra.expires_at is null or ra.expires_at > now());

  -- Get organizations this user has access to
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'name', o.name,
      'org_type', o.org_type,
      'dba', o.dba,
      'tenant_root_id', o.tenant_root_id,
      'region_id', o.region_id,
      'region_name', reg.name
    )
  ), '[]'::jsonb) into organizations
  from app.role_assignments ra
  join app.organizations o on o.id = ra.scope_id
  left join app.regions reg on reg.id = o.region_id
  where ra.user_id = persona_record.id
    and ra.scope_type = 'org'
    and (ra.expires_at is null or ra.expires_at > now());

  -- Get locations this user has access to
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', sl.id,
      'name', sl.name,
      'org_id', sl.org_id,
      'org_name', o.name,
      'claimed', sl.claimed,
      'claim_owner_user_id', sl.claim_owner_user_id
    )
  ), '[]'::jsonb) into locations
  from app.role_assignments ra
  join app.service_locations sl on sl.id = ra.scope_id
  join app.organizations o on o.id = sl.org_id
  where ra.user_id = persona_record.id
    and ra.scope_type = 'location'
    and (ra.expires_at is null or ra.expires_at > now());

  -- Return the persona
  return jsonb_build_object(
    'id', persona_record.id,
    'auth_user_id', persona_record.auth_user_id,
    'email', persona_record.email,
    'display_name', persona_record.display_name,
    'phone', persona_record.phone,
    'is_helper', persona_record.is_helper,
    'roles', role_assignments,
    'organizations', organizations,
    'locations', locations,
    'created_at', persona_record.created_at,
    'updated_at', persona_record.updated_at
  );
end;
$$;