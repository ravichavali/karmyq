# Sprint 91 — Service Consolidation (Phase 1) — ✅ IMPLEMENTED · ready for review gates + PR (v11.0.0)

> **▶ STATUS (2026-06-07):** feed-service folded into request-service. **11 → 10 services.** All
> blocking gates green (build, tsc, audit, feedback:check, full turbo test 25/25, Sprint 91
> feed-router TDD 6/6). Remaining before merge: SDLC review gates (`/code-review`,
> `/security-review`) and the PR + deploy.
>
> **NO DATABASE MIGRATION.** `feed.preferences` + `feed.dismissed_items` stay in place; ownership
> moved to request-service at the app layer only. `feed.featured_stories` orphaned-in-place (not
> dropped, see ADR-071). The deploy removes only the stateless feed-service container — DB untouched.

---

## What shipped this session (continuation of Codex's partial work)

Codex implemented the core fold (router, composers/ranker move, frontend/mobile repoint, infra
decommission, ADR-071, test migration) but was blocked on tooling for the finish. This session
completed the blocked items:

- **`services/registry.json`** — removed `feed-service` entry; added the 5 feed endpoints to
  `request-service.apis.provides`; added `feed` to request-service `database_schemas` + `/paths/batch`
  to consumes; removed feed-service from postgres `required_for`; stats `total_services` 11→10,
  `production_services` 10→9, `candidates_for_removal` 2→1; `updated` 2026-06-07. (Validated: parses, 10 services.)
- **`package-lock.json`** — physically deleted the half-deleted `services/feed-service/` dir + stale
  `node_modules/karmyq-feed-service` symlink, then regenerated from scratch (`npm install
  --package-lock-only --ignore-scripts`). 0 feed-service refs; lock version 11.0.0; `npm audit` clean.
- **`packages/shared/constants/config.ts`** + `apps/frontend/.env.production` + `.env.local.example`
  + `.env.demo.example` + `tests/{.env.test,e2e/.env,load/.env}.example` — removed all `FEED_API_URL` /
  `FEED_SERVICE_URL` / `NEXT_PUBLIC_FEED_API_URL` (FEED_API_URL was defined-but-unused in shared).
- **`npm run analyze:services`** — regenerated dependency-graph / impact-analysis / version-drift
  (GENERATED). No circular deps; no feed-service. Version drift (pg, axios) is pre-existing.
- **Landing docs** — regenerated via `apps/landing` `generate-docs` (wipes + rebuilds the whole
  gitignored `src/data/docs/` from sources). `feed-service.json` gone; `request-service.json` carries
  the 5 feed endpoints; `adr-071-service-consolidation-feed-service` concept JSON + nav entry present.
  Added the ADR-071 slug to `ADR_GROUPS` (Infrastructure) in `scripts/generate-docs.ts`.
- **ADR-071** status `Accepted` → `Implemented`; added to `docs/adr/README.md` index.
- **`claude.md`** — service table 11→10 (Feed row removed + S91 note); event routing dropped Feed
  from `request_created` / `user_joined_community`.
- **`services/request-service/CONTEXT.md`** — new §3.3d Feed View Layer (5 endpoint headings →
  picked up by generate-docs), `feed.*` schema ownership, dropped-endpoints note.
- **`services/auth-service/.claude/README.md`** — dependents 7→6 (feed-service removed).

## Verification (this session, all green)

| Gate | Result |
|------|--------|
| `services/request-service` build (`tsc`) | ✅ clean |
| `apps/frontend` `tsc --noEmit` | ✅ clean |
| `npm audit --package-lock-only --audit-level=high` (ADR-059) | ✅ 0 vulnerabilities |
| `npm run feedback:check` | ✅ exit 0 |
| `turbo run test` (all unit+regression) | ✅ 25/25 tasks |
| request-service unit (incl. ported ranker: proximity/urgency/recency, Auth-forward, graceful-degrade) | ✅ 128/128 |
| request-service regression | ✅ 141/141 |
| `tests/tdd/sprint-91-feed-router.test.ts` (incl. dropped-endpoints 404) | ✅ 6/6 |

**Pre-existing TDD failures unchanged** (DB-connection: sprint-89-community-pulse, sprint-68-halflife,
sprint-67, admin-schemas-api, social-graph sprint-66/67/68, frontend trust-model set). The DB-backed
integration test `tests/integration/request-service-feed.test.ts` runs in CI/deploy (no local Postgres).

## Reference sweep (complete)

All ACTIVE wiring is decommissioned. Remaining `feed-service`/`3007` matches are intentional:
immutable migration comment (`015_ui_schemas_dynamic.sql`), archived scripts (`scripts/archive/*`),
historical docs/examples, ADR-071/CONTEXT mentions, and generated landing ADR content.

## Remaining steps (next action)

1. **`/code-review`** the branch diff — esp. composer move, dismiss-path reconciliation, auth-gate carry-over.
2. **`/security-review`** the branch diff — the `api.ts` `js/request-forgery` CodeQL FP may re-fire on
   the new requestApi feed calls; dismiss after rescan (`feedback_request_forgery_api_baseurl_fp`).
3. **`/simplify`** final pass over the full diff if not already clean.
4. **Open PR** (cross-agent contract body). Title:
   `Sprint 91 — Service Consolidation (v11.0.0): fold feed-service into request-service (11→10 services)`.
5. On maintainer "pull it in" → merge → monitor GitHub Actions (tests + images + integration vs real
   Postgres + Deploy to Demo). Post-deploy: confirm `GET /api/requests/feed` works + dashboard/community
   feed render; watch per-service health during rollout (`feedback_no_docs_push_to_master`).

## Reference

- **Spec:** `docs/superpowers/specs/2026-06-07-sprint-91-service-consolidation-design.md`
- **Plan:** `docs/superpowers/plans/2026-06-07-sprint-91-service-consolidation.md`
- **ADR-071:** `docs/adr/ADR-071-service-consolidation-feed-service.md` (Implemented)
- **Feed code (folded):** `services/request-service/src/routes/feed.ts` + `src/services/feed/*` + `src/types/`
- **request-service mount:** `src/index.ts` — `/requests/feed` before generic `/requests`, with
  `rateLimiters.relaxed` + auth + optionalTenant + dbContext.

---

## Multi-sprint arc

- **Sprint 89** — Community sovereignty redesign. ✅ v10.13.0.
- **Sprint 90** — Designed to forget. ✅ v10.14.0.
- **Sprint 91 (THIS)** — Service Consolidation Phase 1: fold feed-service (11→10). → v11.0.0. ✅ implemented; review+deploy pending.
- **Sprint 92** — Service Consolidation Phase 2: geocoding → client-side (per ADR-071); cleanup KEPT.
- **Deferred** — Mobile parity (originally S91); a bug-fix sprint for BUG-001..005.

---

## Persistent Context (carry forward unchanged)

### Multi-agent PR process — ✅ LIVE on master (2026-06-02, PR #45)
- `.github/pull_request_template.md` = the cross-agent PR contract (Summary / Validation / Docs / Quality gates / Security dismissals / Follow-ups / Lane).
- `.github/workflows/pr-contract.yml` fails a PR whose body is empty or missing the four required headers; `dependabot[bot]` passes through.
- master **branch protection**: required checks = `pr-contract`, `Lint & Type Check`, `Test Frontend`, `Test Backend Services (Unit + Regression)`, `Code Scanning Gate (ADR-060)`, `Security Audit`; `strict: true`; 1 approving review; `enforce_admins: false`.
- **Merge authority:** Admin owns approval + merge; Claude validates merge-readiness and recommends, executes merge only on Admin authorization ("pull it in"). Agents never self-merge.
- A deliberate empty marker commit `90b9067` exists on master — do NOT "clean it up".

### ⚠️ Open dependabot PRs (#34–50) still need unblocking
Comment `@dependabot rebase` to pick up `pr-contract.yml`, then review per dependabot merge discipline
(inspect grouped PRs for MAJOR bumps; don't rapid-merge). Several are major bumps (tailwindcss 3→4 #41,
typescript-eslint 6→8 #40, expo/vector-icons 14→15 #39, gesture-handler 2→3 #37, eslint-config-expo
8→56 #36, eslint-config-next 15→16 #35).

### Architecture Gotchas (Persistent)
- **Landing page docs**: `apps/landing/src/data/docs/` is gitignored — `git add -f`. Generated by
  `scripts/generate-docs.ts` (wipes the dir each run); edit SOURCES (CONTEXT.md / ADR md / generate-docs.ts), never the JSON.
- **ADR numbering**: ADR-071 created in S91; **next free = 072.**
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`
- **Schema is `communities.communities`** (plural schema name)
- **API response unwrap**: `createApiClient` interceptor already unwraps the envelope — use `res.data`, not `res.data.data`
- **trust_edges_live is a VIEW**: never INSERT/UPDATE it
- **`git add` on CLAUDE.md**: tracked as lowercase `claude.md`
- **Solo dev — no worktrees**: work directly on feature branches
- **Root package.json version**: **11.0.0** (Sprint 91).
- **CI security gates**: dependency audit (ADR-059) + CodeQL (ADR-060) run automatically on push
- **request-service already calls social-graph** via `SOCIAL_GRAPH_API_URL` (`dibs.ts` + now the feed ranker).

### Open bugs (triage backlog, `docs/BUGS.md`)
BUG-001 community w/ no admin; BUG-002 feed reload shows already-offered requests; BUG-003 providers
say "Offer help"; BUG-004 missing wordmark; BUG-005 "Mark as done" doesn't unlock rating. Candidates
for a future bug-fix sprint.

### ⚠️ Deploy drift watch
`karmyq.org` live content drifted from `master` around Sprint 83. Confirm the most recent "Deploy to
Demo" run succeeded and live content matches `master` before judging by live content.
