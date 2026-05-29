# Simulation Engine Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single-loop simulation engine with 10 concurrent async workers running 24/7, covering the full platform interaction surface — from match lifecycle to feedback, dibs, and governance.

**Architecture:** New `WorkerPool` class runs 10 independent async worker loops via `Promise.all`. Growth engine moves to a standalone `setInterval`. Business hours gate removed entirely. Workflow weights calibrated so everyday mutual aid (request → offer → accept → complete → feedback) dominates; governance actions near-zero.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `services/simulation-service/src/worker-pool.ts` | WorkerPool class — 10 concurrent async workers |
| `services/simulation-service/src/workflows/vote-on-governance-workflow.ts` | Cast votes on active split/fusion proposals |
| `services/simulation-service/src/workflows/submit-feedback-workflow.ts` | Post-match feedback (helpfulness/responsiveness/clarity) after completed matches |
| `services/simulation-service/src/workflows/dibs-workflow.ts` | Provider calls dibs on a request; requester accepts/declines |
| `services/simulation-service/src/workflows/governance-nominate-workflow.ts` | Nominate high-trust members for elevated roles; ratify pending nominations |
| `services/simulation-service/tests/tdd/sprint-72-simulation-engine.test.ts` | Unit + integration tests |

### Existing files to modify
| File | Change |
|------|--------|
| `services/simulation-service/src/simulator.ts` | Wire WorkerPool, extract growth to setInterval, remove business hours gate |
| `services/simulation-service/src/config/default.json` | Add worker config, disable business hours, lower growth rate |
| `services/simulation-service/src/profiles/index.ts` | Calibrate weights: near-zero for community/collective creation, add new workflows |
| `services/simulation-service/src/workflows/index.ts` | Export all new workflows |
| `services/simulation-service/src/api-client.ts` | Add methods: submitMatchFeedback, callDibs, getPendingDibsForProvider, acceptDibs, declineDibs, nominateMember, ratifyNomination, voteOnSplit, voteOnFusion |
| `services/simulation-service/src/data/realistic-data.ts` | Expand request templates, add feedback comments, add geographic anchors |
| `services/simulation-service/CONTEXT.md` | Update architecture section |
| `apps/landing/src/data/docs/guides/demo-data.json` | New user guide: "Understanding the Demo" |
| `apps/landing/src/data/docs/nav.json` | Add demo-data to User Guides section |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Trust edges via Bull queue only**: `match_completed` event → social-graph subscriber → `upsertTrustEdge()`. No direct trust API call needed.
2. **Workers are async, not OS threads**: `Promise.all` over 10 async loops. Node.js event loop handles I/O concurrency.
3. **Business hours gate must be removed from code**: Remove the `isBusinessHours()` conditional in `simulator.ts` — don't just set `enabled: false` in config.
4. **Worker errors must not propagate**: Each worker loop needs `try/catch` that logs and continues, not re-throws.
5. **Growth engine to standalone setInterval**: Extract `maybeRegisterNewUser()` to `setInterval(growthTick, 3 * 60 * 1000)`.
6. **No bootstrap guard**: DB already has users. Workers sample them immediately on start.
7. **Session affinity = probability weight only**: If sampled user has open requests, weight toward `acceptOffer`/`completeMatch` — no stateful session tracking.
8. **Community/collective creation = near-zero**: `createCommunities` → 0.001, `createCollective` → 0.01. Fission/fusion *initiation* NOT added — only voting on existing proposals.
9. **New user rate = 5/day**: DB already has users. New registrations are a slow organic trickle.
10. **Governance voting uses DB query + API vote**: Query `communities.split_proposals`/`fusion_proposals` WHERE `status = 'voting'`. Check `split_votes`/`fusion_votes` to avoid double-voting. Verify exact voter ID column name in migration SQL before coding.
11. **Post-match feedback is a separate endpoint**: `POST /matches/:matchId/feedback` with `{ from_user_id, helpfulness, responsiveness, clarity, comment }`. Separate from `completeMatch`. Check if user already submitted feedback before calling.
12. **Dibs is provider-initiated**: `POST /requests/:id/dibs` by the provider. `PUT /dibs/:id/accept` or decline by the requester. Check `GET /dibs/pending-for-provider` for provider-side, query DB or browse requests for requester-side pending dibs.
13. **Governance nominations require trust threshold**: The nomination endpoint rejects if the nominated user's trust score is below `eligibility_threshold` (default 50). Only nominate users who have been active (completed matches → trust edges built).
14. **`git add claude.md`** (lowercase) when staging CLAUDE.md on Windows.

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

