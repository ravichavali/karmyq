# Simulation Engine Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single-loop simulation engine with 10 concurrent async workers running 24/7, producing realistic mutual aid activity and a populated trust graph.

**Architecture:** New `WorkerPool` class runs 10 independent async worker loops via `Promise.all`. Growth engine moves to a standalone `setInterval`. Business hours gate removed entirely. Workflow weights calibrated so everyday mutual aid (request → offer → accept → complete) dominates; community/collective creation near-zero.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `services/simulation-service/src/worker-pool.ts` | WorkerPool class — 10 concurrent async workers |
| `services/simulation-service/src/workflows/vote-on-governance-workflow.ts` | Cast votes on active split/fusion proposals in user's communities |
| `services/simulation-service/tests/tdd/sprint-72-simulation-engine.test.ts` | Unit + integration tests for WorkerPool and behavioral invariants |

### Existing files to modify
| File | Change |
|------|--------|
| `services/simulation-service/src/simulator.ts` | Wire WorkerPool, extract growth to setInterval, remove business hours gate |
| `services/simulation-service/src/config/default.json` | Add worker config, disable business hours |
| `services/simulation-service/src/profiles/index.ts` | Calibrate weights: near-zero for community/collective creation, high for everyday mutual aid loop; add governance voting |
| `services/simulation-service/src/workflows/index.ts` | Export new vote-on-governance workflow |
| `services/simulation-service/src/api-client.ts` | Add `voteOnSplit()` and `voteOnFusion()` methods |
| `services/simulation-service/src/data/realistic-data.ts` | Expand request templates to 20+ per type, add geographic anchoring |
| `services/simulation-service/CONTEXT.md` | Update architecture section |
| `apps/landing/src/data/docs/guides/demo-data.json` | New user guide: "Understanding the Demo" |
| `apps/landing/src/data/docs/nav.json` | Add demo-data guide to User Guides section |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Trust edges via Bull queue only**: `match_completed` event → social-graph subscriber → `upsertTrustEdge()`. No direct trust API call needed from simulation.
2. **Workers are async, not OS threads**: `Promise.all` over 10 async loops is correct. Node.js event loop handles I/O concurrency.
3. **Business hours gate must be removed from code**: Remove the `isBusinessHours()` conditional in `simulator.ts` — don't just set `enabled: false` in config.
4. **Worker errors must not propagate**: Each worker loop needs `try/catch` that logs and continues, not re-throws.
5. **Growth engine to standalone setInterval**: Extract `maybeRegisterNewUser()` from the main loop into `setInterval(growthTick, 3 * 60 * 1000)`.
6. **No bootstrap guard**: The DB already has users — workers sample them immediately on start. New user registration stays as a low-frequency workflow action.
7. **Session affinity = probability weight only**: If sampled user has open requests, weight toward `acceptOffer` or `completeMatch` — no stateful session tracking.
8. **Community/collective creation = near-zero**: `createCommunities` → 0.005, `createCollective` → 0.02. Fission and fusion *initiation* should NOT be added — only voting on existing proposals.
9. **Governance voting uses direct DB query + API vote**: Query `communities.split_proposals` / `communities.fusion_proposals` via DB (simulation already has pool access) to find `status = 'voting'` proposals in the user's communities. Then cast vote via API. Check `split_votes` / `fusion_votes` tables first to avoid double-voting.
10. **`git add claude.md`** (lowercase) when staging CLAUDE.md on Windows.

---

## Task 1: Feature Branch

**Files:** None

- [ ] Create feature branch:
  ```bash
  git checkout -b feature/sprint-72-simulation-overhaul
  ```
- [ ] Verify current test suite passes:
  ```bash
  npm test
  ```

---

## Task 2: WorkerPool Class

**Files:**
- Create: `services/simulation-service/src/worker-pool.ts`

- [ ] Create `WorkerPool` class with a configurable worker count:

