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

    // Get community IDs created by test users — needed to clear FK refs before deleting communities
    const testCommResult = await client.query(
      `SELECT id FROM communities.communities WHERE creator_id = ANY($1::uuid[])`,
      [testUserIds]
    );
    const testCommunityIds: string[] = testCommResult.rows.map((r: any) => r.id);

    // Helper: delete with SAVEPOINT so a missing table doesn't abort the transaction
    async function safeDelete(table: string, column: string, ids: string[]): Promise<number> {
      const sp = `sp_${table.replace(/\W/g, '_')}`;
      await client.query(`SAVEPOINT ${sp}`);
      try {
        const r = await client.query(
          `DELETE FROM ${table} WHERE ${column} = ANY($1::uuid[]) RETURNING id`,
          [ids]
        );
        return r.rowCount ?? 0;
      } catch {
        await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
        return 0;
      }
    }

    // 1a. Clear all NO ACTION FK refs to test communities before deleting them.
    if (testCommunityIds.length > 0) {
      const toDelete: [string, string][] = [
        ['reputation.karma_records',    'community_id'],
        ['reputation.trust_scores',     'community_id'],
        ['requests.help_offers',        'community_id'],
        ['feedback.feedback',           'community_id'],
        ['federation.blocked_instances','community_id'],
        ['governance.conflict_cases',   'community_id'],
        ['governance.proposals',        'community_id'],
        ['governance.votes',            'community_id'],
      ];
      for (const [table, col] of toDelete) {
        const n = await safeDelete(table, col, testCommunityIds);
        if (n > 0) counts[`${table} (community)`] = n;
      }
    }

    // 1b. Delete reputation records for test users (catches cross-community records)
    for (const table of ['reputation.karma_records', 'reputation.trust_scores']) {
      const n = await safeDelete(table, 'user_id', testUserIds);
      if (n > 0) counts[`${table} (user)`] = n;
    }

    // 1c. Delete communities created by test users (creator_id has no CASCADE)
    //    All remaining CASCADE refs (members, norms, configs, etc.) auto-delete.
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
