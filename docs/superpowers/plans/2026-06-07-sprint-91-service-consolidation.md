# Service Consolidation (Phase 1) — Fold feed-service into request-service — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fold the 5 live feed-service endpoints into request-service as a `/requests/feed/*`
view layer, drop the 4 dead endpoints, and decommission feed-service — taking the platform from
11 services to 10 with no change to feed behavior.

**Architecture:** feed-service is a pure read/view layer (no queue/cron/events) that already
reads the `requests` schema over the shared `DATABASE_URL`. Its composers + ranker move into
`request-service/src/services/feed/`, its 5 live routes become a `feed.ts` router mounted at
`/requests/feed`, and the container/upstream/registry entry are removed.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `services/request-service/src/routes/feed.ts` | The 5 live feed endpoints (GET `/feed`, GET/PUT `/feed/preferences`, POST `/feed/dismiss/:itemId`, GET `/feed/community-health`) |
| `services/request-service/src/services/feed/feedComposer.ts` | Moved from feed-service (composer) |
| `services/request-service/src/services/feed/socialKarmaFeedComposer.ts` | Moved from feed-service (default composer) |
| `services/request-service/src/services/feed/basicFeedRanker.ts` | Moved from feed-service (ranker + social-graph proximity) |
| `services/request-service/src/types/feed.ts` | Moved feed types (from feed-service `types/index.ts`) |
| `services/request-service/tests/unit/feed-composer.test.ts` | TDD unit tests for compose/rank invariants |
| `tests/tdd/sprint-91-feed-merge-integration.test.ts` | Integration: request-service serves the 5 feed endpoints with identical contract |
| `docs/adr/ADR-071-service-consolidation.md` | Service audit + feed merge + phased decommission plan |
| `apps/landing/src/data/docs/concepts/adr-071-service-consolidation.json` | Landing ADR doc |

### Existing files to modify
| File | Change |
|------|--------|
| `services/request-service/src/index.ts` | Mount feed router at `/requests/feed`; ensure `SOCIAL_GRAPH_API_URL` available |
| `apps/frontend/src/lib/api.ts` | Remove `FEED_API_URL` + `feedApi`; migrate 5 calls to `requestApi` `/requests/feed/*`; fix dismiss path |
| `apps/frontend/src/components/CommunityHealthHero.tsx` | `feedApi` → `requestApi`, path `/requests/feed/community-health` |
| `infrastructure/nginx/nginx.conf` | Remove `feed_service` upstream + `/api/feed` location |
| `infrastructure/docker/docker-compose.yml` | Remove `feed-service:` service |
| `services/registry.json` | Remove feed-service; add feed endpoints to request-service; update statistics (11→10, candidates 2→1) |
| `services/request-service/CONTEXT.md` | Document feed view layer + `feed.*` schema ownership + dropped endpoints |
| `services/request-service/.claude/README.md` | Note it now serves the feed |
| `services/request-service/package.json`, root `package.json` | Version → 11.0.0 |
| `docs/adr/README.md` | Add ADR-071 index entry |
| `docs/ARCHITECTURE.md` | Service count 11→10; remove feed-service mention |
| `apps/landing/src/data/docs/services/request-service.json` | Add feed endpoints |
| `apps/landing/src/data/docs/nav.json` | Remove feed-service "Services" entry; add ADR-071 "Architecture Decisions" entry |

### Files/dirs to DELETE
| Path | Note |
|------|------|
| `services/feed-service/` | Entire directory |
| `apps/landing/src/data/docs/services/feed-service.json` | Landing service doc |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **FOLD THE UNCOMMITTED S90 DOC TAIL INTO THE FIRST COMMIT** (ADR-069/070 → Implemented md +
   README + landing JSON + handoff). NOT a standalone push — that triggers a redundant deploy
   that transiently breaks the demo (`feedback_no_docs_push_to_master`).
2. **feed-service has no Bull queue / cron / events** — pure read/view layer. Grep-confirm
   (`Queue`/`cron`/`karmyq-events` → none) before deleting. No scheduler rewiring.
3. **Only 5 of 9 endpoints are live — DROP the 4 dead** (`/feed/requests`, `/feed/milestones`,
   `/feed/featured-stories`, `/feed/mixed`) + the `feed.featured_stories` read path. No dead code
   into request-service.
