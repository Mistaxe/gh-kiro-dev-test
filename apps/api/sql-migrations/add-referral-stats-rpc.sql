-- Add RPC function for referral statistics

CREATE OR REPLACE FUNCTION app.rpc_get_referral_stats(
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  user_org_id uuid;
  user_location_ids uuid[];
  sent_stats jsonb;
  received_stats jsonb;
BEGIN
  -- Get current user
  current_user_id := app.current_profile_id();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING errcode = '42501';
  END IF;

  -- Get user's organization and accessible locations
  SELECT ra.scope_id INTO user_org_id
  FROM app.role_assignments ra
  WHERE ra.user_id = current_user_id 
    AND ra.scope_type = 'org'
    AND (ra.expires_at IS NULL OR ra.expires_at > now())
  LIMIT 1;

  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'insufficient_permissions' USING errcode = '42501';
  END IF;

  -- Get user's accessible locations
  SELECT array_agg(sl.id) INTO user_location_ids
  FROM app.service_locations sl
  WHERE sl.org_id = user_org_id;

  -- Get sent referral statistics
  SELECT jsonb_build_object(
    'total', count(*),
    'pending', count(*) FILTER (WHERE status = 'pending'),
    'accepted', count(*) FILTER (WHERE status = 'accepted'),
    'declined', count(*) FILTER (WHERE status = 'declined'),
    'completed', count(*) FILTER (WHERE status = 'completed'),
    'cancelled', count(*) FILTER (WHERE status = 'cancelled')
  ) INTO sent_stats
  FROM app.referrals
  WHERE from_user_id = current_user_id;

  -- Get received referral statistics
  SELECT jsonb_build_object(
    'total', count(*),
    'pending', count(*) FILTER (WHERE status = 'pending'),
    'accepted', count(*) FILTER (WHERE status = 'accepted'),
    'declined', count(*) FILTER (WHERE status = 'declined'),
    'completed', count(*) FILTER (WHERE status = 'completed'),
    'cancelled', count(*) FILTER (WHERE status = 'cancelled')
  ) INTO received_stats
  FROM app.referrals
  WHERE to_location_id = ANY(user_location_ids);

  RETURN jsonb_build_object(
    'sent', sent_stats,
    'received', received_stats
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION app.rpc_get_referral_stats TO authenticated;