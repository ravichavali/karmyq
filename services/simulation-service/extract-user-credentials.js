/**
 * Extract User Credentials from Database
 *
 * Queries the production database for existing seeded users and creates
 * a .env.production.users file for the simulation service.
 *
 * All seeded users use password: password123
 *
 * Usage:
 *   node extract-user-credentials.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Profile distribution weights
const PROFILE_WEIGHTS = [
  { type: 'active-helper', weight: 0.30 },
  { type: 'requester', weight: 0.25 },
  { type: 'browser', weight: 0.25 },
  { type: 'community-builder', weight: 0.10 },
  { type: 'social-user', weight: 0.10 }
];

function assignProfile(index, total) {
  const ratio = index / total;
  let cumulative = 0;

  for (const p of PROFILE_WEIGHTS) {
    cumulative += p.weight;
    if (ratio < cumulative) {
      return p.type;
    }
  }

  return PROFILE_WEIGHTS[PROFILE_WEIGHTS.length - 1].type;
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  Extract User Credentials for Simulation');
  console.log('='.repeat(60) + '\n');

  // Connect to production database
  const dbUrl = process.env.DATABASE_URL || 'postgresql://karmyq:karmyq_password@138.2.152.79:5432/karmyq';
  const pool = new Pool({ connectionString: dbUrl });

  try {
    // Query users from database
    console.log('📊 Querying users from production database...');
    const result = await pool.query(`
      SELECT id, email, name
      FROM auth.users
      WHERE email NOT LIKE '%@karmyq.com'
        AND email NOT LIKE '%admin%'
      ORDER BY created_at ASC
      LIMIT 100
    `);

    const users = result.rows;
    console.log(`✅ Found ${users.length} users\n`);

    if (users.length === 0) {
      console.warn('⚠️  No users found in database.');
      process.exit(1);
    }

    // Generate credentials file
    const credentialsFile = path.join(__dirname, '.env.production.users');
    const lines = [];

    lines.push('# Simulated User Credentials (Production)');
    lines.push(`# Generated: ${new Date().toISOString()}`);
    lines.push(`# Total users: ${users.length}`);
    lines.push('# Password for all users: password123');
    lines.push('');

    users.forEach((user, index) => {
      const profile = assignProfile(index, users.length);

      lines.push(`# ${user.name} [${profile}]`);
      lines.push(`SIM_USER_${index + 1}_EMAIL=${user.email}`);
      lines.push(`SIM_USER_${index + 1}_PASSWORD=password123`);
      lines.push(`SIM_USER_${index + 1}_ID=${user.id}`);
      lines.push('');
    });

    fs.writeFileSync(credentialsFile, lines.join('\n'));
    console.log(`✅ Credentials written to: ${credentialsFile}`);
    console.log(`   ${users.length} users extracted\n`);

    // Show profile distribution
    console.log('Profile distribution:');
    const profileCounts = users.reduce((acc, user, index) => {
      const profile = assignProfile(index, users.length);
      acc[profile] = (acc[profile] || 0) + 1;
      return acc;
    }, {});

    Object.entries(profileCounts).forEach(([profile, count]) => {
      console.log(`   ${profile}: ${count} (${((count / users.length) * 100).toFixed(1)}%)`);
    });

    console.log('\n✅ Done! Simulation service can now use these credentials.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
