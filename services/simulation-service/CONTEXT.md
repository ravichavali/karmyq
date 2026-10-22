# Simulation Service — Technical Context

**Port**: N/A (runs as a standalone process)
**Status**: development
**Criticality**: optional — used for demo data generation only

Sprint 134 PR L (BUG-068): the `submitFeedback` action is removed with its workflow, profile weights, type field,
`FEEDBACK_COMMENTS` pool and `ApiClient.submitMatchFeedback`. It posted to request-service
`POST /matches/:matchId/feedback`, which always failed (the client discarded the error) and is now retired, so the
simulation never produced rating data. The live rating path is reputation-service `POST /reputation/feedback`
(ADR-036); no workflow calls it yet. `sprint-72-simulation-engine.test.ts` asserts no profile schedules the action.

Sprint 132 PR C review: `inventory.borrow_notification_outbox` is a reset table alongside inventory
items/shares. Request hard deletion cascades its pending delivery intents. This classification
adds no demo operation authorization; the disposable CI curated reset gate verifies it.

Sprint 132 PR A: `TABLE_POLICY` preserves `auth.skill_vocabulary` as global reference data.
Member `auth.user_tags` remains a reset table. Sprint 133 PR A drops `auth.user_skills` and
removes its reset classification. No demo reset
or seed operation is part of this PR; `sprint-132-skill-vocabulary-preserved.test.ts` proves the
vocabulary classification independently of user data.

---

## Curated fixture standing now delegates to the canonical policy (Sprint 126 / ADR-096)

`src/fixtures/curatedDemo/baselineWriter.ts` projects completed exchanges through
`@karmyq/shared` `projectCompletedExchanges`, which no longer defines its own karma rules — it
delegates to `completedMatchStanding.ts`, the same policy live delivery and historical replay use.

**Curated karma output changed on four axes.** A reset produces different rows than before, by
design:

| Axis | Before | Now |
|---|---|---|
| Reason labels | `help_provided` / `help_received` / `first_help_bonus` | `Provided help` / `Received help` / `First help in community` |
| Milestone schedule | 1 / 5 / 10 / 25 | 1 / 10 / 50 / 100 |
| Milestone scope | platform-wide per helper | per `(helper, community)` |
| Community selection | every configured community, uncapped | ≤3 eligible, by prior helper karma |

The old labels were the reason curated karma was invisible to standing: `updateTrustScore` compares
`reason` against the prose strings **in SQL**, so snake_case rows were stored and then ignored.

`CompletedExchangeEvent` gained `eligibleCommunityIds`, defaulting to `[communityId]`. The baseline
writer passes the exchange's actual request community explicitly — a manifest naming one community
means one community, and widening it would fabricate reach the demo history never had. Fixture
karma inserts are `ON CONFLICT DO NOTHING`, because `uq_karma_match_projection` is now the
authoritative identity for those rows and a re-seed must be a no-op.

`DEFAULT_BASE_KARMA_POOL` was removed in favour of the shared `DEFAULT_KARMA_POOL`.

---

## Purpose

Generates realistic synthetic activity on the karmyq.com demo environment. Simulates users joining communities, posting requests, offering help, completing matches, registering as providers, and organizing into collectives. Runs continuously on the demo server to keep data fresh.

---

## Architecture

### Key Directories
```
src/
├── config/           # default.json — worker count, profile distribution, growth rate
├── data/
│   └── realistic-data.ts  # COMMUNITIES, request templates, PROVIDER_TEMPLATES, name lists
├── profiles/
│   └── index.ts      # User behavior profiles + selectWorkflow() — picks action based on weights
├── types.ts          # UserProfile, ActionWeight, SimulatedUser, SimulationConfig types
├── simulator.ts      # Main orchestrator — bootstrapFounders, growth setInterval, WorkerPool launch
├── worker-pool.ts    # WorkerPool class — 10 concurrent async workers running 24/7
├── api-client.ts     # HTTP client wrapping all karmyq API endpoints
├── db-user-loader.ts # Loads real sim users from PostgreSQL; exports getPool()
└── workflows/        # One file per action type
```

### WorkerPool Architecture (Sprint 72)

