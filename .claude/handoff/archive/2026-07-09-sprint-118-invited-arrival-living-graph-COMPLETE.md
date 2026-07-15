# Sprint 118 — Invited Arrival & the Living Graph — ✅ COMPLETE (merged, deployed, validated)

> **STATUS (2026-07-09):** SPRINT COMPLETE. PR #146 squash-merged to `master` as `b0267c8f` after
> explicit Admin authorization; CI/CD run `28992917501` deployed v11.27.0 to the demo (health
> green). Codex cross-agent review found one merge-blocking follow-up (pre-fix
> `auth.social_distances` exchange cache rows could preserve BUG-028 until TTL expiry) — fixed on
> the branch by revalidating cached exchange paths against `trust_edges_live` + active endpoint
> membership on read (single + batch routes), stale rows deleted and recomputed.
>
> **Human validation (2026-07-09): ALL PASS** —
> demo-session 200 on `b0267c8f`/v11.27.0; Maria's story intact (4 backdated bonds, strong band
> 0.62, NO new-bond emphasis — correct) with the "New bond" legend present; emphasis verified live
> on a sim user (`theo.johnson`: 279/280 edges stroke `#4ade80`, width 2.1, "strong · new bond");
> BUG-028 surface: `maria↔priya` = 1 completed match + no live edge → badge and graph agree, cache
> holds only `community_member` rows; open-path throwaway (`s118.validation@test.karmyq.com`) →
> registered → nudge shown → first join routed to `/welcome` → 24-node ring, zero-edge, no empty
> state → CTA wrote `karmyq_onboarded:<id>` + cleared `karmyq_arrival` + landed on the community;
> invite path (`KARMYQ-S118VALI-2026-E29C` → `s118.invitee@test.karmyq.com`) → invitation-as-landing
> rendered → arrival showed the dashed invitation bond + becomes-trust copy; DB: invitation
> accepted, `invited_by` linked, active membership, **0 trust edges between the pair**; mobile
> 375px: no horizontal overflow, CTA works. Two throwaway accounts remain on the demo (both in SE
> Portland Running Club) — harmless; remove via the S117 runbook if desired.
>
> ADR-085 flipped to `Implemented` (this edit + the ADR/README edits are the uncommitted
> bookkeeping riding the NEXT PR per note 14). Next sprint: not yet planned — candidates in
> "Deferred next-sprint candidates" below plus the S118 follow-ups (community/[id] first-join
> arrival gap; shared setAuthSession helper; header de-congestion memory).
>
> **BUG-029 — maintainer decided (2026-07-09): FOLD INTO NEXT SPRINT.** Live report on
> `/requests/707137aa-…`: tile says "connected via Nadia Ito", graph rightly shows no path.
> Diagnosis in `docs/BUGS.md` BUG-029 — NOT a BUG-028 regression; the preserved
> `community_member` fallback (`computeCommunityPath`) manufactures a 2° path through the
> community's earliest-joined admin, and the compact badge renders it as "via {admin}".
> Agreed fix shape: server stops inserting the admin as a path node (endpoints +
> `community_name` only, keep `connection_type`); `TrustPathBadge` renders community_member as
> "Fellow member of {community}" / "in {community}" — never "via {person}"; KEEP `degrees: 2`
> for feed proximity ranking (maintainer chose ranking-preserving). Cached community_member
> rows become harmless once the renderer stops naming the admin.
>
> Sprint 117 record: `.claude/handoff/archive/2026-07-08-sprint-117-curated-demo-reset-COMPLETE.md`.

## What shipped on the branch (v11.26.0 → v11.27.0, ADR-085)

- **BUG-028 fixed at the derivation layer**: `computeShortestPath` BFS-walks
  `social_graph.trust_edges_live` with active-membership joins (the edge set the graph discloses)
  instead of all-time `requests.matches`; depth-gate ordering fixed in BOTH BFS functions (3°
  paths were silently dropped); dead `ConnectionBadge`/`socialGraphClient` deleted; stale
  invitation-era integration test removed. Codex review follow-up also revalidates cached
  `exchange` rows against the same live edge set on read and deletes/recomputes stale rows, so
  pre-fix cache entries cannot preserve BUG-028. Root cause + demo evidence in `docs/BUGS.md`
  BUG-028.