4. **Mount feed router at `/requests/feed`** — existing `/api/requests` nginx block serves it.
   REMOVE the dead `/api/feed` location + `feed_service` upstream. **nginx changes apply on
   deploy only** (`feedback_nginx_config`).
5. **Frontend:** `feedApi`(`FEED_API_URL`:3007) → `requestApi`(`REQUEST_API_URL`:3003); paths
   `/requests/feed/*`. Remove `FEED_API_URL` + `feedApi`. **Unwrap `res.data`, not `res.data.data`.**
6. **Reconcile dismiss path** — canonical `/requests/feed/dismiss/:itemId`; fix the frontend call
   (currently `/feed/:itemId/dismiss`, likely dead/failing).
7. **Do NOT `DROP SCHEMA feed`** — `feed.preferences` + `feed.dismissed_items` stay; request-service
   owns them. No migration. `feed.featured_stories` becomes orphaned — note in ADR-071, don't drop.
8. **social-graph proximity:** reuse request-service's existing `SOCIAL_GRAPH_API_URL` pattern
   (`dibs.ts`); ensure it's in request-service compose env.
9. **Version 10.14.0 → 11.0.0 (MAJOR)** — service removed = breaking architectural change.
10. **JWT field `communities`** — carry feed-service's existing auth gate; don't loosen it.
11. **`npm run analyze:services` after deleting feed-service** regenerates dependency-graph /
    impact-analysis / version-drift — GENERATED, never hand-edit.
12. **Landing docs gitignored** (`git add -f`); **nav.json reverts** (grep-verify, re-apply).
13. **ADR numbering: next free = 071.**
14. **Behavior-preserving** — the 5 endpoints return identical shapes; tests assert the contract.

---

## Task 1: Feature branch + fold the S90 doc tail — ✅ DONE DURING PLANNING

The planning session already created `feature/sprint-91-service-consolidation` and committed the
spec + plan + handoff **plus the uncommitted S90 doc tail** (ADR-069/070 → Implemented md +
README + regenerated landing JSON + the bug skill + `docs/BUGS.md`) into the branch's first
commit — so nothing docs-only ever lands on master (`feedback_no_docs_push_to_master`).

- [ ] Just check out the branch and confirm:

```bash
git checkout feature/sprint-91-service-consolidation
git log --oneline -1   # the Sprint 91 planning commit
git status
```

Proceed to Task 2.

---

## Task 2: Confirm feed-service has no hidden coupling (audit gate)

**Files:** read-only

- [ ] Confirm no queue / cron / event publishing in feed-service (expect zero matches):

```bash
grep -rnE "Queue|new Worker|cron|karmyq-events|\.process\(|publish" services/feed-service/src
```

- [ ] Confirm the live endpoint set and the 4 dead ones, and enumerate every `feedApi` call site:

```bash
grep -nE "router\.(get|post|put|delete)" services/feed-service/src/routes/feed.ts
grep -rn "feedApi" apps/frontend/src
```

- [ ] Confirm `feed.*` tables in use (`preferences`, `dismissed_items` keep; `featured_stories` drop):

```bash
grep -rhoE "feed\.[a-z_]+" services/feed-service/src | sort | uniq -c
```

- [ ] **Stop and record** in the spec/ADR if anything unexpected surfaces (a queue, an event, a
  5th live endpoint). The plan assumes a clean read/view layer — verify before proceeding.

---

## Task 3 (TDD): Unit tests for the feed composer — written BEFORE the move

**Files:**
- Create: `services/request-service/tests/unit/feed-composer.test.ts`

- [ ] Write failing unit tests for the composition/ranking invariants you're moving. Assert exact
  values, not just "truthy" (per `feedback_testing_standard`). Cover at minimum:
  - Composer returns items sorted by the ranker's score (descending), stable for ties
  - Dismissed items are excluded from the composed feed
  - Social-proximity scoring is applied when `/paths/batch` returns data, and the composer
    degrades gracefully (no throw) when the social-graph call fails
  - Preferences shape round-trips (GET returns what PUT wrote)

- [ ] Run them red (implementation not moved yet):

```bash
cd services/request-service && npm test -- feed-composer 2>&1 | tail -20
```

---

## Task 4: Move the composers + ranker + types into request-service

**Files:**
- Create: `services/request-service/src/services/feed/{feedComposer,socialKarmaFeedComposer,basicFeedRanker}.ts`
- Create: `services/request-service/src/types/feed.ts`

