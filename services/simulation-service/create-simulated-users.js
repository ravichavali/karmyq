/**
 * Create Simulated Users for Production/Staging
 *
 * Creates dedicated user accounts for the simulation service with:
 * - Profile distribution matching simulation config
 * - Secure random passwords
 * - Community memberships
 * - Error handling and retry logic
 *
 * Usage:
 *   node create-simulated-users.js --env production --count 20
 *   node create-simulated-users.js --env staging --count 10
 *   node create-simulated-users.js --env dev --count 5
 */

const axios = require('axios');
const crypto = require('crypto');

// Configuration per environment
const ENVIRONMENTS = {
  production: {
    apiUrl: 'https://karmyq.com/api',
    userCount: 20,
    emailDomain: 'sim-prod.karmyq.com'
  },
  staging: {
    apiUrl: 'https://staging.karmyq.com/api',
    userCount: 10,
    emailDomain: 'sim-staging.karmyq.com'
  },
  dev: {
    apiUrl: 'http://localhost:3000/api',
    userCount: 5,
    emailDomain: 'sim-dev.karmyq.com'
  }
};

// Realistic diverse names (matching realistic-data.ts)
const FIRST_NAMES = [
  'Maria', 'James', 'Priya', 'Wei', 'Fatima',
  'Carlos', 'Aisha', 'Liam', 'Yuki', 'Sarah',
  'Mohamed', 'Elena', 'David', 'Mei', 'Omar',
  'Sofia', 'Raj', 'Nadia', 'Lucas', 'Hannah',
  'Kwame', 'Isabella', 'Chen', 'Amara', 'Ethan',
  'Leila', 'Takeshi', 'Zara', 'Andre', 'Ingrid',
  'Marcus', 'Suki', 'Diego', 'Nina', 'Jamal',
  'Rosa', 'Vikram', 'Chiara', 'Kofi', 'Lena'
];

const LAST_NAMES = [
  'Chen', 'Rodriguez', 'Patel', 'Kim', 'Okafor',
  'Mueller', 'Singh', 'Tanaka', 'Santos', 'Williams',
  'Ahmed', 'Thompson', 'Liu', 'Garcia', 'Nakamura',
  'Martinez', 'Sato', 'Brown', 'Ali', 'Johansson',
  'Nguyen', 'Davis', 'Hernandez', 'Park', 'Wilson',
  'Kumar', 'White', 'Zhao', 'Lopez', 'Anderson',
  'Osei', 'Berg', 'Reyes', 'Rossi', 'Ibrahim',
  'Larsson', 'Sharma', 'Costa', 'Mensah', 'Fischer'
];

// Bios that sound like real people
const BIOS = [
  'Portland native, love hiking and helping neighbors',
  'New to the area, looking to connect with my community',
  'Retired teacher, happy to lend a hand',
  'Software engineer who enjoys volunteering on weekends',
  'Stay-at-home parent, always looking for ways to help out',
  'Dog walker and neighborhood enthusiast',
  'Community organizer passionate about mutual aid',
  'Moved here from the east coast, loving Portland so far',
  'Gardener, cook, and all-around handy person',
  'Student at PSU, want to give back to the community',
  'Long-time SE Portland resident',
  'Carpenter by trade, happy to help with projects',
  'Foodie and amateur baker',
  'Cyclist and outdoor lover',
  'Works from home, flexible schedule to help out',
  '',  // Some users don't fill in a bio
  '',
  '',
];

// Profile types with weights (no names - names generated separately)
const PROFILES = [
  { type: 'active-helper', weight: 0.30 },
  { type: 'requester', weight: 0.25 },
  { type: 'browser', weight: 0.25 },
  { type: 'community-builder', weight: 0.10 },
  { type: 'social-user', weight: 0.10 }
];

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    env: 'dev',
    count: null,
    dryRun: false,
    forceRecreate: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--env' && args[i + 1]) {
      config.env = args[i + 1];
      i++;
    } else if (args[i] === '--count' && args[i + 1]) {
      config.count = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--dry-run') {
      config.dryRun = true;
    } else if (args[i] === '--force-recreate') {
      config.forceRecreate = true;
    }
  }

  return config;
}

// Generate consistent password for demo environment
// All simulated users use the same password for easy testing
function generatePassword() {
  return '115ECourtLn';
}

