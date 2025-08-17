-- Validate existing database structure for seeder implementation
-- Check for required tables and functions

-- Check core tenancy tables
SELECT 'regions' as table_name, count(*) as row_count FROM app.regions
UNION ALL
SELECT 'networks', count(*) FROM app.networks
UNION ALL
SELECT 'organizations', count(*) FROM app.organizations
UNION ALL
SELECT 'service_locations', count(*) FROM app.service_locations;

-- Check user and role tables
SELECT 'users_profile' as table_name, count(*) as row_count FROM app.users_profile
UNION ALL
SELECT 'roles', count(*) FROM app.roles
UNION ALL
SELECT 'role_assignments', count(*) FROM app.role_assignments;

-- Check client and case tables
SELECT 'clients' as table_name, count(*) as row_count FROM app.clients
UNION ALL
SELECT 'client_cases', count(*) FROM app.client_cases
UNION ALL
SELECT 'client_consents', count(*) FROM app.client_consents;

-- Check availability and referral tables
SELECT 'availability' as table_name, count(*) as row_count FROM app.availability
UNION ALL
SELECT 'referrals', count(*) FROM app.referrals
UNION ALL
SELECT 'notes', count(*) FROM app.notes;

-- Check for existing seeder-related functions
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'app' 
AND routine_name LIKE '%seed%'
ORDER BY routine_name;

-- Check table schemas for key columns
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'app'
AND table_name IN ('regions', 'networks', 'organizations', 'service_locations', 'users_profile', 'clients', 'client_cases', 'availability', 'referrals')
ORDER BY table_name, ordinal_position;