`WorkerPool` runs 10 independent async worker loops via `Promise.all`. Each worker:
1. Picks a random DB user
2. Assigns a profile based on config distribution
3. Generates a JWT token directly (bypasses login API)
4. Creates an `ApiClient` instance with the token
5. Calls `selectWorkflow()` to pick an action weighted by profile
6. Executes the action; catches and logs errors without stopping the loop
7. Sleeps 5–30 seconds before the next iteration

Growth (new user registration) runs on a standalone `setInterval` every 3 minutes, decoupled from workers. Business hours gate has been removed — simulation runs 24/7.

---

## Workflows

| File | Action | Triggered by |
|------|--------|--------------|
| `request-workflow.ts` | Create help request (all 5 types) | REQUESTER, COMMUNITY_BUILDER, others |
| `offer-workflow.ts` | Offer help on an open request | ACTIVE_HELPER, COMMUNITY_BUILDER |
| `accept-offer-workflow.ts` | Accept a proposed match | REQUESTER |
| `complete-match-workflow.ts` | Mark match complete (both sides) | ACTIVE_HELPER, REQUESTER, COMMUNITY_BUILDER |
| `browse-workflow.ts` | Browse requests (no side effects) | BROWSER, others |
| `message-workflow.ts` | Send a message in a match conversation | SOCIAL_USER, ACTIVE_HELPER |
| `join-community-workflow.ts` | Discover and join communities | All profiles (forced if 0 communities) |
| `create-community-workflow.ts` | Create a new community from template | COMMUNITY_BUILDER (weight 0.001) |
| `register-provider-workflow.ts` | Register as a service provider | ACTIVE_HELPER (weight 0.02) |
| `create-collective-workflow.ts` | Create a provider collective, link to community | COMMUNITY_BUILDER (weight 0.01) |
| `join-collective-workflow.ts` | Join an existing provider collective | ACTIVE_HELPER (weight 0.01) |
| `browse-providers-workflow.ts` | Browse service provider listings | BROWSER, ACTIVE_HELPER |
| `schedule-activity-workflow.ts` | Create activities in group communities | COMMUNITY_BUILDER |
| `join-activity-workflow.ts` | Join open activities in communities | ACTIVE_HELPER, SOCIAL_USER, COMMUNITY_BUILDER |
| `vote-on-governance-workflow.ts` | Vote on active split/fusion proposals | ACTIVE_HELPER, COMMUNITY_BUILDER, SOCIAL_USER |
| `dibs-workflow.ts` | Requester calls dibs on a prior provider; provider accepts/declines | REQUESTER, ACTIVE_HELPER |
| `governance-nominate-workflow.ts` | Nominate high-trust members for moderator; ratify pending nominations | COMMUNITY_BUILDER, ACTIVE_HELPER, SOCIAL_USER |

---

## Key Behavioral Parameters (Sprint 72)

| Parameter | Value | File | Notes |
|-----------|-------|------|-------|
| Worker count | 10 | `config/default.json` + `worker-pool.ts` | 10 concurrent async workers running 24/7 |
| Worker delay | 5–30s | `config/default.json` | Random sleep between actions per worker |
| Business hours | Disabled | `simulator.ts` (removed gate) | Simulation runs 24/7 |
| Growth rate | 5 new users/day | `config/default.json` | ~480 growth ticks/day; probability per tick = 5/480 |
| Max users | 500 | `config/default.json` | |
| Community cap | 50 | `create-community-workflow.ts` | Sprint 77: was a dead `>=15` check against `limit:11` (unreachable); now `MAX_COMMUNITIES=50` |
| Join guard | `>= 6` communities → skip | `join-community-workflow.ts` | |
| Open request cap | 2 per user | `request-workflow.ts` | |
| Email domain | `@test.karmyq.com` | `db-user-loader.ts` | All sim user queries filtered to this domain via `SIM_ACTOR_POOL_FILTER`; explicitly excludes `@karmyq.test` e2e fixtures (Sprint 77) |
| `createCommunities` weight (COMMUNITY_BUILDER) | 0.001 | `profiles/index.ts` | Near-zero — avoids community proliferation |
| `createCollective` weight (COMMUNITY_BUILDER) | 0.01 | `profiles/index.ts` | Near-zero |

