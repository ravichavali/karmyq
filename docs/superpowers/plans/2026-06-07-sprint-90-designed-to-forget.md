# Designed to Forget — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Karmyq's "designed to forget" promise real for content (a retention/anonymization job)
and visible for members (fading relationships, a re-warming nudge, a transparency page, and a warm
profile with a memory section).

**Architecture:** A new `memoryRetentionJob` in cleanup-service forgets exchange content on configurable
windows (anonymize completed-request free-text to sentinels, hard-delete expired/unmatched, cascade
messages), governed by a `retention_config` table that mirrors `trust_decay_config`. Karma is left fully
intact (no PII; `reason` is a load-bearing enum). A shared `classifyDecayTier` helper turns the existing
`trust_edges_live.current_weight` into a qualitative tier that the social-graph endpoints expose and the
frontend renders as perceptible fading.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `infrastructure/postgres/migrations/20260607-designed-to-forget.sql` | `retention_config` table (+ partial unique index on NULL global row + guarded seed) + `content_forgotten_at`/`forgotten_at` marker columns + partial indexes |
| `services/cleanup-service/src/jobs/memoryRetentionJob.ts` | The forgetting job: anonymize completed-request free-text, hard-delete expired/unmatched, cascade messages (karma untouched) |
| `services/cleanup-service/tests/unit/memoryRetentionJob.test.ts` | TDD-first unit tests for each forgetting branch + the cascade |
| `packages/shared/src/trust/decayTier.ts` | `classifyDecayTier(currentWeight, threshold)` pure helper + tier type |
| `services/social-graph-service/tests/tdd/sprint-90-decay-tier.test.ts` | Tier classification + endpoint shape tests |
| `apps/frontend/src/components/relationships/ReWarmingNudge.tsx` | Nudge card for `nearly_forgotten` bonds |
| `apps/frontend/src/components/profile/MemorySection.tsx` | Profile "what's held / what's fading" section |
| `apps/frontend/src/pages/about/memory.tsx` | Transparency page ("What Karmyq remembers — and what it lets go") |
| `apps/frontend/tests/tdd/sprint-90-memory-surfaces.test.tsx` | Fading visuals + memory section + nudge render tests |
| `docs/adr/ADR-069-data-retention-and-forgetting.md` | Retention/anonymization policy + Exchange Unit cascade |
| `docs/adr/ADR-070-visible-decay-model.md` | Decay-tier model + re-warming nudge |

### Existing files to modify
| File | Change |
|------|--------|
| `services/cleanup-service/src/index.ts` | Schedule `memoryRetentionJob` in the job runner |
| `services/social-graph-service/src/routes/trustGraph.ts` | Extend `/trust/graph/:communityId` + `/trust/graph/:communityId/full` (the routes that power `TrustGraphTab`) with per-edge `currentWeight`, `disappearanceThreshold`, `decayTier`; add `/trust/me/memory` + `/trust/relationships/fading` |
| `services/request-service/src/routes/requests.ts` | Add `GET /retention-policy` (resolved windows + held/forgotten counts) — **register before the `/:id` catch-all at line ~1178** |
| `apps/frontend/src/components/.../TrustGraphTab` | Render fade by `decayTier`; surface nudge |
| `apps/frontend/src/components/TrustPathBadge.tsx` | Accept + render `decayTier` fade consistently (the shared relationship-face element — no `RelationshipFace` component exists) |
| `apps/frontend/src/pages/profile/*` | Warm restyle (`.kq-*`, serif hero) + mount `MemorySection` |
| `apps/frontend/src/lib/api.ts` (or service client) | Wire the new endpoints |
| `apps/frontend/src/lib/onboarding/workflows.ts` | Reference memory/transparency surfaces |
| `services/registry.json` | New endpoints + cleanup-service job/event notes |
| `services/cleanup-service/CONTEXT.md`, `services/social-graph-service/CONTEXT.md`, `services/request-service/CONTEXT.md` | New job/endpoints/schema |
| `apps/landing/src/data/docs/concepts/*`, `guides/*`, `services/*`, `nav.json` | Concept + ADR + guide + service docs |
| `package.json` (root) | Version bump 10.13.0 → 10.14.0 |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **`karma_records` is OFF LIMITS — never write to it.** No PII; `reason` is a load-bearing enum
   (`'Provided help'`/`'Received help'`/milestones) filtered across `trustMetricsDb`, `trustEvolutionDb`,
   `communityTrustService`, `reputation.ts`. Touching `reason`/`points` silently corrupts trust scores.
   Forgetting only ever writes `help_requests` and `messages`.
