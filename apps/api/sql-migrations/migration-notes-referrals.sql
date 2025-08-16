-- Migration: Notes and Referrals System
-- Implements note management with helper vs provider classification
-- and referral workflow with PHI detection and consent validation

-- Notes table with classification and helper journal separation
CREATE TABLE IF NOT EXISTS app.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_root_id uuid NOT NULL,
  author_user_id uuid NOT NULL REFERENCES app.users_profile(id) ON DELETE CASCADE,
  subject_type text NOT NULL CHECK (subject_type IN ('client', 'case', 'referral', 'service')),
  subject_id uuid NOT NULL,
  
  -- Note classification and content
  classification text NOT NULL DEFAULT 'standard' CHECK (classification IN ('standard', 'confidential', 'helper_journal')),
  is_helper_journal boolean NOT NULL DEFAULT false,
  title text,
  content text NOT NULL,
  contains_phi boolean NOT NULL DEFAULT false,
  
  -- Metadata and search
  tags text[] DEFAULT '{}',
  search_vector tsvector,
  
  -- Audit fields
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure helper journals are properly classified
  CHECK ((is_helper_journal = false) OR (is_helper_journal = true AND classification = 'helper_journal'))
);

-- Temporary grants for confidential note access
CREATE TABLE IF NOT EXISTS app.note_temp_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES app.notes(id) ON DELETE CASCADE,
  granted_to_user_id uuid NOT NULL REFERENCES app.users_profile(id) ON DELETE CASCADE,
  granted_by_user_id uuid NOT NULL REFERENCES app.users_profile(id) ON DELETE CASCADE,
  reason text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  
  -- Ensure grant hasn't expired
  CHECK (expires_at > created_at),
  UNIQUE(note_id, granted_to_user_id)
);

-- Referrals table with PHI detection and visibility controls
CREATE TABLE IF NOT EXISTS app.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_root_id uuid NOT NULL,
  from_user_id uuid NOT NULL REFERENCES app.users_profile(id) ON DELETE CASCADE,
  from_location_id uuid NOT NULL REFERENCES app.service_locations(id),
  to_location_id uuid NOT NULL REFERENCES app.service_locations(id),
  
  -- Client association (optional for record-keeping referrals)
  client_id uuid REFERENCES app.clients(id) ON DELETE SET NULL,
  
  -- Referral type and content
  referral_type text NOT NULL DEFAULT 'direct' CHECK (referral_type IN ('direct', 'record_keeping')),
  title text NOT NULL,
  description text NOT NULL,
  urgency text NOT NULL DEFAULT 'routine' CHECK (urgency IN ('routine', 'urgent', 'emergency')),
  
  -- PHI detection and consent
  contains_phi boolean NOT NULL DEFAULT false,
  phi_fields text[] DEFAULT '{}',
  consent_id uuid REFERENCES app.client_consents(id),
  
  -- Visibility and status
  visibility_scope text NOT NULL DEFAULT 'organization' CHECK (visibility_scope IN ('organization', 'network', 'public')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed', 'cancelled')),
  
  -- Response tracking
  responded_at timestamptz,
  responded_by_user_id uuid REFERENCES app.users_profile(id),
  response_notes text,
  
  -- Audit fields
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure PHI referrals have consent when required
  CHECK ((contains_phi = false) OR (contains_phi = true AND (client_id IS NULL OR consent_id IS NOT NULL))),
  -- Ensure from and to locations are different
  CHECK (from_location_id != to_location_id)
);

