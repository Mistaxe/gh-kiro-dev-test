-- Migration: Service Registry and Availability System
-- Run migration-base-tables.sql FIRST, then run this file

-- This file adds the service registry specific tables and functions

-- Service Profiles Table
CREATE TABLE IF NOT EXISTS app.service_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES app.service_locations(id) ON DELETE CASCADE,
  taxonomy_code text,
  populations text[] DEFAULT '{}' CHECK (
    populations <@ ARRAY['adults', 'adolescents', 'children', 'families', 'seniors', 'veterans']
  ),
  eligibility jsonb DEFAULT '{}'::jsonb,
  hours jsonb DEFAULT '{}'::jsonb,
  description text,
  search_vector tsvector,
  claimed boolean DEFAULT false,
  claim_owner_user_id uuid REFERENCES app.users_profile(id),
  curator_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure claimed profiles have an owner
  CHECK ((claimed = false AND claim_owner_user_id IS NULL) OR (claimed = true AND claim_owner_user_id IS NOT NULL))
);

-- Availability Table
CREATE TABLE IF NOT EXISTS app.availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES app.service_locations(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('beds', 'slots', 'appointments')),
  attributes jsonb DEFAULT '{}'::jsonb,
  total int NOT NULL DEFAULT 0 CHECK (total >= 0),
  available int NOT NULL DEFAULT 0 CHECK (available >= 0 AND available <= total),
  version bigint NOT NULL DEFAULT 1,
  updated_by uuid NOT NULL REFERENCES app.users_profile(id),
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(location_id, type, attributes)
);

-- Availability Summary Materialized View
CREATE MATERIALIZED VIEW IF NOT EXISTS app.availability_summary AS
SELECT 
  sl.org_id,
  sl.id as location_id,
  sl.name as location_name,
  a.type,
  sum(a.total) as total_capacity,
  sum(a.available) as total_available,
  count(*) as availability_records,
  max(a.updated_at) as last_updated
FROM app.service_locations sl
LEFT JOIN app.availability a ON a.location_id = sl.id
GROUP BY sl.org_id, sl.id, sl.name, a.type;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS service_profiles_location_idx ON app.service_profiles(location_id);
CREATE INDEX IF NOT EXISTS service_profiles_claimed_idx ON app.service_profiles(claimed);
CREATE INDEX IF NOT EXISTS service_profiles_search_idx ON app.service_profiles USING gin(search_vector);
CREATE INDEX IF NOT EXISTS service_profiles_eligibility_idx ON app.service_profiles USING gin(eligibility);
CREATE INDEX IF NOT EXISTS service_profiles_populations_idx ON app.service_profiles USING gin(populations);

CREATE INDEX IF NOT EXISTS availability_location_type_idx ON app.availability(location_id, type);
CREATE INDEX IF NOT EXISTS availability_attributes_idx ON app.availability USING gin(attributes);
CREATE INDEX IF NOT EXISTS availability_version_idx ON app.availability(version);
CREATE INDEX IF NOT EXISTS availability_updated_at_idx ON app.availability(updated_at);

-- Function to update search vector automatically
CREATE OR REPLACE FUNCTION app.update_service_profile_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', 
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.taxonomy_code, '') || ' ' ||
    coalesce(array_to_string(NEW.populations, ' '), '') || ' ' ||
    coalesce((SELECT name FROM app.service_locations WHERE id = NEW.location_id), '')
  );
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Trigger to automatically update search vector
DROP TRIGGER IF EXISTS service_profile_search_vector_trigger ON app.service_profiles;
CREATE TRIGGER service_profile_search_vector_trigger
  BEFORE INSERT OR UPDATE ON app.service_profiles
  FOR EACH ROW EXECUTE FUNCTION app.update_service_profile_search_vector();