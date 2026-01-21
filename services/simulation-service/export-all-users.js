/**
 * Export All Users for Simulation
 *
 * Fetches all existing users from the database and creates a credentials file
 * for the simulation service. This allows simulation to use real user accounts
 * created through registration workflow.
 *
 * Usage:
 *   node export-all-users.js --env production
 *   node export-all-users.js --env staging
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuration per environment
const ENVIRONMENTS = {
  production: {
    // Will use DATABASE_URL env var from .env.production
    outputFile: '.env.production.users'
  },
  staging: {
    // Will use DATABASE_URL env var from .env.staging
    outputFile: '.env.staging.users'
  },
  dev: {
    connectionString: 'postgresql://karmyq_user:karmyq_local_password@localhost:5432/karmyq_dev',
    outputFile: '.env.dev.users'
  }
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    env: 'dev',
    password: 'demo123!Demo' // Default password to use for exported users
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--env' && args[i + 1]) {
      config.env = args[i + 1];
      i++;
    } else if (args[i] === '--password' && args[i + 1]) {
      config.password = args[i + 1];
      i++;
    }
  }

  return config;
}

// Get database connection string
function getDatabaseUrl(env) {
  if (env === 'production' || env === 'staging') {
    // Load from environment file
    const envFile = path.join(__dirname, '..', '..', '..', `.env.${env}`);
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, 'utf-8');
      const match = content.match(/DATABASE_URL=(.+)/);
      if (match) {
        return match[1].trim();
      }
    }
    // Fallback to env var
    return process.env.DATABASE_URL;
  }
  return ENVIRONMENTS[env].connectionString;
}

// Fetch all users from database
async function fetchAllUsers(client) {
  const query = `
    SELECT
      u.id,
      u.email,
      u.name,
      u.created_at
    FROM auth.users u
    WHERE u.status = 'active'
    ORDER BY u.created_at ASC
  `;

  const result = await client.query(query);
  return result.rows;
}

// Assign profile based on user index (distributed evenly)
function assignProfile(index) {
  const profiles = [
    { type: 'active-helper', weight: 0.30 },
    { type: 'requester', weight: 0.25 },
    { type: 'browser', weight: 0.25 },
    { type: 'community-builder', weight: 0.10 },
    { type: 'social-user', weight: 0.10 }
  ];

  // Calculate cumulative weights
  let cumulative = 0;
  const normalized = index % 100 / 100; // Normalize to 0-1

  for (const profile of profiles) {
    cumulative += profile.weight;
    if (normalized < cumulative) {
      return profile.type;
    }
  }

  return 'browser'; // fallback
}

// Write credentials file
async function writeCredentialsFile(users, outputFile, password) {
  const lines = [
    '# Simulated User Credentials',
    '# Auto-generated from existing database users',
    `# Generated: ${new Date().toISOString()}`,
    `# Total users: ${users.length}`,
    '#',
    '# Format: EMAIL=value, PASSWORD=value, USER_ID=value',
    '# Profile types: active-helper, requester, browser, community-builder, social-user',
    '',
  ];

  users.forEach((user, index) => {
    const profile = assignProfile(index);
    const sanitizedName = user.name.replace(/[^a-zA-Z0-9 ]/g, '');
    const varPrefix = sanitizedName.toUpperCase().replace(/\s+/g, '_');

    lines.push(`# ${user.name} [${profile}]`);
    lines.push(`${varPrefix}_EMAIL=${user.email}`);
    lines.push(`${varPrefix}_PASSWORD=${password}`);
    lines.push(`${varPrefix}_ID=${user.id}`);
    lines.push('');
  });

  const filePath = path.join(__dirname, outputFile);
  fs.writeFileSync(filePath, lines.join('\n'));

  console.log(`✅ Credentials file written: ${filePath}`);
  console.log(`   Total users exported: ${users.length}`);
}

// Main function
async function main() {
  const config = parseArgs();
  const envConfig = ENVIRONMENTS[config.env];

  if (!envConfig) {
    console.error(`❌ Unknown environment: ${config.env}`);
    console.error('   Valid environments: production, staging, dev');
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('  Export All Users for Simulation');
  console.log('='.repeat(60));
  console.log(`Environment: ${config.env}`);
  console.log(`Output file: ${envConfig.outputFile}`);
  console.log(`Password: ${config.password}`);
  console.log('');

  // Connect to database
  const databaseUrl = getDatabaseUrl(config.env);
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found');
    console.error(`   Set DATABASE_URL environment variable or create .env.${config.env} file`);
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    console.log('📡 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');

    // Fetch all users
    console.log('\n📊 Fetching users...');
    const users = await fetchAllUsers(client);
    console.log(`✅ Found ${users.length} active users`);

    if (users.length === 0) {
      console.log('\n⚠️  No users found in database');
      console.log('   Create users first through registration or run:');
      console.log(`   node create-simulated-users.js --env ${config.env} --count 20`);
      process.exit(0);
    }

    // Write credentials file
    console.log('\n📝 Writing credentials file...');
    await writeCredentialsFile(users, envConfig.outputFile, config.password);

    console.log('\n✅ Export complete!');
    console.log('\nNext steps:');
    console.log(`1. Start simulation: pm2 start ecosystem.config.js --env ${config.env}`);
    console.log(`2. View logs: pm2 logs karmyq-simulation`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
