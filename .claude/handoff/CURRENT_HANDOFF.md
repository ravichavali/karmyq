# Sprint 119 — Truthful Surfaces & the Fractal Story — PR A GATES PASSED (awaiting merge authorization)

> **STATUS (2026-07-10, execution session):** PR A Tasks 1–9 COMPLETE on
> `feature/sprint-119-truthful-surfaces` (staged, ready to commit+push). All four SDLC gates run:
> two /simplify passes (8 agents, applied), /code-review at HIGH effort (8 finder angles; all
> confirmed findings FIXED — see below), /security-review (NO findings), full blocking tier green.
> BUG-029 fixed both ends + hardened by review: endpoints-only `computeCommunityPath`;
> scope-preferred deterministic `community_name` enrichment (single+batch, one set-based query);
> **cached community_member rows now revalidated on read** (pre-fix 3-node/1° shapes and
> departed-membership pairs are deleted + recomputed — closes the admin-node leak, stale-claim,
> and mixed-ranking TTL windows); `setAuthSession` removes a leftover refreshToken (cross-account
> refresh bleed found by review, test-pinned); **TrustCard** (missed consumer found by review) now
> names the community, never draws a person route (server passes community_name). Arrival:
> `beginArrival` is the ONE writer (open + invite paths), `hasOnboarded` adopted in
> welcome/WelcomeModal, both join surfaces share `isFirstEverJoin`. Header lever 2 shipped
> (overflow menu = one home for Communities/provider links; My Network keeps topnav). v11.28.0,
> BUGS.md BUG-029 → fixed, CONTEXT/registry/guides/landing updated (nav.json verified twice).
> Sprint-119 suites PROMOTED to regression (frontend 25 suites/223 tests; social-graph 22 suites).
> Known-accepted: batch community_name has no consumer yet (spec-mandated parity); PLAUSIBLE
> pre-existing edge (localStorage communities snapshot can route a stale-snapshot member to
> /welcome). Deferred follow-ups: computeInvitationPath disclosure-gate question, api.ts
> interceptor clearAuthSession adoption, cold-cache batch enrichment.
> **PR OPEN: https://github.com/ravichavali/karmyq/pull/149** (branch pushed, pre-push hook
> green, PR contract filled, gates recorded). **NEXT: cross-agent review if Codex available,
> verify PR CI green, then STOP for explicit Admin merge authorization**
> (`gh pr merge --squash --admin` is never self-authorized), CI/CD deploy, human validation
> checklist (plan Task 10). Post-merge: handoff status + PR B branches off `origin/master`.
> NOTE: this handoff edit is intentionally uncommitted — no docs-only push; it rides the next
> commit on a feature branch.
>
> Sprint 118 record: `.claude/handoff/archive/2026-07-09-sprint-118-invited-arrival-living-graph-COMPLETE.md`.

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout feature/sprint-119-truthful-surfaces` (already created)
3. Open plan: `docs/superpowers/plans/2026-07-09-sprint-119-pr-a-truthful-surfaces.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)
5. After PR A merges + deploys: branch `feature/sprint-119-graph-presentation` off
   `origin/master`, open `docs/superpowers/plans/2026-07-09-sprint-119-pr-b-graph-presentation.md`,
   run `/execute-plan` again (fresh chat per PR is the sanctioned exception for this two-PR sprint).

## Sprint Goal

