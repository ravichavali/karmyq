# Invited Arrival & the Living Graph — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> **This repo's standing exception:** the maintainer prefers inline execution (no subagents, no
> worktrees) — use superpowers:executing-plans inline unless told otherwise.

**Goal:** Rework the join funnel invite-primary with a dedicated `/welcome` arrival moment that
renders the new member's first belonging graph (invitation bond + community ring); complete the
ego graph's growing/fading story with a qualitative `formedRecently` flag; fix BUG-028 so the
connected-badge and the graph agree.

**Architecture:** Disclosed neighborhood links gain `formedRecently: boolean` (links query adds
`MIN(created_at)` per pair; derived in `disclosureProjection.ts`), supplementing the existing
`decayTier` contract whose fading encoding already ships; the join surfaces (`/invite/[code]`,
`/register`, `/communities` welcome flow) converge on a new `/welcome` page rendering a
purpose-built `ArrivalGraph` (ring primitives, no sparse short-circuit; the invitation bond comes
from funnel context, never a manufactured trust edge). No schema changes; no new services.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14 (Pages Router), PostgreSQL 15, Bull queue.

**Spec:** `docs/superpowers/specs/2026-07-08-sprint-118-invited-arrival-living-graph-design.md`
**Version:** v11.26.0 → v11.27.0 · **ADR:** ADR-085

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `apps/frontend/src/pages/welcome.tsx` | Arrival-moment route (both join paths); writes the user-scoped onboarded key on completion/skip |
| `apps/frontend/src/components/graphs/ArrivalGraph.tsx` | Purpose-built arrival presentation (ring primitives + invitation-bond chord; no sparse short-circuit) |
| `docs/adr/ADR-085-invited-arrival-and-edge-lifecycle.md` | Architectural decision |
| `apps/landing/src/data/docs/guides/joining-karmyq.json` | New user guide |
| `apps/landing/src/data/docs/concepts/adr-085-invited-arrival-and-edge-lifecycle.json` | ADR landing JSON |
| `services/social-graph-service/tests/tdd/sprint-118-*.test.ts` | `formedRecently` + BUG-028 TDD tests |
| `apps/frontend/tests/tdd/sprint-118-*.test.tsx` | Funnel/arrival/encoding TDD tests |

### Existing files to modify
| File | Change |
|------|--------|
| `services/social-graph-service/src/database/trustEdgeDb.ts` | Links query gains `MIN(tel.created_at) AS formed_at` per grouped pair |
| `services/social-graph-service/src/services/disclosureProjection.ts` | Derive `formedRecently: boolean` (30-day window constant); `decayTier` untouched |
| `services/social-graph-service/src/routes/trustGraph.ts` (+ `paths.ts` if BUG-028 lands there) | Thread `formedRecently` through `/neighborhood`; BUG-028 layer fix if server-side |
| Shared link types (`apps/frontend/src/components/graphs/types.ts` + service/shared `TrustLink`) | Add optional `formedRecently` |
| `apps/frontend/src/pages/invite/[code].tsx` | Invitation-as-landing redesign; success → `/welcome` with invite context |
| `apps/frontend/src/pages/register.tsx` | Invite-primary nudge |
| `apps/frontend/src/pages/communities/index.tsx` | Welcome-flow first join → `/welcome`; STOP pre-setting the onboarded key |
| `apps/frontend/src/components/WelcomeModal.tsx` | User-scoped onboarded key (honor legacy global); suppress when arrival ran |
| `apps/frontend/src/components/graphs/EgoOrbitGraph.tsx`, `graphVisualEncoding.ts` | "New" emphasis layered on existing decayTier bands; "New" entry added to the EXISTING inline legend |
| `apps/frontend/src/components/requests/ConnectionBadge.tsx` (+ any surface grep finds) | BUG-028 unified derivation |
| `apps/frontend/src/lib/onboarding/workflows.ts` | Arrival/joining step |
| `apps/landing/src/data/docs/nav.json` | Wire new guide + ADR (grep-verify: it silently reverts) |
| `docs/BUGS.md`, `docs/adr/README.md`, service `CONTEXT.md`s, `services/registry.json`, `package.json` (version) | Bookkeeping |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

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

---

## Task 1: Branch + BUG-028 investigation

**Files:**
- Read-only investigation; findings documented in `docs/BUGS.md` under BUG-028.

- [ ] **Confirm branch** `feature/sprint-118-invited-arrival-living-graph` (created off
  `origin/master` at planning time; carries the spec/plan/handoff commit).
