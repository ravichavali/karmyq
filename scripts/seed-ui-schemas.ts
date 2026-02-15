/**
 * Seed UI Schemas - Migrate existing code-based schemas to database
 *
 * This script migrates the 5 built-in request type UI schemas from code
 * to the database. Run this once after applying migration 015_ui_schemas_dynamic.sql
 *
 * Usage:
 *   npx ts-node scripts/seed-ui-schemas.ts
 */

import { Pool } from 'pg';
import { getAllUISchemas } from '../packages/shared/src/schemas/ui';

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'karmyq',
  user: process.env.DB_USER || 'karmyq_user',
  password: process.env.DB_PASSWORD || 'karmyq_password',
});

async function seedUISchemas() {
  console.log('🌱 Seeding UI Schemas...\n');

  try {
    // Get all UI schemas from code
    const schemas = getAllUISchemas();
    console.log(`Found ${schemas.length} UI schemas in code:`);
    schemas.forEach((s) => console.log(`  - ${s.icon} ${s.label} (${s.type})`));
    console.log('');

    // Begin transaction
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      let inserted = 0;
      let skipped = 0;

      for (const schema of schemas) {
        // Check if schema already exists
        const existingResult = await client.query(
          'SELECT id FROM requests.ui_schemas WHERE type = $1',
          [schema.type]
        );

        if (existingResult.rows.length > 0) {
          console.log(`⏭️  Skipping ${schema.type} (already exists)`);
          skipped++;
          continue;
        }

        // Insert schema
        await client.query(
          `INSERT INTO requests.ui_schemas (
            type,
            version,
            label,
            icon,
            color,
            description,
            sections,
            summary,
            status,
            published_at,
            variant,
            rollout_percentage
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10, $11)`,
          [
            schema.type,
            schema.version,
            schema.label,
            schema.icon,
            schema.color,
            schema.description,
            JSON.stringify(schema.sections),
            schema.summary ? JSON.stringify(schema.summary) : null,
            'published', // All built-in types start as published
            'control',   // Default variant
            100,         // 100% rollout
          ]
        );

        console.log(`✅ Inserted ${schema.icon} ${schema.label} (${schema.type})`);
        inserted++;
      }

      await client.query('COMMIT');
      client.release();

      console.log('');
      console.log('✨ Seeding complete!');
      console.log(`   Inserted: ${inserted}`);
      console.log(`   Skipped:  ${skipped}`);
      console.log(`   Total:    ${schemas.length}`);

    } catch (error) {
      await client.query('ROLLBACK');
      client.release();
      throw error;
    }

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  seedUISchemas();
}

export { seedUISchemas };