```typescript
import { SimulationConfig } from './types';
import { getRandomUser, generateToken } from './db-user-loader';
import { ApiClient } from './api-client';
import { selectWorkflow } from './profiles';
import { delay, randomInt } from './utils';

export class WorkerPool {
  private isRunning = false;

  constructor(private config: SimulationConfig) {}

  async start(workerCount: number): Promise<void> {
    this.isRunning = true;
    console.log(`🔧 Starting ${workerCount} simulation workers (24/7)...`);
    await Promise.all(
      Array.from({ length: workerCount }, (_, i) => this.runWorker(i))
    );
  }

  stop(): void {
    this.isRunning = false;
  }

  private async runWorker(id: number): Promise<void> {
    console.log(`[worker-${id}] started`);
    while (this.isRunning) {
      try {
        const user = await getRandomUser();
        if (!user) {
          await delay(10_000);
          continue;
        }

        const token = await generateToken({ id: user.id, email: user.email, name: user.name });
        const client = new ApiClient(this.config.apiBaseUrl);
        client.setToken(token);

        const workflow = await selectWorkflow(user, client, this.config);
        await workflow();

        const waitMs = randomInt(
          this.config.workers?.delayMs?.min ?? 5_000,
          this.config.workers?.delayMs?.max ?? 30_000
        );
        await delay(waitMs);

      } catch (err: any) {
        console.error(`[worker-${id}] error: ${err.message}`);
        await delay(10_000); // backoff before retry
      }
    }
    console.log(`[worker-${id}] stopped`);
  }
}
```

- [ ] Add `workers` field to `SimulationConfig` type in `src/types.ts`:
  ```typescript
  workers?: {
    count: number;
    delayMs: { min: number; max: number };
  };
  ```

---

## Task 3: Refactor `simulator.ts` — Wire WorkerPool + Remove Business Hours

**Files:**
- Modify: `services/simulation-service/src/simulator.ts`

- [ ] Remove the `isBusinessHours()` check and the `await delay(5 * 60 * 1000)` business-hours sleep entirely.

- [ ] Remove `SessionManager`, `activeSessions` map, and the `while (true)` main loop.

- [ ] Replace `start()` method with:

```typescript
async start() {
  console.log('🚀 Starting Karmyq simulation engine...');
  this.isRunning = true;

  await this.bootstrapFounders();

  // Growth engine: register new users on a fixed interval
  const growthInterval = setInterval(
    () => this.maybeRegisterNewUser().catch(console.error),
    3 * 60 * 1000  // every 3 minutes
  );

  // 10 concurrent workers running 24/7
  this.pool = new WorkerPool(this.config);
  await this.pool.start(this.config.workers?.count ?? 10);

  clearInterval(growthInterval);
}
```

- [ ] Update `stop()` to call `this.pool.stop()` instead of ending sessions.

- [ ] Remove the `registrationsToday` 24h-window counter from the class (keep rate limiting inside `maybeRegisterNewUser` if still desired, but simplify).

- [ ] Verify `src/index.ts` still calls `simulator.start()` correctly after refactor.

---

## Task 4: Update Config

**Files:**
- Modify: `services/simulation-service/src/config/default.json`

- [ ] Apply all config changes:

```json
{
  "enabled": true,
  "environment": "production",
  "schedule": {
    "type": "continuous",
    "businessHours": {
      "enabled": false,
      "start": "00:00",
      "end": "24:00",
      "timezone": "America/Los_Angeles"
    }
  },
  "workers": {
    "count": 10,
    "delayMs": { "min": 5000, "max": 30000 }
  },
  "users": {
    "total": 500,
    "profiles": {
      "activeHelper": 0.30,
      "requester": 0.25,
      "browser": 0.20,
      "communityBuilder": 0.10,
      "socialUser": 0.15
    }
  },
  "growth": {
    "newUsersPerDay": 15,
    "maxUsers": 500,
    "emailDomain": "test.karmyq.com",
    "password": "password123"
  },
  "rateLimit": {
    "respectLimits": true,
    "minDelayMs": 2000,
    "maxRetries": 3
  },
  "apiBaseUrl": "http://localhost:3000/api"
}
```

