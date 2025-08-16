-- Migration: Remaining RPC Functions
-- This adds all the remaining functions needed for the service registry and availability system

-- RPC function for updating service profiles
CREATE OR REPLACE FUNCTION app.rpc_update_service_profile(
  p_profile_id uuid,
  p_taxonomy_code text DEFAULT NULL,
  p_populations jsonb DEFAULT NULL,
  p_eligibility jsonb DEFAULT NULL,
  p_hours jsonb DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_curator_notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  user_org_id uuid;
  profile_location_id uuid;
  location_org_id uuid;
  location_claimed boolean;
  is_curator boolean := false;
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

  -- Check if user has curator role
  SELECT EXISTS (
    SELECT 1 FROM app.role_assignments ra
    JOIN app.roles r ON r.id = ra.role_id
    WHERE ra.user_id = current_user_id 
      AND r.name IN ('SuperAdmin', 'OrgAdmin')
      AND (ra.expires_at IS NULL OR ra.expires_at > now())
  ) INTO is_curator;

  -- Get profile and location info
  SELECT sp.location_id, sl.org_id, sl.claimed 
  INTO profile_location_id, location_org_id, location_claimed
  FROM app.service_profiles sp
  JOIN app.service_locations sl ON sl.id = sp.location_id
  WHERE sp.id = p_profile_id;

  IF profile_location_id IS NULL THEN
    RAISE EXCEPTION 'profile_not_found' USING errcode = '42704';
  END IF;

  -- Check permissions
  IF location_claimed THEN
    -- For claimed locations, user must be from the same org or be the claim owner
    IF location_org_id != user_org_id AND NOT EXISTS (
      SELECT 1 FROM app.service_profiles sp
      WHERE sp.id = p_profile_id AND sp.claim_owner_user_id = current_user_id
    ) THEN
      RAISE EXCEPTION 'insufficient_permissions' USING errcode = '42501';
    END IF;
  ELSE
    -- For unclaimed locations, user must be a curator
    IF NOT is_curator THEN
      RAISE EXCEPTION 'curator_access_required' USING errcode = '42501';
    END IF;
  END IF;

  -- Update service profile
  UPDATE app.service_profiles
  SET 
    taxonomy_code = COALESCE(p_taxonomy_code, taxonomy_code),
    populations = COALESCE(p_populations, populations),
    eligibility = COALESCE(p_eligibility, eligibility),
    hours = COALESCE(p_hours, hours),
    description = COALESCE(p_description, description),
    curator_notes = CASE WHEN is_curator THEN COALESCE(p_curator_notes, curator_notes) ELSE curator_notes END,
    updated_at = now()
  WHERE id = p_profile_id;

  -- Log audit entry
  INSERT INTO app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) VALUES (
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
      'curator_notes_updated', (p_curator_notes IS NOT NULL AND is_curator)
    )
  );
END;
$$;

-- RPC function for searching service profiles
CREATE OR REPLACE FUNCTION app.rpc_search_service_profiles(
  p_search_term text DEFAULT NULL,
  p_populations jsonb DEFAULT '[]',
  p_eligibility_filter jsonb DEFAULT '{}',
  p_claimed_only boolean DEFAULT NULL,
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
  FROM app.service_profiles sp
  JOIN app.service_locations sl ON sl.id = sp.location_id
  JOIN app.organizations o ON o.id = sl.org_id
  WHERE (
    -- Search term matching
    p_search_term IS NULL OR 
    sp.search_vector @@ plainto_tsquery('english', p_search_term)
  )
  AND (
    -- Population filtering (using jsonb overlap operator)
    jsonb_array_length(p_populations) = 0 OR 
    sp.populations ?| ARRAY(SELECT jsonb_array_elements_text(p_populations))
  )
  AND (
    -- Eligibility JSONB filtering
    p_eligibility_filter = '{}' OR 
    sp.eligibility @> p_eligibility_filter
  )
  AND (
    -- Claimed status filtering
    p_claimed_only IS NULL OR 
    sp.claimed = p_claimed_only
  )
  AND (
    -- Organization filtering
    p_org_id IS NULL OR 
    sl.org_id = p_org_id
  );

  -- Search service profiles with full-text search and JSONB filtering
  SELECT jsonb_build_object(
    'profiles', COALESCE(
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
          'curator_notes', CASE 
            WHEN EXISTS (
              SELECT 1 FROM app.role_assignments ra
              JOIN app.roles r ON r.id = ra.role_id
              WHERE ra.user_id = current_user_id 
                AND r.name IN ('SuperAdmin', 'OrgAdmin')
                AND (ra.expires_at IS NULL OR ra.expires_at > now())
            ) THEN sp.curator_notes
            ELSE NULL
          END,
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
          'search_rank', CASE 
            WHEN p_search_term IS NOT NULL THEN 
              ts_rank(sp.search_vector, plainto_tsquery('english', p_search_term))
            ELSE 0
          END
        )
        ORDER BY 
          CASE WHEN p_search_term IS NOT NULL THEN 
            ts_rank(sp.search_vector, plainto_tsquery('english', p_search_term)) 
          ELSE 0 
          END DESC,
          sp.updated_at DESC
      ), '[]'::jsonb
    ),
    'total_count', total_count,
    'has_more', (total_count > p_offset + p_limit)
  ) INTO result
  FROM app.service_profiles sp
  JOIN app.service_locations sl ON sl.id = sp.location_id
  JOIN app.organizations o ON o.id = sl.org_id
  WHERE (
    -- Search term matching
    p_search_term IS NULL OR 
    sp.search_vector @@ plainto_tsquery('english', p_search_term)
  )
  AND (
    -- Population filtering
    jsonb_array_length(p_populations) = 0 OR 
    sp.populations ?| ARRAY(SELECT jsonb_array_elements_text(p_populations))
  )
  AND (
    -- Eligibility JSONB filtering
    p_eligibility_filter = '{}' OR 
    sp.eligibility @> p_eligibility_filter
  )
  AND (
    -- Claimed status filtering
    p_claimed_only IS NULL OR 
    sp.claimed = p_claimed_only
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
    'service_profile',
    NULL,
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

  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION app.rpc_update_service_profile TO authenticated;
GRANT EXECUTE ON FUNCTION app.rpc_search_service_profiles TO authenticated;