2. **Target columns are `NOT NULL` → sentinel, never `NULL`.** `help_requests.title`/`description` and
   `messages.content` are `NOT NULL`; `NULL` throws. Write `'[forgotten]'` (+ `'{}'::jsonb` for
   `payload`/`requirements`). **`messages.content` is the column, NOT `body`.** Conversations link to an
   exchange via `messaging.conversations.request_match_id` (the cascade join).
3. **Forget ALL request free-text** — `title`, `description`, `payload`, `requirements` — not just
   `description` (else PII stays in `title`/`payload`).
4. **Exchange Unit cascade is one transaction per exchange** — request + its conversation's messages
   forget together, or none. Karma is NOT part of the cascade.
5. **Expired model is the `expired` boolean, NOT `status='expired'`.** `status` is
   `open`/`dibs_pending`/`matched`/`completed`/`cancelled` (CHECK in `20260603-feed-vocab-reconciliation.sql`)
   — never `expired`; the expiration job sets the separate `expired = TRUE` flag. Hard-delete only
   `expired = TRUE` with NO match row, **aging from `updated_at`** (the job stamps it when it flips the
   flag — `created_at` would delete a just-expired old request immediately). Completed-anonymize trigger:
   `status='completed' AND updated_at < now() - window` (no `completed_at` column exists).
