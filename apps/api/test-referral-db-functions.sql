-- Test referral database functions
-- Run these queries to verify the RPC functions work

-- Check that all referral RPC functions exist
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_schema = 'app' 
AND routine_name LIKE '%referral%'
ORDER BY routine_name;

-- Test the PHI detection function
SELECT app.detect_referral_phi(
  'Mental Health Referral',
  'Client John Doe needs treatment for depression and anxiety. Contact at john.doe@email.com or 555-123-4567',
  '12345678-90ab-cdef-1234-567890abcdef'::uuid
) as phi_detection_result;

-- Check referrals table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'app' 
AND table_name = 'referrals'
ORDER BY ordinal_position;