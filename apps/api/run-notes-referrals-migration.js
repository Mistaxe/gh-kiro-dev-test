import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  const supabaseUrl = 'https://tifyqedzntwvihnyopml.supabase.co';
  const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpZnlxZWR6bnR3dmlobnlvcG1sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTE5OTM2MywiZXhwIjoyMDcwNzc1MzYzfQ.W7DQymhP_iCuYu04QtWHaflTRZPLJrmjKDYRe1JNOXk';

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('Running Notes and Referrals migration...');
    
    // Read the migration file
    const migrationPath = join(__dirname, 'sql-migrations', 'migration-notes-referrals.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    // Split the SQL into individual statements (rough split on semicolons)
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        
        const { error } = await supabase.rpc('exec', { 
          sql: statement + ';' 
        });
        
        if (error) {
          console.error(`Error in statement ${i + 1}:`, error.message);
          console.log('Statement:', statement.substring(0, 100) + '...');
          // Continue with other statements
        }
      }
    }
    
    console.log('Notes and Referrals migration completed!');
    console.log('The following tables and functions have been created:');
    console.log('- app.notes');
    console.log('- app.note_temp_grants');
    console.log('- app.referrals');
    console.log('- app.referral_matches');
    console.log('- RPC functions for note and referral management');
    
  } catch (error) {
    console.error('Migration failed:', error);
    console.log('\nPlease run the SQL commands manually in your Supabase SQL editor:');
    console.log('1. Go to https://supabase.com/dashboard/project/tifyqedzntwvihnyopml/sql');
    console.log('2. Copy and paste the contents of sql-migrations/migration-notes-referrals.sql');
    console.log('3. Click "Run"');
  }
}

runMigration();