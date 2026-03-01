/**
 * run.ts — Main simulation orchestrator
 *
 * Spawns worker threads, one per active persona.
 * Each worker runs an autonomous session loop.
 *
 * Usage:
 *   npx ts-node simulation/scripts/run.ts [--load-profile=steady|spike|ramp] [--persona=id] [--ticks=N]
 */

import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { SimApiClient } from '../api/client';
import { PersonaState, SeededUser, Persona } from '../personas/types';
import { FOUNDERS } from '../personas/founders';
import { generatePersona } from '../personas/generator';
import { fetchContext, applyPropagation } from '../social-graph/propagation';
import { getActivityMultiplier, shouldActThisTick, selectAction } from '../scheduler/temporal';
import { runWorkflow, WorkflowName } from '../workflows';
import { log } from '../utils/logger';
import { naturalDelay, sleep } from '../utils/random';

dotenv.config({ path: path.join(__dirname, '../.env') });

const API_URL    = process.env.TARGET_API_URL ?? 'http://localhost';
const MAX_USERS  = parseInt(process.env.SIM_MAX_USERS ?? '50');
const CONCURRENCY = parseInt(process.env.SIM_CONCURRENCY ?? '5');
const TICK_MS    = parseInt(process.env.SIM_TICK_INTERVAL_MS ?? '5000');
const JITTER_MS  = parseInt(process.env.SIM_TICK_JITTER_MS ?? '3000');
const STATE_DIR  = path.join(__dirname, '../state');
const PENDING_INVITES_FILE = path.join(STATE_DIR, 'pending-invites.json');
const USERS_FILE = path.join(STATE_DIR, 'users.json');

// ─────────────────────────────────────────────────────────────────────────────
// Worker thread — runs one persona's session loop
// ─────────────────────────────────────────────────────────────────────────────

