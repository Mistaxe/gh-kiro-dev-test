import { createClient } from '@supabase/supabase-js';

async function setupDatabase() {
  const supabaseUrl = 'https://tifyqedzntwvihnyopml.supabase.co';
  const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpZnlxZWR6bnR3dmlobnlvcG1sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTE5OTM2MywiZXhwIjoyMDcwNzc1MzYzfQ.W7DQymhP_iCuYu04QtWHaflTRZPLJrmjKDYRe1JNOXk';

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('Setting up database schema...');
    
    // Create schema
    await supabase.rpc('exec', { sql: 'create schema if not exists app;' });
    
    // Create users_profile table
    const { error: usersError } = await supabase.rpc('exec', {
      sql: `
        create table if not exists app.users_profile (
          id uuid primary key default gen_random_uuid(),
          auth_user_id uuid unique not null,
          email text not null,
          display_name text,
          phone text,
          is_helper boolean default false,
          created_at timestamptz default now(),
          updated_at timestamptz default now()
        );
      `
    });
    
    if (usersError) {
      console.log('Users table might already exist:', usersError.message);
    }
    
    console.log('Database setup completed!');
    console.log('You can now start the API server with: npm run dev');
    
  } catch (error) {
    console.error('Setup failed:', error);
    console.log('\nPlease run the SQL commands manually in your Supabase SQL editor:');
    console.log('1. Go to https://supabase.com/dashboard/project/tifyqedzntwvihnyopml/sql');
    console.log('2. Copy and paste the contents of setup-database.sql');
    console.log('3. Click "Run"');
  }
}

setupDatabase();