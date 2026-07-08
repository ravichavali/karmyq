# Invited Arrival & the Living Graph — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> **This repo's standing exception:** the maintainer prefers inline execution (no subagents, no
> worktrees) — use superpowers:executing-plans inline unless told otherwise.

**Goal:** Rework the join funnel invite-primary with a dedicated `/welcome` arrival moment that
renders the new member's first belonging graph; add a growing/fading edge-lifecycle encoding to the
ego graph; fix BUG-028 so the connected-badge and the graph share one connection derivation.

**Architecture:** A new qualitative `lifecycle` field on disclosed neighborhood links (derived in
`disclosureProjection.ts` from ADR-070 decay tiers + edge age) drives edge rendering in
`EgoOrbitGraph`; the join surfaces (`/invite/[code]`, `/register`, `/communities` welcome flow) are
rewired to converge on a new `/welcome` page that composes the existing graph components. No schema
changes; no new services.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14 (Pages Router), PostgreSQL 15, Bull queue.

**Spec:** `docs/superpowers/specs/2026-07-08-sprint-118-invited-arrival-living-graph-design.md`
**Version:** v11.26.0 → v11.27.0 · **ADR:** ADR-085

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `apps/frontend/src/pages/welcome.tsx` | Arrival-moment route (both join paths) |
| `apps/frontend/src/components/graphs/EgoMemoryLegend.tsx` | "How memory fades" legend for ego view (adapted from community view) |
| `docs/adr/ADR-085-invited-arrival-and-edge-lifecycle.md` | Architectural decision |
| `apps/landing/src/data/docs/guides/joining-karmyq.json` | New user guide |
| `apps/landing/src/data/docs/concepts/adr-085-invited-arrival-and-edge-lifecycle.json` | ADR landing JSON |
| `services/social-graph-service/tests/tdd/sprint-118-*.test.ts` | Lifecycle + BUG-028 TDD tests |
| `apps/frontend/tests/tdd/sprint-118-*.test.tsx` | Funnel/arrival/encoding TDD tests |

### Existing files to modify
| File | Change |
|------|--------|
| `services/social-graph-service/src/services/disclosureProjection.ts` | Derive + expose `lifecycle` per link |
| `services/social-graph-service/src/routes/trustGraph.ts` | Thread lifecycle through `/neighborhood`; BUG-028 layer fix if server-side |
| `apps/frontend/src/pages/invite/[code].tsx` | Invitation-as-landing redesign; success → `/welcome` |
| `apps/frontend/src/pages/register.tsx` | Invite-primary nudge |
| `apps/frontend/src/pages/communities/index.tsx` | Welcome-flow first join → `/welcome` |
| `apps/frontend/src/components/WelcomeModal.tsx` | Suppress when arrival ran |
| `apps/frontend/src/components/graphs/EgoOrbitGraph.tsx`, `graphVisualEncoding.ts` | Lifecycle edge rendering |
| `apps/frontend/src/components/requests/ConnectionBadge.tsx` (+ any surface grep finds) | BUG-028 unified derivation |
| `apps/frontend/src/lib/onboarding/workflows.ts` | Arrival/joining step |
| `apps/landing/src/data/docs/nav.json` | Wire new guide + ADR (grep-verify: it silently reverts) |
| `docs/BUGS.md`, `docs/adr/README.md`, service `CONTEXT.md`s, `services/registry.json`, `package.json` (version) | Bookkeeping |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

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

## Task 3: Edge-lifecycle projection — RED tests

**Files:**
- Create: `services/social-graph-service/tests/tdd/sprint-118-edge-lifecycle.test.ts`

- [ ] **Unit tests against `disclosureProjection` (real function, no stubs of logic under test):**
  - decay tier → `active` / `fading` / `nearlyForgotten` mapping, exact expected values per tier;
  - recent edge (age under the `new` window) → `new`, regardless of tier being healthy;
  - `swept` edges still not returned at all (existing behavior preserved);
  - **no numeric weight appears anywhere in the outward link shape** (ADR-082 scan).