---

## Organic Growth Engine (Sprint 21)

The simulation no longer requires a bulk user creation script. Users are registered organically:

1. **Founder bootstrap** (`simulator.ts:bootstrapFounders`): On startup, checks if 5 named founder accounts exist. If not, registers them via the API. Founders: Maria Reyes, James Okafor, Priya Sharma, Wei Zhang, Fatima Alhassan — all with `@test.karmyq.com` emails.

2. **Ongoing growth** (`simulator.ts:maybeRegisterNewUser`): Each main loop tick probabilistically registers a new user. Rate = `newUsersPerDay / 480` per tick (loop runs every 1-5 min, ~480 ticks/day). Capped at `maxUsers` total and `newUsersPerDay` per 24h window.

3. **New user registration** (`workflows/register-user-workflow.ts`): Generates a random name + unique `{name}{suffix}@test.karmyq.com` email, registers via `/auth/register`, returns `{ id, email, name, token }`. Newly registered users immediately get an onboarding session (first action: join communities).

**To slow down growth**: Set `GROWTH_USERS_PER_DAY=3` env var. No code changes needed.

**To wipe and reseed**: `DELETE FROM auth.users WHERE email LIKE '%@test.karmyq.com'` — sim will re-bootstrap founders on next restart.

---

## Community Templates (Sprint 21)

9 communities, capped at 15 total:
1. Portland Mutual Aid Network (mutual_aid)
2. Southeast PDX Helpers (neighborhood)
3. PDX Parents Co-op (family)
4. Portland Tool Library & Share (sharing)
5. PDX Service Providers Network (professional) — anchor for provider collectives
6. PDX Rides Collective (professional) — ride providers
7. PDX Home Repair & Trades (professional) — tradesperson providers
8. Portland Tutors Network (professional) — tutor providers
9. Northeast PDX Community Circle (neighborhood)

---

## Provider Types

Valid API service types: `ride`, `tradesperson`, `tutor`, `other`

Ride providers include `ride_details` (vehicle_type, max_passengers, advance_booking_required).

---

## API Client Methods (`api-client.ts`)

### Requests & Matches
- `browseRequests(params)` — GET /requests
- `createRequest(data)` — POST /requests
- `offerHelp(requestId, userId)` — POST /matches
- `getMatches(params?)` — GET /matches
- `acceptMatch(matchId, userId)` — PUT /matches/:id/accept
- `completeMatch(matchId, userId, payload)` — PUT /matches/:id/complete

### Providers
- `registerProvider(data)` — POST /requests/providers
- `getMyProviderProfiles()` — GET /requests/providers/my
- `getProviders(serviceType?)` — GET /requests/providers (public browsing)

### Collectives
- `createCollective(data)` — POST /requests/collectives
- `getCollectives()` — GET /requests/collectives
- `getMyCollectives()` — GET /requests/collectives/my
- `joinCollective(collectiveId)` — POST /requests/collectives/:id/members
- `linkCollectiveToCommunity(collectiveId, communityId)` — POST /requests/collectives/:id/communities

### Communities
- `getCommunities(userId?)` — GET /communities
- `discoverCommunities(params?)` — GET /communities
- `createCommunity(data)` — POST /communities

---

## Recent Changes

### Sprint 134 PR D (2026-10-22) - `verify:demo` reads the demo env file
`src/scripts/demoEnvFile.ts`: `resolveDemoEnvPath` resolves `DEMO_ENV_FILE` (unset or empty → `.env.demo`)
against the **repo root**, as `scripts/demo/*.sh` do (under `npm --workspace`, `cwd` is this workspace, so the
old relative default missed the repo-root file). `verify:demo`'s `main()` calls `loadDemoEnvFile` before
`readEnv()`: it applies only `DEMO_CONFIG_KEYS` (the four story IDs + `DEMO_PERSONA_EMAIL`, the keys rotation
publishes; the rest of `.env.demo` is compose secrets and is never applied) via `dotenv.parse`, and exported
variables win, so the operator no longer exports the story IDs. A missing default is not an error; a missing
explicit `DEMO_ENV_FILE` reports unavailable. The report adds `envFile` + `envFileShadowed` (exported keys whose
value differs from the file), or `envFileLookedFor` when the default is absent: paths and key names, never
values. `readEnv()` is unchanged; `rotate:demo-stories` publishes to the same resolved path and passes it,
absolute, as `DEMO_ENV_FILE` to `DEMO_ENABLE_CMD`/`DEMO_RESTART_AUTH_CMD`.