-- Referral matching for service discovery
CREATE TABLE IF NOT EXISTS app.referral_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES app.referrals(id) ON DELETE CASCADE,
  service_profile_id uuid NOT NULL REFERENCES app.service_profiles(id) ON DELETE CASCADE,
  match_score decimal(3,2) NOT NULL CHECK (match_score >= 0 AND match_score <= 1),
  match_criteria jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(referral_id, service_profile_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS notes_tenant_idx ON app.notes(tenant_root_id);
CREATE INDEX IF NOT EXISTS notes_author_idx ON app.notes(author_user_id);
CREATE INDEX IF NOT EXISTS notes_subject_idx ON app.notes(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS notes_classification_idx ON app.notes(classification);
CREATE INDEX IF NOT EXISTS notes_helper_journal_idx ON app.notes(is_helper_journal) WHERE is_helper_journal = true;
CREATE INDEX IF NOT EXISTS notes_search_idx ON app.notes USING gin(search_vector);
CREATE INDEX IF NOT EXISTS notes_tags_idx ON app.notes USING gin(tags);
CREATE INDEX IF NOT EXISTS notes_created_idx ON app.notes(created_at);

CREATE INDEX IF NOT EXISTS note_temp_grants_note_idx ON app.note_temp_grants(note_id);
CREATE INDEX IF NOT EXISTS note_temp_grants_user_idx ON app.note_temp_grants(granted_to_user_id);
CREATE INDEX IF NOT EXISTS note_temp_grants_expires_idx ON app.note_temp_grants(expires_at);

CREATE INDEX IF NOT EXISTS referrals_tenant_idx ON app.referrals(tenant_root_id);
CREATE INDEX IF NOT EXISTS referrals_from_user_idx ON app.referrals(from_user_id);
CREATE INDEX IF NOT EXISTS referrals_from_location_idx ON app.referrals(from_location_id);
CREATE INDEX IF NOT EXISTS referrals_to_location_idx ON app.referrals(to_location_id);
CREATE INDEX IF NOT EXISTS referrals_client_idx ON app.referrals(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS referrals_status_idx ON app.referrals(status);
CREATE INDEX IF NOT EXISTS referrals_visibility_idx ON app.referrals(visibility_scope);
CREATE INDEX IF NOT EXISTS referrals_created_idx ON app.referrals(created_at);

CREATE INDEX IF NOT EXISTS referral_matches_referral_idx ON app.referral_matches(referral_id);
CREATE INDEX IF NOT EXISTS referral_matches_service_idx ON app.referral_matches(service_profile_id);
CREATE INDEX IF NOT EXISTS referral_matches_score_idx ON app.referral_matches(match_score DESC);

-- Function to update note search vector automatically
CREATE OR REPLACE FUNCTION app.update_note_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', 
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.content, '') || ' ' ||
    coalesce(array_to_string(NEW.tags, ' '), '')
  );
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Trigger to automatically update note search vector
DROP TRIGGER IF EXISTS note_search_vector_trigger ON app.notes;
CREATE TRIGGER note_search_vector_trigger
  BEFORE INSERT OR UPDATE ON app.notes
  FOR EACH ROW EXECUTE FUNCTION app.update_note_search_vector();

-- Function to detect PHI in referral content
CREATE OR REPLACE FUNCTION app.detect_referral_phi(
  p_title text,
  p_description text,
  p_client_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  phi_detected boolean := false;
  phi_fields text[] := '{}';
  content_text text;
BEGIN
  content_text := coalesce(p_title, '') || ' ' || coalesce(p_description, '');
  
  -- Simple PHI detection heuristics (in production, use more sophisticated detection)
  
  -- Check for client association
  IF p_client_id IS NOT NULL THEN
    phi_detected := true;
    phi_fields := array_append(phi_fields, 'client_association');
  END IF;
  
  -- Check for medical terms
  IF content_text ~* '\b(diagnosis|medication|treatment|therapy|psychiatric|mental health|substance|addiction|depression|anxiety|bipolar|schizophrenia)\b' THEN
    phi_detected := true;
    phi_fields := array_append(phi_fields, 'medical_information');
  END IF;
  
  -- Check for personal identifiers
  IF content_text ~* '\b\d{3}-\d{2}-\d{4}\b' THEN -- SSN pattern
    phi_detected := true;
    phi_fields := array_append(phi_fields, 'ssn');
  END IF;
  
  IF content_text ~* '\b\d{3}-\d{3}-\d{4}\b' THEN -- Phone pattern
    phi_detected := true;
    phi_fields := array_append(phi_fields, 'phone');
  END IF;
  
  IF content_text ~* '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b' THEN -- Email pattern
    phi_detected := true;
    phi_fields := array_append(phi_fields, 'email');
  END IF;
  
  RETURN jsonb_build_object(
    'contains_phi', phi_detected,
    'phi_fields', phi_fields
  );
END;
$$;

-- Function to update referral PHI detection automatically
CREATE OR REPLACE FUNCTION app.update_referral_phi_detection()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  phi_result jsonb;
BEGIN
  -- Detect PHI in referral content
  phi_result := app.detect_referral_phi(NEW.title, NEW.description, NEW.client_id);
  
  NEW.contains_phi := (phi_result->>'contains_phi')::boolean;
  NEW.phi_fields := ARRAY(SELECT jsonb_array_elements_text(phi_result->'phi_fields'));
  NEW.updated_at := now();
  
  RETURN NEW;
END;
$$;

-- Trigger to automatically detect PHI in referrals
DROP TRIGGER IF EXISTS referral_phi_detection_trigger ON app.referrals;
CREATE TRIGGER referral_phi_detection_trigger
  BEFORE INSERT OR UPDATE ON app.referrals
  FOR EACH ROW EXECUTE FUNCTION app.update_referral_phi_detection();
-
- RPC Functions for Note Management

-- RPC function for creating notes with proper classification
CREATE OR REPLACE FUNCTION app.rpc_create_note(
  p_subject_type text,
  p_subject_id uuid,
  p_title text DEFAULT NULL,
  p_content text,
  p_classification text DEFAULT 'standard',
  p_tags text[] DEFAULT '{}',
  p_contains_phi boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  user_org_id uuid;
  note_id uuid;
  subject_tenant_id uuid;
  is_helper boolean;
BEGIN
  -- Get current user
  current_user_id := app.current_profile_id();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING errcode = '42501';
  END IF;

  -- Get user's organization and helper status
  SELECT ra.scope_id, up.is_helper INTO user_org_id, is_helper
  FROM app.role_assignments ra
  JOIN app.users_profile up ON up.id = current_user_id
  WHERE ra.user_id = current_user_id 
    AND ra.scope_type = 'org'
    AND (ra.expires_at IS NULL OR ra.expires_at > now())
  LIMIT 1;

  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'insufficient_permissions' USING errcode = '42501';
  END IF;

  -- Validate subject exists and get tenant context
  IF p_subject_type = 'client' THEN
    SELECT tenant_root_id INTO subject_tenant_id
    FROM app.clients WHERE id = p_subject_id;
  ELSIF p_subject_type = 'case' THEN
    SELECT c.tenant_root_id INTO subject_tenant_id
    FROM app.client_cases cc
    JOIN app.clients c ON c.id = cc.client_id
    WHERE cc.id = p_subject_id;
  ELSE
    -- For other subject types, use user's org as tenant
    subject_tenant_id := user_org_id;
  END IF;

  IF subject_tenant_id IS NULL THEN
    RAISE EXCEPTION 'subject_not_found' USING errcode = '42704';
  END IF;

  -- Validate tenant access
  IF subject_tenant_id != user_org_id THEN
    RAISE EXCEPTION 'insufficient_permissions' USING errcode = '42501';
  END IF;

  -- Auto-classify helper journals
  IF is_helper AND p_classification = 'standard' THEN
    p_classification := 'helper_journal';
  END IF;

  -- Generate note ID
  note_id := gen_random_uuid();

  -- Insert note
  INSERT INTO app.notes (
    id,
    tenant_root_id,
    author_user_id,
    subject_type,
    subject_id,
    classification,
    is_helper_journal,
    title,
    content,
    contains_phi,
    tags
  ) VALUES (
    note_id,
    subject_tenant_id,
    current_user_id,
    p_subject_type,
    p_subject_id,
    p_classification,
    (p_classification = 'helper_journal'),
    p_title,
    p_content,
    p_contains_phi,
    p_tags
  );

  -- Log audit entry
  INSERT INTO app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) VALUES (
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
      'is_helper_journal', (p_classification = 'helper_journal'),
      'contains_phi', p_contains_phi,
      'tenant_root_id', subject_tenant_id
    )
  );

  RETURN note_id;
END;
$$;

-- RPC function for searching notes with authorization filtering
CREATE OR REPLACE FUNCTION app.rpc_search_notes(
  p_subject_type text DEFAULT NULL,
  p_subject_id uuid DEFAULT NULL,
  p_search_term text DEFAULT NULL,
  p_tags text[] DEFAULT '{}',
  p_include_helper_journals boolean DEFAULT false,
  p_classification text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  user_org_id uuid;
  is_helper boolean;
  result jsonb;
  total_count int;
BEGIN
  -- Get current user
  current_user_id := app.current_profile_id();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING errcode = '42501';
  END IF;

  -- Get user's organization and helper status
  SELECT ra.scope_id, up.is_helper INTO user_org_id, is_helper
  FROM app.role_assignments ra
  JOIN app.users_profile up ON up.id = current_user_id
  WHERE ra.user_id = current_user_id 
    AND ra.scope_type = 'org'
    AND (ra.expires_at IS NULL OR ra.expires_at > now())
  LIMIT 1;

  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'insufficient_permissions' USING errcode = '42501';
  END IF;

  -- Get total count for pagination
  SELECT count(*) INTO total_count
  FROM app.notes n
  WHERE n.tenant_root_id = user_org_id
    AND (p_subject_type IS NULL OR n.subject_type = p_subject_type)
    AND (p_subject_id IS NULL OR n.subject_id = p_subject_id)
    AND (p_classification IS NULL OR n.classification = p_classification)
    AND (p_search_term IS NULL OR n.search_vector @@ plainto_tsquery('english', p_search_term))
    AND (array_length(p_tags, 1) IS NULL OR n.tags && p_tags)
    -- Provider note queries exclude helper journals by default
    AND (p_include_helper_journals = true OR n.is_helper_journal = false OR n.author_user_id = current_user_id)
    -- Confidential notes require author access or temp grant
    AND (n.classification != 'confidential' OR n.author_user_id = current_user_id OR
         EXISTS (
           SELECT 1 FROM app.note_temp_grants ntg
           WHERE ntg.note_id = n.id 
             AND ntg.granted_to_user_id = current_user_id
             AND ntg.expires_at > now()
             AND ntg.used_at IS NULL
         ));

  -- Get notes with pagination
  SELECT jsonb_build_object(
    'notes', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', n.id,
          'subject_type', n.subject_type,
          'subject_id', n.subject_id,
          'classification', n.classification,
          'is_helper_journal', n.is_helper_journal,
          'title', n.title,
          'content', CASE 
            WHEN n.contains_phi AND NOT EXISTS (
              SELECT 1 FROM app.client_consents cc
              WHERE cc.client_id = n.subject_id 
                AND cc.scope_type = 'organization'
                AND cc.scope_id = user_org_id
                AND cc.revoked_at IS NULL
                AND 'care' = ANY(cc.allowed_purposes)
            ) THEN '[PHI REDACTED - CONSENT REQUIRED]'
            ELSE n.content
          END,
          'contains_phi', n.contains_phi,
          'tags', n.tags,
          'author', jsonb_build_object(
            'id', up.id,
            'display_name', up.display_name,
            'is_helper', up.is_helper
          ),
          'created_at', n.created_at,
          'updated_at', n.updated_at
        )
        ORDER BY n.created_at DESC
      ), '[]'::jsonb
    ),
    'total_count', total_count,
    'has_more', (p_offset + p_limit < total_count)
  ) INTO result
  FROM app.notes n
  JOIN app.users_profile up ON up.id = n.author_user_id
  WHERE n.tenant_root_id = user_org_id
    AND (p_subject_type IS NULL OR n.subject_type = p_subject_type)
    AND (p_subject_id IS NULL OR n.subject_id = p_subject_id)
    AND (p_classification IS NULL OR n.classification = p_classification)
    AND (p_search_term IS NULL OR n.search_vector @@ plainto_tsquery('english', p_search_term))
    AND (array_length(p_tags, 1) IS NULL OR n.tags && p_tags)
    AND (p_include_helper_journals = true OR n.is_helper_journal = false OR n.author_user_id = current_user_id)
    AND (n.classification != 'confidential' OR n.author_user_id = current_user_id OR
         EXISTS (
           SELECT 1 FROM app.note_temp_grants ntg
           WHERE ntg.note_id = n.id 
             AND ntg.granted_to_user_id = current_user_id
             AND ntg.expires_at > now()
             AND ntg.used_at IS NULL
         ))
  LIMIT p_limit OFFSET p_offset;

  -- Log audit entry for search
  INSERT INTO app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) VALUES (
    current_user_id,
    'search',
    'note',
    NULL,
    'allow',
    'Note search performed',
    jsonb_build_object(
      'search_term', p_search_term,
      'subject_type', p_subject_type,
      'subject_id', p_subject_id,
      'include_helper_journals', p_include_helper_journals,
      'tenant_root_id', user_org_id,
      'results_count', jsonb_array_length(result->'notes')
    )
  );

  RETURN result;
