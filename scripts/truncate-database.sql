-- Truncate All Database Tables
-- WARNING: This will DELETE ALL DATA from the database
-- Use with caution - only for development/testing environments

\echo ''
\echo '🗑️  Truncating all tables...'
\echo ''

-- Disable triggers temporarily to avoid constraint issues
SET session_replication_role = 'replica';

-- SOCIAL GRAPH TABLES (newest, truncate first)
TRUNCATE TABLE auth.social_distances CASCADE;
TRUNCATE TABLE auth.user_invitations CASCADE;
TRUNCATE TABLE auth.inviter_stats CASCADE;

\echo '✓ Social graph tables truncated'

-- MESSAGING TABLES
TRUNCATE TABLE messaging.messages CASCADE;
TRUNCATE TABLE messaging.conversations CASCADE;
TRUNCATE TABLE messaging.conversation_participants CASCADE;

\echo '✓ Messaging tables truncated'

-- NOTIFICATIONS TABLES
TRUNCATE TABLE notifications.notifications CASCADE;
TRUNCATE TABLE notifications.preferences CASCADE;
TRUNCATE TABLE notifications.global_preferences CASCADE;

\echo '✓ Notifications tables truncated'

-- REPUTATION TABLES
TRUNCATE TABLE reputation.karma_records CASCADE;
TRUNCATE TABLE reputation.trust_scores CASCADE;
-- TRUNCATE TABLE reputation.badges CASCADE; -- Commented out if table doesn't exist yet

\echo '✓ Reputation tables truncated'

-- FEED TABLES
TRUNCATE TABLE feed.dismissed_items CASCADE;
TRUNCATE TABLE feed.preferences CASCADE;

\echo '✓ Feed tables truncated'

-- REQUESTS TABLES
TRUNCATE TABLE requests.feedback CASCADE;
TRUNCATE TABLE requests.matches CASCADE;
TRUNCATE TABLE requests.offers CASCADE;
TRUNCATE TABLE requests.help_requests CASCADE;

\echo '✓ Requests tables truncated'

-- COMMUNITY TABLES
TRUNCATE TABLE communities.members CASCADE;
TRUNCATE TABLE communities.communities CASCADE;

\echo '✓ Community tables truncated'

-- AUTH TABLES (last, due to foreign keys)
TRUNCATE TABLE auth.sessions CASCADE;
TRUNCATE TABLE auth.users CASCADE;

\echo '✓ Auth tables truncated'

-- Re-enable triggers
SET session_replication_role = 'origin';

-- Reset sequences to start from 1 (for any SERIAL columns)
-- Note: Most tables use UUIDs, so this may not be necessary

\echo ''
\echo '✅ All tables truncated successfully!'
\echo ''
\echo 'Database is now empty and ready for fresh data.'
\echo 'Run seed scripts to populate with test data:'
\echo '  - scripts/seed-test-data.sql (small test dataset)'
\echo '  - scripts/seed-realistic-data.sql (large realistic dataset)'
\echo ''
