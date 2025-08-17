-- Add missing RPC functions for referral update and cancel operations

-- RPC function for updating referrals (creator only, pending only)
CREATE OR REPLACE FUNCTION app.rpc_update_referral(
  p_referral_id uuid,
  p_title text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_urgency text DEFAULT NULL,
  p_visibility_scope text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
  current_user_id uuid;
  user_org_id uuid;
  referral_info record;
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

  -- Get referral and validate creator access
  SELECT r.* INTO referral_info
  FROM app.referrals r
  WHERE r.id = p_referral_id
    AND r.from_user_id = current_user_id
    AND r.status = 'pending';

  IF referral_info IS NULL THEN
    RAISE EXCEPTION 'referral_not_found_or_not_creator' USING errcode = '42704';
  END IF;

  -- Update referral with provided fields
  UPDATE app.referrals
  SET 
    title = COALESCE(p_title, title),
    description = COALESCE(p_description, description),
    urgency = COALESCE(p_urgency, urgency),
    visibility_scope = COALESCE(p_visibility_scope, visibility_scope),
    updated_at = now()
  WHERE id = p_referral_id;

  -- Log audit entry
  INSERT INTO app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) VALUES (
    current_user_id,
    'update',
    'referral',
    p_referral_id,
    'allow',
    'Referral updated by creator',
    jsonb_build_object(
      'updated_fields', jsonb_build_object(
        'title', p_title,
        'description', p_description,
        'urgency', p_urgency,
        'visibility_scope', p_visibility_scope
      ),
      'tenant_root_id', user_org_id
    )
  );
END;
$;
-- RPC 
function for cancelling referrals (creator only, pending only)
CREATE OR REPLACE FUNCTION app.rpc_cancel_referral(
  p_referral_id uuid,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
  current_user_id uuid;
  user_org_id uuid;
  referral_info record;
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

  -- Get referral and validate creator access
  SELECT r.* INTO referral_info
  FROM app.referrals r
  WHERE r.id = p_referral_id
    AND r.from_user_id = current_user_id
    AND r.status = 'pending';

  IF referral_info IS NULL THEN
    RAISE EXCEPTION 'referral_not_found_or_not_creator' USING errcode = '42704';
  END IF;

  -- Cancel referral
  UPDATE app.referrals
  SET 
    status = 'cancelled',
    response_notes = p_reason,
    responded_at = now(),
    responded_by_user_id = current_user_id,
    updated_at = now()
  WHERE id = p_referral_id;

  -- Log audit entry
  INSERT INTO app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) VALUES (
    current_user_id,
    'cancel',
    'referral',
    p_referral_id,
    'allow',
    'Referral cancelled by creator',
    jsonb_build_object(
      'cancellation_reason', p_reason,
      'tenant_root_id', user_org_id
    )
  );
END;
$;

-- Grant execute permissions on new RPC functions
GRANT EXECUTE ON FUNCTION app.rpc_update_referral TO authenticated;
GRANT EXECUTE ON FUNCTION app.rpc_cancel_referral TO authenticated;