if (!isMainThread) {
  const { seededUser, maxTicks }: { seededUser: SeededUser; maxTicks: number } = workerData;

  async function runPersonaSession() {
    const persona: Persona = FOUNDERS.find(f => f.id === seededUser.personaId) ?? {
      id: seededUser.personaId,
      name: seededUser.name,
      email: seededUser.email,
      password: seededUser.password,
      backstory: '',
      motivation: '',
      location: seededUser.location,
      region: seededUser.region,
      profileType: 'browser',
      actionWeights: { browseRequests: 0.5, createRequest: 0.2, offerHelp: 0.3, acceptOffer: 0.5, completeMatch: 0.6, sendMessage: 0.3, generateInvite: 0.2, joinCommunity: 0.4, createCommunity: 0.05 },
      temporalPattern: { peakHours: [9,10,11,12,13,14], activeHours: [8,15,16,17], activeDays: [0,1,2,3,4,5,6], offPeakMultiplier: 0.05 },
      socialBias: { reciprocity: 1.2, inviteAfterHelped: true, requestAfterMatch: false, crossCommunityGrowth: 0.5 },
      inviteeRegions: [seededUser.region],
    } as Persona;

    const client = new SimApiClient(API_URL, persona.id);
    let token = '';

    // Login
    try {
      const result = await client.login(seededUser.email, seededUser.password);
      token = result.token;
      client.setToken(token);
    } catch (err: any) {
      log('error', persona.id, 'Login failed in worker', { error: err.message });
      process.exit(1);
    }

    const state: PersonaState = {
      persona,
      token,
      tokenExpiresAt: Date.now() + 6 * 24 * 60 * 60 * 1000, // 6 days
      userId: seededUser.userId,
      communityIds: seededUser.communityIds ?? [],
      recentlyHelped: false,
      recentlyHelpedSomeone: false,
      pendingOfferCount: 0,
      helpedReciprocally: false,
      inviteCodesPending: [],
    };

    // If no communities yet, force join first
    if (state.communityIds.length === 0) {
      await runWorkflow('joinCommunity', client, state);
    }

    const createdAt = new Date(seededUser.createdAt);
    let ticks = 0;

    log('info', persona.id, 'Session started', { location: persona.location });

    while (maxTicks === 0 || ticks < maxTicks) {
      await naturalDelay(TICK_MS, JITTER_MS);

      const multiplier = getActivityMultiplier(persona, createdAt);
      if (!shouldActThisTick(multiplier)) {
        ticks++;
        continue;
      }

      // Refresh social context every 5 ticks
      if (ticks % 5 === 0) {
        const context = await fetchContext(client, state);
        state.recentlyHelped = context.wasHelped;
        state.pendingOfferCount = context.pendingOffers;
        // Apply propagation to weights
        const adjustedWeights = applyPropagation(persona.actionWeights, context, persona);

        const action = selectAction(adjustedWeights) as WorkflowName;
        if (action) {
          const result = await runWorkflow(action, client, state);
          // Save new invite codes for the orchestrator to pick up
          if (action === 'generateInvite' && (result as any).inviteCode) {
            parentPort?.postMessage({ type: 'new_invite', code: (result as any).inviteCode, persona: persona.id, region: persona.region, inviteeRegions: persona.inviteeRegions });
          }
        }
      } else {
        const action = selectAction(persona.actionWeights) as WorkflowName;
        if (action) {
          await runWorkflow(action, client, state);
        }
      }

      ticks++;
    }

    log('info', persona.id, 'Session ended', { ticks });
    parentPort?.postMessage({ type: 'done', persona: persona.id });
  }

  runPersonaSession().catch(err => {
    log('error', workerData.seededUser?.personaId ?? 'unknown', 'Worker crashed', { error: err.message });
    process.exit(1);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main thread — orchestrator
// ─────────────────────────────────────────────────────────────────────────────

if (isMainThread) {
  const args = process.argv.slice(2);
  const profile = args.find(a => a.startsWith('--load-profile='))?.split('=')[1] ?? process.env.SIM_LOAD_PROFILE ?? 'steady';
  const singlePersona = args.find(a => a.startsWith('--persona='))?.split('=')[1];
  const maxTicks = parseInt(args.find(a => a.startsWith('--ticks='))?.split('=')[1] ?? '0');

  async function main() {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    if (!fs.existsSync(PENDING_INVITES_FILE)) {
      fs.writeFileSync(PENDING_INVITES_FILE, JSON.stringify([]));
    }

    let users: SeededUser[] = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));

    if (singlePersona) {
      users = users.filter(u => u.personaId === singlePersona);
      if (users.length === 0) {
        console.error(`Persona not found: ${singlePersona}`);
        process.exit(1);
      }
    }

    log('info', 'orchestrator', 'Starting simulation', { profile, concurrency: CONCURRENCY, userCount: users.length });
    console.log(`\n🚀 Karmyq Simulation — ${profile} profile`);
    console.log(`   ${users.length} users, max ${CONCURRENCY} concurrent\n`);

    const workers = new Map<string, Worker>();
    const existingEmails = new Set(users.map(u => u.email));

    // Handle invite codes from workers → spawn new users
    function handleWorkerMessage(worker: Worker, personaId: string, msg: any) {
      if (msg.type === 'done') {
        workers.delete(personaId);
      }
      if (msg.type === 'new_invite') {
        const pending: string[] = JSON.parse(fs.readFileSync(PENDING_INVITES_FILE, 'utf-8'));
        pending.push(msg.code);
        fs.writeFileSync(PENDING_INVITES_FILE, JSON.stringify(pending));

        // If under max users, grow the network
        if (users.length < MAX_USERS) {
          const newPersona = generatePersona(msg.persona, msg.region, msg.inviteeRegions, existingEmails);
          existingEmails.add(newPersona.email);
          spawnInvitee(newPersona, msg.code, msg.persona, users);
        }
      }
    }

    async function spawnInvitee(persona: Persona, inviteCode: string, invitedBy: string, userList: SeededUser[]) {
      const client = new SimApiClient(API_URL, persona.id);
      try {
        const result = await client.register(persona.email, persona.name, persona.password);
        client.setToken(result.token);

        // Accept the invite
        try { await client.acceptInvite(inviteCode); } catch { /* non-fatal */ }

        const newUser: SeededUser = {
          personaId: persona.id,
          name: persona.name,
          email: persona.email,
          password: persona.password,
          userId: result.user.id,
          communityIds: [],
          location: persona.location,
          region: persona.region,
          type: 'invited',
          invitedBy,
          inviteDepth: (userList.find(u => u.personaId === invitedBy)?.inviteDepth ?? 0) + 1,
          createdAt: new Date().toISOString(),
        };

        userList.push(newUser);
        fs.writeFileSync(USERS_FILE, JSON.stringify(userList, null, 2));
        log('info', persona.id, 'New user joined via invite', { invitedBy, location: persona.location });

        spawnWorker(newUser, maxTicks);
      } catch (err: any) {
        log('warn', persona.id, 'Failed to spawn invitee', { error: err.message });
      }
    }

    function spawnWorker(user: SeededUser, ticks: number) {
      if (workers.size >= CONCURRENCY) return;
      if (workers.has(user.personaId)) return;

      const worker = new Worker(__filename, {
        workerData: { seededUser: user, maxTicks: ticks },
        execArgv: ['--require', 'ts-node/register'],
      });

      worker.on('message', msg => handleWorkerMessage(worker, user.personaId, msg));
      worker.on('error', err => {
        log('error', 'orchestrator', `Worker error: ${user.personaId}`, { error: err.message });
        workers.delete(user.personaId);
      });
      worker.on('exit', () => workers.delete(user.personaId));

      workers.set(user.personaId, worker);
      log('info', 'orchestrator', `Spawned worker: ${user.personaId}`);
    }

    // Adjust concurrency by load profile
    const concurrencyMap: Record<string, number> = { steady: CONCURRENCY, spike: CONCURRENCY * 3, ramp: 1 };
    const targetConcurrency = concurrencyMap[profile] ?? CONCURRENCY;

    // Spawn initial workers
    for (const user of users.slice(0, targetConcurrency)) {
      spawnWorker(user, maxTicks);
      await sleep(500);
    }

    // Ramp profile: add a worker every 30s
    if (profile === 'ramp') {
      let index = targetConcurrency;
      const rampInterval = setInterval(() => {
        if (index >= users.length || workers.size >= CONCURRENCY * 10) {
          clearInterval(rampInterval);
          return;
        }
        spawnWorker(users[index++], maxTicks);
      }, 30000);
    }

    // Keep main thread alive
    process.on('SIGINT', () => {
      log('info', 'orchestrator', 'Shutting down...');
      workers.forEach(w => w.terminate());
      process.exit(0);
    });

    // Poll to refill workers when they exit (steady profile)
    if (profile === 'steady') {
      setInterval(() => {
        const reloadedUsers: SeededUser[] = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
        for (const user of reloadedUsers) {
          if (workers.size >= CONCURRENCY) break;
          spawnWorker(user, 0);
        }
      }, 10000);
    }
  }

  main().catch(err => {
    console.error('Fatal orchestrator error:', err);
    process.exit(1);
  });
}
