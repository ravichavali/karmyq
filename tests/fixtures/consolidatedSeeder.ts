/**
 * Consolidated Seeder - Single source of truth for test data generation
 *
 * Replaces all 5+ inconsistent scripts:
 * - seed-test-data.js
 * - generate-realistic-data.ts
 * - populate-polymorphic-data.js
 * - create-test-feed-data.js
 * - generate-large-dataset.js
 *
 * Features:
 * - API-first approach (triggers business logic)
 * - Time travel support (aged data)
 * - Environment-aware profiles
 * - Idempotent operations
 * - Progress reporting
 */

import { Pool } from 'pg';
import { VolumeSeeder, SeedConfig, SeedProgress } from './volumeSeeder';
import { createPool } from './index';

export type DataProfile = 'quick' | 'staging' | 'production';
export type DataSize = 'small' | 'medium' | 'large';

export interface SeederOptions {
  profile: DataProfile;
  size?: DataSize;
  databaseUrl?: string;
  password?: string;
  verbose?: boolean;
}

/**
 * Predefined data profiles for different environments
 */
const PROFILES: Record<DataProfile, Omit<SeedConfig, 'password'>> = {
  // Quick iteration for local development
  quick: {
    users: 20,
    communities: 5,
    requestsPerUser: 2,
    ageMonths: 1,
    batchSize: 10,
    includeTestPersonas: true
  },

  // Full volume for staging environment
  staging: {
    users: 2000,
    communities: 200,
    requestsPerUser: 5,
    ageMonths: 6,
    batchSize: 50,
    includeTestPersonas: true
  },

  // Production demo data
  production: {
    users: 2000,
    communities: 200,
    requestsPerUser: 5,
    ageMonths: 6,
    batchSize: 50,
    includeTestPersonas: false
  }
};

/**
 * Size multipliers (adjust volume)
 */
const SIZE_MULTIPLIERS: Record<DataSize, number> = {
  small: 0.1,   // 10% of profile volume
  medium: 0.5,  // 50% of profile volume
  large: 1.0    // 100% of profile volume
};

export class ConsolidatedSeeder {
  private pool: Pool;
  private verbose: boolean;

  constructor(databaseUrl?: string, verbose = false) {
    this.pool = databaseUrl
      ? new Pool({ connectionString: databaseUrl })
      : createPool();
    this.verbose = verbose;
  }

  /**
   * Main seed operation
   */
  async seed(options: SeederOptions): Promise<void> {
    const { profile, size = 'large', password } = options;

    // Get base config for profile
    const baseConfig = { ...PROFILES[profile] };

    // Apply size multiplier
    const multiplier = SIZE_MULTIPLIERS[size];
    const config: SeedConfig = {
      ...baseConfig,
      users: Math.ceil(baseConfig.users * multiplier),
      communities: Math.ceil(baseConfig.communities * multiplier),
      password: password || this.getDefaultPassword(profile)
    };

    this.log(`\n🌱 Consolidated Seeder`);
    this.log(`═══════════════════════`);
    this.log(`Profile: ${profile}`);
    this.log(`Size: ${size} (${multiplier * 100}%)`);
    this.log(`Database: ${this.getDatabaseInfo()}`);
    this.log(`\nConfiguration:`);
    this.log(`  Users: ${config.users}`);
    this.log(`  Communities: ${config.communities}`);
    this.log(`  Requests per user: ${config.requestsPerUser}`);
    this.log(`  Data age: ${config.ageMonths} months`);
    this.log(`  Batch size: ${config.batchSize}`);
    this.log(`  Test personas: ${config.includeTestPersonas ? 'Yes' : 'No'}`);
    this.log(``);

    // Confirmation for production
    if (profile === 'production' && !process.env.SKIP_CONFIRMATION) {
      console.log(`⚠️  WARNING: You are about to seed PRODUCTION data`);
      console.log(`   This operation will create ${config.users} users`);
      console.log(``);
      console.log(`   Set SKIP_CONFIRMATION=true to bypass this message`);
      console.log(``);
      throw new Error('Production seeding requires confirmation');
    }

    // Truncate existing data (idempotent)
    await this.truncateData();

    // Run volume seeder
    const volumeSeeder = new VolumeSeeder(this.pool);

    await volumeSeeder.seed(config, (progress) => {
      if (this.verbose) {
        this.logProgress(progress);
      }
    });

    this.log(`\n✅ Seeding complete!`);
    await this.pool.end();
  }

  /**
   * Truncate all test data (idempotent operation)
   */
  private async truncateData(): Promise<void> {
    this.log(`🗑️  Truncating existing data...`);

    try {
      await this.pool.query(`
        TRUNCATE TABLE messaging.messages CASCADE;
        TRUNCATE TABLE messaging.conversations CASCADE;
        TRUNCATE TABLE requests.matches CASCADE;
        TRUNCATE TABLE requests.help_offers CASCADE;
        TRUNCATE TABLE requests.request_communities CASCADE;
        TRUNCATE TABLE requests.help_requests CASCADE;
        TRUNCATE TABLE reputation.karma_records CASCADE;
        TRUNCATE TABLE reputation.milestone_events CASCADE;
        TRUNCATE TABLE reputation.trust_scores CASCADE;
        TRUNCATE TABLE communities.members CASCADE;
        TRUNCATE TABLE communities.communities CASCADE;
        TRUNCATE TABLE auth.users CASCADE;
      `);

      this.log(`   ✓ Data truncated`);
    } catch (error: any) {
      this.log(`   ⚠️  Truncation warning: ${error.message}`);
      // Continue anyway - tables might not exist yet
    }
  }

  /**
   * Get default password for profile
   */
  private getDefaultPassword(profile: DataProfile): string {
    switch (profile) {
      case 'quick':
        return 'password123';
      case 'staging':
        return 'test123';
      case 'production':
        const prodPassword = process.env.DEMO_PASSWORD;
        if (!prodPassword) {
          throw new Error('Production seeding requires DEMO_PASSWORD environment variable');
        }
        return prodPassword;
      default:
        return 'password123';
    }
  }

  /**
   * Get database connection info (sanitized)
   */
  private getDatabaseInfo(): string {
    const connString = this.pool.options.connectionString ||
      process.env.DATABASE_URL ||
      'postgresql://localhost:5432/karmyq_db';

    // Sanitize (hide password)
    return connString.replace(/:([^@]+)@/, ':****@');
  }

  /**
   * Log message (respects verbose flag)
   */
  private log(message: string): void {
    console.log(message);
  }

  /**
   * Log progress (only in verbose mode)
   */
  private logProgress(progress: SeedProgress): void {
    console.log(`Progress: Users=${progress.usersCreated}, Communities=${progress.communitiesCreated}, Requests=${progress.requestsCreated}`);
  }
}
