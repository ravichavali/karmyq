# Sprint 91 — Service Consolidation (Phase 1) — 📋 PLANNED · Ready to execute (v10.14.0 → v11.0.0)

> **▶ STATUS (2026-06-07):** Sprint 90 (Designed to Forget) shipped + closed as PR **#74**
> (`7d39fd6`), **v10.14.0**. **Mobile parity (the originally-planned Sprint 91) is DEFERRED** —
> maintainer redirected Sprint 91 to **architecture & service pruning** (the arc item previously
> scoped as Sprint 92, pulled forward).
>
> **Sprint 91 = fold feed-service into request-service** (11 services → 10) + **ADR-071** with a
> phased decommission plan for the remaining candidates (geocoding → client-side in S92; cleanup
> KEPT). Spec + plan written; branch not yet created. **Start by executing the plan.**
>
> **⚠️ UNCOMMITTED S90 DOC TAIL — folds into Sprint 91's FIRST commit (Task 1), do NOT push
> standalone:** ADR-069/070 status → Implemented (md + README + regenerated landing JSON), this
> handoff, and `docs/BUGS.md` are working-tree changes only — a docs-only master push triggers a
> redundant deploy that transiently breaks the demo (`feedback_no_docs_push_to_master`).

---

## Quick Start

1. Read this handoff.
2. The branch already exists with the planning commit (spec + plan + handoff + the S90 doc
   tail) — just check it out: `git checkout feature/sprint-91-service-consolidation`
   (NOT `-b` — it exists). Task 1 in the plan is therefore already done.
