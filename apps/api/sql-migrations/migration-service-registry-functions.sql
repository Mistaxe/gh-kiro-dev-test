-- Migration: Service Registry RPC Functions
-- Run this AFTER running migration-service-registry.sql

-- RPC function for creating service profiles
CREATE OR REPLACE FUNCTION app.rpc_create_service_profile(
  p_location_id uuid,
  p_taxonomy_code text DEFAULT NULL,
  p_populations text[] DEFAULT '{}',
  p_eligibility jsonb DEFAULT '{}',
  p_hours jsonb DEFAULT '{}',
  p_description text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  user_org_id uuid;
  profile_id uuid;
  location_org_id uuid;
  location_claimed boolean;
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
    AND r.name IN ('LocationManager', 'OrgAdmin', 'SuperAdmin')
    AND (ra.expires_at IS NULL OR ra.expires_at > now())
  LIMIT 1;

  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'insufficient_permissions' USING errcode = '42501';
  END IF;

  -- Validate location exists and get its org and claimed status
  SELECT sl.org_id, sl.claimed INTO location_org_id, location_claimed
  FROM app.service_locations sl
  WHERE sl.id = p_location_id;

  IF location_org_id IS NULL THEN
    RAISE EXCEPTION 'location_not_found' USING errcode = '42704';
  END IF;

  -- Check if user can manage this location
  IF location_claimed AND location_org_id != user_org_id THEN
    -- For claimed locations, user must be from the same org
    RAISE EXCEPTION 'insufficient_permissions' USING errcode = '42501';
  ELSIF NOT location_claimed THEN
    -- For unclaimed locations, check if user has curator role
    IF NOT EXISTS (
      SELECT 1 FROM app.role_assignments ra
      JOIN app.roles r ON r.id = ra.role_id
      WHERE ra.user_id = current_user_id 
        AND r.name IN ('SuperAdmin', 'OrgAdmin')
        AND (ra.expires_at IS NULL OR ra.expires_at > now())
    ) THEN
      RAISE EXCEPTION 'curator_access_required' USING errcode = '42501';
    END IF;
  END IF;

  -- Generate profile ID
  profile_id := gen_random_uuid();

  -- Insert service profile
  INSERT INTO app.service_profiles (
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
  ) VALUES (
    profile_id,
    p_location_id,
    p_taxonomy_code,
    p_populations,
    p_eligibility,
    p_hours,
    p_description,
    location_claimed,
    CASE WHEN location_claimed THEN current_user_id ELSE NULL END,
    now(),
    now()
  );

  -- Log audit entry
  INSERT INTO app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) VALUES (
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

  RETURN profile_id;
END;
$$;