- [ ] **Reproduce on the curated demo baseline** (superpowers:systematic-debugging): find an
  offer/relationship-context surface that says "connected" for a pair where the graph shows no
  path. Read-only demo access per memory *Demo UX-audit access*; do not mutate demo data.
- [ ] **Trace both derivations end-to-end:** badge → `socialGraphClient.getPath` →
  `GET /paths/:targetUserId` (which graph does it query? invitation edges or trust edges? decayed
  or live?); ego/community graph → `/neighborhood` + disclosure projection. Identify the exact
  divergence (edge source, decay filter, scope, or direction).
- [ ] **Grep ALL consumers** of each derivation (`getPath`, relationship-context, ConnectionBadge,
  TrustPathBadge, RelationshipLens, DibsPrompt…) and list the affected surfaces.
- [ ] **Write the root cause + chosen fix layer into `docs/BUGS.md` BUG-028** before any fix code.

- [ ] **Verification:**
```bash
git branch --show-current   # feature/sprint-118-invited-arrival-living-graph
grep -A8 "BUG-028" docs/BUGS.md   # root cause + fix layer documented
```

## Task 2: BUG-028 fix (TDD)

**Files:**
- Create: `services/social-graph-service/tests/tdd/sprint-118-connection-consistency.test.ts`
- Modify: the layer Task 1 identified (server route/query preferred; badge only if it's a pure
  client mislabel)

- [ ] **RED:** test asserting the invariant — *any pair the connection derivation reports as
  connected (≤3°) must be substantiated by the same edge set the graph discloses* (same source
  tables, same decay/liveness filter, both directions).
- [ ] **GREEN:** unify the derivation at the identified layer. If terminology differs (invitation
  path vs trust path), make the badge's wording truthful rather than papering over the data.
- [ ] **Fix every consumer surface** found in Task 1's grep — not just ConnectionBadge.
- [ ] **/simplify** on the diff.

- [ ] **Verification:**
```bash
cd services/social-graph-service && npx jest tests/tdd/sprint-118-connection-consistency.test.ts
npx tsc --noEmit -p services/social-graph-service
```

## Task 3: `formedRecently` projection — RED tests

**Files:**
- Create: `services/social-graph-service/tests/tdd/sprint-118-formed-recently.test.ts`

- [ ] **Unit tests against `disclosureProjection` + the links-query row mapping (real functions, no
  stubs of logic under test):**
  - pair whose `formed_at` is inside the 30-day window → `formedRecently: true`; outside → `false`;
    missing/undefined `formed_at` → `false` (fail closed, never `true` by accident);
  - multi-community pair: `formed_at` = MIN(created_at) — a fixture with an old edge in one
    community and a fresh edge in another is NOT `formedRecently`;
  - **regression pins:** existing `decayTier` mapping unchanged (exact tier per fixture); `swept`
    edges still not returned;
  - **no timestamp and no numeric weight appears anywhere in the outward link shape** (ADR-082 scan).