END;
$$;

-- RPC function for granting temporary access to confidential notes
CREATE OR REPLACE FUNCTION app.rpc_grant_note_access(
  p_note_id uuid,
  p_granted_to_user_id uuid,
  p_reason text,
  p_duration_hours int DEFAULT 24
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  user_org_id uuid;
  note_info record;
  grant_id uuid;
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

  -- Get note information and validate access
  SELECT n.*, up.display_name as author_name INTO note_info
  FROM app.notes n
  JOIN app.users_profile up ON up.id = n.author_user_id
  WHERE n.id = p_note_id 
    AND n.tenant_root_id = user_org_id
    AND n.classification = 'confidential'
    AND n.author_user_id = current_user_id;

  IF note_info IS NULL THEN
    RAISE EXCEPTION 'note_not_found_or_not_author' USING errcode = '42704';
  END IF;

  -- Validate target user exists in same org
  IF NOT EXISTS (
    SELECT 1 FROM app.role_assignments ra
    WHERE ra.user_id = p_granted_to_user_id
      AND ra.scope_type = 'org'
      AND ra.scope_id = user_org_id
      AND (ra.expires_at IS NULL OR ra.expires_at > now())
  ) THEN
    RAISE EXCEPTION 'target_user_not_found' USING errcode = '42704';
  END IF;

  -- Create temporary grant
  INSERT INTO app.note_temp_grants (
    note_id,
    granted_to_user_id,
    granted_by_user_id,
    reason,
    expires_at
  ) VALUES (
    p_note_id,
    p_granted_to_user_id,
    current_user_id,
    p_reason,
    now() + (p_duration_hours || ' hours')::interval
  )
  ON CONFLICT (note_id, granted_to_user_id) 
  DO UPDATE SET
    granted_by_user_id = current_user_id,
    reason = p_reason,
    expires_at = now() + (p_duration_hours || ' hours')::interval,
    used_at = NULL
  RETURNING id INTO grant_id;

  -- Log audit entry
  INSERT INTO app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) VALUES (
    current_user_id,
    'grant_access',
    'note',
    p_note_id,
    'allow',
    'Temporary access granted to confidential note',
    jsonb_build_object(
      'granted_to_user_id', p_granted_to_user_id,
      'reason', p_reason,
      'duration_hours', p_duration_hours,
      'expires_at', now() + (p_duration_hours || ' hours')::interval,
      'tenant_root_id', user_org_id
    )
  );

  RETURN grant_id;