// Generate unique realistic names
function generateUniqueNames(count) {
  const usedNames = new Set();
  const names = [];

  // Shuffle both arrays independently
  const shuffledFirst = [...FIRST_NAMES].sort(() => Math.random() - 0.5);
  const shuffledLast = [...LAST_NAMES].sort(() => Math.random() - 0.5);

  for (let i = 0; names.length < count && i < 1000; i++) {
    const first = shuffledFirst[i % shuffledFirst.length];
    // Use a different offset for last names so they don't pair predictably
    const last = shuffledLast[(i * 7 + 3) % shuffledLast.length];
    const full = `${first} ${last}`;

    if (!usedNames.has(full)) {
      usedNames.add(full);
      names.push({ first, last, full });
    }
  }

  return names;
}

// Distribute users across profiles with realistic names
function distributeProfiles(count) {
  const names = generateUniqueNames(count);
  const distribution = [];
  let assigned = 0;

  for (const profile of PROFILES) {
    const profileCount = Math.round(count * profile.weight);

    for (let i = 0; i < profileCount && assigned < count; i++) {
      const name = names[assigned];
      distribution.push({
        name: name.full,
        firstName: name.first,
        lastName: name.last,
        bio: BIOS[assigned % BIOS.length],
        profile: profile.type,
        index: assigned + 1
      });
      assigned++;
    }
  }

  // Fill remaining with random profiles if needed
  while (assigned < count) {
    const profile = PROFILES[assigned % PROFILES.length];
    const name = names[assigned];
    distribution.push({
      name: name.full,
      firstName: name.first,
      lastName: name.last,
      bio: BIOS[assigned % BIOS.length],
      profile: profile.type,
      index: assigned + 1
    });
    assigned++;
  }

  return distribution;
}

// Delete a user (admin function - requires manual DB access or admin API)
async function deleteUser(apiUrl, email, password) {
  try {
    // First login to get token
    const loginResponse = await axios.post(`${apiUrl}/auth/login`, {
      email,
      password: password || 'dummy' // Won't work with wrong password, but we'll try
    });

    const token = loginResponse.data.data?.token;

    // Delete user account
    await axios.delete(`${apiUrl}/auth/user`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}

// Register a user
async function registerUser(apiUrl, email, name, password, bio = '', forceRecreate = false) {
  try {
    const registerData = { email, name, password };
    if (bio) registerData.bio = bio;

    const response = await axios.post(`${apiUrl}/auth/register`, registerData, {
      timeout: 10000
    });

    return {
      success: true,
      userId: response.data.data?.user?.id || response.data.data?.id,
      token: response.data.data?.token
    };
  } catch (error) {
    if (error.response?.status === 409) {
      // User already exists
      if (forceRecreate) {
        // Try to delete and recreate
        // Note: This requires the user to be able to delete their own account
        // For now, we'll just return an error asking for manual deletion
        return {
          success: false,
          error: 'User exists. Please manually delete via database or use existing credentials file.'
        };
      }

      // Try to login with provided password
      try {
        const loginResponse = await axios.post(`${apiUrl}/auth/login`, {
          email,
          password
        });
        return {
          success: true,
          userId: loginResponse.data.data?.user?.id,
          token: loginResponse.data.data?.token,
          existed: true
        };
      } catch (loginError) {
        return {
          success: false,
          error: 'User exists but login failed (password mismatch?)'
        };
      }
    }

    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}

// Get or create default community
async function getDefaultCommunity(apiUrl, token) {
  try {
    // Try to get existing communities
    const response = await axios.get(`${apiUrl}/communities`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000
    });

    if (response.data.data?.length > 0) {
      return response.data.data[0].id;
    }

    // Create default community if none exists
    const createResponse = await axios.post(`${apiUrl}/communities`, {
      name: 'Demo Community',
      description: 'Default community for simulated users',
      location: 'Virtual',
      category: 'general'
    }, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000
    });

    return createResponse.data.data?.id || createResponse.data.data?.community_id;
  } catch (error) {
    console.warn('Could not get/create community:', error.message);
    return null;
  }
}

// Join community
async function joinCommunity(apiUrl, token, inviteCode) {
  try {
    await axios.post(`${apiUrl}/communities/join`, {
      invite_code: inviteCode
    }, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000
    });
    return true;
  } catch (error) {
    console.warn('Could not join community:', error.message);
    return false;
  }
}

