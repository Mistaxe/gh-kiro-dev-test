-- Migration: Base Tables First
-- Run this BEFORE the service registry migration to ensure all base tables exist

-- Create app schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS app;

-- Create users_profile table if it doesn't exist
CREATE TABLE IF NOT EXISTS app.users_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE NOT NULL,
  email text NOT NULL,
  display_name text,
  phone text,
  is_helper boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create regions table if it doesn't exist
CREATE TABLE IF NOT EXISTS app.regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  jurisdiction jsonb DEFAULT '{}'::jsonb,
  attributes jsonb DEFAULT '{}'::jsonb
);

-- Create networks table if it doesn't exist
CREATE TABLE IF NOT EXISTS app.networks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id uuid REFERENCES app.regions(id) ON DELETE SET NULL,
  name text NOT NULL,
  attributes jsonb DEFAULT '{}'::jsonb
);

-- Create organizations table if it doesn't exist
CREATE TABLE IF NOT EXISTS app.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id uuid REFERENCES app.regions(id) ON DELETE SET NULL,
  name text NOT NULL,
  org_type text,
  dba text,
  tenant_root_id uuid,
  attributes jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Ensure tenant_root_id is set to id if null
UPDATE app.organizations SET tenant_root_id = id WHERE tenant_root_id IS NULL;

-- Create service_locations table if it doesn't exist
CREATE TABLE IF NOT EXISTS app.service_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  claimed boolean DEFAULT false,
  claim_owner_user_id uuid REFERENCES app.users_profile(id),
  attributes jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create roles table if it doesn't exist
CREATE TABLE IF NOT EXISTS app.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  scope_type text NOT NULL,
  description text,
  baseline_permissions jsonb DEFAULT '{}'::jsonb
);

-- Create role_assignments table if it doesn't exist
CREATE TABLE IF NOT EXISTS app.role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.users_profile(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES app.roles(id),
  scope_type text NOT NULL,
  scope_id uuid NOT NULL,
  source text,
  expires_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role_id, scope_type, scope_id)
);

-- Create current_profile_id function if it doesn't exist
CREATE OR REPLACE FUNCTION app.current_profile_id()
RETURNS uuid
LANGUAGE sql STABLE 
AS $$
  SELECT id FROM app.users_profile WHERE auth_user_id = auth.uid()
$$;

-- Create audit_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS app.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz DEFAULT now(),
  actor_user_id uuid REFERENCES app.users_profile(id),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  decision text NOT NULL CHECK (decision IN ('allow', 'deny')),
  reason text,
  ctx jsonb DEFAULT '{}'::jsonb,
  policy_version text,
  correlation_id text
);

-- Create basic indexes
CREATE INDEX IF NOT EXISTS users_profile_auth_user_id_idx ON app.users_profile(auth_user_id);
CREATE INDEX IF NOT EXISTS role_assignments_user_id_idx ON app.role_assignments(user_id);
CREATE INDEX IF NOT EXISTS role_assignments_scope_idx ON app.role_assignments(scope_type, scope_id);
CREATE INDEX IF NOT EXISTS organizations_tenant_root_id_idx ON app.organizations(tenant_root_id);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON app.audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS audit_logs_resource_idx ON app.audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS audit_logs_ts_idx ON app.audit_logs(ts);