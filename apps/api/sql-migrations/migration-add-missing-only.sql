-- Migration: Add only missing columns and functions
-- This assumes tables already exist and just adds what's missing

-- Add missing columns to service_profiles if they don't exist
ALTER TABLE app.service_profiles 
ADD COLUMN IF NOT EXISTS taxonomy_code text;

ALTER TABLE app.service_profiles 
ADD COLUMN IF NOT EXISTS populations text[] DEFAULT '{}';

ALTER TABLE app.service_profiles 
ADD COLUMN IF NOT EXISTS eligibility jsonb DEFAULT '{}'::jsonb;

ALTER TABLE app.service_profiles 
ADD COLUMN IF NOT EXISTS hours jsonb DEFAULT '{}'::jsonb;

ALTER TABLE app.service_profiles 
ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE app.service_profiles 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

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

-- Add missing columns to availability if they don't exist
ALTER TABLE app.availability 
ADD COLUMN IF NOT EXISTS type text;

ALTER TABLE app.availability 
ADD COLUMN IF NOT EXISTS attributes jsonb DEFAULT '{}'::jsonb;

ALTER TABLE app.availability 
ADD COLUMN IF NOT EXISTS total int DEFAULT 0;

ALTER TABLE app.availability 
ADD COLUMN IF NOT EXISTS available int DEFAULT 0;

ALTER TABLE app.availability 
ADD COLUMN IF NOT EXISTS version bigint DEFAULT 1;

ALTER TABLE app.availability 
ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES app.users_profile(id);

ALTER TABLE app.availability 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE app.availability 
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Add constraints if they don't exist (these will fail silently if they already exist)
DO $$ 
BEGIN
    -- Add check constraint for populations
    ALTER TABLE app.service_profiles 
    ADD CONSTRAINT service_profiles_populations_check 
    CHECK (populations <@ ARRAY['adults', 'adolescents', 'children', 'families', 'seniors', 'veterans']);
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

-- Create indexes (these will be ignored if they already exist)
CREATE INDEX IF NOT EXISTS service_profiles_location_idx ON app.service_profiles(location_id);
CREATE INDEX IF NOT EXISTS service_profiles_claimed_idx ON app.service_profiles(claimed);
CREATE INDEX IF NOT EXISTS service_profiles_search_idx ON app.service_profiles USING gin(search_vector);
CREATE INDEX IF NOT EXISTS service_profiles_eligibility_idx ON app.service_profiles USING gin(eligibility);
CREATE INDEX IF NOT EXISTS service_profiles_populations_idx ON app.service_profiles USING gin(populations);

CREATE INDEX IF NOT EXISTS availability_location_type_idx ON app.availability(location_id, type);
CREATE INDEX IF NOT EXISTS availability_attributes_idx ON app.availability USING gin(attributes);
CREATE INDEX IF NOT EXISTS availability_version_idx ON app.availability(version);
CREATE INDEX IF NOT EXISTS availability_updated_at_idx ON app.availability(updated_at);