- [ ] Create `WorkerPool` class:

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
        if (!user) { await delay(10_000); continue; }

        const token = await generateToken({ id: user.id, email: user.email, name: user.name });
        const client = new ApiClient(this.config.apiBaseUrl);
        client.setToken(token);

        const workflow = await selectWorkflow(user, client, this.config);
        await workflow();

        await delay(randomInt(
          this.config.workers?.delayMs?.min ?? 5_000,
          this.config.workers?.delayMs?.max ?? 30_000
        ));
      } catch (err: any) {
        console.error(`[worker-${id}] error: ${err.message}`);
        await delay(10_000);
      }
    }
    console.log(`[worker-${id}] stopped`);
  }
}
```

- [ ] Add `workers` field to `SimulationConfig` type in `src/types.ts`:
  ```typescript
  workers?: { count: number; delayMs: { min: number; max: number } };
  ```

---

## Task 3: Refactor `simulator.ts` — Wire WorkerPool + Remove Business Hours

**Files:**
- Modify: `services/simulation-service/src/simulator.ts`

- [ ] Remove the `isBusinessHours()` check and business-hours sleep entirely.
- [ ] Remove `SessionManager`, `activeSessions` map, and the `while (true)` main loop.
- [ ] Replace `start()` with:

```typescript
async start() {
  console.log('🚀 Starting Karmyq simulation engine...');
  this.isRunning = true;

  await this.bootstrapFounders();

  const growthInterval = setInterval(
    () => this.maybeRegisterNewUser().catch(console.error),
    3 * 60 * 1000
  );

  this.pool = new WorkerPool(this.config);
  await this.pool.start(this.config.workers?.count ?? 10);

  clearInterval(growthInterval);
}
```

- [ ] Update `stop()` to call `this.pool.stop()`.
- [ ] Remove `registrationsToday` 24h-window counter (keep rate limiting inside `maybeRegisterNewUser` if still needed).
- [ ] Verify `src/index.ts` still calls `simulator.start()` correctly.

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
    "newUsersPerDay": 5,
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

## Task 5: Workflow Calibration — Profile Weights

**Files:**
- Modify: `services/simulation-service/src/profiles/index.ts`

The dominant cycle: browse → offer → accept → complete → feedback. Everything else is incidental.

- [ ] Update `COMMUNITY_BUILDER` profile weights:
  - `createCommunities`: `0.05` → `0.001`
  - `createCollective`: `0.10` → `0.01`
  - `joinCommunity`: `0.30` → `0.08`
  - `registerAsProvider`: `0.15` → `0.02`
  - Add `voteOnGovernance: 0.05`
  - Add `submitFeedback: 0.20`
  - Add `callDibs: 0.05`
  - Add `nominateOrRatify: 0.02`

- [ ] Update `ACTIVE_HELPER` profile weights:
  - `registerAsProvider`: `0.08` → `0.02`
  - `joinCollective`: `0.05` → `0.01`
  - Add `voteOnGovernance: 0.03`
  - Add `submitFeedback: 0.25`
  - Add `callDibs: 0.10`

- [ ] Update `REQUESTER` profile:
  - Add `submitFeedback: 0.30` (requesters rate their helpers)
  - Add `acceptOrDeclineDibs: 0.10`

- [ ] Update `SOCIAL_USER` profile:
  - Add `voteOnGovernance: 0.03`
  - Add `submitFeedback: 0.15`

- [ ] Add session affinity: if the sampled user has open requests, double the weight of `acceptOffers` and `completeMatches` before selecting a workflow.

---

## Task 6: Governance Voting Workflow

**Files:**
- Create: `services/simulation-service/src/workflows/vote-on-governance-workflow.ts`
- Modify: `services/simulation-service/src/api-client.ts`
- Modify: `services/simulation-service/src/workflows/index.ts`

- [ ] Verify the exact voter ID column name in `split_votes` and `fusion_votes` tables:
  ```bash
  grep -A8 "CREATE TABLE.*split_votes\|CREATE TABLE.*fusion_votes" infrastructure/postgres/migrations/20260527-fission.sql infrastructure/postgres/migrations/20260527-fusion.sql
  ```

- [ ] Create `vote-on-governance-workflow.ts`:

```typescript
import { pool } from '../db-user-loader';
import { ApiClient } from '../api-client';
import { SimulatedUser } from '../types';

