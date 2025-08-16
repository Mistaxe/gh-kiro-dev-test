# Notes and Referrals Migration Instructions

To apply the Notes and Referrals System changes to your Supabase database, follow these steps:

## Step 1: Run the Migration
1. Go to your Supabase SQL Editor: https://supabase.com/dashboard/project/tifyqedzntwvihnyopml/sql
2. Copy and paste the entire contents of `migration-notes-referrals.sql` into the SQL Editor
3. Click "Run" to execute the migration

## What This Migration Creates:

### Tables:
- **`app.notes`** - Note management with helper vs provider classification
  - Supports standard, confidential, and helper_journal classifications
  - Full-text search capabilities with tsvector
  - PHI detection and consent integration
  - Audit trail with author tracking

- **`app.note_temp_grants`** - Temporary access grants for confidential notes
  - Time-limited access with expiration
  - Reason tracking for audit purposes
  - One grant per user per note

- **`app.referrals`** - Referral workflow management
  - Direct vs record-keeping referral types
  - PHI detection and consent validation
  - Visibility scope controls (organization, network, public)
  - Status tracking (pending, accepted, declined, completed, cancelled)

- **`app.referral_matches`** - Service matching for referrals
  - Match scoring and criteria tracking
  - Links referrals to service profiles

### Functions:
- **`app.rpc_create_note`** - Create notes with proper classification
- **`app.rpc_search_notes`** - Search notes with authorization filtering
- **`app.rpc_grant_note_access`** - Grant temporary access to confidential notes
- **`app.rpc_create_referral`** - Create referrals with PHI detection
- **`app.rpc_search_referrals`** - Search referrals with visibility controls
- **`app.rpc_respond_to_referral`** - Accept/decline referrals
- **`app.rpc_match_referral_services`** - Match referrals to services

### Triggers:
- **Note search vector updates** - Automatically maintains full-text search
- **Referral PHI detection** - Automatically detects PHI in referral content

## Key Features Implemented:

### Note Management:
- ✅ Helper vs provider classification
- ✅ Confidential note access with temporary grants
- ✅ Helper journal separation from provider case notes
- ✅ Note search and filtering with authorization
- ✅ Provider note queries exclude helper journals by default
- ✅ Access to confidential notes requires temporary grant or explicit policy

### Referral Workflow:
- ✅ Direct vs record-keeping referral types
- ✅ PHI detection and consent validation for referrals
- ✅ Visibility scope controls and status tracking
- ✅ Referral search and matching functionality
- ✅ Service profile matching with scoring

## Verification:
After running the migration, you can verify it worked by running:

```sql
-- Check that tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'app' 
AND table_name IN ('notes', 'note_temp_grants', 'referrals', 'referral_matches');

-- Check that functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'app' 
AND routine_name LIKE 'rpc_%note%' OR routine_name LIKE 'rpc_%referral%';
```

## API Endpoints Available:
Once the migration is complete, the following API endpoints will be available:

### Notes:
- `POST /api/notes` - Create note
- `GET /api/notes/search` - Search notes
- `GET /api/notes/:id` - Get specific note
- `PUT /api/notes/:id` - Update note (author only)
- `DELETE /api/notes/:id` - Delete note (author only)
- `POST /api/notes/:id/grant-access` - Grant temporary access
- `GET /api/notes/subject/:type/:id` - Get notes for subject
- `GET /api/notes/my-recent` - Get user's recent notes

### Referrals:
- `POST /api/referrals` - Create referral
- `GET /api/referrals/search` - Search referrals
- `GET /api/referrals/:id` - Get specific referral
- `PUT /api/referrals/:id` - Update referral (creator only)
- `POST /api/referrals/:id/respond` - Accept/decline referral
- `POST /api/referrals/:id/cancel` - Cancel referral
- `GET /api/referrals/:id/match-services` - Match services
- `GET /api/referrals/sent` - Get sent referrals
- `GET /api/referrals/received` - Get received referrals
- `GET /api/referrals/stats` - Get referral statistics