- [ ] Copy the three service files + types from feed-service into `request-service/src/services/feed/`.
  Rewire imports to request-service's `db`/pool and `@karmyq/shared`. Remove the
  `feed.featured_stories` code path (it belonged to a dropped endpoint).
- [ ] Point the social-graph call at request-service's existing env convention
  (`SOCIAL_GRAPH_API_URL`, as used in `dibs.ts`).
- [ ] Make the Task 3 unit tests pass:

```bash
cd services/request-service && npm test -- feed-composer 2>&1 | tail -20
```

- [ ] `/simplify` the moved files (dedupe against request-service's existing DB helpers; drop any
  feed-service-only scaffolding).

---

## Task 5: Feed router in request-service (5 live endpoints, drop 4 dead)

**Files:**
- Create: `services/request-service/src/routes/feed.ts`
- Modify: `services/request-service/src/index.ts`

- [ ] Implement the 5 live endpoints in `feed.ts`, carrying the existing auth gate
  (`user.communities ?? []` where feed-service gated). Canonical dismiss path:
  `POST /dismiss/:itemId` (mounted under `/requests/feed`). Do NOT port the 4 dead endpoints.
- [ ] Mount in `index.ts`:

```typescript
import feedRouter from './routes/feed';
app.use('/requests/feed', rateLimiters.standard, feedRouter);
```

- [ ] Type-check + build:

```bash
cd services/request-service && npm run build 2>&1 | tail -20
```

- [ ] `/simplify` the router.

---

## Task 6: Frontend — repoint feed calls to request-service

**Files:**
- Modify: `apps/frontend/src/lib/api.ts`, `apps/frontend/src/components/CommunityHealthHero.tsx`

- [ ] Remove `FEED_API_URL` const + `feedApi` export. Migrate the 5 live calls to `requestApi`
  with `/requests/feed/*` paths. Fix the dismiss call to `/requests/feed/dismiss/:itemId`.
- [ ] Repoint `CommunityHealthHero.tsx` to `requestApi.get('/requests/feed/community-health?…')`.
- [ ] Grep-verify no `feedApi` / `FEED_API_URL` / `NEXT_PUBLIC_FEED_API_URL` references remain:

```bash
grep -rn "feedApi\|FEED_API_URL" apps/frontend/src
```

- [ ] Type-check:

```bash
cd apps/frontend && npm run type-check 2>&1 | tail -20
```

- [ ] `/simplify` the diff.

---

## Task 7: Decommission feed-service (infra + registry + delete)

**Files:**
- Modify: `infrastructure/nginx/nginx.conf`, `infrastructure/docker/docker-compose.yml`,
  `services/registry.json`
- Delete: `services/feed-service/`

- [ ] nginx: remove `upstream feed_service { … }` and `location ~ ^/api/feed(/.*)?$`.
- [ ] docker-compose: remove the `feed-service:` service definition (and any `depends_on:
  feed-service` references — grep).
- [ ] registry.json: delete the `feed-service` entry, add the 5 endpoints under
  `request-service.apis.provides`, update `statistics` (`total_services` 11→10,
  `candidates_for_removal` 2→1, `production_services` 10→9).