function pickVote(): 'yes' | 'abstain' | 'no' {
  const r = Math.random();
  return r < 0.80 ? 'yes' : r < 0.95 ? 'abstain' : 'no';
}

export async function voteOnGovernanceWorkflow(user: SimulatedUser, client: ApiClient): Promise<void> {
  const memberRes = await pool.query(
    `SELECT community_id FROM communities.members WHERE user_id = $1 AND status = 'active'`,
    [user.id]
  );
  const communityIds: string[] = memberRes.rows.map((r: any) => r.community_id);
  if (!communityIds.length) return;

  // Active split votes
  const splitRes = await pool.query(
    `SELECT id, community_id FROM communities.split_proposals WHERE status = 'voting' AND community_id = ANY($1)`,
    [communityIds]
  );
  for (const p of splitRes.rows) {
    const voted = await pool.query(
      `SELECT 1 FROM communities.split_votes WHERE proposal_id = $1 AND voter_id = $2`,
      [p.id, user.id]
    );
    if (!voted.rows.length) await client.voteOnSplit(p.community_id, p.id, pickVote()).catch(() => null);
  }

  // Active fusion votes
  const fusionRes = await pool.query(
    `SELECT id, community_a_id, community_b_id FROM communities.fusion_proposals
     WHERE status = 'voting' AND (community_a_id = ANY($1) OR community_b_id = ANY($1))`,
    [communityIds]
  );
  for (const p of fusionRes.rows) {
    const communityId = communityIds.includes(p.community_a_id) ? p.community_a_id : p.community_b_id;
    const voted = await pool.query(
      `SELECT 1 FROM communities.fusion_votes WHERE proposal_id = $1 AND voter_id = $2`,
      [p.id, user.id]
    );
    if (!voted.rows.length) await client.voteOnFusion(communityId, p.id, pickVote()).catch(() => null);
  }
}
```

- [ ] Add to `api-client.ts`:
```typescript
async voteOnSplit(communityId: string, splitId: string, vote: 'yes' | 'no' | 'abstain') {
  return this.client.post(`/communities/${communityId}/splits/${splitId}/vote`, { vote }).catch(() => null);
}
async voteOnFusion(communityId: string, fusionId: string, vote: 'yes' | 'no' | 'abstain') {
  return this.client.post(`/communities/${communityId}/fusions/${fusionId}/vote`, { vote }).catch(() => null);
}
```

---

## Task 7: Post-Match Feedback Workflow

**Files:**
- Create: `services/simulation-service/src/workflows/submit-feedback-workflow.ts`
- Modify: `services/simulation-service/src/api-client.ts`
- Modify: `services/simulation-service/src/workflows/index.ts`

This is the most impactful missing workflow — without it, the Social Karma system has no data.

- [ ] Check the exact feedback endpoint shape by reading `services/request-service/src/routes/feedback.ts` before coding — specifically what `from_user_id` expects, which ratings are required vs optional, and whether there's a duplicate-submission guard.

- [ ] Create `submit-feedback-workflow.ts`:

```typescript
import { SimulatedUser } from '../types';
import { ApiClient } from '../api-client';
import { randomInt } from '../utils';

const FEEDBACK_COMMENTS = [
  'Really helpful, showed up on time and went above and beyond.',
  'Great communication throughout. Would ask again.',
  'Friendly and efficient. Made everything easy.',
  'Genuinely kind — this is what neighbors are for.',
  'Quick response and followed through exactly as promised.',
  'A little hard to coordinate timing but ultimately came through.',
  'Did the job well. No complaints.',
];

