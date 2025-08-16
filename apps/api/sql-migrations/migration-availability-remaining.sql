-- Migration: Remaining Availability Functions
-- This adds the remaining availability functions

-- RPC function for updating availability with optimistic concurrency control
CREATE OR REPLACE FUNCTION app.rpc_update_availability(
  p_availability_id uuid,
  p_version bigint,
  p_total int DEFAULT NULL,
  p_available int DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  user_org_id uuid;
  location_org_id uuid;
  current_version bigint;
  new_version bigint;
  old_total int;
  old_available int;
  new_total int;
  new_available int;
BEGIN
  -- Get current user
  current_user_id := app.current_profile_id();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING errcode = '42501';
  END IF;

  -- Get user's organization
  SELECT ra.scope_id INTO user_org_id
  FROM app.role_assignments ra
  JOIN app.roles r ON r.id = ra.role_id
  WHERE ra.user_id = current_user_id 
    AND ra.scope_type = 'org'
    AND r.name IN ('LocationManager', 'OrgAdmin', 'Provider')
    AND (ra.expires_at IS NULL OR ra.expires_at > now())
  LIMIT 1;

  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'insufficient_permissions' USING errcode = '42501';
  END IF;

  -- Get current availability record and validate access
  SELECT a.version, a.total, a.available, sl.org_id
  INTO current_version, old_total, old_available, location_org_id
  FROM app.availability a
  JOIN app.service_locations sl ON sl.id = a.location_id
  WHERE a.id = p_availability_id
  FOR UPDATE; -- Lock the row for update

  IF current_version IS NULL THEN
    RAISE EXCEPTION 'availability_not_found' USING errcode = '42704';
  END IF;

  IF location_org_id != user_org_id THEN
    RAISE EXCEPTION 'insufficient_permissions' USING errcode = '42501';
  END IF;

  -- Check optimistic concurrency control
  IF current_version != p_version THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'version_conflict',
      'current_version', current_version,
      'provided_version', p_version,
      'message', 'Availability record has been modified by another user'
    );
  END IF;

  -- Calculate new values
  new_total := COALESCE(p_total, old_total);
  new_available := COALESCE(p_available, old_available);

  -- Validate availability constraints
  IF new_available > new_total THEN
    RAISE EXCEPTION 'invalid_availability' USING errcode = '23514';
  END IF;

  -- Increment version
  new_version := current_version + 1;

  -- Update availability record
  UPDATE app.availability
  SET 
    total = new_total,
    available = new_available,
    version = new_version,
    updated_by = current_user_id,
    updated_at = now()
  WHERE id = p_availability_id;

  -- Refresh materialized view
  REFRESH MATERIALIZED VIEW app.availability_summary;

  -- Log audit entry
  INSERT INTO app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) VALUES (
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

  RETURN jsonb_build_object(
    'success', true,
    'version', new_version,
    'total', new_total,
    'available', new_available,
    'updated_at', now()
  );
END;
$$;

-- RPC function for searching availability
CREATE OR REPLACE FUNCTION app.rpc_search_availability(
  p_location_ids uuid[] DEFAULT '{}',
  p_type text DEFAULT NULL,
  p_attribute_predicates jsonb DEFAULT '{}',
  p_min_available int DEFAULT NULL,
  p_org_id uuid DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  user_org_id uuid;
  result jsonb;
  total_count int;
BEGIN
  -- Get current user
  current_user_id := app.current_profile_id();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING errcode = '42501';
  END IF;

  -- Get user's organization
  SELECT ra.scope_id INTO user_org_id
  FROM app.role_assignments ra
  WHERE ra.user_id = current_user_id 
    AND ra.scope_type = 'org'
    AND (ra.expires_at IS NULL OR ra.expires_at > now())
  LIMIT 1;

  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'insufficient_permissions' USING errcode = '42501';
  END IF;

  -- Get total count for pagination
  SELECT count(*) INTO total_count
  FROM app.availability a
  JOIN app.service_locations sl ON sl.id = a.location_id
  JOIN app.organizations o ON o.id = sl.org_id
  WHERE (
    -- Location filtering
    array_length(p_location_ids, 1) IS NULL OR 
    a.location_id = ANY(p_location_ids)
  )
  AND (
    -- Type filtering
    p_type IS NULL OR 
    a.type = p_type
  )
  AND (
    -- Attribute predicate matching
    p_attribute_predicates = '{}' OR 
    a.attributes @> p_attribute_predicates
  )
  AND (
    -- Minimum available filtering
    p_min_available IS NULL OR 
    a.available >= p_min_available
  )
  AND (
    -- Organization filtering
    p_org_id IS NULL OR 
    sl.org_id = p_org_id
  );

  -- Search availability records
  SELECT jsonb_build_object(
    'availability', COALESCE(
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
        ORDER BY a.updated_at DESC
      ), '[]'::jsonb
    ),
    'total_count', total_count,
    'has_more', (total_count > p_offset + p_limit)
  ) INTO result
  FROM app.availability a
  JOIN app.service_locations sl ON sl.id = a.location_id
  JOIN app.organizations o ON o.id = sl.org_id
  JOIN app.users_profile up ON up.id = a.updated_by
  WHERE (
    -- Location filtering
    array_length(p_location_ids, 1) IS NULL OR 
    a.location_id = ANY(p_location_ids)
  )
  AND (
    -- Type filtering
    p_type IS NULL OR 
    a.type = p_type
  )
  AND (
    -- Attribute predicate matching
    p_attribute_predicates = '{}' OR 
    a.attributes @> p_attribute_predicates
  )
  AND (
    -- Minimum available filtering
    p_min_available IS NULL OR 
    a.available >= p_min_available
  )
  AND (
    -- Organization filtering
    p_org_id IS NULL OR 
    sl.org_id = p_org_id
  )
  LIMIT p_limit OFFSET p_offset;

  -- Log audit entry for search
  INSERT INTO app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) VALUES (
    current_user_id,
    'search',
    'availability',
    NULL,
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

  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION app.rpc_update_availability TO authenticated;
GRANT EXECUTE ON FUNCTION app.rpc_search_availability TO authenticated;