- [ ] Tests fail (field doesn't exist yet).

- [ ] **Verification:**
```bash
cd services/social-graph-service && npx jest tests/tdd/sprint-118-edge-lifecycle.test.ts  # RED
```

## Task 4: Edge-lifecycle projection — implementation

**Files:**
- Modify: `services/social-graph-service/src/services/disclosureProjection.ts`,
  `src/routes/trustGraph.ts` (thread through `/neighborhood`), shared types if links are typed in
  `@karmyq/shared`

- [ ] **Derive `lifecycle` where decay classification already happens** (`classifyDecayTier`
  call sites). `new` = edge created within the window (define one constant, e.g. 30 days, in the
  projection — document it in the ADR); otherwise map tier → `active|fading|nearlyForgotten`.
- [ ] **Expose on `/neighborhood` links** (ego is the consumer this sprint; other graph endpoints
  gain it only if free — do not expand scope).
- [ ] Tests from Task 3 green. **/simplify** on the diff.

- [ ] **Verification:**
```bash
cd services/social-graph-service && npx jest   # full service suite green
npx tsc --noEmit -p services/social-graph-service
```

## Task 5: Ego lifecycle encoding + legend — RED tests

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-118-ego-lifecycle-encoding.test.tsx`

- [ ] **Component tests (D3/jsdom gotchas per note 8):**
  - `graphVisualEncoding` maps each lifecycle label to a distinct edge treatment (exact class/attr
    assertions; `new` emphasized, `fading` reduced, `nearlyForgotten` ghosted, `active` = current
    bands unchanged);
  - `EgoOrbitGraph` renders edges with the treatment for the lifecycle in fixture data;
  - layout unchanged: orbit radii/positions for a fixed fixture identical before/after (ADR-083
    regression pin);
  - `EgoMemoryLegend` renders all four states + copy, only on ego mode.

- [ ] **Verification:**
```bash
cd apps/frontend && npx jest tests/tdd/sprint-118-ego-lifecycle-encoding.test.tsx  # RED
```

## Task 6: Ego lifecycle encoding + legend — implementation

**Files:**
- Create: `apps/frontend/src/components/graphs/EgoMemoryLegend.tsx`
- Modify: `apps/frontend/src/components/graphs/EgoOrbitGraph.tsx`,
  `graphVisualEncoding.ts`, `apps/frontend/src/pages/network.tsx` (mount legend in ego mode)

- [ ] Implement encoding + legend (adapt the community "How memory fades" legend copy/pattern —
  Update, Don't Create: extract/share rather than fork if feasible).
- [ ] Tasks 5 tests green; existing graph suites green. **/simplify** on the diff.

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
  - communities welcome flow: first public join routes to `/welcome` (not `/dashboard`), sets
    `karmyq_onboarded`;
  - `/welcome`: invite arrival shows the inviter edge + community ring; open arrival shows
    community ring only; both render the single CTA to the community's open asks; skip works and
    lands the same place; no joined community → redirect `/dashboard`; graph fetch failure falls
    back gracefully (CTA still works);
  - WelcomeModal suppressed when arrival ran.

- [ ] **Verification:**
```bash
cd apps/frontend && npx jest tests/tdd/sprint-118-invited-arrival.test.tsx  # RED
```

## Task 8: Invite landing + register nudge — implementation

**Files:**
- Modify: `apps/frontend/src/pages/invite/[code].tsx`, `apps/frontend/src/pages/register.tsx`

- [ ] Redesign `/invite/[code]` as the landing (context card + inline form; preserve every
  registration side effect — note 6). Success → `/welcome` with the invite context.
- [ ] Add the invite-primary nudge to `/register`.
- [ ] Task 7's invite/register tests green. **/simplify** on the diff.

- [ ] **Verification:**
```bash
cd apps/frontend && npx jest tests/tdd/sprint-118-invited-arrival.test.tsx -t "invite"
```

## Task 9: `/welcome` arrival moment — implementation

**Files:**
- Create: `apps/frontend/src/pages/welcome.tsx`
- Modify: `apps/frontend/src/pages/communities/index.tsx`, `apps/frontend/src/components/WelcomeModal.tsx`

- [ ] Build the arrival route (full-screen, unhurried, skippable; one-edge graph is the design —
  note 4; compose `EgoOrbitGraph`/`CommunityRingGraph`, defensive `getMyCommunities` extraction —
  note 7).
- [ ] Rewire the welcome-flow first join; suppress WelcomeModal post-arrival.
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
- Modify: `docs/adr/README.md`, `apps/landing/src/data/docs/nav.json` (grep-verify after — note 9),
  network guide/concept JSON (lifecycle encoding + legend),
  `apps/frontend/src/lib/onboarding/workflows.ts`, `docs/BUGS.md` (BUG-028 → resolved),
  `package.json` → `11.27.0`

- [ ] Author all docs (ADR status `Accepted`; flip to `Implemented` post-deploy).
- [ ] **Verification:**
```bash
grep -c "adr-085\|joining-karmyq" apps/landing/src/data/docs/nav.json   # both wired
cd tests && npx jest regression/doc-context-drift-gate.test.ts          # direct run (Turbo cache — note 10)
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
  (note 10).
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
  - register a throwaway account via the OPEN path on demo → arrival moment renders (community
    ring, CTA works, skip works);
  - generate an invite from a non-protected persona → accept it via `/invite/[code]` → arrival
    shows the newborn edge; DB: the trust/invitation edge exists for the pair;
  - `/network?mode=ego` as `maria.reyes` → lifecycle encoding + legend visible, orbits unchanged;
  - the BUG-028 surface: connected-badge and graph now agree on the curated baseline;
  - desktop + mobile viewport pass on the funnel pages.
- [ ] Flip ADR-085 → `Implemented`; resolve BUG-028 in `docs/BUGS.md` (if not already); update
  handoff to COMPLETE (rides with the PR or the next one — no docs-only master push).
