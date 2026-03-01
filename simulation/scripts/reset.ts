/**
 * reset.ts — Wipe all @test.karmyq.com simulation data
 *
 * Safe to run at any time. Deletes only rows linked to test user emails.
 * The deletion order respects FK constraints:
 *   1. communities (creator_id has no CASCADE — must delete before users)
 *   2. auth.users (cascades sessions, invitations, inviter_stats, reputation, etc.)
 *
 * Usage: npx ts-node simulation/scripts/reset.ts
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const TEST_EMAIL_DOMAIN = '@test.karmyq.com';

async function reset() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log('🧹 Karmyq Simulation Reset');
  console.log('  Domain:', TEST_EMAIL_DOMAIN);
  console.log('  Database:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'));
  console.log('');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get test user IDs first
    const usersResult = await client.query(
      `SELECT id, email FROM auth.users WHERE email LIKE $1`,
      [`%${TEST_EMAIL_DOMAIN}`]
    );
    const testUserIds = usersResult.rows.map(r => r.id);
    const testEmails = usersResult.rows.map(r => r.email);

    if (testUserIds.length === 0) {
      console.log('✓ No test users found — nothing to delete.');
      await client.query('ROLLBACK');
      return;
    }

    console.log(`Found ${testUserIds.length} test users:`);
    testEmails.forEach(e => console.log(`  - ${e}`));
    console.log('');

    const counts: Record<string, number> = {};

    // 1. Delete communities created by test users (no CASCADE on creator_id)
    //    This cascades: community.members, community.norms, requests.community_scope, etc.
    const commResult = await client.query(
      `DELETE FROM communities.communities WHERE creator_id = ANY($1::uuid[]) RETURNING id`,
      [testUserIds]
    );
    counts['communities.communities'] = commResult.rowCount ?? 0;

    // 2. Delete requests created by test users (not already cascade-deleted)
    const reqResult = await client.query(
      `DELETE FROM requests.help_requests WHERE requester_id = ANY($1::uuid[]) RETURNING id`,
      [testUserIds]
    );
    counts['requests.help_requests'] = reqResult.rowCount ?? 0;

    // 3. Delete matches where responder is a test user (requester-side cascaded above)
    const matchResult = await client.query(
      `DELETE FROM requests.matches WHERE responder_id = ANY($1::uuid[]) RETURNING id`,
      [testUserIds]
    );
    counts['requests.matches (responder)'] = matchResult.rowCount ?? 0;

    // 4. Delete conversations started by test users
    const convResult = await client.query(
      `DELETE FROM messaging.conversations
       WHERE id IN (
         SELECT conversation_id FROM messaging.participants
         WHERE participant_id = ANY($1::uuid[])
       ) RETURNING id`,
      [testUserIds]
    );
    counts['messaging.conversations'] = convResult.rowCount ?? 0;

    // 5. Delete notifications for test users
    const notifResult = await client.query(
      `DELETE FROM notifications.notifications WHERE user_id = ANY($1::uuid[]) RETURNING id`,
      [testUserIds]
    );
    counts['notifications.notifications'] = notifResult.rowCount ?? 0;

    // 6. Finally delete users — cascades: sessions, invitations, inviter_stats,
    //    reputation records, social graph connections, feed preferences
    const userDeleteResult = await client.query(
      `DELETE FROM auth.users WHERE id = ANY($1::uuid[]) RETURNING id`,
      [testUserIds]
    );
    counts['auth.users'] = userDeleteResult.rowCount ?? 0;

    await client.query('COMMIT');

    console.log('Deleted rows:');
    Object.entries(counts).forEach(([table, count]) => {
      if (count > 0) console.log(`  ${table}: ${count}`);
    });
    console.log('');
    console.log('✅ Reset complete. Ready to reseed with: npx ts-node simulation/scripts/seed-founders.ts');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Reset failed — rolled back all changes:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

reset();