- [ ] Delete the directory: `git rm -r services/feed-service`.
- [ ] Regenerate the governance artifacts (GENERATED — don't hand-edit):

```bash
npm run analyze:services
```

- [ ] Grep for any lingering feed-service references:

```bash
grep -rn "feed-service\|feed_service\|3007" infrastructure services apps --include=*.ts --include=*.tsx --include=*.json --include=*.conf --include=*.yml | grep -v node_modules
```

- [ ] `/simplify` the infra diff.

---

## Task 8: ADR-071 + landing ADR doc

**Files:**
- Create: `docs/adr/ADR-071-service-consolidation.md`
- Create: `apps/landing/src/data/docs/concepts/adr-071-service-consolidation.json`
- Modify: `docs/adr/README.md`, `apps/landing/src/data/docs/nav.json`

- [ ] Write ADR-071: the service audit table (keep/merge/replace per service), the feed-service
  merge decision + mechanics, the **phased decommission plan** (Sprint 92: geocoding → client-side;
  cleanup KEPT with rationale — Sprint 90 logic), and the orphaned `feed.featured_stories` note.
  Status: `Implemented` (the feed merge ships this sprint).
- [ ] Add ADR-071 to `docs/adr/README.md`.
- [ ] Create the landing ADR JSON (slug `adr-071-service-consolidation`, number `071`) + add to
  nav.json "Architecture Decisions".
- [ ] Verify nav didn't revert:

```bash
grep -n "adr-071" apps/landing/src/data/docs/nav.json
```

---

## Task 9: CONTEXT / registry / landing service docs

**Files:**
- Modify: `services/request-service/CONTEXT.md`, `services/request-service/.claude/README.md`,
  `docs/ARCHITECTURE.md`, `apps/landing/src/data/docs/services/request-service.json`,
  `apps/landing/src/data/docs/nav.json`
- Delete: `apps/landing/src/data/docs/services/feed-service.json`

- [ ] request-service CONTEXT.md: add the feed view-layer section (5 endpoints), `feed.*` schema
  ownership, dropped-endpoints note.
- [ ] ARCHITECTURE.md: service count 11→10; remove feed-service row/mention.
- [ ] Landing: add feed endpoints to `request-service.json`; remove `feed-service.json` +
  its nav.json "Services" entry.
- [ ] Verify nav integrity (no dangling feed-service entry; ADR-071 present):

```bash
grep -n "feed-service\|adr-071" apps/landing/src/data/docs/nav.json
```

---

## Task 10: Integration test — request-service serves the feed

**Files:**
- Create: `tests/tdd/sprint-91-feed-merge-integration.test.ts`

- [ ] Integration test (DB-backed, runs in CI/deploy) proving request-service serves all 5 live
  feed endpoints with the **same response contract** feed-service did:
  - `GET /requests/feed` returns ranked items (envelope `{success,data}`)
  - `GET`/`PUT /requests/feed/preferences` round-trips
  - `POST /requests/feed/dismiss/:itemId` excludes the item from the next `GET /requests/feed`
  - `GET /requests/feed/community-health` returns the hero metrics shape
  - the 4 dropped paths return 404

- [ ] Run locally if DB available (else it runs in CI/deploy):

```bash
npm run test:integration 2>&1 | tail -20 || echo "no local DB — runs in CI"
```

---

## Task 11: SDLC quality gates

**Files:** whole branch diff

- [ ] **`/simplify`** — final pass over the full branch diff (reuse, altitude, dead code).

```bash
# resolve findings, then re-verify build
```

- [ ] **`/code-review`** — on the branch diff; resolve correctness/logic findings (esp. the
  composer move, the dismiss-path reconciliation, and the auth-gate carry-over).
- [ ] **`/security-review`** — on the branch diff; resolve real findings, justify dismissals. The
  recurring `api.ts` `js/request-forgery` CodeQL FP may re-fire (new requestApi feed calls) —
  dismiss as false positive after rescan (`feedback_request_forgery_api_baseurl_fp`).

---

## Task 12: Version bump + final verification

**Files:**
- Modify: root `package.json`, `services/request-service/package.json`

- [ ] Bump versions to `11.0.0` (root + request-service).
- [ ] Full pre-push verification:

```bash
npm test                    # unit + regression — must pass
npm run test:tdd            # report (pre-existing failures documented in handoff are OK)
npm run feedback:check      # docs complete
npm run analyze:services    # deps changed (feed-service removed)
npm audit --package-lock-only --audit-level=high   # ADR-059 gate clean
cd services/request-service && npm run build && cd ../../apps/frontend && npm run type-check
```

- [ ] Confirm no NEW test failures vs the documented pre-existing set.

---

## Task 13: Merge + Deploy

**Files:** n/a — use the `/deploy` skill.

- [ ] Open the PR with the cross-agent contract body (Summary / Validation / Docs / Quality gates
  / Security dismissals / Follow-ups / Lane). Title:
  `Sprint 91 — Service Consolidation (v11.0.0): fold feed-service into request-service (11→10 services)`.
- [ ] On maintainer authorization ("pull it in"), merge to master.
- [ ] Monitor the GitHub Actions run: tests + build images + **integration tests vs real Postgres**
  + **Deploy to Demo**. The feed-merge integration test must pass against the demo DB.
- [ ] **Post-deploy verification** — the demo no longer runs a feed-service container; confirm
  `GET /api/requests/feed` works and the dashboard/community feed render. Watch for the
  `feedback_no_docs_push_to_master` pattern (per-service health if anything 502s during rollout).
- [ ] Flip ADR-071 to `Implemented` if not already; dismiss the `api.ts` CodeQL FP after rescan
  if it re-fires.
