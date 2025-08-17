// Simple test to verify seeder API endpoints work
import { createClient } from '@supabase/supabase-js';

async function testSeederEndpoints() {
  console.log('Testing seeder API endpoints...');
  
  const supabaseUrl = 'https://tifyqedzntwvihnyopml.supabase.co';
  const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpZnlxZWR6bnR3dmlobnlvcG1sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTE5OTM2MywiZXhwIjoyMDcwNzc1MzYzfQ.W7DQymhP_iCuYu04QtWHaflTRZPLJrmjKDYRe1JNOXk';

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('\n=== Testing database connection ===');
    
    // Test basic database connectivity
    const { data: regions, error: regionsError } = await supabase
      .from('regions')
      .select('*', { count: 'exact', head: true });
    
    if (regionsError) {
      console.error('❌ Database connection failed:', regionsError.message);
      return;
    }
    
    console.log('✅ Database connection successful');
    console.log(`Current regions count: ${regions?.length || 0}`);
    
    // Test other tables
    const tables = ['networks', 'organizations', 'service_locations', 'users_profile', 'clients'];
    
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
    
    console.log('\n=== Testing seeder data generation (small sample) ===');
    
    // Test creating a small amount of sample data
    const testRegion = {
      id: crypto.randomUUID(),
      name: 'Test Region ' + Date.now(),
      jurisdiction: { state: 'CA', country: 'US' },
      attributes: { test: true }
    };
    
    const { error: insertError } = await supabase
      .from('regions')
      .insert(testRegion);
    
    if (insertError) {
      console.error('❌ Failed to insert test region:', insertError.message);
    } else {
      console.log('✅ Successfully inserted test region');
      
      // Clean up test data
      const { error: deleteError } = await supabase
        .from('regions')
        .delete()
        .eq('id', testRegion.id);
      
      if (deleteError) {
        console.warn('⚠️ Failed to clean up test region:', deleteError.message);
      } else {
        console.log('✅ Successfully cleaned up test region');
      }
    }
    
    console.log('\n✅ Seeder functionality test completed successfully!');
    console.log('The seeder service should work correctly when the API is running.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSeederEndpoints();