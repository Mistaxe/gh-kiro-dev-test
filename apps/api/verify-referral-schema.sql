-- Verify the referrals table now has all required columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'app' 
AND table_name = 'referrals'
AND column_name IN ('title', 'description', 'urgency', 'referral_type', 'consent_id')
ORDER BY column_name;

-- Check if the RPC functions we need exist and work
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_schema = 'app' 
AND routine_name IN (
  'rpc_create_referral',
  'rpc_search_referrals', 
  'rpc_respond_to_referral',
  'rpc_match_referral_services'
);