- **`formed_recently`** on `/trust/neighborhood` links (MIN(created_at) per pair, 30-day window,
  fail-closed boolean; ADR-082 preserved) + client new-bond emphasis (stroke #4ade80 + width,
  layered on untouched decayTier opacity bands) + "New bond" legend entry. No layout changes.
- **Invite-primary funnel**: `/invite/[code]` is the landing (context hero + inline form; all
  register side effects preserved); `/register` nudge; first public join → **`/welcome`** arrival
  (purpose-built `ArrivalGraph`, never sparse-gated; invitation bond = dashed distinct chord from
  funnel context, never a trust edge); user-scoped `karmyq_onboarded:<userId>` written only on
  completion/skip (legacy global key honored); `karmyq_arrival` sessionStorage is user-stamped
  (stale cross-account contexts dropped).
- **Docs**: ADR-085, Joining Karmyq guide, trust-graph guide updates, onboarding workflow step,
  CONTEXT.md/registry.json, landing regenerated via `scripts/generate-docs.ts`.
- **Quality gates run**: per-task /simplify; 3-reviewer code review (findings applied in
  f1e82823); security review (no action findings; watch the recurring CodeQL `js/request-forgery`
  FP on push); `npm audit --audit-level=high` exit 0 (3 pre-existing moderates); TDD promotion ran
  (32 service suites + 2 frontend sprint-118 suites moved to regression).

## Quick Start (next session)

1. Confirm demo is still healthy after CI/CD run `28992917501` (deployed `b0267c8f`).
2. Run the human validation checklist from plan Task 14 (demo-session 200, open-path arrival,
   invite arrival + DB check, maria.reyes ego view, BUG-028 surface, viewport pass).
3. After deploy validation: flip ADR-085 → Implemented + mark this handoff COMPLETE, but leave
   those edits uncommitted to ride the next PR.

## Sprint Goal