### Sprint 133 PR D (2026-10-17) - curated skills layer
Curated seed gains (live on the demo since the authorized curated reset of 2026-10-19) skills, a skills-sharing opt-out, endorsements, items and standing offers; counts are
derived (`deriveEndorsementCounts`, `applyEndorsementCounts`) and proven against social-graph's reconcile
in CI; the verifier gains `skillsVisible` and `offerBoundary`. See *Sprint 133 PR D* under Sprint 117.

### Sprint 78 (2026-05-31) — Autonomous fission
- **`vote-on-governance-workflow.ts`** now drives the full fission loop for an admin's communities: (1) **propose** a split when `current_members >= 140` (urgent threshold) and no active proposal exists; (2) **vote** on `voting` split/fusion proposals; (3) **execute** any `approved` split. Over-cap communities now split with zero human action.
- **`api-client.ts`**: added `executeSplit`, `createSplitProposal`, `startSplitVote`.
- **`profiles/index.ts`**: bumped `voteOnGovernance` weight (0.03/0.05 → 0.10/0.12) so the propose→vote→execute loop progresses in reasonable time (it was too slow with a single admin per community).

### Sprint 77 (2026-05-30) — Data hygiene (ADR-062)
- **FIXED (cap bug)**: `create-community-workflow.ts` fetched `discoverCommunities({limit:11})` then checked `>= 15` — unreachable. Now `MAX_COMMUNITIES=50`, fetching `limit:51`. (Idempotent `POST /communities` makes runaway duplication impossible regardless; the cap just bounds churn.)
- **FIXED (actor pool)**: `db-user-loader.ts` now uses `SIM_ACTOR_POOL_FILTER` — selects `@test.karmyq.com` and explicitly excludes `@karmyq.test` e2e/integration fixtures so sim workflows never corrupt those accounts.

### Sprint 72 (2026-05-29)
- WorkerPool class: 10 concurrent async workers via `Promise.all` running 24/7
- Business hours gate removed from `simulator.ts` entirely
- Growth engine moved to standalone `setInterval(3min)`, decoupled from workers
- `selectWorkflow()` added to `profiles/index.ts` — replaces `performRandomAction()` in simulator
- 4 new workflows: vote-on-governance, submit-feedback, dibs (call + respond), governance nominations (nominate + ratify)
- All new api-client methods: `voteOnSplit`, `voteOnFusion`, `submitMatchFeedback`, `callDibs`, `getPendingDibsForProvider`, `acceptDibs`, `declineDibs`, `getGovernanceState`, `getCommunityMembers`, `nominateMember`, `ratifyNomination`
- Session affinity: if user has open requests, `acceptOffer`/`completeMatch` weights doubled
- Workflow weight calibration: `createCommunities` → 0.001, `createCollective` → 0.01, `submitFeedback` → 0.25–0.30
- Request templates expanded: 20+ authentic Portland mutual aid templates in GENERIC_REQUESTS
- `FEEDBACK_COMMENTS` pool (15 entries) added to `realistic-data.ts`
- User guide: "Understanding the Demo" added to landing site
- `getPool()` exported from db-user-loader.ts for direct DB queries in governance workflows