- [ ] Tests fail (field doesn't exist yet).

- [ ] **Verification:**
```bash
cd services/social-graph-service && npx jest tests/tdd/sprint-118-formed-recently.test.ts  # RED
```

## Task 4: `formedRecently` projection — implementation

**Files:**
- Modify: `services/social-graph-service/src/database/trustEdgeDb.ts` (links query:
  `MIN(tel.created_at) AS formed_at` added to the GROUP BY aggregation),
  `src/services/disclosureProjection.ts` (derive the boolean; one exported window constant),
  `src/routes/trustGraph.ts` (thread through `/neighborhood`), shared/frontend `TrustLink` types

- [ ] **Derive `formedRecently` where decay classification already happens**; `formed_at` stays
  internal — only the boolean is projected outward. Document the window + MIN semantics in ADR-085.
- [ ] **Expose on `/neighborhood` links only** (ego is the consumer this sprint; other graph
  endpoints gain it only if free — do not expand scope).
- [ ] Tests from Task 3 green. **/simplify** on the diff.

- [ ] **Verification:**
```bash
cd services/social-graph-service && npx jest   # full service suite green
npx tsc --noEmit -p services/social-graph-service
```

## Task 5: New-bond emphasis + legend entry — RED tests

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-118-new-bond-encoding.test.tsx`

- [ ] **Component tests (D3/jsdom gotchas per note 9):**
  - `edgeVisual` gives `formedRecently` links a distinct "new" emphasis (exact attr assertions)
    **layered on top of** the decayTier opacity — the OPACITY band values for
    strong/warm/fading/nearly_forgotten are pinned exactly as they are today (regression);
  - `EgoOrbitGraph` renders a `formedRecently` fixture link with the emphasis and a non-new link
    without it;
  - layout unchanged: orbit radii/positions for a fixed fixture identical before/after (ADR-083
    regression pin);
  - the EXISTING inline legend gains a "New" entry alongside Strong/Warm/Fading/Nearly forgotten.

- [ ] **Verification:**
```bash
cd apps/frontend && npx jest tests/tdd/sprint-118-new-bond-encoding.test.tsx  # RED
```

## Task 6: New-bond emphasis + legend entry — implementation

**Files:**
- Modify: `apps/frontend/src/components/graphs/graphVisualEncoding.ts` (emphasis in `edgeVisual`),
  `apps/frontend/src/components/graphs/EgoOrbitGraph.tsx` (legend entry),
  `apps/frontend/src/components/graphs/types.ts` (`formedRecently?: boolean`)

- [ ] Implement the emphasis + legend entry (Update, Don't Create — no new legend component; the
  inline legend at `EgoOrbitGraph.tsx:246` is extended).
- [ ] Task 5 tests green; existing graph suites green. **/simplify** on the diff.

- [ ] **Verification:**
```bash
cd apps/frontend && npx jest   # frontend suite green
npx tsc --noEmit -p apps/frontend
```

## Task 7: Join funnel + arrival — RED tests

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-118-invited-arrival.test.tsx`

- [ ] **Per the UI coverage table:**
  - invite page: renders inviter + community context as the landing, form inside it; submit calls
    register + accept with correct payload (mocked), stores token/refreshToken/user, clears
    `demoContext`, routes to `/welcome`;
  - register page: invite-primary nudge renders; open-path submit still routes to
    `/communities?welcome=true`;
  - communities welcome flow: first public join routes to `/welcome` (not `/dashboard`) and does
    NOT pre-set any onboarded key;
  - `/welcome`: invite arrival shows the invitation bond (distinct from trust-edge styling, with
    the becomes-trust copy) + community ring via `ArrivalGraph`; open arrival shows you on the
    community ring (zero trust edges renders intentionally — no sparse empty state); both render
    the single CTA to the community's open asks; completion AND skip both write the user-scoped
    `karmyq_onboarded:<userId>` key and land the same place; no joined community → redirect
    `/dashboard`; graph fetch failure falls back gracefully (CTA still works);
  - WelcomeModal: gates on the user-scoped key, honors the legacy global key (existing users see
    no modal), suppressed when arrival ran.

- [ ] **Verification:**
```bash
cd apps/frontend && npx jest tests/tdd/sprint-118-invited-arrival.test.tsx  # RED
```

## Task 8: Invite landing + register nudge — implementation

**Files:**
- Modify: `apps/frontend/src/pages/invite/[code].tsx`, `apps/frontend/src/pages/register.tsx`

- [ ] Redesign `/invite/[code]` as the landing (context card + inline form; preserve every
  registration side effect — note 7). Success → `/welcome` with the invite context.
- [ ] Add the invite-primary nudge to `/register`.
- [ ] Task 7's invite/register tests green. **/simplify** on the diff.

- [ ] **Verification:**
```bash
cd apps/frontend && npx jest tests/tdd/sprint-118-invited-arrival.test.tsx -t "invite"
```

## Task 9: `/welcome` arrival moment — implementation

**Files:**
- Create: `apps/frontend/src/pages/welcome.tsx`, `apps/frontend/src/components/graphs/ArrivalGraph.tsx`
- Modify: `apps/frontend/src/pages/communities/index.tsx`, `apps/frontend/src/components/WelcomeModal.tsx`

- [ ] Build `ArrivalGraph` (reuse ring primitives; invitation-bond chord from funnel context —
  notes 2 and 5; never gated on edge count) and the arrival route (full-screen, unhurried,
  skippable; defensive `getMyCommunities` extraction — note 8).
- [ ] Rewire the welcome-flow first join (stop pre-setting the onboarded key); switch WelcomeModal
  to the user-scoped key honoring the legacy global one (note 12).
- [ ] All Task 7 tests green. **/simplify** on the diff.

- [ ] **Verification:**
```bash
cd apps/frontend && npx jest && npx tsc --noEmit -p apps/frontend
```

## Task 10: Docs — ADR-085, guides, landing, workflows, version

**Files:**
- Create: `docs/adr/ADR-085-invited-arrival-and-edge-lifecycle.md`,
  `apps/landing/src/data/docs/guides/joining-karmyq.json`,
  `apps/landing/src/data/docs/concepts/adr-085-invited-arrival-and-edge-lifecycle.json`
- Modify: `docs/adr/README.md`, `apps/landing/src/data/docs/nav.json` (grep-verify after — note 10),
  network guide/concept JSON (completed growing/fading story; invitation bond vs trust),
  `apps/frontend/src/lib/onboarding/workflows.ts`, `docs/BUGS.md` (BUG-028 → resolved),
  `package.json` → `11.27.0`

- [ ] Author all docs (ADR status `Accepted`; flip to `Implemented` post-deploy).
- [ ] **Verification:**
```bash
grep -c "adr-085\|joining-karmyq" apps/landing/src/data/docs/nav.json   # both wired
cd tests && npx jest regression/doc-context-drift-gate.test.ts          # direct run (Turbo cache — note 11)
```

## Task 11: CONTEXT.md + registry.json + integration test

**Files:**
- Modify: `services/social-graph-service/CONTEXT.md` (+ `.claude/README.md` if flows changed),
  `apps/frontend/.claude/README.md` (funnel map), `services/registry.json` (neighborhood link shape)
- Create: `tests/tdd/sprint-118-arrival-funnel-integration.test.ts` (cross-workspace, if DB-backed
  assertions are needed; otherwise the workspace TDD suites from Tasks 2–7 cover it — don't pad)

- [ ] Update CONTEXT/registry per Development Disciplines §6; BUG-028 into "Recent Fixes".
- [ ] `npm run analyze:services` if dependencies changed (they shouldn't).
- [ ] **Verification:**
```bash
npm run feedback:check   # advisory list clean for this diff
```

## Task 12: SDLC quality gates

- [ ] **/simplify** — final pass on the full branch diff.
```bash
git diff origin/master --stat   # scope check before the pass
```
- [ ] **/code-review** — on the branch diff; resolve correctness findings before merge.
```bash
# rerun the suites any fix touches
```
- [ ] **/security-review** — on the branch diff; resolve real findings, justify dismissals in
  writing. Watch for the recurring CodeQL `js/request-forgery` FP if any client API call was added
  (documented FP — dismiss via Security UI, never loop the API).
```bash
npm audit --audit-level=high   # 0 vulns expected
```

## Task 13: Final verification

- [ ] Type check everything touched:
```bash
npx tsc --noEmit -p services/social-graph-service && npx tsc --noEmit -p apps/frontend
```
- [ ] Full test + advisory + diff hygiene:
```bash
npm test && npm run feedback:check && git diff --check
```
- [ ] Direct (non-Turbo) rerun of cross-workspace regression suites touched by doc/landing changes
  (note 11).
- [ ] Promote green TDD suites per `scripts/promote-tdd-tests.js` policy (or leave for CI promotion
  if that's the current flow — check the script).

## Task 14: Merge + Deploy + human validation

- [ ] Push branch; open PR (fill `.github/pull_request_template.md`); cross-agent review if Codex
  is available (Claude authored → Codex reviews).
- [ ] **STOP for Admin authorization before merge** (`gh pr merge --squash --admin` requires
  explicit authorization — a casual "merge it" isn't enough).
- [ ] Merge → GitHub Actions deploys to karmyq.com; monitor; use the `/deploy` skill.
- [ ] **Human validation (mandatory — API smoke + DB check + UI check):**
  - `/auth/demo-session` still 200 with the curated Maria story;
  - register a throwaway account via the OPEN path on demo → arrival moment renders (you on the
    community ring with ZERO trust edges — no empty state; CTA works, skip works);
  - generate an invite from a non-protected persona → accept it via `/invite/[code]` → arrival
    shows the invitation bond (distinct from trust styling); DB: `auth.user_invitations` row +
    `users.invited_by` link the pair (NO trust edge is expected — note 2);
  - `/network?mode=ego` as `maria.reyes` → decayTier bands unchanged, "New" legend entry present,
    any recently formed curated edge shows the emphasis, orbits unchanged;
  - the BUG-028 surface: connected-badge and graph now agree on the curated baseline;
  - desktop + mobile viewport pass on the funnel pages.
- [ ] **Post-deploy bookkeeping (note 14):** flip ADR-085 → `Implemented` and update the handoff to
  COMPLETE, but leave these edits UNCOMMITTED to ride the next PR — deploy happens after merge, and
  a docs-only master push is forbidden (S117 precedent).
