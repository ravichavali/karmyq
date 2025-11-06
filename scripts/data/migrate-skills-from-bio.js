/**
 * Migrate skills from bio field to user_skills table
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'karmyq_db',
  user: 'karmyq_user',
  password: 'karmyq_password_dev'
});

async function migrateSkills() {
  try {
    console.log('Migrating skills from bio to user_skills table...');

    // Get all users with skills in their bio
    const users = await pool.query(
      `SELECT id, bio FROM auth.users WHERE bio LIKE 'Skills:%'`
    );

    console.log(`Found ${users.rowCount} users with skills in bio`);

    let migrated = 0;
    for (const user of users.rows) {
      // Parse skills from bio (format: "Skills: skill1, skill2, skill3")
      const skillsMatch = user.bio.match(/Skills: (.+)/);
      if (skillsMatch) {
        const skills = skillsMatch[1].split(',').map(s => s.trim());

        for (const skill of skills) {
          try {
            await pool.query(
              `INSERT INTO auth.user_skills (user_id, skill)
               VALUES ($1, $2)
               ON CONFLICT (user_id, skill) DO NOTHING`,
              [user.id, skill]
            );
            migrated++;
          } catch (err) {
            console.error(`Error inserting skill ${skill} for user ${user.id}:`, err.message);
          }
        }
      }
    }

    console.log(`✅ Migrated ${migrated} skills to user_skills table`);

    // Verify
    const count = await pool.query('SELECT COUNT(*) FROM auth.user_skills');
    console.log(`Total skills in database: ${count.rows[0].count}`);

  } catch (error) {
    console.error('Error migrating skills:', error);
  } finally {
    await pool.end();
  }
}

migrateSkills();
