/**
 * seed-founders.ts — Register the 5 founders and bootstrap the first community.
 *
 * Run AFTER reset.ts:
 *   npx ts-node simulation/scripts/seed-founders.ts
 *
 * Output: simulation/state/founders.json (gitignored)
 *         simulation/state/users.json (gitignored)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { SimApiClient } from '../api/client';
import { FOUNDERS } from '../personas/founders';
import { SeededUser } from '../personas/types';
import { log } from '../utils/logger';
import { sleep } from '../utils/random';

dotenv.config({ path: path.join(__dirname, '../.env') });

const API_URL = process.env.TARGET_API_URL ?? 'http://localhost';
const STATE_DIR = path.join(__dirname, '../state');

// The founding community Maria creates
const FOUNDING_COMMUNITY = {
  name: 'Bay Area Mutual Aid Network',
  description: 'A grassroots community helping Bay Area neighbors with everyday needs — rides, groceries, tools, skills, and more. Founded on the belief that we can take care of each other.',
  location: 'San Francisco Bay Area, CA',
  category: 'mutual_aid',
};

async function seedFounders() {
  fs.mkdirSync(STATE_DIR, { recursive: true });

  log('info', 'seed-founders', 'Starting founder seeding', { apiUrl: API_URL });
  console.log('');
  console.log('🌱 Karmyq Founder Seeding');
  console.log('  API:', API_URL);
  console.log('');

  const seededUsers: SeededUser[] = [];
  const founderCredentials: Array<{ personaId: string; userId: string; token: string; communityIds: string[] }> = [];

  let foundingCommunityId: string | null = null;

  // Step 1: Register all founders
  for (const persona of FOUNDERS) {
    const client = new SimApiClient(API_URL, persona.id);
    try {
      const result = await client.register(persona.email, persona.name, persona.password);
      log('info', persona.id, `Registered: ${persona.name}`, { userId: result.user.id });
      console.log(`  ✓ Registered: ${persona.name} (${persona.email})`);

      founderCredentials.push({
        personaId: persona.id,
        userId: result.user.id,
        token: result.token,
        communityIds: [],
      });

      await sleep(500); // Small delay between registrations
    } catch (err: any) {
      // Already exists from a previous partial seed — try logging in
      if (err.response?.status === 409) {
        log('warn', persona.id, 'Already exists, logging in');
        const loginResult = await client.login(persona.email, persona.password);
        founderCredentials.push({
          personaId: persona.id,
          userId: loginResult.user.id,
          token: loginResult.token,
          communityIds: [],
        });
        console.log(`  ~ Already exists: ${persona.name} — logged in`);
      } else {
        log('error', persona.id, 'Registration failed', { error: err.message });
        console.error(`  ✗ Failed to register ${persona.name}:`, err.message);
        process.exit(1);
      }
    }
  }

  console.log('');

  // Step 2: Maria creates the founding community
  const maria = founderCredentials.find(f => f.personaId === 'maria-reyes')!;
  const mariaClient = new SimApiClient(API_URL, 'maria-reyes');
  mariaClient.setToken(maria.token);

  try {
    const community = await mariaClient.createCommunity(FOUNDING_COMMUNITY);
    foundingCommunityId = community.id ?? community.community?.id;
    log('info', 'maria-reyes', 'Created founding community', { communityId: foundingCommunityId, name: FOUNDING_COMMUNITY.name });
    console.log(`  ✓ Maria created: "${FOUNDING_COMMUNITY.name}" (${foundingCommunityId})`);
    maria.communityIds.push(foundingCommunityId!);
  } catch (err: any) {
    log('error', 'maria-reyes', 'Failed to create community', { error: err.message });
    console.error('  ✗ Maria failed to create founding community:', err.message);
    process.exit(1);
  }

  await sleep(500);

  // Step 3: Maria generates invite codes for the other 4 founders
  const otherFounders = founderCredentials.filter(f => f.personaId !== 'maria-reyes');
  const inviteCodes: string[] = [];

  for (const _ of otherFounders) {
    try {
      const invite = await mariaClient.generateInvite(foundingCommunityId!);
      inviteCodes.push(invite.code);
      await sleep(300);
    } catch (err: any) {
      log('warn', 'maria-reyes', 'Failed to generate invite code', { error: err.message });
    }
  }
  console.log(`  ✓ Maria generated ${inviteCodes.length} invite codes`);

  // Step 4: Other founders join via invite codes (or direct join if invite fails)
  for (let i = 0; i < otherFounders.length; i++) {
    const founder = otherFounders[i];
    const persona = FOUNDERS.find(p => p.id === founder.personaId)!;
    const client = new SimApiClient(API_URL, founder.personaId);
    client.setToken(founder.token);

    // Try accept invite
    if (inviteCodes[i]) {
      try {
        await client.acceptInvite(inviteCodes[i]);
        log('info', founder.personaId, 'Accepted invite to founding community');
        console.log(`  ✓ ${persona.name} accepted invite to founding community`);
        founder.communityIds.push(foundingCommunityId!);
        await sleep(400);
        continue;
      } catch (err: any) {
        log('warn', founder.personaId, 'Invite accept failed, falling back to direct join', { error: err.message });
      }
    }

    // Fallback: direct join
    try {
      await client.joinCommunity(foundingCommunityId!);
      log('info', founder.personaId, 'Joined founding community directly');
      console.log(`  ✓ ${persona.name} joined founding community (direct)`);
      founder.communityIds.push(foundingCommunityId!);
    } catch (err: any) {
      log('error', founder.personaId, 'Failed to join founding community', { error: err.message });
      console.error(`  ✗ ${persona.name} failed to join community:`, err.message);
    }

    await sleep(400);
  }

  console.log('');

  // Step 5: Build seeded users list
  for (const fc of founderCredentials) {
    const persona = FOUNDERS.find(p => p.id === fc.personaId)!;
    seededUsers.push({
      personaId: persona.id,
      name: persona.name,
      email: persona.email,
      password: persona.password,
      userId: fc.userId,
      communityIds: fc.communityIds,
      location: persona.location,
      region: persona.region,
      type: 'founder',
      inviteDepth: 0,
      createdAt: new Date().toISOString(),
    });
  }

  // Step 6: Save state
  const foundersState = founderCredentials.map(fc => ({
    ...fc,
    foundingCommunityId,
  }));

  fs.writeFileSync(
    path.join(STATE_DIR, 'founders.json'),
    JSON.stringify(foundersState, null, 2)
  );
  fs.writeFileSync(
    path.join(STATE_DIR, 'users.json'),
    JSON.stringify(seededUsers, null, 2)
  );

  console.log('State saved to simulation/state/');
  console.log('');
  console.log('✅ Seeding complete!');
  console.log(`   ${seededUsers.length} founders registered`);
  console.log(`   Founding community: "${FOUNDING_COMMUNITY.name}"`);
  console.log('');
  console.log('Next step: npx ts-node simulation/scripts/run.ts --load-profile=steady');
}

seedFounders().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
