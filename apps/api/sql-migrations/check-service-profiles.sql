-- Check what columns exist in service_profiles table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'app' 
AND table_name = 'service_profiles'
ORDER BY ordinal_position;

-- Check what columns exist in availability table  
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'app' 
AND table_name = 'availability'
ORDER BY ordinal_position;