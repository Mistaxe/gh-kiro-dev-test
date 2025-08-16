-- Migration: Add missing columns to existing tables
-- This adds only the columns that are missing from the existing tables

-- Fix service_profiles table - add missing columns
-- The existing table uses location_id as primary key, but we need id as primary key
-- First add the id column, then we'll need to change the primary key

ALTER TABLE app.service_profiles 
ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

-- Make sure all existing rows have an id
UPDATE app.service_profiles SET id = gen_random_uuid() WHERE id IS NULL;

-- Make id column not null
ALTER TABLE app.service_profiles ALTER COLUMN id SET NOT NULL;

-- Drop the old primary key constraint and create new one
DO $$ 
BEGIN
    -- Drop the existing primary key on location_id
    ALTER TABLE app.service_profiles DROP CONSTRAINT service_profiles_pkey;
    
    -- Add new primary key on id
    ALTER TABLE app.service_profiles ADD PRIMARY KEY (id);
    
    -- Create index on location_id since it's no longer primary key but still important
    CREATE INDEX IF NOT EXISTS service_profiles_location_id_idx ON app.service_profiles(location_id);
EXCEPTION
    WHEN OTHERS THEN 
        -- If this fails, just continue - the table might already be in the right state
        RAISE NOTICE 'Primary key change failed or already applied: %', SQLERRM;
END $$;

ALTER TABLE app.service_profiles 
ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE app.service_profiles 
ADD COLUMN IF NOT EXISTS claimed boolean DEFAULT false;

ALTER TABLE app.service_profiles 
ADD COLUMN IF NOT EXISTS claim_owner_user_id uuid REFERENCES app.users_profile(id);

ALTER TABLE app.service_profiles 
ADD COLUMN IF NOT EXISTS curator_notes text;

ALTER TABLE app.service_profiles 
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE app.service_profiles 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Fix availability table - add missing columns
ALTER TABLE app.availability 
ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1;

ALTER TABLE app.availability 
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Add constraints that might be missing
DO $$ 
BEGIN
    -- Add check constraint for service profiles claimed logic
    ALTER TABLE app.service_profiles 
    ADD CONSTRAINT service_profiles_claimed_owner_check 
    CHECK ((claimed = false AND claim_owner_user_id IS NULL) OR (claimed = true AND claim_owner_user_id IS NOT NULL));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
    -- Add check constraint for availability type
    ALTER TABLE app.availability 
    ADD CONSTRAINT availability_type_check 
    CHECK (type IN ('beds', 'slots', 'appointments'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
    -- Add check constraint for availability totals
    ALTER TABLE app.availability 
    ADD CONSTRAINT availability_totals_check 
    CHECK (total >= 0 AND available >= 0 AND available <= total);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
    -- Add unique constraint for availability
    ALTER TABLE app.availability 
    ADD CONSTRAINT availability_location_type_attributes_unique 
    UNIQUE(location_id, type, attributes);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create missing indexes
-- id is now the primary key, so no need for separate index
CREATE INDEX IF NOT EXISTS service_profiles_location_idx ON app.service_profiles(location_id);
CREATE INDEX IF NOT EXISTS service_profiles_claimed_idx ON app.service_profiles(claimed);
CREATE INDEX IF NOT EXISTS service_profiles_search_idx ON app.service_profiles USING gin(search_vector);
CREATE INDEX IF NOT EXISTS service_profiles_eligibility_idx ON app.service_profiles USING gin(eligibility);
CREATE INDEX IF NOT EXISTS service_profiles_populations_idx ON app.service_profiles USING gin(populations);

CREATE INDEX IF NOT EXISTS availability_location_type_idx ON app.availability(location_id, type);
CREATE INDEX IF NOT EXISTS availability_attributes_idx ON app.availability USING gin(attributes);
CREATE INDEX IF NOT EXISTS availability_version_idx ON app.availability(version);
CREATE INDEX IF NOT EXISTS availability_updated_at_idx ON app.availability(updated_at);

-- Create the materialized view for availability summary
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

-- Create the search vector update function
CREATE OR REPLACE FUNCTION app.update_service_profile_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', 
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.taxonomy_code, '') || ' ' ||
    coalesce(array_to_string(ARRAY(SELECT jsonb_array_elements_text(NEW.populations)), ' '), '') || ' ' ||
    coalesce((SELECT name FROM app.service_locations WHERE id = NEW.location_id), '')
  );
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Create the trigger for search vector updates
DROP TRIGGER IF EXISTS service_profile_search_vector_trigger ON app.service_profiles;
CREATE TRIGGER service_profile_search_vector_trigger
  BEFORE INSERT OR UPDATE ON app.service_profiles
  FOR EACH ROW EXECUTE FUNCTION app.update_service_profile_search_vector();