-- Diagnostic queries to check current database state
-- Run this first to see what exists in your database

-- Check what tables exist in the app schema
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'app' 
ORDER BY table_name;

-- Check columns in service_locations table (if it exists)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'app' 
AND table_name = 'service_locations'
ORDER BY ordinal_position;

-- Check columns in organizations table (if it exists)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'app' 
AND table_name = 'organizations'
ORDER BY ordinal_position;

-- Check what functions exist
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_schema = 'app'
ORDER BY routine_name;