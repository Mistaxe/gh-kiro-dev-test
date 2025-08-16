-- Migration: Availability RPC Functions
-- Run this AFTER running the previous migration files

-- RPC function for creating availability records
CREATE OR REPLACE FUNCTION app.rpc_create_availability(
  p_location_id uuid,
  p_type text,
  p_total int,
  p_available int,
  p_attributes jsonb DEFAULT '{}'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  user_org_id uuid;
  location_org_id uuid;
  availability_id uuid;
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

  -- Validate location exists and user has access
  SELECT sl.org_id INTO location_org_id
  FROM app.service_locations sl
  WHERE sl.id = p_location_id;

  IF location_org_id IS NULL THEN
    RAISE EXCEPTION 'location_not_found' USING errcode = '42704';
  END IF;

  IF location_org_id != user_org_id THEN
    RAISE EXCEPTION 'insufficient_permissions' USING errcode = '42501';
  END IF;

  -- Validate availability constraints
  IF p_available > p_total THEN
    RAISE EXCEPTION 'invalid_availability' USING errcode = '23514';
  END IF;

  -- Check for existing availability record
  IF EXISTS (
    SELECT 1 FROM app.availability
    WHERE location_id = p_location_id 
      AND type = p_type 
      AND attributes = p_attributes
  ) THEN
    RAISE EXCEPTION 'availability_exists' USING errcode = '23505';
  END IF;

  -- Generate availability ID
  availability_id := gen_random_uuid();

  -- Insert availability record
  INSERT INTO app.availability (
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
  ) VALUES (
    availability_id,
    p_location_id,
    p_type,
    p_attributes,
    p_total,
    p_available,
    1,
    current_user_id,
    now(),
    now()
  );

  -- Refresh materialized view
  REFRESH MATERIALIZED VIEW app.availability_summary;

  -- Log audit entry
  INSERT INTO app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) VALUES (
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

  RETURN availability_id;
END;
$$;

-- Grant permissions for the functions we've created so far
GRANT EXECUTE ON FUNCTION app.rpc_create_service_profile TO authenticated;
GRANT EXECUTE ON FUNCTION app.rpc_create_availability TO authenticated;