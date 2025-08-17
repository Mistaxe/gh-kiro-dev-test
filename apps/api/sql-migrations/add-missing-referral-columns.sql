-- Migration: Add missing columns to referrals table for complete referral workflow
-- This adds the columns required by the API that are missing from the current schema

-- Add missing columns to referrals table
ALTER TABLE app.referrals 
ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT 'Referral',
ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS urgency text NOT NULL DEFAULT 'routine' CHECK (urgency IN ('routine', 'urgent', 'emergency')),
ADD COLUMN IF NOT EXISTS referral_type text NOT NULL DEFAULT 'direct' CHECK (referral_type IN ('direct', 'record_keeping')),
ADD COLUMN IF NOT EXISTS consent_id uuid REFERENCES app.client_consents(id);

-- Update the constraint to ensure PHI referrals have consent when required
ALTER TABLE app.referrals DROP CONSTRAINT IF EXISTS referrals_phi_consent_check;
ALTER TABLE app.referrals ADD CONSTRAINT referrals_phi_consent_check 
CHECK ((contains_phi = false) OR (contains_phi = true AND (client_id IS NULL OR consent_id IS NOT NULL)));

-- Update the constraint to ensure from and to locations are different  
ALTER TABLE app.referrals DROP CONSTRAINT IF EXISTS referrals_different_locations_check;
ALTER TABLE app.referrals ADD CONSTRAINT referrals_different_locations_check 
CHECK (from_location_id != to_location_id);

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS referrals_urgency_idx ON app.referrals(urgency);
CREATE INDEX IF NOT EXISTS referrals_type_idx ON app.referrals(referral_type);
CREATE INDEX IF NOT EXISTS referrals_consent_idx ON app.referrals(consent_id) WHERE consent_id IS NOT NULL;

-- Update the PHI detection function to work with the new columns
CREATE OR REPLACE FUNCTION app.detect_referral_phi(
  p_title text,
  p_description text,
  p_client_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
AS $
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
$;

-- Update the PHI detection trigger to work with new columns
CREATE OR REPLACE FUNCTION app.update_referral_phi_detection()
RETURNS trigger
LANGUAGE plpgsql
AS $
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
$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS referral_phi_detection_trigger ON app.referrals;
CREATE TRIGGER referral_phi_detection_trigger
  BEFORE INSERT OR UPDATE ON app.referrals
  FOR EACH ROW EXECUTE FUNCTION app.update_referral_phi_detection();

-- Update existing referrals to have default values for new columns (if any exist)
UPDATE app.referrals 
SET 
  title = COALESCE(title, 'Referral'),
  description = COALESCE(description, 'Referral request'),
  urgency = COALESCE(urgency, 'routine'),
  referral_type = COALESCE(referral_type, 'direct')
WHERE title IS NULL OR description IS NULL OR urgency IS NULL OR referral_type IS NULL;