END;
$$;-- RPC
 Functions for Referral Management

-- RPC function for creating referrals with PHI detection
CREATE OR REPLACE FUNCTION app.rpc_create_referral(
  p_to_location_id uuid,
  p_client_id uuid DEFAULT NULL,
  p_referral_type text DEFAULT 'direct',
  p_title text,
  p_description text,
  p_urgency text DEFAULT 'routine',
  p_visibility_scope text DEFAULT 'organization',
  p_consent_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  user_org_id uuid;
  user_location_id uuid;
  referral_id uuid;
  client_tenant_id uuid;
  phi_result jsonb;
BEGIN
  -- Get current user
  current_user_id := app.current_profile_id();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING errcode = '42501';
  END IF;

  -- Get user's organization and primary location
  SELECT ra.scope_id INTO user_org_id
  FROM app.role_assignments ra
  WHERE ra.user_id = current_user_id 
    AND ra.scope_type = 'org'
    AND (ra.expires_at IS NULL OR ra.expires_at > now())
  LIMIT 1;

  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'insufficient_permissions' USING errcode = '42501';
  END IF;

  -- Get user's primary location (first location they have access to)
  SELECT sl.id INTO user_location_id
  FROM app.service_locations sl
  WHERE sl.org_id = user_org_id
  LIMIT 1;

  IF user_location_id IS NULL THEN
    RAISE EXCEPTION 'no_location_access' USING errcode = '42501';
  END IF;

  -- Validate target location exists
  IF NOT EXISTS (
    SELECT 1 FROM app.service_locations WHERE id = p_to_location_id
  ) THEN
    RAISE EXCEPTION 'target_location_not_found' USING errcode = '42704';
  END IF;

  -- Validate client access if specified
  IF p_client_id IS NOT NULL THEN
    SELECT tenant_root_id INTO client_tenant_id
    FROM app.clients WHERE id = p_client_id;
    
    IF client_tenant_id IS NULL THEN
      RAISE EXCEPTION 'client_not_found' USING errcode = '42704';
    END IF;
    
    IF client_tenant_id != user_org_id THEN
      RAISE EXCEPTION 'insufficient_client_access' USING errcode = '42501';
    END IF;
  END IF;

  -- Detect PHI in referral content
  phi_result := app.detect_referral_phi(p_title, p_description, p_client_id);

  -- Validate consent for PHI referrals
  IF (phi_result->>'contains_phi')::boolean AND p_client_id IS NOT NULL THEN
    IF p_consent_id IS NULL THEN
      RAISE EXCEPTION 'consent_required_for_phi' USING errcode = '42501';
    END IF;
    
    -- Validate consent exists and is active
    IF NOT EXISTS (
      SELECT 1 FROM app.client_consents cc
      WHERE cc.id = p_consent_id
        AND cc.client_id = p_client_id
        AND cc.revoked_at IS NULL
        AND (cc.expires_at IS NULL OR cc.expires_at > now())
        AND 'care' = ANY(cc.allowed_purposes)
    ) THEN
      RAISE EXCEPTION 'invalid_consent' USING errcode = '42501';
    END IF;
  END IF;

  -- Generate referral ID
  referral_id := gen_random_uuid();

  -- Insert referral
  INSERT INTO app.referrals (
    id,
    tenant_root_id,
    from_user_id,
    from_location_id,
    to_location_id,
    client_id,
    referral_type,
    title,
    description,
    urgency,
    contains_phi,
    phi_fields,
    consent_id,
    visibility_scope,
    status
  ) VALUES (
    referral_id,
    user_org_id,
    current_user_id,
    user_location_id,
    p_to_location_id,
    p_client_id,
    p_referral_type,
    p_title,
    p_description,
    p_urgency,
    (phi_result->>'contains_phi')::boolean,
    ARRAY(SELECT jsonb_array_elements_text(phi_result->'phi_fields')),
    p_consent_id,
    p_visibility_scope,
    'pending'
  );

  -- Log audit entry
  INSERT INTO app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) VALUES (
    current_user_id,
    'create',
    'referral',
    referral_id,
    'allow',
    'Referral created via RPC',
    jsonb_build_object(
      'to_location_id', p_to_location_id,
      'client_id', p_client_id,
      'referral_type', p_referral_type,
      'contains_phi', (phi_result->>'contains_phi')::boolean,
      'phi_fields', phi_result->'phi_fields',
      'consent_id', p_consent_id,
      'visibility_scope', p_visibility_scope,
      'tenant_root_id', user_org_id
    )
  );

  RETURN referral_id;
