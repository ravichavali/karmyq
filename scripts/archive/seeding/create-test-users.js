#!/usr/bin/env node
/**
 * Create Test Users with Valid Passwords
 * Run: node scripts/create-test-users.js
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://karmyq_user:karmyq_password_dev@localhost:5432/karmyq_db'
});

const TEST_USERS = [
  { email: 'alice@test.com', name: 'Alice Test', password: 'password123' },
  { email: 'bob@test.com', name: 'Bob Test', password: 'password123' },
  { email: 'charlie@test.com', name: 'Charlie Test', password: 'password123' },
  { email: 'diana@test.com', name: 'Diana Test', password: 'password123' },
  { email: 'eve@test.com', name: 'Eve Test', password: 'password123' },
];

async function createTestUsers() {
  const client = await pool.connect();

  try {
    console.log('🔐 Creating test users...\n');

    for (const user of TEST_USERS) {
      const hashedPassword = await bcrypt.hash(user.password, 10);

      const result = await client.query(
        `INSERT INTO auth.users (name, email, password_hash)
         VALUES ($1, $2, $3)
         ON CONFLICT (email)
         DO UPDATE SET password_hash = EXCLUDED.password_hash
         RETURNING id, name, email`,
        [user.name, user.email, hashedPassword]
      );

      console.log(`✓ ${user.name} (${user.email})`);
    }

    console.log('\n✅ Test users created successfully!');
    console.log('\n📝 Login credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    TEST_USERS.forEach(user => {
      console.log(`Email: ${user.email}`);
      console.log(`Password: [REDACTED - see script source]`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });

  } catch (error) {
    console.error('Error creating test users:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

createTestUsers();
