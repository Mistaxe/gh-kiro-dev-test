-- Check if referral table has all required columns for the API
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'referrals' AND column_name = 'title') 
    THEN 'EXISTS' ELSE 'MISSING' 
  END as title_column,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'referrals' AND column_name = 'description') 
    THEN 'EXISTS' ELSE 'MISSING' 
  END as description_column,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'referrals' AND column_name = 'urgency') 
    THEN 'EXISTS' ELSE 'MISSING' 
  END as urgency_column,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'referrals' AND column_name = 'referral_type') 
    THEN 'EXISTS' ELSE 'MISSING' 
  END as referral_type_column,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'referrals' AND column_name = 'consent_id') 
    THEN 'EXISTS' ELSE 'MISSING' 
  END as consent_id_column;