export async function submitFeedbackWorkflow(user: SimulatedUser, client: ApiClient): Promise<void> {
  // Get user's completed matches that may still need feedback
  const matches = await client.getMatches({ status: 'completed' });
  if (!matches.length) return;

  // Pick a random recent completed match
  const match = matches[Math.floor(Math.random() * Math.min(matches.length, 5))];

  const isRequester = match.requester_id === user.id;
  const isResponder = match.responder_id === user.id;
  if (!isRequester && !isResponder) return;

  await client.submitMatchFeedback(match.id, {
    from_user_id: user.id,
    helpfulness: randomInt(3, 5),
    responsiveness: randomInt(3, 5),
    clarity: randomInt(3, 5),
    comment: FEEDBACK_COMMENTS[Math.floor(Math.random() * FEEDBACK_COMMENTS.length)],
    allow_featuring: Math.random() > 0.5,
  });
}
```

- [ ] Add to `api-client.ts`:
```typescript
async submitMatchFeedback(matchId: string, data: {
  from_user_id: string;
  helpfulness?: number;
  responsiveness?: number;
  clarity?: number;
  comment?: string;
  allow_featuring?: boolean;
}): Promise<any> {
  return this.client.post(`/matches/${matchId}/feedback`, data).catch(() => null);
}
```

- [ ] Export from `workflows/index.ts`.

- [ ] Verify: after running the workflow a few times, check that `requests.interaction_feedback` (or equivalent table) has rows. Confirm the karma event fires (check Bull queue or reputation service logs).

---

## Task 8: Dibs Workflow

**Files:**
- Create: `services/simulation-service/src/workflows/dibs-workflow.ts`
- Modify: `services/simulation-service/src/api-client.ts`
- Modify: `services/simulation-service/src/workflows/index.ts`

Dibs is a provider-initiated path: a provider spots an open request and "calls dibs" before formal matching. The requester then accepts or declines.

- [ ] Read `services/request-service/src/routes/dibs.ts` before coding — verify the request body for `POST /:id/dibs`, what `GET /dibs/pending-for-provider` returns, and the accept/decline body shape.

- [ ] Create `dibs-workflow.ts` with two entry points:

```typescript
// Provider side: call dibs on an open request
export async function callDibsWorkflow(user: SimulatedUser, client: ApiClient): Promise<void> {
  const requests = await client.browseRequests({ status: 'open', limit: 20 });
  if (!requests.length) return;
  const request = requests[Math.floor(Math.random() * requests.length)];
  if (request.requester_id === user.id) return; // can't dibs your own request
  await client.callDibs(request.id).catch(() => null);
}

// Requester side: check pending dibs on their requests and accept/decline
export async function respondToDibsWorkflow(user: SimulatedUser, client: ApiClient): Promise<void> {
  const myRequests = await client.browseRequests({ requester_id: user.id, status: 'open' });
  for (const request of myRequests) {
    const pendingDibs = await client.getDibsForRequest(request.id).catch(() => []);
    for (const dibs of (pendingDibs || []).slice(0, 2)) {
      // Accept 70% of the time, decline 30%
      if (Math.random() < 0.70) {
        await client.acceptDibs(dibs.id).catch(() => null);
      } else {
        await client.declineDibs(dibs.id).catch(() => null);
      }
    }
  }
}
```

- [ ] Add to `api-client.ts`:
```typescript
async callDibs(requestId: string): Promise<any> {
  return this.client.post(`/requests/${requestId}/dibs`, {}).catch(() => null);
}
async getDibsForRequest(requestId: string): Promise<any[]> {
  const res = await this.client.get(`/requests/${requestId}/dibs-candidate`).catch(() => null);
  return res?.data?.data || [];
}
async acceptDibs(dibsId: string): Promise<any> {
  return this.client.put(`/dibs/${dibsId}/accept`, {}).catch(() => null);
}
async declineDibs(dibsId: string): Promise<any> {
  return this.client.put(`/dibs/${dibsId}/decline`, {}).catch(() => null);
}
```

- [ ] Export both `callDibsWorkflow` and `respondToDibsWorkflow` from `workflows/index.ts`.

- [ ] Add profile weights: `callDibs` on ACTIVE_HELPER (0.10), `respondToDibs` on REQUESTER (0.10).

---

## Task 9: Governance Nominations + Ratification Workflow

**Files:**
- Create: `services/simulation-service/src/workflows/governance-nominate-workflow.ts`
- Modify: `services/simulation-service/src/api-client.ts`
- Modify: `services/simulation-service/src/workflows/index.ts`

Over time, trusted members should be elevated. This makes community leadership reflect actual participation history.

- [ ] Read `services/community-service/src/routes/governance.ts` before coding — note the `eligibility_threshold` (default 50 trust score), the `quorum_size`, and that the nominated user cannot ratify themselves.

- [ ] Create `governance-nominate-workflow.ts` with two entry points:

```typescript
// COMMUNITY_BUILDER: nominate a high-trust member for 'moderator' role
export async function nominateMemberWorkflow(user: SimulatedUser, client: ApiClient): Promise<void> {
  const communities = await client.getCommunities();
  if (!communities.length) return;
  const community = communities[Math.floor(Math.random() * communities.length)];

  // Get governance state to find existing nominations
  const govState = await client.getGovernanceState(community.id).catch(() => null);
  if (!govState) return;
  // Skip if there's already a pending nomination (avoid spam)
  if (govState.nominations?.some((n: any) => n.status === 'pending')) return;

  // Pick a random community member to nominate (not self)
  const members = await client.getCommunityMembers(community.id).catch(() => []);
  const candidates = members.filter((m: any) => m.user_id !== user.id && m.role === 'member');
  if (!candidates.length) return;

  const nominee = candidates[Math.floor(Math.random() * candidates.length)];
  await client.nominateMember(community.id, nominee.user_id, 'moderator').catch(() => null);
}