6. **`retention_config` NULL-row idempotency:** a bare `UNIQUE(community_id)` does NOT make the NULL
   global row unique in Postgres (`ON CONFLICT` won't fire on re-run → dup rows). Add a partial unique
   index `WHERE community_id IS NULL` + seed with `WHERE NOT EXISTS`. Resolution: community → global →
   hardcoded default. (Cross-schema FK to `communities.communities` is the established precedent.)
7. **`classifyDecayTier` is a single shared pure helper** — consumed by endpoints + tests; never inline
   the band math twice. Nudge fires only on `nearly_forgotten` (`1 ≤ r < 1.3`).
8. **`trust_edges_live` is a VIEW** — read `current_weight`; never write it. Sweep deletes from
   `trust_edges` base table.
9. **JWT field is `communities`** (`user.communities ?? []`) for membership gates on new endpoints.
10. **API unwrap:** frontend consumes `res.data`, not `res.data.data`.
11. **Landing docs gitignored** (`git add -f`); **nav.json reverts** after `generate-docs` (grep-verify, re-apply).
12. **Idempotent migration** (`IF NOT EXISTS` everywhere) + guarded global-row seed; job no-ops safely
    on empty config (hardcoded fallback windows).
13. **ADR numbering:** 069 + 070 this sprint; next free = 071.

---

## Task 1: Branch + retention migration

**Files:**
- Create: `infrastructure/postgres/migrations/20260607-designed-to-forget.sql`
- Modify: `package.json` (version → 10.14.0)

- [ ] Confirm you're on the sprint branch (it already exists with the planning commit):
  `git checkout feature/sprint-90-designed-to-forget` (use `-b` only if it doesn't exist yet)
- [ ] Write the migration exactly per the spec Data Model: `requests.retention_config` (mirror
  `trust_decay_config`) with partial unique index on the NULL global row + `WHERE NOT EXISTS` guarded
  seed, `content_forgotten_at` / `forgotten_at` columns, two partial indexes. Every statement idempotent.
- [ ] Bump root `package.json` version to `10.14.0`.

- [ ] **Verification** — apply against a local/CI Postgres and confirm idempotency (run twice):

```bash
psql "$DATABASE_URL" -f infrastructure/postgres/migrations/20260607-designed-to-forget.sql
psql "$DATABASE_URL" -f infrastructure/postgres/migrations/20260607-designed-to-forget.sql  # must not error
```

- [ ] Run the **migration-validator** agent on the new migration (cross-schema FK, IF NOT EXISTS guards, ownership).

---

## Task 2: Forgetting job — TDD tests first

**Files:**
- Create: `services/cleanup-service/tests/unit/memoryRetentionJob.test.ts`

- [ ] Write failing unit tests BEFORE the implementation (one per branch), using seeded fixtures:
  - Completed request (`status='completed'`) with `updated_at` older than `completed_request_window_days` → `title`/`description` = `'[forgotten]'`, `payload`/`requirements` = `'{}'`, `content_forgotten_at` set, **`karma_records` rows entirely unchanged** (reason + points), match row intact.
  - Its conversation's `messages.content` = `'[forgotten]'` + `forgotten_at` set (cascade), in the same pass.
  - Expired (`expired = TRUE`) + **unmatched** request whose `updated_at` is older than `expired_request_window_days` → row hard-deleted. (Aging from `updated_at`, NOT `created_at`: assert a row created long ago but expired *today* is NOT deleted.)
  - Expired but **matched** request → NOT hard-deleted (anonymize path).
  - **Karma guard:** an aged completed exchange leaves its `karma_records.reason` (`'Provided help'`/`'Received help'`) and `points` byte-for-byte unchanged.
  - Standalone old message (no qualifying parent) older than `message_window_days` → `content` = `'[forgotten]'`.
  - Config resolution: community row overrides global; empty config → hardcoded fallback windows.
  - Idempotency: a second run forgets nothing already forgotten (partial-index predicate respected); re-running the migration does not create a second global config row.

- [ ] **Verification** — tests run and fail for the right reason (no implementation yet):

```bash
cd services/cleanup-service && npm run test:unit -- memoryRetentionJob
```

---

## Task 3: Forgetting job — implementation + schedule

**Files:**
- Create: `services/cleanup-service/src/jobs/memoryRetentionJob.ts`
- Modify: `services/cleanup-service/src/index.ts`

- [ ] Implement `forgetExchangeContent()` to make Task 2 pass: resolve windows from
  `requests.retention_config` (community → global → fallback), then run each branch. The Exchange Unit
  cascade (request free-text → sentinel + its conversation's messages → sentinel) runs in one
  transaction per exchange; **never write `karma_records`**. Expired-unmatched hard-delete and the
  standalone message backstop are separate batched statements. Log counts per branch.
- [ ] Wire the job into the cleanup-service scheduler in `src/index.ts` next to `trustEdgeSweepJob` /
  `reputationDecayJob` (same cadence pattern).

- [ ] **Verification**:

```bash
cd services/cleanup-service && npm run test:unit -- memoryRetentionJob   # all green
npx tsc --noEmit -p services/cleanup-service
```

- [ ] Run `/simplify` on the job + scheduler diff.

---

## Task 4: Shared decay-tier helper + social-graph endpoints

**Files:**
- Create: `packages/shared/src/trust/decayTier.ts`
- Create: `services/social-graph-service/tests/tdd/sprint-90-decay-tier.test.ts`
- Modify: `services/social-graph-service/src/routes/trustGraph.ts` (the real graph routes — NOT a `/connections` endpoint, which does not exist)

- [ ] Write `classifyDecayTier(currentWeight, threshold)` returning `strong | warm | fading |
  nearly_forgotten` per the spec bands, plus the TS type. Export from `@karmyq/shared`.
- [ ] TDD test: band boundaries (r = 3, 2, 1.3, 1) + the endpoint response shape.
- [ ] Extend **`/trust/graph/:communityId/full`** and **`/trust/graph/:communityId`** (the routes
  `TrustGraphTab` consumes via `getFullCommunityGraph()` / `getTrustGraph()`) so each edge includes
  `currentWeight`, `disappearanceThreshold`, `decayTier` (read from `trust_edges_live` + resolved
  threshold). Add `GET /trust/me/memory` (activeCount + `fading[]` + `nearlyForgotten[]`) and
  `GET /trust/relationships/fading` to the same router. Gate on `user.communities`.

- [ ] **Verification**:

```bash
cd services/social-graph-service && npm run test:tdd -- sprint-90
npx tsc --noEmit -p services/social-graph-service
```

- [ ] Run `/simplify` on the diff.

---

## Task 5: Retention-policy endpoint (transparency backing)

**Files:**
- Modify: `services/request-service/src/routes/requests.ts`
- Create/extend: a request-service TDD test for the endpoint

- [ ] Add `GET /retention-policy?communityId=` (resolves to `/api/requests/retention-policy`) returning
  resolved windows + counts of what is currently forgotten vs held for the requesting member (read-only,
  no PII). Membership-gated.
  - ⚠️ **Route order:** register this **BEFORE** the catch-all `router.get('/:id', ...)` at
    `requests.ts:1178` — Express matches top-down, so appending it after makes `/:id` capture
    `retention-policy` as an id (404/garbage). Put the static-path route above all `/:id*` routes.
- [ ] Test: returns resolved windows (community override honored), counts are non-negative, non-member →
  403, and `GET /retention-policy` is NOT shadowed by `/:id` (asserts it returns the policy, not an id lookup).

- [ ] **Verification**:

```bash
cd services/request-service && npm run test:tdd -- retention
npx tsc --noEmit -p services/request-service
```

- [ ] Run `/simplify` on the diff.

---

## Task 6: Frontend — fading relationship visuals

**Files:**
- Modify: `TrustGraphTab` / "How we're connected", `apps/frontend/src/components/TrustPathBadge.tsx`, `karmyq-shell.css`
- Wire the new endpoints in the frontend service client

- [ ] Add `decayTier` styling tokens to `karmyq-shell.css` (opacity/desaturation ramp). Thread `decayTier`
  through the shared `TrustPathBadge` component so bonds fade consistently in the graph
  and on feed cards. Tier label on hover. Consume `res.data` (no double-unwrap).

- [ ] **Verification**:

```bash
cd apps/frontend && npx tsc --noEmit
```

- [ ] Run `/simplify` on the diff.

---

## Task 7: Frontend — re-warming nudge

**Files:**
- Create: `apps/frontend/src/components/relationships/ReWarmingNudge.tsx`
- Modify: `TrustGraphTab` (mount the nudge for `nearly_forgotten` bonds)

- [ ] Build the nudge card ("You and {name} used to help each other often — reconnect before it fades")
  fed by `socialGraphService.get('/trust/relationships/fading')` (or `/trust/me/memory`'s
  `nearlyForgotten[]`). Suppress entirely when none.

- [ ] **Verification**: `cd apps/frontend && npx tsc --noEmit`
- [ ] Run `/simplify` on the diff.

---

## Task 8: Frontend — transparency page

**Files:**
- Create: `apps/frontend/src/pages/about/memory.tsx`

- [ ] Build "What Karmyq remembers — and what it lets go": the three windows (live from
  `/retention-policy`), anonymize-vs-hard-delete, the Exchange Unit cascade, and what's kept (aggregates).
  Plain language, warm-commons styling.

- [ ] **Verification**: `cd apps/frontend && npx tsc --noEmit`
- [ ] Run `/simplify` on the diff.

---

## Task 9: Frontend — profile warm restyle + memory section

**Files:**
- Create: `apps/frontend/src/components/profile/MemorySection.tsx`
- Create: `apps/frontend/tests/tdd/sprint-90-memory-surfaces.test.tsx`
- Modify: member profile page(s)

- [ ] TDD test first: fading visual renders by tier; memory section shows fading/active; nudge renders
  only when a nearly-forgotten bond exists; no empty placeholder tiles.
- [ ] Restyle the member profile to the S87–89 commons look (serif hero, `.kq-*` shell) and mount
  `MemorySection` (active relationships, fading, karma trend, "what we'll let go"). Suppress empty rows.

- [ ] **Verification**:

```bash
cd apps/frontend && npm run test:tdd -- sprint-90 && npx tsc --noEmit
```

- [ ] Run `/simplify` on the diff.

---

## Task 10: ADRs + landing docs + onboarding

**Files:**
- Create: `docs/adr/ADR-069-data-retention-and-forgetting.md`, `docs/adr/ADR-070-visible-decay-model.md`; modify `docs/adr/README.md`
- Create (landing, `git add -f`): `concepts/designed-to-forget.json`, `concepts/adr-069-data-retention-and-forgetting.json`, `concepts/adr-070-visible-decay-model.json`, `guides/your-memory-and-relationships.json`; modify `services/cleanup-service.json`, `services/social-graph.json`, `services/request.json`, `nav.json`
- Modify: `apps/frontend/src/lib/onboarding/workflows.ts`

- [ ] Write both ADRs (status `Accepted` → set `Implemented` post-deploy). Add landing concept + ADR +
  guide JSON, update affected service docs, update onboarding for the new surfaces.

- [ ] **Verification** — regenerate landing docs, then grep-verify nav.json kept every new entry:

```bash
cd apps/landing && npm run generate-docs
# re-apply nav.json entries if reverted, then:
git add -f apps/landing/src/data/docs
```

---

## Task 11: CONTEXT.md + registry.json + integration test

**Files:**
- Modify: `services/cleanup-service/CONTEXT.md`, `services/social-graph-service/CONTEXT.md`, `services/request-service/CONTEXT.md`, `services/registry.json`
- Create: `tests/tdd/sprint-90-forgetting-integration.test.ts`

- [ ] Document the new job, endpoints, schema columns, and `retention_config` in each CONTEXT.md and
  registry.json (new endpoints; cleanup-service job notes).
- [ ] Integration test: seed an aged completed exchange → run the job → assert request free-text
  (`title`/`description`/`payload`/`requirements`) + messages sentinelled, **`karma_records` untouched
  (reason + points)**, trust score unchanged, expired-unmatched deleted.

- [ ] **Verification**:

```bash
npm run analyze:services
npm run feedback:check
```

---

## Task 12: SDLC quality gates

- [ ] **`/simplify`** — final pass over the whole branch diff (reuse, altitude, shared helper not duplicated).
- [ ] **`/code-review`** — resolve correctness findings (esp. cascade transaction boundaries, expired-vs-matched guard, tier band edges).
- [ ] **`/security-review`** — resolve real findings; verify the retention-policy endpoint leaks no PII and forgetting can't be triggered cross-community. Dismiss the recurring `api.ts` `js/request-forgery` FP with justification.

- [ ] **Verification** — each gate run and findings resolved/justified in the PR body.

---

## Task 13: Final type check + pre-push verification

- [ ] **Verification**:

```bash
npm test                 # unit + regression green
npm run test:tdd         # sprint-90 suites green (pre-existing failures unchanged)
npm run feedback:check
npm audit --package-lock-only --audit-level=high
# full-repo tsc across changed services + frontend
```

- [ ] Confirm no NEW TDD failures beyond the documented pre-existing set.

---

## Task 14: Merge + Deploy

- [ ] Use the **`/deploy`** skill: open PR with the contract template (Summary / Validation / Docs /
  Quality gates / Security dismissals / Follow-ups / Lane), get maintainer merge authorization, merge to
  master, monitor GitHub Actions (CI/CD + Tests + CodeQL + Security Audit all green; dismiss the `api.ts`
  request-forgery FP after rescan if it re-fires), confirm demo health.
- [ ] SSH only if the migration must be applied manually on the demo DB before the new job runs.
- [ ] Post-deploy: flip ADR-069 + ADR-070 status to `Implemented`.