No surface claims structure the data doesn't contain (PR A: BUG-029 fix at both ends + arrival
gap + setAuthSession helper + header lever 2), then give the two remaining graph scales their
at-a-glance answers (PR B: community ring = "where do you fit?", across-communities hub = "which
of your communities are woven together?") — closing the presentation question opened by the S114
revert, recorded as ADR-086.

## Arc Context

- S115 (ADR-083) made position earned; S118 (ADR-085) made ego edge state lived ("your web is
  growing/fading"). S119 PR B completes the fractal: one question per zoom level. Community-scale
  answer chosen by the maintainer this session: **"where do you fit?"** (viewer-centric, NOT
  weaving/fraying — that option was explicitly not chosen). Across-communities answer: **"which
  are woven together?"** (bridge emphasis + aliveness).
- BUG-029 fold-in was decided by the maintainer at S118 close; fix shape recorded there and in
  `docs/BUGS.md` (server endpoints-only path, badge "Fellow member of {community}", keep
  `degrees: 2` for ranking).

## Approved Artifacts

- Design: `docs/superpowers/specs/2026-07-09-sprint-119-truthful-surfaces-fractal-story-design.md`
- Plan PR A (10 tasks): `docs/superpowers/plans/2026-07-09-sprint-119-pr-a-truthful-surfaces.md`
- Plan PR B (9 tasks): `docs/superpowers/plans/2026-07-09-sprint-119-pr-b-graph-presentation.md`
- Branches: `feature/sprint-119-truthful-surfaces` (PR A, exists) →
  `feature/sprint-119-graph-presentation` (PR B, after PR A merges)
- Version: v11.27.0 → v11.28.0 (PR A) → v11.29.0 (PR B) · ADR: **ADR-086** (rides PR B)
- Scope decisions (maintainer, this session): theme = graph presentation phase 2 + all four
  ride-alongs (arrival gap, setAuthSession, header lever 2, invitation-wording review); two PRs,
  one sprint, per-PR plan files; each PR merges + deploys independently.

## Critical Implementation Notes (from the spec — read before implementing)

1. **BUG-029 is fixed at BOTH ends, presentation-truthful.** Server: `computeCommunityPath`
   (`pathComputation.ts:281`) returns endpoints + `community_name` only — the earliest-joined-admin
   lookup goes away. Keep `connection_type: 'community_member'` and **keep `degrees: 2`** (feed
   proximity ranking preserved — assert it doesn't move). Client: `TrustPathBadge.tsx` has TWO
   render sites naming the admin (~L88, ~L112) — fix both, grep for any other consumer of
   community_member path nodes. Cached rows become harmless via the renderer; no cache purge.
   BUT cache-hit responses omit `community_name` today (`paths.ts` cache-hit branch) — enrich
   community_member cache hits with the name on BOTH single + batch routes, prove it with a
   ROUTE-level cached-row test, and give the badge a "Fellow community member" fallback.
2. **`computeInvitationPath` wording is a review, not a rewrite** — "Joined through {inviter}" is
   factual provenance; change only if a surface renders it as a live trust route.
3. **Arrival gap: reuse the exact S118 pattern with its gates** (`communities/index.tsx:355-362`):
   fires only on a FIRST public join (`karmyq_onboarded:<userId>` AND legacy global key absent);
   invite-funnel joins already route; `/welcome` handles the no-membership deep link.
4. **`setAuthSession` scope = real-auth sites ONLY (login, register, invite).** `demo.tsx` is
   intentionally NOT migrated — it stores `demoContext` and REMOVES `refreshToken` by design
   (the tour must expire; `apps/frontend/CONTEXT.md`); `dashboard.tsx` only CLEARS → use a
   sibling `clearAuthSession`. Setter side effects exact: store `token`/`refreshToken`/`user`,
   clear `demoContext`, nothing more; `ApiClient.login/register` already set the token (#140);
   decode the JWT for membership (`communities`, never `communityMemberships`).
5. **Header: lever 1 is DONE** (`kq-page` already carries `--measure-chrome: 72rem`,
   `karmyq-shell.css:7`); this sprint is lever 2 only (move Communities/Service Providers into
   overflow). `kq-topnav` is xl-only (BUG-016) — audit md–xl first; don't regress the rhythm.
6. **Ring: rotation only — no layout invention (ADR-083).** Ring membership/order/geometry stay as
   S115 shipped; the viewer anchor rotates the existing order to 12 o'clock. decayTier opacity
   bands + `new > caller > focused` stroke precedence are shipped contracts — pin with regression
   assertions BEFORE touching emphasis.
7. **Do NOT add `formed_at` to community graph queries** — weaving/fraying was considered for the
   community scale and NOT chosen; `formed_recently` stays fail-closed false there.
8. **Bridge aliveness is server-derived, fail-closed, qualitative (ADR-082):** `active_recently` =
   `community_trust_edges.last_interaction_at` within the SAME exported 30-day constant S118
   introduced (no second window constant); the raw timestamp never leaves the server. Client-side
   it must survive the normalization hop (`normalizeCommunityDepthGraph`:
   `DepthLink.active_recently` → `TrustLink.activeRecently`) and the hub tests must exercise a
   RAW depth-graph payload through that hop, not only hand-built `TrustLink`s.
9. **Demo look: check bridge/degree data before judging surfaces** — the demo graph is sparse
   (avg ~4.6 connections; `community_trust_edges` may be thin); `maria.reyes` is the rich view;
   protected story core (maria.reyes / elena.torres / noah.williams / marcus.lee@test.karmyq.com)
   is never signed up or mutated in smoke tests.
10. **jsdom/D3 gotchas**: `^d3$` → `d3/dist/d3.min.js`, stub ResizeObserver, seed `node.__zoom`
    directly; `next/router` globally mocked in `jest.setup`.
11. **`getMyCommunities` returns `{communities,count,total}`, not an array** — extract defensively.
12. **TDD placement + turbo cache**: workspace `tests/tdd/`; run cross-workspace suites directly
    (`cd tests && npx jest ...`).
13. **`nav.json` silently reverts** — grep-verify after every landing regen.
14. **Two-PR sequencing**: PR A carries the S118 bookkeeping; PR B branches off `origin/master`
    after PR A merges; each PR merges via admin-authorized squash (explicit authorization required
    every time) and deploys via CI/CD; no docs-only master pushes. PR B's post-deploy bookkeeping
    (ADR-086 → Implemented, handoff COMPLETE) rides the NEXT sprint's first PR.
15. **Feed-ranking regression check for BUG-029**: only the `path` array shape changes; ranking
    inputs (`degrees_of_separation`) must not move.

## Carry-Forward / Known State

- **BUG-029** (`docs/BUGS.md`): open, diagnosed, fix shape agreed — fixed by PR A of this sprint.
- **Demo state:** curated baseline live (36 users, 6 communities, 14 trust edges) + two harmless
  S118 validation throwaways (both in SE Portland Running Club; remove via the S117 runbook if
  desired). Protected story core: see note 9.
- **Deferred candidates (not in S119):** desktop/mobile five-second-test UX pass; init.sql
  regeneration from fully-migrated schema (own sprint, docs/IDEAS.md 2026-07-08); docs-token
  cleanup on CLAUDE.md/AGENTS.md; community-pulse-adjacent open design question (governance
  ratification quorum) — see memory index.
- Docker unavailable locally; DB-backed assertions ride CI (full migrated schema via
  `scripts/ci-apply-full-schema.sh`, PR #143 — new migrations may need a sentinel there; this
  sprint has none).
- Root Turbo on Windows can hit Jest temp-cache `EPERM`; rerun isolated with unique caches under
  `C:\tmp` — assertion failures are not cache races.

## Persistent Context

### Multi-Agent PR Process

- Admin owns scope approval, merge authority, and deploy authorization.
- Claude owns merge-readiness recommendation and is the only agent that marks a sprint complete.
- Contributor agents never self-merge; one branch/PR per task and no direct commits to `master`.
- Copy and fill `.github/pull_request_template.md` when using `gh pr create`.
- The non-authoring agent performs cross-agent review when available.
- Do not independently resolve cross-agent conflicts; pause for reassignment.

### Architecture Gotchas

- Frontend uses the Pages Router (`apps/frontend/src/pages`).
- API interceptor unwraps envelopes: callers consume `res.data`, not `res.data.data`.
- JWT membership field is `communities`, not `communityMemberships`.
- Authorization uses live membership lookup; JWT membership is only a hint.
- Community schema is `communities.*`; auth schema is `auth.*`.
- Error contract is `{ success:false, message:string, error:string }` (ADR-074).
- `social_graph.trust_edges_live` is read-only.
- Request-service owns `/requests/feed`; there is no feed-service.
- `category` and `request_type` are not interchangeable.
- Trust-path topology is platform-wide; strength is community-scoped (ADR-077).
- Reputation/relationship outward contracts remain governed by ADR-082/084.
- Root `CLAUDE.md` is tracked as lowercase `claude.md` on Windows.

### Workflow Gotchas

- TDD tests start in each changed workspace's `tests/tdd/`, then promote when green.
- Run focused workspace suites directly; Turbo can hide or invent cache-related failures.
- Every implementation task runs `/simplify`; every sprint runs `/code-review` and `/security-review`.
- Invoke `pre-commit-check` before every commit.
- Unit + regression must pass before push.
- Run the direct doc-context drift test after generated landing-doc changes.
- Do not create worktrees; this is a shared, time-sliced checkout.
- Do not make a docs-only follow-up push to `master`; every master push triggers a deploy.

### Demo / Deploy Drift Watch

Confirm GitHub Actions deploy succeeded and live content matches `master` before judging the result.
Demo persona credentials come from server environment configuration; never commit passwords.