---

## Task 5: Workflow Calibration

**Files:**
- Modify: `services/simulation-service/src/profiles/index.ts`

The goal: the dominant activity should be the everyday mutual aid lifecycle (browse → offer → accept → complete). Governance actions (create community, create collective) should be rare enough that they almost never fire.

- [ ] Update `COMMUNITY_BUILDER` profile weights:
  - `createCommunities`: `0.05` → `0.005`
  - `createCollective`: `0.10` → `0.02`
  - `joinCommunity`: `0.30` → `0.10` (communities are already populated)
  - `registerAsProvider`: `0.15` → `0.03` (most users already registered as providers)
  - Compensate by increasing `offerHelp`, `acceptOffers`, `completeMatches` proportionally

- [ ] Update `ACTIVE_HELPER` profile weights:
  - `registerAsProvider`: `0.08` → `0.02` (most already registered)
  - `joinCollective`: `0.05` → `0.01`
  - Increase `completeMatches` and `offerHelp` to compensate

- [ ] Add session affinity: in the workflow selector (wherever `profiles/index.ts` builds the action list for a user), if the user has open requests (check via API or pass as context), double the weight of `acceptOffers` and `completeMatches`. This ensures lifecycle follow-through. Keep it as a probability tweak — no stateful session tracking.

- [ ] Verify no fission or fusion workflow files exist in `workflows/` — they should not be added.

---

## Task 6: Governance Voting Workflow

**Files:**
- Create: `services/simulation-service/src/workflows/vote-on-governance-workflow.ts`
- Modify: `services/simulation-service/src/workflows/index.ts`
- Modify: `services/simulation-service/src/api-client.ts`

The goal: when a split or fusion enters `voting` status, simulated members cast votes so governance proposals actually advance to quorum and execute.

- [ ] Create `vote-on-governance-workflow.ts`:

```typescript
import { SimulatedUser } from '../types';
import { ApiClient } from '../api-client';
import { pool } from '../db-user-loader'; // re-use existing pool

const VOTE_DISTRIBUTION = { yes: 0.80, abstain: 0.15, no: 0.05 };

function pickVote(): 'yes' | 'abstain' | 'no' {
  const r = Math.random();
  if (r < VOTE_DISTRIBUTION.yes) return 'yes';
  if (r < VOTE_DISTRIBUTION.yes + VOTE_DISTRIBUTION.abstain) return 'abstain';
  return 'no';
}

export async function voteOnGovernanceWorkflow(user: SimulatedUser, client: ApiClient): Promise<void> {
  // Get user's community memberships from DB
  const memberRes = await pool.query(
    `SELECT community_id FROM communities.members WHERE user_id = $1 AND status = 'active'`,
    [user.id]
  );
  const communityIds: string[] = memberRes.rows.map((r: any) => r.community_id);
  if (communityIds.length === 0) return;

  // Check active split votes
  const splitRes = await pool.query(
    `SELECT id, community_id FROM communities.split_proposals
     WHERE status = 'voting' AND community_id = ANY($1)`,
    [communityIds]
  );
  for (const proposal of splitRes.rows) {
    const alreadyVoted = await pool.query(
      `SELECT 1 FROM communities.split_votes WHERE proposal_id = $1 AND voter_id = $2`,
      [proposal.id, user.id]
    );
    if (alreadyVoted.rows.length === 0) {
      await client.voteOnSplit(proposal.community_id, proposal.id, pickVote());
    }
  }

  // Check active fusion votes
  const fusionRes = await pool.query(
    `SELECT id, community_a_id, community_b_id FROM communities.fusion_proposals
     WHERE status = 'voting' AND (community_a_id = ANY($1) OR community_b_id = ANY($1))`,
    [communityIds]
  );
  for (const proposal of fusionRes.rows) {
    const communityId = communityIds.includes(proposal.community_a_id)
      ? proposal.community_a_id
      : proposal.community_b_id;
    const alreadyVoted = await pool.query(
      `SELECT 1 FROM communities.fusion_votes WHERE proposal_id = $1 AND voter_id = $2`,
      [proposal.id, user.id]
    );
    if (alreadyVoted.rows.length === 0) {
      await client.voteOnFusion(communityId, proposal.id, pickVote());
    }
  }
}
```