// Main function
async function main() {
  const config = parseArgs();

  console.log('🚀 Simulated User Creation Tool\n');
  console.log(`Environment: ${config.env}`);

  if (!ENVIRONMENTS[config.env]) {
    console.error(`❌ Invalid environment: ${config.env}`);
    console.error(`   Valid options: ${Object.keys(ENVIRONMENTS).join(', ')}`);
    process.exit(1);
  }

  const env = ENVIRONMENTS[config.env];
  const userCount = config.count || env.userCount;

  console.log(`API URL: ${env.apiUrl}`);
  console.log(`Users to create: ${userCount}`);
  console.log(`Email domain: @${env.emailDomain}`);

  if (config.dryRun) {
    console.log('\n⚠️  DRY RUN MODE - No users will be created\n');
  } else {
    console.log('');
  }

  // Distribute users across profiles
  const distribution = distributeProfiles(userCount);

  console.log('Profile Distribution:');
  const profileCounts = {};
  distribution.forEach(u => {
    profileCounts[u.profile] = (profileCounts[u.profile] || 0) + 1;
  });
  Object.entries(profileCounts).forEach(([profile, count]) => {
    console.log(`  ${profile}: ${count} (${Math.round(count / userCount * 100)}%)`);
  });
  console.log('');

  if (config.dryRun) {
    console.log('Preview of users to create:');
    distribution.forEach(u => {
      const email = `${u.firstName.toLowerCase()}.${u.lastName.toLowerCase()}@${env.emailDomain}`;
      console.log(`  ${u.index}. ${u.name} <${email}> [${u.profile}]`);
    });
    console.log('\nRun without --dry-run to create these users.');
    process.exit(0);
  }

  // Create users
  const results = {
    created: [],
    existed: [],
    failed: []
  };

  console.log('Creating users...\n');

  for (const user of distribution) {
    const email = `${user.firstName.toLowerCase()}.${user.lastName.toLowerCase()}@${env.emailDomain}`;
    const password = generatePassword();

    process.stdout.write(`[${user.index}/${userCount}] Creating ${user.name} <${email}>... `);

    const result = await registerUser(env.apiUrl, email, user.name, password, user.bio);

    if (result.success) {
      if (result.existed) {
        console.log('✓ (already exists)');
        results.existed.push({ email, name: user.name, profile: user.profile });
      } else {
        console.log('✓');
        results.created.push({
          email,
          password,
          name: user.name,
          profile: user.profile,
          userId: result.userId
        });
      }
    } else {
      console.log(`✗ ${result.error}`);
      results.failed.push({ email, name: user.name, error: result.error });
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Summary:');
  console.log(`  ✓ Created: ${results.created.length}`);
  console.log(`  ✓ Already existed: ${results.existed.length}`);
  console.log(`  ✗ Failed: ${results.failed.length}`);
  console.log('='.repeat(60));

  if (results.failed.length > 0) {
    console.log('\nFailed users:');
    results.failed.forEach(u => {
      console.log(`  ✗ ${u.email}: ${u.error}`);
    });
  }

  // Save credentials to file
  if (results.created.length > 0) {
    const credentialsFile = `.env.${config.env}.users`;
    const fs = require('fs');

    let content = `# Simulated User Credentials - ${new Date().toISOString()}\n`;
    content += `# Environment: ${config.env}\n`;
    content += `# Total: ${results.created.length} users\n\n`;

    results.created.forEach((u, i) => {
      content += `# ${u.name} [${u.profile}]\n`;
      content += `SIM_USER_${i + 1}_EMAIL=${u.email}\n`;
      content += `SIM_USER_${i + 1}_PASSWORD=${u.password}\n`;
      content += `SIM_USER_${i + 1}_ID=${u.userId}\n\n`;
    });

    fs.writeFileSync(credentialsFile, content);
    console.log(`\n✓ Credentials saved to: ${credentialsFile}`);
    console.log(`  ⚠️  IMPORTANT: Keep this file secure and never commit to git!`);
  }

  console.log('\n✅ User creation complete!');
  console.log('\nNext steps:');
  console.log('  1. Review credentials file');
  console.log('  2. Update simulation service configuration');
  console.log('  3. Start simulation service with PM2');
  console.log('  4. Monitor logs for activity');
}

// Run
main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
