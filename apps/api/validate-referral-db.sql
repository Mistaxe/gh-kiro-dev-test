-- Validation queries for referral database schema
-- Check that referral tables and functions exist

-- Check that referral tables exist
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'app' 
AND table_name IN ('referrals', 'referral_matches');

-- Check that referral RPC functions exist
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_schema = 'app' 
AND routine_name LIKE '%referral%';

-- Check referral table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'app' 
AND table_name = 'referrals'
ORDER BY ordinal_position;

-- Check referral_matches table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'app' 
AND table_name = 'referral_matches'
ORDER BY ordinal_position;

-- Check for referral indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'app'
AND tablename IN ('referrals', 'referral_matches');