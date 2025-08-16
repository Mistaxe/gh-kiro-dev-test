# Service Registry Migration Instructions

To apply the Service Registry and Availability System changes to your Supabase database, run these files **in order** through the Supabase SQL Editor:

## Step 0: Check Current State (Optional)
Copy and paste the contents of `diagnostic-check.sql` into the Supabase SQL Editor and run it to see what currently exists in your database.

## Step 1: Create Base Tables
Copy and paste the contents of `migration-base-tables.sql` into the Supabase SQL Editor and run it first. This ensures all required base tables exist.

## Step 2: Create Service Registry Tables
Copy and paste the contents of `migration-service-registry.sql` into the Supabase SQL Editor and run it.

This creates:
- `app.service_profiles` table
- `app.availability` table  
- `app.availability_summary` materialized view
- All necessary indexes
- Search vector update function and trigger

## Step 2: Create Service Profile Functions
Copy and paste the contents of `migration-service-registry-functions.sql` into the Supabase SQL Editor and run it.

This creates:
- `app.rpc_create_service_profile` function

## Step 3: Create Availability Functions
Copy and paste the contents of `migration-availability-functions.sql` into the Supabase SQL Editor and run it.

This creates:
- `app.rpc_create_availability` function
- Grants permissions for the functions

## Step 4: Verify Installation
After running all three files, you can verify the installation by running this query:

```sql
-- Check that tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'app' 
AND table_name IN ('service_profiles', 'availability');

-- Check that functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'app' 
AND routine_name LIKE 'rpc_%service%' OR routine_name LIKE 'rpc_%availability%';
```

## Notes:
- The migration files use standard PostgreSQL syntax without dollar-quoting to avoid Supabase SQL Editor issues
- Each file should run without errors
- If you get permission errors, make sure you're running as the database owner
- The materialized view will be empty initially until you create availability records

## What This Enables:
Once these migrations are complete, your API will be able to:
- Create and manage service profiles with full-text search
- Track availability with optimistic concurrency control
- Match client needs with available services
- Generate availability summaries and reports