import { DataSeeder } from './src/services/seeder.js';

async function testSeeder() {
  console.log('Testing seeder functionality...');
  
  const config = {
    supabaseUrl: 'https://tifyqedzntwvihnyopml.supabase.co',
    supabaseServiceKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpZnlxZWR6bnR3dmlobnlvcG1sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTE5OTM2MywiZXhwIjoyMDcwNzc1MzYzfQ.W7DQymhP_iCuYu04QtWHaflTRZPLJrmjKDYRe1JNOXk',
    regions: 2,
    networksPerRegion: 1,
    orgsPerNetwork: 2,
    locationsPerOrg: 1,
    usersPerOrg: 3,
    clientsPerOrg: 5,
    casesPerClient: 1,
    availabilityPerLocation: 2,
    referralsPerOrg: 2
  };
  
  const seeder = new DataSeeder(config, (progress) => {
    console.log(`[${progress.step}] ${progress.current}/${progress.total} - ${progress.message}`);
  });
  
  try {
    // Test validation first
    console.log('\n=== Testing validation ===');
    const initialStatus = await seeder.validateSeededData();
    console.log('Initial data counts:', initialStatus);
    
    // Test seeding
    console.log('\n=== Testing seeding ===');
    await seeder.seedAll();
    
    // Validate after seeding
    console.log('\n=== Validating after seeding ===');
    const finalStatus = await seeder.validateSeededData();
    console.log('Final data counts:', finalStatus);
    
    console.log('\n✅ Seeder test completed successfully!');
    
  } catch (error) {
    console.error('❌ Seeder test failed:', error);
  }
}

testSeeder();