END;
$$;

-- RPC function for searching referrals with visibility controls
CREATE OR REPLACE FUNCTION app.rpc_search_referrals(
  p_status text DEFAULT NULL,
  p_urgency text DEFAULT NULL,
  p_referral_type text DEFAULT NULL,
  p_from_location_id uuid DEFAULT NULL,
  p_to_location_id uuid DEFAULT NULL,
  p_search_term text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  user_org_id uuid;
  user_location_ids uuid[];
  result jsonb;
  total_count int;
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

  -- Get total count for pagination
  SELECT count(*) INTO total_count
  FROM app.referrals r
  JOIN app.service_locations sl_from ON sl_from.id = r.from_location_id
  JOIN app.service_locations sl_to ON sl_to.id = r.to_location_id
  WHERE (
    -- User can see referrals from their org
    r.tenant_root_id = user_org_id OR
    -- User can see referrals to their locations
    r.to_location_id = ANY(user_location_ids) OR
    -- User can see public referrals
    r.visibility_scope = 'public'
  )
  AND (p_status IS NULL OR r.status = p_status)
  AND (p_urgency IS NULL OR r.urgency = p_urgency)
  AND (p_referral_type IS NULL OR r.referral_type = p_referral_type)
  AND (p_from_location_id IS NULL OR r.from_location_id = p_from_location_id)
  AND (p_to_location_id IS NULL OR r.to_location_id = p_to_location_id)
  AND (p_search_term IS NULL OR 
       r.title ILIKE '%' || p_search_term || '%' OR 
       r.description ILIKE '%' || p_search_term || '%');

  -- Get referrals with pagination
  SELECT jsonb_build_object(
    'referrals', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'from_user_id', r.from_user_id,
          'from_location', jsonb_build_object(
            'id', sl_from.id,
            'name', sl_from.name,
            'org_id', sl_from.org_id
          ),
          'to_location', jsonb_build_object(
            'id', sl_to.id,
            'name', sl_to.name,
            'org_id', sl_to.org_id
          ),
          'client_id', r.client_id,
          'referral_type', r.referral_type,
          'title', r.title,
          'description', CASE 
            WHEN r.contains_phi AND r.tenant_root_id != user_org_id AND r.to_location_id != ALL(user_location_ids) THEN
              '[PHI CONTENT REDACTED]'
            ELSE r.description
          END,
          'urgency', r.urgency,
          'contains_phi', r.contains_phi,
          'phi_fields', CASE 
            WHEN r.contains_phi AND r.tenant_root_id != user_org_id AND r.to_location_id != ALL(user_location_ids) THEN
              '[]'::jsonb
            ELSE to_jsonb(r.phi_fields)
          END,
          'visibility_scope', r.visibility_scope,
          'status', r.status,
          'responded_at', r.responded_at,
          'responded_by_user_id', r.responded_by_user_id,
          'response_notes', r.response_notes,
          'created_at', r.created_at,
          'updated_at', r.updated_at,
          'from_user', jsonb_build_object(
            'id', up.id,
            'display_name', up.display_name
          )
        )
        ORDER BY 
          CASE r.urgency 
            WHEN 'emergency' THEN 1
            WHEN 'urgent' THEN 2
            WHEN 'routine' THEN 3
          END,
          r.created_at DESC
      ), '[]'::jsonb
    ),
    'total_count', total_count,
    'has_more', (p_offset + p_limit < total_count)
  ) INTO result
  FROM app.referrals r
  JOIN app.service_locations sl_from ON sl_from.id = r.from_location_id
  JOIN app.service_locations sl_to ON sl_to.id = r.to_location_id
  JOIN app.users_profile up ON up.id = r.from_user_id
  WHERE (
    r.tenant_root_id = user_org_id OR
    r.to_location_id = ANY(user_location_ids) OR
    r.visibility_scope = 'public'
  )
  AND (p_status IS NULL OR r.status = p_status)
  AND (p_urgency IS NULL OR r.urgency = p_urgency)
  AND (p_referral_type IS NULL OR r.referral_type = p_referral_type)
  AND (p_from_location_id IS NULL OR r.from_location_id = p_from_location_id)
  AND (p_to_location_id IS NULL OR r.to_location_id = p_to_location_id)
  AND (p_search_term IS NULL OR 
       r.title ILIKE '%' || p_search_term || '%' OR 
       r.description ILIKE '%' || p_search_term || '%')
  LIMIT p_limit OFFSET p_offset;

  -- Log audit entry for search
  INSERT INTO app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) VALUES (
    current_user_id,
    'search',
    'referral',
    NULL,
    'allow',
    'Referral search performed',
    jsonb_build_object(
      'search_term', p_search_term,
      'status', p_status,
      'urgency', p_urgency,
      'referral_type', p_referral_type,
      'tenant_root_id', user_org_id,
      'results_count', jsonb_array_length(result->'referrals')
    )
  );

  RETURN result;
