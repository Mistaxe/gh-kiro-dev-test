import { createClient } from '@supabase/supabase-js';

async function validateDatabase() {
  const supabaseUrl = 'https://tifyqedzntwvihnyopml.supabase.co';
  const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpZnlxZWR6bnR3dmlobnlvcG1sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTE5OTM2MywiZXhwIjoyMDcwNzc1MzYzfQ.W7DQymhP_iCuYu04QtWHaflTRZPLJrmjKDYRe1JNOXk';

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('Validating database structure for seeder...\n');
    
    // Check core tenancy tables
    const tables = ['regions', 'networks', 'organizations', 'service_locations', 'users_profile', 'roles', 'role_assignments', 'clients', 'client_cases', 'client_consents', 'availability', 'referrals', 'notes'];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          console.log(`❌ Table ${table}: ${error.message}`);
        } else {
          console.log(`✅ Table ${table}: ${data?.length || 0} rows`);
        }
      } catch (err) {
        console.log(`❌ Table ${table}: ${err.message}`);
      }
    }
    
    // Check for existing seeder functions
    console.log('\nChecking for existing seeder functions...');
    const { data: functions, error: funcError } = await supabase.rpc('exec', {
      sql: `
        SELECT routine_name, routine_type 
        FROM information_schema.routines 
        WHERE routine_schema = 'app' 
        AND routine_name LIKE '%seed%'
        ORDER BY routine_name;
      `
    });
    
    if (funcError) {
      console.log('❌ Could not check functions:', funcError.message);
    } else {
      console.log('Seeder functions found:', functions || 'None');
    }
    
  } catch (error) {
    console.error('Validation failed:', error);
  }
}

validateDatabase();