### Sprint 21 (2026-03-10)
- Organic user growth engine: 5 founders bootstrapped on startup, 10-15 new users/day via API registration
- New `register-user-workflow.ts`: standalone `registerNewUser()` for growth engine
- All DB queries now filtered to `@test.karmyq.com` domain
- Added `getUserCount()` and `userExistsByEmail()` to `db-user-loader.ts`
- Community cap raised 5 → 15; join guard raised 3 → 6 (target 5-6 communities/user, 75/community)
- Open request cap: 2 per user (prevents request glut)
- 4 new community templates: PDX Rides Collective, PDX Home Repair & Trades, Portland Tutors Network, Northeast PDX Community Circle
- FOUNDERS constant added to realistic-data.ts
- REQUESTER createRequests weight 0.8 → 0.3; ACTIVE_HELPER registerAsProvider weight 0.05 → 0.08
- Growth config in `default.json`: `newUsersPerDay`, `maxUsers`, `emailDomain`, `password`
- Configurable via env: `GROWTH_USERS_PER_DAY`, `GROWTH_MAX_USERS`, `GROWTH_EMAIL_DOMAIN`

### Sprint 20 (2026-03-10)
- Fixed community membership: join guard changed from "any → skip" to ">= 3 → skip" (was root cause of 3-6 members per community)
- Reduced community cap from 10 to 5 (demo had accumulated 37 communities)
- Trimmed COMMUNITIES to 5 templates, added PDX Service Providers Network
- Fixed provider service type mismatch: `skill`/`errand`/`care` → `tradesperson`/`tutor` (invalid types caused silent API failures)
- Added ride_details to ride provider registrations
- Added 3 new workflows: `create-collective`, `join-collective`, `browse-providers`
- Added 6 new API client methods for collectives and provider browsing
- Increased match completion rate from 10% to 50%
- Offer workflow now deduplicates (no same-user double offers) and routes providers to matching request types

## Sprint 116 (PR B): Maria relationship-story rehearsal

`src/scenarios/mariaRelationshipStory.ts` is a PURE planner + API-only apply for standing up two
contrasting demo stories: a rich, cross-community ORDINARY helper story and a low-overlap PROVIDER
story.

The rich floor splits into two parts. **Structural** overlap (`≥3` shared, `≥4` one-hop per side)
can only come from the real graph — `planMariaRelationshipStory` selects only structurally-rich
helpers and never synthesizes shared people. The **path** degree, by contrast, is repairable: when a
structurally-rich helper is more than two hops from Maria, the plan emits a single Maria↔helper
`request → offer → accept → two-sided-completion` exchange (`create_repair_request` … `complete_repair`
×2) to create the direct bond. A helper with no structural overlap cannot be repaired by one exchange,
so the plan warns and `applyMariaRelationshipStory` refuses (`floor.achievable === false`) rather than
validate a sparse picture.

Discovery is **selection-aware and lifecycle-aware**: a pre-existing match/offer only counts as
"already done" when it belongs to the selected helper/provider (matched by `responderId` /
`providerUserId`) **and is still reviewable** (`proposed` match, `pending` offer, on an `open`
request) — a terminal row never masks the story. Matches are fetched with the API's `request_id`
filter (not a latest-N system-wide window, which drops older stories on a busy demo). Candidate
one-hop overlap is measured with the **candidate's own token** (the neighborhood endpoint 404s on a
non-shared-community target, so Maria's token would abort gather for exactly the cross-community
helper). **Cross-community** is community-set disjointness (not first-community equality).

Selection-time overlap is a pre-match heuristic (`overlapFromNeighborhoods`) that counts only true
one-hop neighbours (`degrees_of_separation === 1`) and excludes **both anchors** — otherwise each ego's
own center and the post-repair direct edge would leak in as fake shared connections. Requests are
created at **platform** visibility scope (`STORY_REQUEST_SCOPE`) so a cross-community helper/provider
can actually reach and offer on them; the **provider** request is a valid `service` request carrying
the required `payload.service_category`. The repair exchange is **resumable and lifecycle-aware**: prior
repair request/match/completion state is gathered (the repair request is looked up regardless of
status, since accepting its match closes it), only a still-live (`proposed`/`matched`) repair match is
resumed — a rejected/cancelled one triggers a fresh exchange, a fully-completed one emits nothing — and
only the missing steps are re-emitted.