// Any member: ratify a pending nomination (not their own)
export async function ratifyNominationWorkflow(user: SimulatedUser, client: ApiClient): Promise<void> {
  const communities = await client.getCommunities();
  for (const community of communities.slice(0, 3)) {
    const govState = await client.getGovernanceState(community.id).catch(() => null);
    if (!govState?.nominations) continue;
    for (const nomination of govState.nominations.filter((n: any) => n.status === 'pending')) {
      if (nomination.nominated_user_id === user.id) continue; // can't ratify self
      await client.ratifyNomination(community.id, nomination.id).catch(() => null);
    }
  }
}
```

- [ ] Add to `api-client.ts`:
```typescript
async getGovernanceState(communityId: string): Promise<any> {
  const res = await this.client.get(`/communities/${communityId}/governance`).catch(() => null);
  return res?.data?.data || null;
}
async getCommunityMembers(communityId: string): Promise<any[]> {
  const res = await this.client.get(`/communities/${communityId}/members`).catch(() => null);
  return res?.data?.data?.members || [];
}
async nominateMember(communityId: string, nominatedUserId: string, role: 'moderator' | 'admin'): Promise<any> {
  return this.client.post(`/communities/${communityId}/governance/nominate`, {
    nominated_user_id: nominatedUserId, role
  }).catch(() => null);
}
async ratifyNomination(communityId: string, nominationId: string): Promise<any> {
  return this.client.post(`/communities/${communityId}/governance/ratify/${nominationId}`, {}).catch(() => null);
}
```

- [ ] Export both from `workflows/index.ts`.
- [ ] Profile weights: `nominateOrRatify` on COMMUNITY_BUILDER (0.02 nominate, 0.05 ratify), on ACTIVE_HELPER (0.03 ratify only), on SOCIAL_USER (0.03 ratify only).

---

## Task 10: Expand Request Templates — Mission Alignment

**Files:**
- Modify: `services/simulation-service/src/data/realistic-data.ts`

- [ ] Expand each request type to 20+ template variants with authentic Portland mutual aid voice:
  - Geographic anchors: Hawthorne, Alberta, Buckman, Sellwood, St. Johns, Division, Mississippi
  - Urgency variation (urgent/time-sensitive vs. routine/flexible)
  - Real neighbor language — warm, specific, human

- [ ] Example:
  - **Before**: `"Need a ride to the airport"`
  - **After**: `"My car is in the shop and I have a medical appointment at OHSU on Thursday morning — would anyone be able to give me a lift from Hawthorne? Happy to return the favor."`

- [ ] Add 10+ feedback comment strings to `FEEDBACK_COMMENTS` in `realistic-data.ts` (import these into `submit-feedback-workflow.ts` instead of hardcoding).

- [ ] Review community descriptions for mission resonance.

- [ ] Add 5+ name pairs to `FIRST_NAMES` / `LAST_NAMES` arrays.

---

## Task 11: User Guide — "Understanding the Demo"

**Files:**
- Create: `apps/landing/src/data/docs/guides/demo-data.json`
- Modify: `apps/landing/src/data/docs/nav.json`

- [ ] Create `demo-data.json`:

```json
{
  "slug": "demo-data",
  "title": "Understanding the Demo",
  "description": "How the karmyq.com demo simulation works and what the data represents.",
  "content": "# Understanding the Demo\n\nThe live platform at karmyq.com runs a continuous simulation of a mutual aid network based in Portland, Oregon. This simulation exists so you can see what Karmyq looks like when it is actually being used — not a wireframe, but a living community.\n\n## What You're Seeing\n\nThe platform currently shows a simulated network of neighbors helping neighbors across several Portland communities: the Portland Mutual Aid Network, Southeast PDX Helpers, PDX Parents Co-op, Portland Tool Library & Share, and several professional service networks.\n\nAll accounts with `@test.karmyq.com` email addresses are synthetic. Their activity — requests for help, offers, completed matches, trust connections — is generated by a simulation engine running continuously in the background.\n\n## How Activity Is Generated\n\nThe simulation engine runs 10 concurrent workers, each independently acting as a simulated community member. Workers create help requests, offer assistance, complete matches, submit feedback, call dibs on requests, and participate in community governance — all through the same APIs a real user would call.\n\nThis means the trust graph, karma scores, and match history you see are the result of real platform behavior, not seeded test data.\n\n## What Real Users Would Look Like\n\nIn a real deployment, each of these interactions would be a person. A neighbor without a car asking for a ride to a medical appointment. A parent needing a school pickup covered. Someone with tools to lend finding someone who needs them. The simulation reflects these real patterns so evaluators can see the platform as it would actually be used.\n\n## Trust Graph\n\nThe trust network shows how trust has accumulated between simulated users through repeated positive interactions. Every completed match strengthens the trust edge between the helper and the person they helped. This is how real trust networks form — through doing things together over time."
}
```

- [ ] Add to `nav.json` User Guides section:
  ```json
  { "slug": "demo-data", "title": "Understanding the Demo" }
  ```

- [ ] Verify nav.json persisted:
  ```bash
  grep "demo-data" apps/landing/src/data/docs/nav.json
  ```

---

## Task 12: CONTEXT.md Update

**Files:**
- Modify: `services/simulation-service/CONTEXT.md`

- [ ] Update "Architecture" section: describe WorkerPool, remove SessionManager reference.
- [ ] Update "Workflows" table: add all new workflows (vote-on-governance, submit-feedback, dibs, governance-nominate).
- [ ] Update "Key Behavioral Parameters" table: worker count 10, newUsersPerDay 5, business hours disabled, `createCommunities` 0.001, `createCollective` 0.01.
- [ ] Add "Recent Changes" entry for Sprint 72, date 2026-05-29.
- [ ] Remove `concurrentSessions.min/max` row (no longer applicable).

---

## Task 13: TDD Tests

**Files:**
- Create: `services/simulation-service/tests/tdd/sprint-72-simulation-engine.test.ts`

- [ ] WorkerPool unit tests:
  - `stop()` sets `isRunning = false` and workers exit
  - Worker error isolation: one workflow failure does not crash siblings
  - Worker count matches config

- [ ] Behavioral invariant tests:
  - `createCommunities` weight on COMMUNITY_BUILDER ≤ 0.002
  - `createCollective` weight on COMMUNITY_BUILDER ≤ 0.015
  - `submitFeedback` weight on ACTIVE_HELPER ≥ 0.20
  - `submitFeedback` weight on REQUESTER ≥ 0.25

- [ ] Content quality tests for `realistic-data.ts`:
  - Each request type has ≥ 10 template variants
  - No template < 30 characters
  - At least one Portland neighborhood name appears across all categories

- [ ] Run:
  ```bash
  cd services/simulation-service && npm run test:tdd
  ```

---

## Task 14: Type Check + Pre-Push Verification

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
- [ ] Verify nav.json still has demo-data entry:
  ```bash
  grep "demo-data" apps/landing/src/data/docs/nav.json
  ```

---

## Task 15: Merge + Deploy

- [ ] Run the `/deploy` skill to merge to master, push, and monitor GitHub Actions.
- [ ] After deploy: SSH to karmyq.com and restart simulation service:
  ```bash
  pm2 restart karmyq-simulation
  pm2 logs karmyq-simulation --lines 40
  ```
- [ ] Verify 10 workers started in logs:
  ```
  [worker-0] started ... [worker-9] started
  ```
- [ ] Wait 3–5 minutes and verify across platform:
  - New requests appearing
  - Matches being created and completed
  - Feedback records present: check `requests.interaction_feedback` table
  - Trust edges growing: check trust graph tab
