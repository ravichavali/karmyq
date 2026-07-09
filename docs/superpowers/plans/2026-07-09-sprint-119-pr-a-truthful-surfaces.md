# Sprint 119 PR A: Truthful Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** No surface claims structure the data doesn't contain — fix BUG-029 at both ends, close
the community-page arrival gap, extract the shared auth-session write, and de-congest the header
(lever 2).

**Architecture:** Projection-shape fix in social-graph's path computation plus presentation fixes
in the frontend badge; the arrival gap and session helper reuse S118's shipped funnel patterns.
No schema changes, no new endpoints.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14 (Pages Router), PostgreSQL 15, Bull queue.

**Version:** v11.27.0 → v11.28.0 · **Branch:** `feature/sprint-119-truthful-surfaces` (exists, off `origin/master`, carrying S118 bookkeeping edits + Sprint 119 planning docs)

**Spec:** `docs/superpowers/specs/2026-07-09-sprint-119-truthful-surfaces-fractal-story-design.md`

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `apps/frontend/src/lib/session.ts` | `setAuthSession` — the single auth-session write sequence |
| `services/social-graph-service/tests/tdd/sprint-119-community-path-shape.test.ts` | BUG-029 server: community_member path = endpoints only |
| `apps/frontend/tests/tdd/sprint-119-trust-path-badge-truthful.test.tsx` | BUG-029 client: no "via {person}" for community_member |
| `apps/frontend/tests/tdd/sprint-119-community-page-arrival.test.tsx` | First join from community page routes to /welcome |
| `apps/frontend/tests/tdd/sprint-119-set-auth-session.test.ts` | Helper side effects exact |

### Existing files to modify
| File | Change |
|------|--------|
| `services/social-graph-service/src/services/pathComputation.ts` | `computeCommunityPath` (L281): endpoints + community_name only; drop the earliest-admin lookup; keep `connection_type`, `degrees: 2` |
| `apps/frontend/src/components/TrustPathBadge.tsx` | community_member: "Fellow member of {community}" / "in {community}"; never "via {person}" (both render sites, ~L88 + ~L112); review invitation wording |
| `apps/frontend/src/pages/communities/[id].tsx` | `handleJoinCommunity` (L88): first-public-join gate → user-stamped `karmyq_arrival` + `/welcome` (mirror `communities/index.tsx:355-362`) |
| `apps/frontend/src/pages/{login,register,demo,dashboard}.tsx`, `apps/frontend/src/pages/invite/[code].tsx` | Replace inline session writes with `setAuthSession` |
| `apps/frontend/src/components/Layout.tsx` | Lever 2: move Communities/Service Providers (+ provider links) out of `kq-topnav` into overflow |
| `docs/BUGS.md` | BUG-029 → fixed |
| `services/social-graph-service/CONTEXT.md`, `services/registry.json` | Paths shape change documented |
| `docs/guides/` + `apps/landing/src/data/docs/` (+ regen) | Joining guide parity note; badge wording wherever documented |
| `package.json` | 11.27.0 → 11.28.0 |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

Spec notes 1–5, 11–15 apply to this PR verbatim — the load-bearing ones:

1. **BUG-029 both ends:** server returns endpoints + `community_name` only (admin lookup deleted);
   **keep `degrees: 2`** (feed ranking preserved — assert it doesn't move); client fixes BOTH
   badge render sites and greps for any other `community_member` path-node consumer. Cached rows
   become harmless via the renderer — no cache purge.
2. **Invitation wording is a review, not a rewrite** — "Joined through {inviter}" is factual
   provenance; change only if a surface renders it as a live trust route.
3. **Arrival gap:** copy the `communities/index.tsx:355-362` pattern with its EXACT gates (first
   public join only: `karmyq_onboarded:<userId>` AND legacy global key absent); invite-funnel
   joins already route; `/welcome` handles the no-membership deep link.
4. **`setAuthSession`:** token + refreshToken + user stored, `demoContext` cleared, nothing more;
   `ApiClient.login/register` already set the token (#140) — don't double-manage; decode the JWT
   for membership (`communities`, never `communityMemberships`); `getMyCommunities` returns
   `{communities,count,total}`, not an array.
5. **Header lever 1 is DONE** (`kq-page` → `--measure-chrome: 72rem`); this PR is lever 2 only.
   `kq-topnav` is xl-only (BUG-016) — audit md–xl first; don't regress the topbar rhythm.
6. **TDD tests start in each changed workspace's `tests/tdd/`**; run cross-workspace suites
   directly (`cd tests && npx jest ...`) — Turbo's cache hides cross-workspace failures.
7. **`nav.json` silently reverts** — grep-verify after landing regen.
8. **This branch carries the S118 bookkeeping edits** (ADR-085 → Implemented, BUGS.md BUG-029
   entry, archived S118 handoff) — commit them with the planning docs, don't strip them.

---

## Task 1: TDD tests for BUG-029 (server + client) — before any fix

**Files:**
- Create: `services/social-graph-service/tests/tdd/sprint-119-community-path-shape.test.ts`
- Create: `apps/frontend/tests/tdd/sprint-119-trust-path-badge-truthful.test.tsx`

- [ ] **Server test**: `computeCommunityPath` result for two co-members asserts `path` contains
      EXACTLY the two endpoints (no third node), `community_name` present,
      `connection_type: 'community_member'`, `degrees_of_separation === 2`. Add a regression-style
      assertion that no admin/member lookup result appears anywhere in the returned path array.
- [ ] **Client test**: render `TrustPathBadge` with a `community_member` path (both old 3-node
      cached shape AND new 2-node shape): full variant shows "Fellow member of {community}",
      compact shows "in {community}"; assert `via` does NOT appear for either input shape; assert
      no person-chain row renders. Pin `invitation_chain` current wording ("Joined through
      {inviter}") and an `exchange` 2°/3° "via {person}" case so the truthful paths stay truthful.

- [ ] **Verification: both suites RED for the right reason**

```bash
cd services/social-graph-service && npx jest tests/tdd/sprint-119-community-path-shape --no-coverage
cd apps/frontend && npx jest tests/tdd/sprint-119-trust-path-badge-truthful --no-coverage
```

## Task 2: Server fix — computeCommunityPath endpoints-only

**Files:**
- Modify: `services/social-graph-service/src/services/pathComputation.ts`

- [ ] Delete the earliest-joined-admin query and the admin node insertion in
      `computeCommunityPath` (L281–336); return `[source, target]` + `community_name`, keeping
      `connection_type: 'community_member'` and `degrees: 2`.
- [ ] Grep the service for every consumer of community_member `path_data` (cache write/read in
      `paths.ts` single + batch, internal relationship context) — confirm none assumes a 3-node
      path; fix any that does.
- [ ] Confirm feed-ranking inputs unchanged: grep request-service for `degrees_of_separation` /
      proximity usage and assert only the `path` array shape changed.
- [ ] Run `/simplify` on the touched files.

- [ ] **Verification: Task 1 server suite GREEN; service unit+regression green**

```bash
cd services/social-graph-service && npx jest tests/tdd/sprint-119-community-path-shape --no-coverage && npx jest tests/unit tests/regression --no-coverage
```

## Task 3: Client fix — TrustPathBadge truthful wording

**Files:**
- Modify: `apps/frontend/src/components/TrustPathBadge.tsx`

- [ ] community_member full variant → "Fellow member of {community}"; feed-compact → "in
      {community}"; remove both "via {admin}" branches (~L88, ~L112) and the person-chain row for
      this type. Tolerate old cached 3-node shapes (render as if 2-node).
- [ ] Review `invitation_chain` wording per spec note 2 — record keep/change decision in the PR
      description.
- [ ] Grep frontend + mobile for any other renderer of community_member paths (`Fellow member`,
      `via `, `connection_type`) and fix consistently.
- [ ] Run `/simplify` on the diff.

- [ ] **Verification: Task 1 client suite GREEN; frontend unit+regression green**

```bash
cd apps/frontend && npx jest tests/tdd/sprint-119-trust-path-badge-truthful --no-coverage && npm test
```

## Task 4: Community-page first-join arrival

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-119-community-page-arrival.test.tsx`
- Modify: `apps/frontend/src/pages/communities/[id].tsx`

- [ ] **TDD first**: first public join (no `karmyq_onboarded:<userId>`, no legacy key) writes
      user-stamped `karmyq_arrival` and routes to `/welcome`; join with either onboarded key
      present keeps current behavior; failed join does neither.
- [ ] Implement in `handleJoinCommunity` by mirroring `communities/index.tsx:355-362` exactly
      (same sessionStorage payload shape, same gates). Extract a tiny shared
      `routeFirstJoinArrival` helper into the arrival lib ONLY if the two sites would otherwise
      duplicate >~10 lines (Update, Don't Create).
- [ ] Run `/simplify`.

- [ ] **Verification:**

```bash
cd apps/frontend && npx jest tests/tdd/sprint-119-community-page-arrival --no-coverage
```

## Task 5: setAuthSession helper

**Files:**
- Create: `apps/frontend/src/lib/session.ts`, `apps/frontend/tests/tdd/sprint-119-set-auth-session.test.ts`
- Modify: `login.tsx`, `register.tsx`, `demo.tsx`, `dashboard.tsx`, `invite/[code].tsx`

- [ ] **TDD first**: helper stores `token`/`refreshToken`/`user`, clears `demoContext`, does NOT
      call ApiClient token setters (they're already set by login/register per #140), handles a
      missing refreshToken gracefully.
- [ ] Implement `setAuthSession`; migrate the five call sites; diff each site's before/after side
      effects — byte-identical storage state per site (register's extra effects stay at the site).
- [ ] Run `/simplify`.

- [ ] **Verification: helper suite green + all five pages' existing suites green**

```bash
cd apps/frontend && npx jest tests/tdd/sprint-119-set-auth-session --no-coverage && npm test
```

## Task 6: Header de-congestion — lever 2

**Files:**
- Modify: `apps/frontend/src/components/Layout.tsx` (+ `karmyq-shell.css` if the overflow needs styles)

- [ ] **Audit first** (UI-research-first): screenshot/measure the topbar at md, lg, xl with a
      provider account (worst case: Network + Communities + Service Providers + provider links +
      bell + availability + avatar); record what actually crowds.
- [ ] Move Communities + Service Providers (+ "Become a provider" / my-provider links) from
      `kq-topnav` into an overflow affordance (a "More" dropdown in the topnav, or fold into the
      existing avatar menu — pick whichever the audit shows reads calmer; they already exist in
      the mobile drawer, so keep one source of link truth if possible).
- [ ] Verify active-route highlighting still works for the moved links; keyboard + aria parity
      with the existing dropdown patterns.
- [ ] Tests: conditional-render coverage per CLAUDE.md UI table (links reachable in overflow for
      member and provider roles; Network still in topnav).
- [ ] Run `/simplify`.

- [ ] **Verification:**

```bash
cd apps/frontend && npm test
```

## Task 7: Docs — BUGS.md, guides, landing, CONTEXT, registry

**Files:**
- Modify: `docs/BUGS.md`, `services/social-graph-service/CONTEXT.md`, `services/registry.json`,
  `docs/guides/` (Joining Karmyq), `apps/landing/src/data/docs/**` (regen), `package.json` (v11.28.0)

- [ ] BUG-029 → fixed: root cause (manufactured admin path), fix layers (server shape + renderer),
      note that cached rows are inert.
- [ ] social-graph `CONTEXT.md`: paths endpoints shape under "API Endpoints" + "Recent Fixes";
      registry.json description if it names the path shape.
- [ ] Joining Karmyq guide: community-page join lands on the welcome arrival (parity note);
      badge wording updated wherever the connection badge is documented.
- [ ] Regenerate landing (`npx tsx scripts/generate-docs.ts`); **grep-verify `nav.json`** wiring
      survived.
- [ ] Bump `package.json` to 11.28.0.

- [ ] **Verification:**

```bash
npm run feedback:check
cd tests && npx jest regression/doc-context-drift-gate --no-coverage
```

## Task 8: SDLC quality gates

- [ ] `/simplify` — final pass on the whole branch diff.
- [ ] `/code-review` on the branch diff; resolve correctness findings, justify dismissals.
- [ ] `/security-review` on the branch diff; resolve real findings (expect the recurring
      `js/request-forgery` FP on api.ts if a client call was added — dismiss with justification).
- [ ] Cross-agent review per protocol if Codex is available (non-author reviews).

- [ ] **Verification: all three gates run and recorded in the PR description**

```bash
git diff origin/master --stat   # the reviewed diff
```

## Task 9: Final verification

- [ ] `npx tsc --noEmit` in every touched workspace.
- [ ] Promote green TDD suites (`node scripts/promote-tdd-tests.js`).
- [ ] Full test + advisory pass; update handoff status.

```bash
npm test
npm run feedback:check
cd tests && npx jest regression --no-coverage
```

## Task 10: Merge + Deploy (use the `/ship` skill)

- [ ] Open PR (template filled), cross-agent review, then **ask the maintainer for explicit admin
      merge authorization** (`gh pr merge --squash --admin` is never self-authorized).
- [ ] Monitor GitHub Actions deploy; verify demo health per service.
- [ ] **Human validation**: on the live demo — the BUG-029 request tile
      (`/requests/707137aa-…`, viewer maria.reyes) now reads "in Southeast PDX Helpers" / "Fellow
      member of…" with no "via Nadia Ito" and graph agreement; a throwaway account's first join
      from a community DETAIL page lands on `/welcome`; login/register/invite still authenticate
      (session helper); topbar at md/lg/xl reads calmer, moved links reachable. Do not mutate
      protected personas.
- [ ] Update handoff: PR A shipped; PR B is next. **Leave post-deploy bookkeeping uncommitted to
      ride PR B.**