Apply mutates only through ordinary APIs, then verifies in two stages: it **re-reads authoritative
state** to derive the demo IDs from the server (never from mutation responses) — requiring an **open**
request with a still-live decision (`proposed` match / `pending` offer), so a concurrent transition to
rejected/declined/closed fails verification instead of being printed as "verified" — and then confirms
the rich floor by **re-measuring from the platform-wide match relationship-context** (the same contract
the demo renders), polling with bounded retries to tolerate the asynchronous `match_completed` trust
projection. Community-scoped neighborhoods are deliberately NOT used for verification: a repaired
cross-community edge is stored under Maria's request community and is invisible to a neighborhood walk
that requires the disjoint helper's active membership there. It imports no DB pool and seeds no trust
edges. The CLI
(`npm --workspace @karmyq/simulation-service run rehearse:maria-relationship`) is dry-run by default
and applies only with `-- --apply`. New api-client methods: `submitProviderOffer`,
`getOffersForRequest`, `getNeighborhood`.

### Sprint 116 post-deploy fix (2026-07-01) — neighborhood node identity normalization

The privacy-safe `GET /trust/neighborhood/:userId` contract identifies nodes with `user_id`, while
older simulation fixtures used the internal `id` field. The rehearsal now resolves either shape
through `neighborhoodNodeId()` before measuring one-hop overlap or path degree. Without this
normalization, every projected node collapsed to `undefined`, producing the misleading live floor
`sharedConnections: 1, mariaOneHop: 1, helperOneHop: 1` regardless of the actual graph. Regression
coverage uses the real outward `{ user_id, degrees_of_separation }` shape.

### Sprint 116 post-deploy fix (2026-07-01) — stable guided-demo persona

The continuous simulator now excludes the configured `DEMO_PERSONA_EMAIL` from both random actor
selection and actor counts. Without that boundary, Maria could randomly accept a competing proposal
on her rehearsed request, moving the request to `matched` and automatically rejecting the configured
demo match. `scripts/deploy.sh` propagates the same value from `.env.demo` into the PM2 simulation
environment; all other `@test.karmyq.com` actors continue driving the living demo.

## Sprint 117: Curated Demo Reset & Protected Core

Sprint 132 PR B adds `inventory` to the managed catalog scan and classifies both
`inventory.items` and `inventory.item_shares` as `reset`. Inventory is user data;
`auth.skill_vocabulary` remains `preserve`. `sprint-117-reset-safety.test.ts` checks
discovery and these classifications together. No demo reset is part of this PR.

The simulation service now owns two distinct populations:

- **Protected core** — a deterministic, curated historical baseline (`src/fixtures/curatedDemo/`):
  a typed manifest → compiler (semantic-key UUIDs, one-anchor relative ages) → guarded transactional
  reset. Trust/karma history is **derived**, not authored: the manifest declares completed exchanges
  and `packages/shared` `projectCompletedExchanges` rebuilds edges/karma using the same math as
  production (`computeRawWeight`/`allocateKarma`), locked by a cross-workspace equivalence test. Live
  `match_completed` behaviour is **unchanged** — this is fixture-only replay.
- **Ambient population** — the existing continuous simulation, which evolves everyone *except* the
  protected core. Actor selection excludes the entire manifest-protected email set
  (`getProtectedFixtureEmails()`), not just `DEMO_PERSONA_EMAIL`.

**Operator commands (all dry-run/read-only by default):**

| Command | Purpose |
|---|---|
| `npm --workspace @karmyq/simulation-service run reset:demo` | Print the reset plan (no mutation). |
| `npm --workspace @karmyq/simulation-service run reset:demo -- --apply` | Guarded destructive reset (fingerprint + backup + lock + txn; approved downtime). |
| `npm --workspace @karmyq/simulation-service run verify:demo` | Read-only outward-API health + privacy verification. Applies the story keys from `DEMO_ENV_FILE`, else the repo-root `.env.demo`, without overriding exported variables; the report names the file as `envFile`. |
| `npm --workspace @karmyq/simulation-service run rotate:demo-stories` | Explicit finite live-story rotation (never a full reset). |

The verifier is the only authority that publishes the four server-generated story IDs, and only after
authoritative privacy-scoped readback. Health is read-only; rotation replaces only finite live stories.
The legacy `scripts/truncate-database.*` paths now delegate to `reset:demo` or refuse.

### Sprint 133 PR D: curated skills layer (2026-10-17)