END;
$$;

-- RPC function for responding to referrals
CREATE OR REPLACE FUNCTION app.rpc_respond_to_referral(
  p_referral_id uuid,
  p_status text,
  p_response_notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  user_org_id uuid;
  user_location_ids uuid[];
  referral_info record;
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

  -- Get referral information and validate access
  SELECT r.* INTO referral_info
  FROM app.referrals r
  WHERE r.id = p_referral_id
    AND r.to_location_id = ANY(user_location_ids)
    AND r.status = 'pending';

  IF referral_info IS NULL THEN
    RAISE EXCEPTION 'referral_not_found_or_no_access' USING errcode = '42704';
  END IF;

  -- Validate status transition
  IF p_status NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'invalid_status_transition' USING errcode = '22023';
  END IF;

  -- Update referral
  UPDATE app.referrals
  SET 
    status = p_status,
    responded_at = now(),
    responded_by_user_id = current_user_id,
    response_notes = p_response_notes,
    updated_at = now()
  WHERE id = p_referral_id;

  -- Log audit entry
  INSERT INTO app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) VALUES (
    current_user_id,
    'respond',
    'referral',
    p_referral_id,
    'allow',
    'Referral response recorded',
    jsonb_build_object(
      'old_status', 'pending',
      'new_status', p_status,
      'response_notes', p_response_notes,
      'tenant_root_id', user_org_id
    )
  );
