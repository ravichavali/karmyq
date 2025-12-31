#!/usr/bin/env node
/**
 * Seed Data CLI - Command-line interface for consolidated seeder
 *
 * Usage:
 *   npm run seed                              # Quick profile (20 users)
 *   npm run seed -- --profile staging         # Staging profile (2000 users)
 *   npm run seed -- --profile staging --size medium  # 1000 users
 *   npm run seed -- --profile production --password=secret123
 *
 * Environment variables:
 *   DATABASE_URL    - Database connection string
 *   DEMO_PASSWORD   - Required for production profile
 *   SKIP_CONFIRMATION=true - Skip production confirmation prompt
 */

import { ConsolidatedSeeder, DataProfile, DataSize } from '../fixtures/consolidatedSeeder';

interface CliArgs {
  profile: DataProfile;
  size: DataSize;
  password?: string;
  databaseUrl?: string;
  verbose: boolean;
  help: boolean;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {
    profile: 'quick',
    size: 'large',
    verbose: false,
    help: false
  };

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];

    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg.startsWith('--profile=')) {
      args.profile = arg.split('=')[1] as DataProfile;
    } else if (arg === '--profile') {
      args.profile = process.argv[++i] as DataProfile;
    } else if (arg.startsWith('--size=')) {
      args.size = arg.split('=')[1] as DataSize;
    } else if (arg === '--size') {
      args.size = process.argv[++i] as DataSize;
    } else if (arg.startsWith('--password=')) {
      args.password = arg.split('=')[1];
    } else if (arg === '--password') {
      args.password = process.argv[++i];
    } else if (arg.startsWith('--database-url=')) {
      args.databaseUrl = arg.split('=')[1];
    } else if (arg === '--database-url') {
      args.databaseUrl = process.argv[++i];
    } else if (arg === '--verbose' || arg === '-v') {
      args.verbose = true;
    }
  }

  return args;
}

function printHelp(): void {
  console.log(`
Seed Data CLI - Consolidated test data generator

USAGE:
  npm run seed [OPTIONS]

OPTIONS:
  --profile <quick|staging|production>
      Data profile to use (default: quick)

      quick:      20 users, 5 communities, 1 month age
      staging:    2000 users, 200 communities, 6 months age
      production: 2000 users, 200 communities, 6 months age (requires DEMO_PASSWORD)

  --size <small|medium|large>
      Adjust volume (default: large)

      small:  10% of profile volume
      medium: 50% of profile volume
      large:  100% of profile volume

  --password <password>
      Override default password for user accounts

      Default passwords:
      - quick:      password123
      - staging:    test123
      - production: $DEMO_PASSWORD (from environment)

  --database-url <url>
      Override DATABASE_URL environment variable

  --verbose, -v
      Enable verbose progress logging

  --help, -h
      Show this help message

EXAMPLES:
  # Quick local seeding (20 users)
  npm run seed

  # Staging environment (2000 users)
  npm run seed -- --profile staging

  # Staging with 50% volume (1000 users)
  npm run seed -- --profile staging --size medium

  # Production (requires DEMO_PASSWORD env var)
  DEMO_PASSWORD=secret123 npm run seed -- --profile production

  # Custom database and password
  npm run seed -- --profile staging \\
    --database-url postgresql://user:pass@host:5432/db \\
    --password test456

ENVIRONMENT VARIABLES:
  DATABASE_URL      Database connection string
  DEMO_PASSWORD     Required for production profile
  SKIP_CONFIRMATION Set to 'true' to skip production confirmation

DATA GENERATED:
  ✓ Realistic user names and emails
  ✓ Varied community types and sizes
  ✓ Polymorphic requests (ride, event, service, question, item)
  ✓ Complete workflows (request → offer → match → messages → karma)
  ✓ Aged data with realistic time distributions
  ✓ Test personas for E2E testing (staging only)

VOLUME ESTIMATES:
  Profile: quick
    20 users
    5 communities
    ~40 requests
    ~12 matches
    ~48 messages

  Profile: staging / production
    2000 users
    200 communities
    ~10,000 requests
    ~3,000 matches
    ~12,000 messages

TIME ESTIMATES:
  quick:      30 seconds
  staging:    5-10 minutes (depends on API response times)
  production: 5-10 minutes
`);
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Validate profile
  const validProfiles: DataProfile[] = ['quick', 'staging', 'production'];
  if (!validProfiles.includes(args.profile)) {
    console.error(`❌ Invalid profile: ${args.profile}`);
    console.error(`   Valid profiles: ${validProfiles.join(', ')}`);
    process.exit(1);
  }

  // Validate size
  const validSizes: DataSize[] = ['small', 'medium', 'large'];
  if (!validSizes.includes(args.size)) {
    console.error(`❌ Invalid size: ${args.size}`);
    console.error(`   Valid sizes: ${validSizes.join(', ')}`);
    process.exit(1);
  }

  // Create seeder
  const seeder = new ConsolidatedSeeder(args.databaseUrl, args.verbose);

  try {
    await seeder.seed({
      profile: args.profile,
      size: args.size,
      password: args.password,
      verbose: args.verbose
    });

    process.exit(0);
  } catch (error: any) {
    console.error(`\n❌ Seeding failed: ${error.message}`);
    if (args.verbose && error.stack) {
      console.error(`\nStack trace:\n${error.stack}`);
    }
    process.exit(1);
  }
}

// Run CLI
main();
