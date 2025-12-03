/**
 * Clean up test data from the database
 *
 * This script removes all test users and their associated data.
 * Run this manually when test data accumulates in the database.
 *
 * Usage:
 *   npm run cleanup-test-data
 *
 * Or with options:
 *   npm run cleanup-test-data -- --dry-run   # Preview what would be deleted
 *   npm run cleanup-test-data -- --force     # Skip confirmation
 */

import { Pool } from 'pg';
import * as readline from 'readline';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'karmyq_db',
  user: process.env.DB_USER || 'karmyq_user',
  password: process.env.DB_PASSWORD || 'karmyq_password_dev',
});

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isForce = args.includes('--force');

async function askConfirmation(question: string): Promise<boolean> {
  if (isForce) return true;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function cleanupTestData() {
  try {
    console.log('🔍 Scanning for test data...\n');

    // Find test users
    const usersResult = await pool.query(`
      SELECT id, name, email, created_at
      FROM auth.users
      WHERE email LIKE '%@test.karmyq.com%'
      ORDER BY created_at DESC
    `);

    const testUsers = usersResult.rows;

    if (testUsers.length === 0) {
      console.log('✨ No test data found. Database is clean!');
      return;
    }

    console.log(`Found ${testUsers.length} test users:\n`);
    console.log('Recent test users:');
    testUsers.slice(0, 5).forEach((user) => {
      console.log(`  - ${user.name} (${user.email})`);
      console.log(`    Created: ${user.created_at}`);
    });

    if (testUsers.length > 5) {
      console.log(`  ... and ${testUsers.length - 5} more\n`);
    } else {
      console.log('');
    }

    // Count associated data
    const statsResult = await pool.query(`
      WITH test_user_ids AS (
        SELECT id FROM auth.users WHERE email LIKE '%@test.karmyq.com%'
      )
      SELECT
        (SELECT COUNT(*) FROM communities.communities WHERE creator_id IN (SELECT id FROM test_user_ids)) as communities,
        (SELECT COUNT(*) FROM communities.members WHERE user_id IN (SELECT id FROM test_user_ids)) as memberships,
        (SELECT COUNT(*) FROM requests.help_requests WHERE requester_id IN (SELECT id FROM test_user_ids)) as requests,
        (SELECT COUNT(*) FROM requests.matches WHERE responder_id IN (SELECT id FROM test_user_ids)) as matches,
        (SELECT COUNT(*) FROM reputation.karma_records WHERE user_id IN (SELECT id FROM test_user_ids)) as karma_records,
        (SELECT COUNT(*) FROM notifications.notifications WHERE user_id IN (SELECT id FROM test_user_ids)) as notifications,
        (SELECT COUNT(*) FROM messaging.messages WHERE sender_id IN (SELECT id FROM test_user_ids)) as messages
    `);

    const stats = statsResult.rows[0];
    console.log('Associated data to be deleted:');
    console.log(`  - ${stats.communities} communities`);
    console.log(`  - ${stats.memberships} memberships`);
    console.log(`  - ${stats.requests} help requests`);
    console.log(`  - ${stats.matches} matches`);
    console.log(`  - ${stats.karma_records} karma records`);
    console.log(`  - ${stats.notifications} notifications`);
    console.log(`  - ${stats.messages} messages`);
    console.log('');

    if (isDryRun) {
      console.log('🏃 DRY RUN - No data will be deleted');
      return;
    }

    const confirmed = await askConfirmation('⚠️  Are you sure you want to delete all this test data?');

    if (!confirmed) {
      console.log('❌ Cancelled. No data was deleted.');
      return;
    }

    console.log('\n🗑️  Deleting test data...\n');

    // Delete in order of dependencies
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete messages
      const messagesResult = await client.query(`
        DELETE FROM messaging.messages
        WHERE sender_id IN (SELECT id FROM auth.users WHERE email LIKE '%@test.karmyq.com%')
      `);
      console.log(`✓ Deleted ${messagesResult.rowCount} messages`);

      // Delete notifications
      const notificationsResult = await client.query(`
        DELETE FROM notifications.notifications
        WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@test.karmyq.com%')
      `);
      console.log(`✓ Deleted ${notificationsResult.rowCount} notifications`);

      // Delete karma records
      const karmaResult = await client.query(`
        DELETE FROM reputation.karma_records
        WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@test.karmyq.com%')
      `);
      console.log(`✓ Deleted ${karmaResult.rowCount} karma records`);

      // Delete trust scores
      const trustResult = await client.query(`
        DELETE FROM reputation.trust_scores
        WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@test.karmyq.com%')
      `);
      console.log(`✓ Deleted ${trustResult.rowCount} trust scores`);

      // Delete matches (only by responder_id, matches don't have requester_id directly)
      const matchesResult = await client.query(`
        DELETE FROM requests.matches
        WHERE responder_id IN (SELECT id FROM auth.users WHERE email LIKE '%@test.karmyq.com%')
      `);
      console.log(`✓ Deleted ${matchesResult.rowCount} matches`);

      // Delete help requests
      const requestsResult = await client.query(`
        DELETE FROM requests.help_requests
        WHERE requester_id IN (SELECT id FROM auth.users WHERE email LIKE '%@test.karmyq.com%')
      `);
      console.log(`✓ Deleted ${requestsResult.rowCount} help requests`);

      // Delete community norms
      const normsResult = await client.query(`
        DELETE FROM communities.norms
        WHERE created_by IN (SELECT id FROM auth.users WHERE email LIKE '%@test.karmyq.com%')
      `);
      console.log(`✓ Deleted ${normsResult.rowCount} community norms`);

      // Delete memberships
      const membershipsResult = await client.query(`
        DELETE FROM communities.members
        WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@test.karmyq.com%')
      `);
      console.log(`✓ Deleted ${membershipsResult.rowCount} memberships`);

      // Delete communities
      const communitiesResult = await client.query(`
        DELETE FROM communities.communities
        WHERE creator_id IN (SELECT id FROM auth.users WHERE email LIKE '%@test.karmyq.com%')
      `);
      console.log(`✓ Deleted ${communitiesResult.rowCount} communities`);

      // Delete users
      const usersDeleteResult = await client.query(`
        DELETE FROM auth.users
        WHERE email LIKE '%@test.karmyq.com%'
      `);
      console.log(`✓ Deleted ${usersDeleteResult.rowCount} users`);

      await client.query('COMMIT');
      console.log('\n✅ Test data cleanup completed successfully!');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error during cleanup:', error);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run cleanup
cleanupTestData().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
