# Sprint 118 — Invited Arrival & the Living Graph — 📋 PLANNED, READY TO EXECUTE

> **STATUS (2026-07-08):** Sprint 117 is COMPLETE & DEPLOYED (v11.26.0; curated demo live and
> healthy; full record archived at
> `.claude/handoff/archive/2026-07-08-sprint-117-curated-demo-reset-COMPLETE.md` — the host reset
> runbook, published story IDs, and recovery paths live there). Sprint 118 is planned and approved;
> spec + plan are committed on the sprint branch. **Nothing has been implemented yet.**

## Quick Start

1. Read this handoff
2. Check out branch: `git switch feature/sprint-118-invited-arrival-living-graph` (already exists —
   it carries the spec/plan/handoff planning commit)
3. Open plan: `docs/superpowers/plans/2026-07-08-sprint-118-invited-arrival-living-graph.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development — but this repo's standing
   preference is INLINE execution via superpowers:executing-plans; no subagents/worktrees unless the
   maintainer asks)
5. Run `/simplify` after every implementation task and `/pre-commit-check` before every commit.

## Sprint Goal

Rework the join funnel invite-primary with a dedicated `/welcome` arrival moment where a new member
sees their first belonging graph; add a growing/fading edge-lifecycle encoding (from existing
ADR-070 decay tiers) to the ego graph; fix BUG-028 so the connected-badge and the graph share one
connection derivation.

## Arc Context

- S115 (ADR-083) made graph *position* earned; S118 makes edge *state* lived ("The Graph Is Alive").
  Ego's at-a-glance answer chosen by the maintainer: **"your web is growing/fading."** Community and
  across-communities at-a-glance answers remain open threads for a future presentation session.
- The "join the platform" change the maintainer had in the pipe = **full funnel rework,
  invite-primary** (decided this session): invitation is the celebrated path, registration happens
  inside the community/inviter context, both paths converge on the arrival moment (dedicated route,
  not a modal).

## Approved Artifacts

- Design: `docs/superpowers/specs/2026-07-08-sprint-118-invited-arrival-living-graph-design.md`
- Plan: `docs/superpowers/plans/2026-07-08-sprint-118-invited-arrival-living-graph.md` (14 tasks)
- Branch: `feature/sprint-118-invited-arrival-living-graph` (off `origin/master` = `b75790a5`)
- Version target: `v11.26.0 → v11.27.0` · ADR: **ADR-085**
- Scope decisions (maintainer, this session): invite-primary funnel; arrival = dedicated skippable
  `/welcome` route; ego encoding = full lifecycle (new/active/fading/nearlyForgotten) + memory
  legend, NO layout change; BUG-028 in scope with fix (not investigate-only); ships end-to-end
  (merge + deploy).

## Critical Implementation Notes (from the spec — read before Task 2)

1. **Fix BUG-028 before building the arrival moment.** The arrival celebrates a connection; it must
   not celebrate one the graph can't substantiate. Follow the Bug Fixing discipline: reproduce on
   the curated demo baseline, identify the layer (the badge uses `GET /paths/:id`; the graph uses
   disclosed trust edges via `/neighborhood`), grep ALL surfaces consuming each derivation, fix at
   the source — never a client-side patch.
2. **Lifecycle is qualitative and server-derived (ADR-082).** The outward projection may say
   `fading`, never `weight: 0.23`. Do the derivation in `disclosureProjection.ts` where decay
   classification already lives; the frontend only maps labels to styles.
3. **No layout changes to the ego graph (ADR-083).** Orbits, ring placement, expansion arcs stay
   exactly as S115 shipped them. This sprint changes edge *rendering* only.
4. **The one-edge arrival graph is the design, not an empty state.** Do not reuse the sparse-ego
   empty-state copy on `/welcome`; a single bright new edge with the community ring is the intended
   picture. Open-path arrivals (no inviter edge) show you + the community ring and must also read
   as intentional.
5. **Do not break the curated demo.** `/auth/demo-session` and the Maria story flows must be
   untouched; protected demo personas are excluded from any manual smoke-test signups. New encoding
   will change how the demo's fading edges LOOK — that's expected and desirable; verify Maria's
   rich story still reads (`maria.reyes` is the rich view; most sim users are sparse).
6. **Registration side effects must be preserved on the redesigned invite page:** store `token`,
   `refreshToken`, `user`, clear `demoContext` (see `register.tsx`), and remember
   `ApiClient.login/register` set the auth token automatically since #140. On join, refresh
   membership state by decoding the new JWT — never hand-construct `communities`.
7. **`getMyCommunities` returns `{communities,count,total}`, not an array** — extract defensively
   anywhere the funnel or arrival reads it (S113 crash pattern).
8. **jsdom/D3 test gotchas apply to the graph work:** map `^d3$` → `d3/dist/d3.min.js`, stub
   ResizeObserver, seed `node.__zoom` directly; `next/router` is globally mocked in `jest.setup`.
9. **`nav.json` silently reverts** — grep-verify the wiring after editing; re-apply if needed.
10. **New TDD tests start in the changed workspace's `tests/tdd/`** (social-graph-service, frontend,
    root `tests/` for cross-workspace) and promote when green. Run cross-workspace suites directly
    (`cd tests && npx jest ...`) — Turbo's cache hides cross-workspace failures.
11. **Arrival is once-per-account and skippable.** Gate on first community join; a skip must be as
    graceful as completion (both mark `karmyq_onboarded`, both land on the guided destination).
    Deep-linking `/welcome` with no joined community redirects harmlessly to `/dashboard`.
12. **Keep the funnel rework bounded to the join surfaces named above.** No auth-service contract
    changes; if the invitation-validate payload lacks something the new landing needs, extend the
    projection, don't invent a parallel endpoint (Update, Don't Create).

## Carry-Forward / Known State

- **BUG-028** (`docs/BUGS.md`): offer relationship context says "connected" but the graph finds no
  path — likely a derivation mismatch (badge = `getPath` → `GET /paths/:id`, comment claims
  *invitation* graph; graph = disclosed *trust* edges via `/neighborhood` with decay filters).
  Possibly surfaced by the S117 curated baseline. Task 1 investigates on the live curated demo
  (read-only; access per memory *Demo UX-audit access*).
- **Demo state:** curated baseline live (36 users, 6 communities, 14 trust edges); protected story
  core = maria.reyes / elena.torres / noah.williams / marcus.lee@test.karmyq.com — never sign up /
  mutate these in smoke tests. Live story IDs + reset/rotate runbook: see the archived S117 handoff.
- **Deferred next-sprint candidates** (not in S118): desktop/mobile UI five-second-test pass;
  init.sql regeneration from fully-migrated schema (docs/IDEAS.md 2026-07-08, own sprint);
  docs-token cleanup on CLAUDE.md/AGENTS.md (memory: *Docs token cleanup post-S116*).
- Docker is unavailable locally; DB-backed assertions ride CI (which now runs the FULL migrated
  schema via `scripts/ci-apply-full-schema.sh`, PR #143 — new migrations may need a sentinel there).
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