- [ ] Add `voteOnSplit()` and `voteOnFusion()` methods to `api-client.ts`:

```typescript
async voteOnSplit(communityId: string, splitId: string, vote: 'yes' | 'no' | 'abstain') {
  return this.post(`/communities/${communityId}/splits/${splitId}/vote`, { vote });
}

async voteOnFusion(communityId: string, fusionId: string, vote: 'yes' | 'no' | 'abstain') {
  return this.post(`/communities/${communityId}/fusions/${fusionId}/vote`, { vote });
}
```

- [ ] Export `voteOnGovernanceWorkflow` from `workflows/index.ts`.

- [ ] Add `voteOnGovernance` to relevant profiles in `profiles/index.ts`:
  - `COMMUNITY_BUILDER`: weight 0.05
  - `ACTIVE_HELPER`: weight 0.03
  - `SOCIAL_USER`: weight 0.03

- [ ] Verify: check column name for voter ID in `split_votes` and `fusion_votes` tables (may be `voter_id` or `user_id`) — read the migration SQL before assuming.

  ```bash
  grep -A5 "CREATE TABLE.*split_votes\|CREATE TABLE.*fusion_votes" infrastructure/postgres/migrations/20260527-fission.sql infrastructure/postgres/migrations/20260527-fusion.sql
  ```

---

## Task 7: Expand Request Templates — Mission Alignment

**Files:**
- Modify: `services/simulation-service/src/data/realistic-data.ts`

- [ ] Expand each request type to 20+ template variants. Each template should:
  - Sound like a real person asking a real neighbor
  - Include geographic anchors (Portland neighborhoods: Hawthorne, Alberta, Buckman, Sellwood, St. Johns, Division, Mississippi)
  - Have natural urgency variation (urgent/time-sensitive vs. routine/flexible)
  - Reflect the karmyq mission: mutual care, not a gig economy

- [ ] Example voice for a ride request:
  - **Before**: `"Need a ride to the airport"`
  - **After**: `"My car is in the shop and I have a medical appointment at OHSU on Thursday morning — would anyone be able to give me a lift from Hawthorne? Happy to return the favor."`

- [ ] Review community descriptions for mission resonance — they should feel like real PDX neighborhoods, not corporate descriptions.

- [ ] Add 5 more name pairs to `FIRST_NAMES` and `LAST_NAMES` arrays for variety.

---

## Task 8: User Guide — "Understanding the Demo"

**Files:**
- Create: `apps/landing/src/data/docs/guides/demo-data.json`
- Modify: `apps/landing/src/data/docs/nav.json`

- [ ] Create `demo-data.json`:

```json
{
  "slug": "demo-data",
  "title": "Understanding the Demo",
  "description": "How the karmyq.com demo simulation works and what the data represents.",
  "content": "# Understanding the Demo\n\nThe live platform at karmyq.com runs a continuous simulation of a mutual aid network based in Portland, Oregon. This simulation exists so you can see what Karmyq looks like when it is actually being used — not a wireframe, but a living community.\n\n## What You're Seeing\n\nThe platform currently shows a simulated network of neighbors helping neighbors across several Portland communities: the Portland Mutual Aid Network, Southeast PDX Helpers, PDX Parents Co-op, Portland Tool Library & Share, and several professional service networks.\n\nAll accounts with `@test.karmyq.com` email addresses are synthetic. Their activity — requests for help, offers, completed matches, trust connections — is generated by a simulation engine running continuously in the background.\n\n## How Activity Is Generated\n\nThe simulation engine runs 10 concurrent workers, each independently acting as a simulated community member. Workers create help requests, offer assistance, complete matches, join communities, and build trust relationships — all through the same APIs a real user would call.\n\nThis means the trust graph, karma scores, and match history you see are the result of real platform behavior, not seeded test data. The simulation has been running long enough that trust edges reflect actual interaction history.\n\n## What Real Users Would Look Like\n\nIn a real deployment, each of these interactions would be a person. A neighbor without a car asking for a ride to a medical appointment. A parent needing a school pickup covered. Someone with tools to lend finding someone who needs them. The simulation is designed to reflect these real patterns so evaluators can understand what the platform looks like in practice.\n\n## Trust Graph\n\nThe trust network you see under the Trust Network tab shows how trust has accumulated between simulated users through repeated positive interactions. Every completed match strengthens the trust edge between the helper and the person they helped. This is how real trust networks form — through doing things together over time."
}
```