END;
$$;

-- RPC function for matching referrals to service profiles
CREATE OR REPLACE FUNCTION app.rpc_match_referral_services(
  p_referral_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  user_org_id uuid;
  referral_info record;
  matches jsonb;
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

  -- Get referral information and validate access
  SELECT r.* INTO referral_info
  FROM app.referrals r
  WHERE r.id = p_referral_id
    AND (r.tenant_root_id = user_org_id OR r.visibility_scope IN ('network', 'public'));

  IF referral_info IS NULL THEN
    RAISE EXCEPTION 'referral_not_found' USING errcode = '42704';
  END IF;

  -- Find matching service profiles
  SELECT jsonb_agg(
    jsonb_build_object(
      'service_profile_id', sp.id,
      'location_id', sp.location_id,
      'location_name', sl.name,
      'org_name', o.name,
      'taxonomy_code', sp.taxonomy_code,
      'populations', sp.populations,
      'description', sp.description,
      'match_score', CASE
        -- Exact taxonomy match
        WHEN sp.taxonomy_code = referral_info.title THEN 1.0
        -- Description similarity (simple text matching)
        WHEN sp.description ILIKE '%' || split_part(referral_info.title, ' ', 1) || '%' THEN 0.8
        -- Population match (if referral mentions population)
        WHEN referral_info.description ~* '\b(adult|adolescent|child|family|senior|veteran)s?\b' 
             AND sp.populations && ARRAY(
               SELECT unnest(regexp_split_to_array(
                 regexp_replace(referral_info.description, '\b(adult|adolescent|child|family|senior|veteran)s?\b', '\1', 'gi'),
                 '\s+'
               ))
             ) THEN 0.6
        -- Default match for same service type
        ELSE 0.4
      END,
      'claimed', sp.claimed,
      'availability', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'type', a.type,
            'total', a.total,
            'available', a.available,
            'updated_at', a.updated_at
          )
        )
        FROM app.availability a
        WHERE a.location_id = sp.location_id
      ), '[]'::jsonb)
    )
    ORDER BY CASE
      WHEN sp.taxonomy_code = referral_info.title THEN 1.0
      WHEN sp.description ILIKE '%' || split_part(referral_info.title, ' ', 1) || '%' THEN 0.8
      WHEN referral_info.description ~* '\b(adult|adolescent|child|family|senior|veteran)s?\b' 
           AND sp.populations && ARRAY(
             SELECT unnest(regexp_split_to_array(
               regexp_replace(referral_info.description, '\b(adult|adolescent|child|family|senior|veteran)s?\b', '\1', 'gi'),
               '\s+'
             ))
           ) THEN 0.6
      ELSE 0.4
    END DESC
  ) INTO matches
  FROM app.service_profiles sp
  JOIN app.service_locations sl ON sl.id = sp.location_id
  JOIN app.organizations o ON o.id = sl.org_id
  WHERE sp.location_id != referral_info.from_location_id -- Don't match to same location
    AND (
      -- Match within network if network visibility
      referral_info.visibility_scope = 'network' OR
      -- Match publicly if public visibility
      referral_info.visibility_scope = 'public' OR
      -- Always match within same org
      o.id = user_org_id
    );

  -- Store matches for future reference
  INSERT INTO app.referral_matches (referral_id, service_profile_id, match_score, match_criteria)
  SELECT 
    p_referral_id,
    (match->>'service_profile_id')::uuid,
    (match->>'match_score')::decimal,
    jsonb_build_object(
      'taxonomy_match', (match->>'taxonomy_code' = referral_info.title),
      'description_match', (match->>'description' ILIKE '%' || split_part(referral_info.title, ' ', 1) || '%'),
      'population_match', (referral_info.description ~* '\b(adult|adolescent|child|family|senior|veteran)s?\b')
    )
  FROM jsonb_array_elements(matches) AS match
  ON CONFLICT (referral_id, service_profile_id) DO UPDATE SET
    match_score = EXCLUDED.match_score,
    match_criteria = EXCLUDED.match_criteria;

  -- Log audit entry
  INSERT INTO app.audit_logs (
    actor_user_id, action, resource_type, resource_id, decision, reason, ctx
  ) VALUES (
    current_user_id,
    'match_services',
    'referral',
    p_referral_id,
    'allow',
    'Service matching performed for referral',
    jsonb_build_object(
      'matches_found', jsonb_array_length(COALESCE(matches, '[]'::jsonb)),
      'tenant_root_id', user_org_id
    )
  );

  RETURN COALESCE(matches, '[]'::jsonb);
END;
$$;

-- Grant execute permissions on RPC functions
GRANT EXECUTE ON FUNCTION app.rpc_create_note TO authenticated;
GRANT EXECUTE ON FUNCTION app.rpc_search_notes TO authenticated;
GRANT EXECUTE ON FUNCTION app.rpc_grant_note_access TO authenticated;
GRANT EXECUTE ON FUNCTION app.rpc_create_referral TO authenticated;
GRANT EXECUTE ON FUNCTION app.rpc_search_referrals TO authenticated;
GRANT EXECUTE ON FUNCTION app.rpc_respond_to_referral TO authenticated;
GRANT EXECUTE ON FUNCTION app.rpc_match_referral_services TO authenticated;