3. Open plan: `docs/superpowers/plans/2026-06-07-sprint-91-service-consolidation.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

## Sprint 91 goal (one sentence)

Fold the 5 live feed-service endpoints into request-service as a `/requests/feed/*` view layer,
drop the 4 dead endpoints, and decommission feed-service — taking the platform from 11 services
to 10 with **no change to feed behavior** — and publish ADR-071 with the phased decommission plan
for the rest of the prune.

## Why now

The registry has long flagged feed-service / geocoding-service / cleanup-service as redundant
(`statistics.candidates_for_removal: 2`). feed-service is the cleanest first cut: **pure
read/view layer, no Bull queue / cron / events**, already reads the `requests` schema over the
shared `DATABASE_URL`, and **only 5 of its 9 endpoints are live** (the other 4 are dead code).
Mobile parity deferred → this pulls the architecture-pruning arc forward.

## Scope decisions locked with maintainer (2026-06-07)

1. **Appetite = execute one real merge** (not audit-only): actually fold feed-service this sprint
   + write ADR-071 with the decommission plan for the deferred candidates.
2. **Route shape = fold under `/api/requests`** → feed becomes `/requests/feed/*`; frontend
   `feedApi` calls migrate to `requestApi`; **no new nginx block** (existing `/api/requests` block
   serves it); the dead `/api/feed` location + `feed_service` upstream are removed.
3. **Version = v11.0.0 (MAJOR)** — removing a service is a breaking architectural change.
4. **Drop the 4 dead endpoints** (`/feed/requests`, `/feed/milestones`, `/feed/featured-stories`,
   `/feed/mixed`) + `feed.featured_stories` usage — don't carry dead code into request-service.
5. **geocoding-service = DEFER to Sprint 92** (needs a real client-side geocoder migration, not a
   delete). **cleanup-service = KEEP** (Sprint 90's `memoryRetentionJob` lives there; jobs carry
   real TS logic pg_cron can't host). Both recorded in ADR-071.

## Critical Implementation Notes (copied verbatim from spec)

1. **FOLD THE UNCOMMITTED S90 DOC TAIL INTO SPRINT 91's FIRST COMMIT** (ADR-069/070 → Implemented
   md + README + landing JSON + handoff + BUGS.md). NOT a standalone push
   (`feedback_no_docs_push_to_master`).
2. **feed-service is a pure read/view layer — no Bull queue, no cron, no events.** Grep-confirm
   before deleting. No scheduler/event rewiring.
3. **Only 5 of 9 endpoints live — DROP the 4 dead** + the `feed.featured_stories` read path.
4. **Mount feed router at `/requests/feed`** — existing `/api/requests` nginx block serves it;
   REMOVE the dead `/api/feed` location + `feed_service` upstream. nginx applies on deploy only
   (`feedback_nginx_config`).
5. **Frontend:** `feedApi`(`FEED_API_URL`:3007) → `requestApi`(`REQUEST_API_URL`:3003); paths
   `/requests/feed/*`. Remove `FEED_API_URL` + `feedApi`. Unwrap `res.data`, not `res.data.data`.
6. **Reconcile dismiss path** — canonical `/requests/feed/dismiss/:itemId`; fix frontend (currently
   `/feed/:itemId/dismiss`, likely dead/failing).
7. **Do NOT `DROP SCHEMA feed`** — `feed.preferences` + `feed.dismissed_items` stay; request-service
   owns them. No migration. `feed.featured_stories` orphaned (note in ADR-071, don't drop).
8. **social-graph proximity:** reuse request-service's existing `SOCIAL_GRAPH_API_URL` (`dibs.ts`);
   ensure it's in request-service compose env.
9. **request-service DB role already has cross-schema read** — composer reads work unchanged.
10. **Version 10.14.0 → 11.0.0 (MAJOR)** — bump root + request-service package.json.
11. **JWT field `communities`** — carry feed-service's auth gate; don't loosen it.
12. **`npm run analyze:services` after deleting feed-service** regenerates dependency-graph /
    impact-analysis / version-drift — GENERATED, never hand-edit.
13. **Landing docs gitignored** (`git add -f`); **nav.json reverts** (grep-verify, re-apply).
14. **ADR numbering: next free = 071.**
15. **Behavior-preserving** — the 5 endpoints return identical shapes; tests assert the contract.

## What moves / drops / stays (the merge at a glance)

- **MOVES (request-service `src/services/feed/`):** `feedComposer.ts`, `socialKarmaFeedComposer.ts`,
  `basicFeedRanker.ts`, feed types → new `routes/feed.ts` mounted at `/requests/feed`.
- **LIVE endpoints absorbed:** `GET /feed`, `GET`/`PUT /feed/preferences`, `POST /dismiss/:itemId`,
  `GET /feed/community-health`.
- **DROPPED:** `GET /feed/requests`, `/feed/milestones`, `/feed/featured-stories`, `/feed/mixed`.
- **DELETED:** `services/feed-service/`, its docker-compose service, registry entry, nginx
  upstream + `/api/feed` block, `apps/landing/.../services/feed-service.json`.
- **STAYS:** `feed.preferences` + `feed.dismissed_items` tables (no migration).

## Reference

- **Spec:** `docs/superpowers/specs/2026-06-07-sprint-91-service-consolidation-design.md`
- **Plan:** `docs/superpowers/plans/2026-06-07-sprint-91-service-consolidation.md`
- **feed-service (to fold):** `services/feed-service/src/{routes/feed.ts, services/*Composer.ts, services/basicFeedRanker.ts}`
- **request-service (target):** `src/index.ts` route mounts; `dibs.ts` for the `SOCIAL_GRAPH_API_URL` pattern.
- **Open bugs (triage backlog, `docs/BUGS.md`):** BUG-001 community w/ no admin; BUG-002 feed
  reload shows already-offered requests; BUG-003 providers say "Offer help"; BUG-004 missing
  wordmark; BUG-005 "Mark as done" doesn't unlock rating. **Not in S91 scope** — candidates for a
  future bug-fix sprint.

---

## Multi-sprint arc

- **Sprint 89** — Community sovereignty redesign. ✅ v10.13.0.
- **Sprint 90** — Designed to forget: content retention + visible decay + profile memory. ✅ v10.14.0.
- **Sprint 91 (THIS)** — Service Consolidation Phase 1: fold feed-service (11→10). → v11.0.0.
- **Sprint 92** — Service Consolidation Phase 2: geocoding → client-side (per ADR-071); cleanup kept.
- **Deferred** — Mobile parity (originally S91); a bug-fix sprint for BUG-001..005.

---

## Persistent Context (carry forward unchanged)

### Multi-agent PR process — ✅ LIVE on master (2026-06-02, PR #45)
- `.github/pull_request_template.md` = the cross-agent PR contract (Summary / Validation / Docs / Quality gates / Security dismissals / Follow-ups / Lane).
- `.github/workflows/pr-contract.yml` fails a PR whose body is empty or missing the four required headers; `dependabot[bot]` passes through.
- master **branch protection**: required checks = `pr-contract`, `Lint & Type Check`, `Test Frontend`, `Test Backend Services (Unit + Regression)`, `Code Scanning Gate (ADR-060)`, `Security Audit`; `strict: true`; 1 approving review; `enforce_admins: false`.
- **Merge authority:** Admin owns approval + merge; Claude validates merge-readiness and recommends, executes merge only on Admin authorization ("pull it in"). Agents never self-merge.
- **Enforcement is identity-based** — same-machine agents (Claude, Codex) share admin `gh` creds, so "no direct push to master" is convention-by-discipline for them, not a hard gate. See AGENTS.md "Enforcement reality".
- A deliberate empty marker commit `90b9067` exists on master — do NOT "clean it up".

### ⚠️ Open dependabot PRs (#34–50) still need unblocking
The open dependabot PRs predate `pr-contract.yml`; their stale branches have no `pr-contract` status, so the now-required check **blocks** them. To unblock each: comment **`@dependabot rebase`** → recreated branch includes the workflow and passes via bot pass-through. Then review/merge per dependabot merge discipline (**inspect grouped PRs for MAJOR bumps; don't rapid-merge** — 5 concurrent deploys caused ENOTEMPTY). Several are major bumps (tailwindcss 3→4 #41, typescript-eslint 6→8 #40, expo/vector-icons 14→15 #39, gesture-handler 2→3 #37, eslint-config-expo 8→56 #36, eslint-config-next 15→16 #35) — inspect before merging.

### Architecture Gotchas (Persistent)
- **Landing page docs**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f`. (`docs/design/` is NOT gitignored — only the landing data dir is.)
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json — run from `apps/landing/`; grep-verify after; re-apply if reverted
- **ADR numbering**: ADR-069 + ADR-070 created in S90; **ADR-071 created in S91; next free = 072.**
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`
- **Schema is `communities.communities`** (plural schema name) — older `community.*` comments are stale
- **API response unwrap**: `createApiClient` interceptor already unwraps the envelope — use `res.data`, not `res.data.data`
- **trust_edges_live is a VIEW**: never INSERT/UPDATE it — write `trust_edges`, read `trust_edges_live`
- **messaging schema**: `messages.content` (NOT `body`); `conversations.request_match_id` links a thread to its exchange.
- **`git add` on CLAUDE.md**: tracked as lowercase `claude.md`
- **Solo dev — no worktrees**: work directly on feature branches
- **Root package.json version**: **10.14.0** (Sprint 90 shipped; **S91 bumps to 11.0.0**).
- **CI security gates**: dependency audit (ADR-059, blocking `--audit-level=high`) + CodeQL code-scanning gate (ADR-060) run automatically on push
- **`request_type` vs `category`**: `request_type` = 5-value `request_type_enum` (filter); `category` = fine
  payload subtype (`transportation` etc., what `RequestPayloadRenderer` switches on, what matching keys off).
  S86 surfaces `category` as `payload_type` on the card (ADR-067).
- **request-service already calls social-graph** via `SOCIAL_GRAPH_API_URL` (`dibs.ts`) — reuse for the feed proximity call.

### Pre-Existing TDD Failures (do NOT fix — a NEW failure this sprint is a real regression)
`sprint-39-provider-ux` (7), `sprint-43-feed-ranking` (crashes), `admin-schemas-api.test.ts` (request-service), `sprint-68-halflife` (6 DB-conn), `sprint-67-governance` (DB-conn), social-graph-service tdd `sprint-66`/`sprint-67`/`sprint-68`, plus the 5 frontend TDD failures noted in S89 (trust-model / useTrustQuestions / sprint-38/39/40).

### ⚠️ Deploy drift watch
`karmyq.org` live content drifted from `master` around Sprint 83. If judging by live content, first confirm the most recent "Deploy to Demo" GitHub Actions run succeeded and live content matches `master`.

### Sprint 81 residual (carried)
- JWT-in-URL exposure → nginx log scrub (shipped Sprint 83). Token TTL kept at 1h (documented). SSE auth tests promoted to regression.