Rework the join funnel invite-primary with a dedicated `/welcome` arrival moment where a new member
sees their first belonging graph (the invitation bond — provenance, NOT a trust edge — plus the
joined community's ring); complete the ego graph's growing/fading story with a qualitative
`formedRecently` flag supplementing the existing `decayTier` encoding (whose fading half already
ships); fix BUG-028 so the connected-badge and the graph agree.

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
  `/welcome` route; ego encoding = complete the growing/fading story (fading already ships via
  `decayTier` bands + inline legend; this sprint adds `formedRecently` new-bond emphasis + a "New"
  legend entry), NO layout change; BUG-028 in scope with fix (not investigate-only); ships
  end-to-end (merge + deploy).
- **Cross-agent review of the plan (Codex, 2026-07-08): 7 findings, ALL folded into spec + plan.**
  The load-bearing ones: (1) no inviter edge exists in the belonging graph — arrival renders the
  INVITATION BOND from funnel context, never a manufactured trust edge; (2) the neighborhood links
  query returns no timestamps — Task 4 adds `MIN(created_at)` per pair, `formedRecently` derived
  fail-closed; (3) `karmyq_onboarded` is browser-global and pre-set at join — switch to a
  user-scoped key written only on `/welcome` completion/skip; (4) no parallel `lifecycle` enum —
  supplement the existing `decayTier` contract; (5) arrival needs a purpose-built `ArrivalGraph`
  (existing renderers short-circuit sparse graphs); (6) post-deploy bookkeeping rides the NEXT PR;
  (7) the paths endpoint is `/paths/:targetUserId`, not under `/trust`.

## Critical Implementation Notes (from the spec — read before Task 2)

1. **Fix BUG-028 before building the arrival moment.** The arrival celebrates a connection; it must
   not celebrate one the graph can't substantiate. Follow the Bug Fixing discipline: reproduce on
   the curated demo baseline, identify the layer — the badge uses `GET /paths/:id`
   (`computeTrustPath` + the `auth.social_distances` cache; platform-wide exchange topology), the
   graph uses community-scoped disclosed `trust_edges_live` with active-membership joins via
   `/trust/neighborhood` — grep ALL surfaces consuming each derivation, fix at the source, never a
   client-side patch.
2. **The inviter bond is an invitation relationship, NOT a trust edge.** Invitation acceptance
   writes `auth.user_invitations` / `users.invited_by` / membership only; `/trust/neighborhood`
   traverses `trust_edges_live` exclusively — no inviter edge exists in the belonging graph. The
   arrival renders the invitation bond from the invite-funnel context (validate/accept responses),
   visually distinct from trust edges, with "this bond becomes trust when you help each other"
   copy. **Never manufacture a trust edge from an invitation** (earned-structure principle,
   ADR-070/077/083). The ego graph does not gain invitation edges this sprint.
3. **`formedRecently` supplements the existing `decayTier` contract — it does not replace it.**
   Links already carry `decayTier` (strong/warm/fading/nearly_forgotten) rendered via the OPACITY
   bands in `graphVisualEncoding.ts` plus an inline ego legend — leave both exactly as they are and
   pin them with regression assertions. Server-side: the links query gains
   `MIN(tel.created_at) AS formed_at` per grouped pair (first formation across communities = the
   relationship's age; a long-standing pair adding a new community edge is NOT new); the projection
   derives `formedRecently: boolean` against one 30-day window constant. No timestamp or numeric
   leaves the server (ADR-082).
4. **No layout changes to the ego graph (ADR-083).** Orbits, ring placement, expansion arcs stay
   exactly as S115 shipped them. This sprint changes edge *rendering* only.
5. **The arrival graph must bypass the sparse short-circuit — it is the design, not an empty
   state.** `EgoOrbitGraph` (and the ring renderer) early-return an empty state on sparse graphs
   (`EgoOrbitGraph.tsx:102`); the new purpose-built `ArrivalGraph` reuses the ring primitives but
   is never gated on edge count. A zero-trust-edge open-path arrival (you among your new neighbors
   on the community ring) and a one-bond invite arrival must both read as intentional.
6. **Do not break the curated demo.** `/auth/demo-session` and the Maria story flows must be
   untouched; protected demo personas are excluded from any manual smoke-test signups. New-bond
   emphasis will change how recent demo edges LOOK — expected; verify Maria's rich story still
   reads (`maria.reyes` is the rich view; most sim users are sparse).
7. **Registration side effects must be preserved on the redesigned invite page:** store `token`,
   `refreshToken`, `user`, clear `demoContext` (see `register.tsx`), and remember
   `ApiClient.login/register` set the auth token automatically since #140. On join, refresh
   membership state by decoding the new JWT — never hand-construct `communities`.
8. **`getMyCommunities` returns `{communities,count,total}`, not an array** — extract defensively
   anywhere the funnel or arrival reads it (S113 crash pattern).
9. **jsdom/D3 test gotchas apply to the graph work:** map `^d3$` → `d3/dist/d3.min.js`, stub
   ResizeObserver, seed `node.__zoom` directly; `next/router` is globally mocked in `jest.setup`.
10. **`nav.json` silently reverts** — grep-verify the wiring after editing; re-apply if needed.
11. **New TDD tests start in the changed workspace's `tests/tdd/`** (social-graph-service, frontend,
    root `tests/` for cross-workspace) and promote when green. Run cross-workspace suites directly
    (`cd tests && npx jest ...`) — Turbo's cache hides cross-workspace failures.
12. **Arrival is once per account — use a user-scoped key, written only at the end.**
    `karmyq_onboarded` today is a browser-global localStorage key set BEFORE the arrival would run
    (`communities/index.tsx` sets it at join). Switch the gate to `karmyq_onboarded:<userId>`,
    written ONLY when `/welcome` completes or is skipped; `WelcomeModal` and the arrival gate also
    honor the legacy global key so existing users see nothing new. Skip must be as graceful as
    completion (both write the key, both land on the guided destination). Deep-linking `/welcome`
    with no joined community redirects harmlessly to `/dashboard`.
13. **Keep the funnel rework bounded to the join surfaces named above.** No auth-service contract
    changes; if the invitation-validate payload lacks something the new landing needs, extend the
    projection, don't invent a parallel endpoint (Update, Don't Create).
14. **Post-deploy bookkeeping rides the NEXT PR.** Flipping ADR-085 → `Implemented` and marking the
    handoff COMPLETE happen after deploy, which is after merge — leave those edits uncommitted (no
    docs-only master push; S117 precedent) so they ride the next PR.

## Carry-Forward / Known State

- **BUG-028** (`docs/BUGS.md`): offer relationship context said "connected" while the graph found
  no path — fixed in S118 at the derivation layer and cache-read layer. `GET /paths/:id` and
  `/paths/batch` now derive exchange paths from live disclosed edges and revalidate existing cached
  `exchange` rows before returning them; stale/malformed exchange rows are deleted and recomputed.
  Graph disclosure remains `/trust/neighborhood` over `trust_edges_live` + active-membership joins.
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