The curated manifest gains four fixture kinds, on top of `shareSkills?: false` on a person:
`skills` (`auth.user_tags`, slugged or deliberate free text), the opt-out (`auth.user_privacy_settings`,
only for the opted-out person, `person.ambient-09`), `endorsements` (`auth.skill_endorsements`, each on
one seeded exchange; one withdrawn, `revision = 2`) and `items` / item shares (`inventory`), plus
`offers` (`requests.help_offers`, three active standing offers). Ids are `semanticUuid(key)`, so they are
stable across resets. Skill X for the opt-out proof is `bookkeeping`, held by Amina and ambient-09.

- **Compiler fails closed** (`compiler.ts`, each error names the semantic key): endorsement rules are
  ADR-100's write rule (endorser != endorsee, skill belongs to endorsee, exchange between the pair with a
  completed match, both active members at the anchor, endorsee not opted out, `createdAge` younger than the
  exchange, `withdrawnAge` younger than `createdAge`, one per endorser and skill); items follow
  `inventoryDb` (one owner, shares only to communities the owner actively belongs to, community-owned items
  have no shares and an admin `createdBy`); offers need an active-member offerer and `expires_at` at least
  30 days after the anchor. Text limits (`TEXT_LIMITS`: tag 100, item name 120, offer title 255) are checked.
- **Arbiter-locked constants:** `SKILL_VOCABULARY`, `ITEM_CATEGORIES/CONDITIONS/STATUSES`, `OFFER_CATEGORIES`
  and `OFFER_TTL_DAYS` are asserted against the migrations, `init.sql` CHECK sets, `offer_ttl_days` and the
  offer form options by `tests/regression/sprint-133-demo-seed-arbiters.test.ts`. Never edit one without
  its source.
- **Counts are derived.** `deriveEndorsementCounts` mirrors `ENDORSEMENT_TARGETS_SQL`
  (`social-graph-service/src/services/endorsementReconcile.ts`): per normalized pair and community, the
  distinct endorsers with at least one non-withdrawn endorsement. Expected: Maria-Sophia 2, Maria-Wei 1,
  Maria-James 0, Elena-Fatima 2, Amina-Noah 1.
- **`applyEndorsementCounts`** (`baselineWriter.ts`, after `insertProjections`) reads
  `social_graph.interaction_weights` (community row beats global row, default 1.0) and sets
  `endorsement_count` and `raw_weight` in one `UPDATE` per pair; it throws unless exactly one edge row is
  updated.
- **CI proof:** `tests/tdd/sprint-117-demo-reset.integration.test.ts` runs social-graph's real
  `reconcileEndorsementPairLocked` in dry run under the pair lock after each of the two resets and expects
  no planned writes, checks `raw_weight` against the formula and the exact pair counts by identity, and
  includes a negative case (bump a count, expect a planned update).
- **Verifier** (`verifier.ts`, `ready` requires both; reads fail closed to status 0):
  `skillsVisible` (Maria sees Sophia's skills and her own cooking with 2 vouches; the Portland Mutual Aid
  directory is non-empty; as Noah, ambient-09's profile is 404, the bookkeeping search contains Amina and
  not ambient-09, and the providers directory map equals `expectedSkillDirectory`) and `offerBoundary`
  (Maria lists both Portland Mutual Aid offers and not the rides offer; the rides offer is 404 to her and
  200 to Marcus Lee). `failedReads` ids: `personas.maria-identity`, `personas.provider-identity`, `personas.unrelated-identity`, `skills.member-profile`, `skills.own-cooking-vouches`, `skills.community-directory`, `skills.opt-out-profile-hidden`, `skills.opt-out-search-control`, `skills.opt-out-search-absent`, `skills.directory-exact`, `offers.member-list`, `offers.member-read`, `offers.foreign-list-absent`, `offers.foreign-read-404`, `offers.non-vacuous-read`. New `ApiClient` methods:
  `listOffers()`, `getOffer(id)`, `getMemberSkills(userId)`, `getSkillDirectory(communityId)`,
  `searchCommunitySkills(communityId, skill)` (the term goes in `params`, so axios URL-encodes it).
