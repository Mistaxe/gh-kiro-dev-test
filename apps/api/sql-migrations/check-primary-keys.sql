-- Check what primary keys exist
SELECT 
    tc.table_name, 
    kcu.column_name,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'app' 
    AND tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_name IN ('service_profiles', 'availability')
ORDER BY tc.table_name, kcu.ordinal_position;