- [ ] Add to `nav.json` User Guides section:
  ```json
  { "slug": "demo-data", "title": "Understanding the Demo" }
  ```

- [ ] After editing `nav.json`, verify with grep that the change persisted (nav.json has a known revert issue — see architecture gotchas):
  ```bash
  grep "demo-data" apps/landing/src/data/docs/nav.json
  ```

---

## Task 9: CONTEXT.md Update

**Files:**
- Modify: `services/simulation-service/CONTEXT.md`

- [ ] Update "Architecture" section to describe WorkerPool (new) and remove SessionManager (retired).

- [ ] Update "Key Behavioral Parameters" table with new values (worker count 10, newUsersPerDay 15, business hours disabled, `createCommunities` 0.005, `createCollective` 0.02).

- [ ] Add "Recent Changes" entry for Sprint 72 with date 2026-05-29.

- [ ] Remove the `concurrentSessions.min/max` row from the parameters table (no longer applicable).

---

## Task 10: TDD Tests

**Files:**
- Create: `services/simulation-service/tests/tdd/sprint-72-simulation-engine.test.ts`

- [ ] Write unit tests for `WorkerPool`:
  - Verify `stop()` terminates all workers (isRunning = false after stop)
  - Verify workers restart after a single workflow error (error isolation)
  - Verify worker count matches config

- [ ] Write behavioral invariant tests:
  - A user with open requests is more likely to advance them than create new ones (session affinity probability check)
  - `createCommunities` weight on COMMUNITY_BUILDER profile is ≤ 0.01
  - `createCollective` weight on COMMUNITY_BUILDER profile is ≤ 0.03

- [ ] Write content quality assertions for `realistic-data.ts`:
  - Each request type has ≥10 template variants
  - No template is fewer than 20 characters (not a placeholder)
  - At least one Portland neighborhood name appears in each category

- [ ] Run tests:
  ```bash
  cd services/simulation-service && npm run test:tdd
  ```

---

## Task 11: Type Check + Pre-Push Verification

**Files:** None

- [ ] TypeScript check:
  ```bash
  cd services/simulation-service && npx tsc --noEmit
  ```

- [ ] Full test suite:
  ```bash
  npm test
  ```

- [ ] TDD tests:
  ```bash
  npm run test:tdd
  ```

- [ ] Feedback loop check:
  ```bash
  npm run feedback:check
  ```

- [ ] Verify nav.json still has the demo-data entry (revert bug):
  ```bash
  grep "demo-data" apps/landing/src/data/docs/nav.json
  ```

---

## Task 12: Merge + Deploy

- [ ] Run the `/deploy` skill to merge to master, push, and monitor GitHub Actions.
- [ ] After deploy: SSH to karmyq.com and restart simulation service:
  ```bash
  pm2 restart karmyq-simulation
  pm2 logs karmyq-simulation --lines 30
  ```
- [ ] Verify 10 workers are visible in logs:
  ```
  [worker-0] started
  [worker-1] started
  ...
  [worker-9] started
  ```
- [ ] Wait 2-3 minutes and verify activity appears in the platform (requests created, matches offered).