- **Identity guard** (`getViewerUserId(viewer)` dep): each persona client's logged-in user id must equal
  `semanticUuid('person.maria' | 'person.provider' | 'person.outsider')`. A mismatch (or unreadable id) adds
  `personas.<viewer>-identity` to `failedReads`, fails the checks that persona feeds (Maria: both; provider:
  `skillsVisible`; unrelated: `offerBoundary`) and makes `ready` false, so a wrong env account cannot pass
  vacuously. `buildDeps` reads the ids from the login responses.
- **Compiler rules (review CR3/CR4):** a personal item's `createdBy`, if set, must equal its owner (the live
  inventory API records the caller as `created_by`); an endorsement's `createdAge` must be younger than its
  skill tag's (P120D).
- **Hidden reads cannot tell hidden from absent.** The three opt-out "hidden" reads (profile 404, search
  absence, foreign offer 404) cannot distinguish a hidden row from a missing one. Existence is proven in CI
  (the privacy row and the tags, by id) and the live reset is transactional, so a partial seed cannot ship.
- **Failure diagnostics (review I1):** `rotateStories` appends the verifier's `failedReads` to its refusal
  (`Refusing rotation: replacement stories are not ready (failed reads: ...)`), so `reset:demo` and
  `rotate:demo-stories` name the failing ids while the demo is down. `buildRotationDeps().verify` carries them.
- **Deploy-to-reset window.** After PR D deploys and before the authorized curated reset, `verify:demo`
  reports not-ready by design: the `skills.*` and `offers.*` ids fail because that data is not seeded yet, and
  `rotate:demo-stories` refuses. The curated reset is the remedy. A `personas.*` id is different: it means a
  wrong `DEMO_*_EMAIL` on the host (not missing data) and must be fixed in the host env BEFORE the reset.
- Applying this to the demo is a full curated reset and needs its own maintainer authorization.

## Sprint 131 PR B2 — declared imports (2026-09-17)

Now declares `bcryptjs` in `dependencies` at root's exact
ranges (BUG-046). They were imported but undeclared, resolving only through root hoisting. Resolved versions are
unchanged. `tests/regression/sprint-131-workspace-declarations.test.ts` fails on any undeclared import, and fails
when root's hoisted version stops satisfying a range declared here — so a root-only major bump (e.g. D1 dotenv 17)
must bump this manifest in the same PR. Range satisfaction alone could not enforce that: npm answers a stranded
range by nesting a satisfying older copy under the workspace, which keeps a plain satisfaction check green.

**Two pre-existing ranges here still differ from root and were deliberately left alone:** `dotenv ^16.3.0`
(root `^16.3.1`) and `jsonwebtoken ^9.0.0` (root `^9.0.2`). Neither is *stranded* — root's hoisted 16.6.1 and 9.0.3
both satisfy them, so the gate is green and this service runs the same copy as everyone else. Re-aligning them is a
D-series concern, not this PR's.

No endpoint, payload, event or schema change.

## Sprint 131 D1 — dotenv 17 (2026-09-19)

`dotenv` **16.6.1 → 17.4.2** (root plus all 9 npm workspaces that declare it; the ranges moved together in
one PR, which the declarations gate requires. The two non-workspace test manifests, `tests/e2e/package.json` and
`tests/load/package.json`, deliberately stay on `^16.3.1` with their own nested installs — dotenv 16 accepts
`quiet` too, so their call sites are fixed either way). `src/index.ts` now calls **`dotenv.config({ quiet: true })`**.

`quiet` is not cosmetic here. dotenv 16 defaulted it to `true`; 17 defaults it to falsy, so a bare
`config()` prints `◇ injected env (N) from .env // tip: …` on every call — and the tip is drawn at random
from an 8-entry list that includes third-party promo URLs. Without the flag this service would log a
non-deterministic marketing line on every container start.
`tests/regression/sprint-131-dotenv-quiet.test.ts` discovers the call sites from tracked source and fails
on any `config()` that omits `quiet`.

No endpoint, payload, event or schema change. `parse()` output is byte-identical between 16 and 17, and
nothing here reads `config()`’s return value.
