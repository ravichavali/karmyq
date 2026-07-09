# Sprint 119 PR B: Graph Presentation Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give the two remaining graph scales their at-a-glance answers — community ring: "where
do you fit?"; across-communities hub: "which of your communities are woven together?" — closing
the presentation question opened by the S114 revert (ADR-086).

**Architecture:** One server projection addition (`active_recently` on `/trust/communities`
organic links, derived fail-closed from existing `community_trust_edges.last_interaction_at`);
everything else is client-side emphasis in the two graph renderers plus shared encoding constants.
No schema changes.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14 (Pages Router), D3 (deterministic
renderers), PostgreSQL 15.

**Version:** v11.28.0 → v11.29.0 · **Branch:** `feature/sprint-119-graph-presentation` — create off
`origin/master` AFTER PR A merges (do not start this plan until PR A is deployed)

**Spec:** `docs/superpowers/specs/2026-07-09-sprint-119-truthful-surfaces-fractal-story-design.md`

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `docs/adr/ADR-086-scale-answers-one-question-per-zoom-level.md` | The three scale answers + lineage |
| `apps/landing/src/data/docs/concepts/adr-086-scale-answers.json` | Landing ADR page |
| `services/social-graph-service/tests/tdd/sprint-119-bridge-aliveness.test.ts` | `active_recently` projection, fail-closed |
| `apps/frontend/tests/tdd/sprint-119-ring-where-you-fit.test.tsx` | Viewer anchor + emphasis + summary + pinned contracts |
| `apps/frontend/tests/tdd/sprint-119-hub-woven-bridges.test.tsx` | Bridge emphasis + aliveness + legend |

### Existing files to modify
| File | Change |
|------|--------|
| `services/social-graph-service/src/database/trustEdgeDb.ts` | `getCommunityDepthGraph` organic query selects `last_interaction_at` |
| `services/social-graph-service/src/routes/trustGraph.ts` (or the projection module) | Derive `active_recently: boolean` on organic links; strip the timestamp before responding |
| `services/social-graph-service/src/services/disclosureProjection.ts` | Share the 30-day window constant (export, don't duplicate) |
| `apps/frontend/src/components/graphs/graphVisualEncoding.ts` | Viewer-emphasis + bridge constants/helpers |
| `apps/frontend/src/components/graphs/normalizeGraphData.ts` | `DepthLink` gains `active_recently?: boolean`; `normalizeCommunityDepthGraph` maps it to `activeRecently` |
| `apps/frontend/src/components/graphs/types.ts` | `TrustLink` gains `activeRecently?: boolean` (mirrors the `formed_recently` → `formedRecently` pattern) |
| `apps/frontend/src/components/graphs/communityRingModel.ts` | Rotation so the caller sits at 12 o'clock |
| `apps/frontend/src/components/graphs/CommunityRingGraph.tsx` | Default viewer-chord emphasis, place summary line, "You" legend, honest no-bonds state |
| `apps/frontend/src/components/graphs/CommunityHubGraph.tsx` | Member↔member bridge emphasis, `active_recently` aliveness treatment, legend entries |
| `docs/adr/README.md` | ADR-086 indexed |
| `docs/guides/` living-graph/trust-graph guide + landing regen + `nav.json` | Community + across-communities sections |
| `services/social-graph-service/CONTEXT.md`, `services/registry.json` | `/trust/communities` projection change |
| `package.json` | 11.28.0 → 11.29.0 |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

Spec notes 6–15 apply to this PR verbatim — the load-bearing ones:

1. **Ring: rotation only — no layout invention (ADR-083).** Ring membership, order, radius, chord
   geometry stay exactly as S115 shipped; the viewer anchor rotates the existing order so the
   caller lands at 12 o'clock. Deterministic: same input → same picture.
2. **decayTier opacity bands and `new > caller > focused` stroke precedence are shipped
   contracts** (`graphVisualEncoding.ts`) — pin both with regression assertions in Task 1 BEFORE
   touching emphasis. Viewer emphasis layers on top (quiet non-viewer chords); it must not
   reorder the stroke precedence or alter band values within a group.
3. **Do NOT add `formed_at` to community graph queries** — "weaving/fraying" was considered for
   the community scale and NOT chosen; `formed_recently` stays fail-closed false there.
4. **Bridge aliveness is server-derived, fail-closed, qualitative (ADR-082):** `active_recently` =
   `last_interaction_at` within the SAME exported 30-day constant S118 introduced (never a second
   window constant); the raw timestamp must NOT appear in the response.
4b. **The flag must survive the client normalization hop or the live hub never sees it.** The
   real data path is `BelongingGraph` (mode `communities`) → `normalizeCommunityDepthGraph` →
   `DepthLink` → `TrustLink` (`normalizeGraphData.ts`, `types.ts`). Thread
   `active_recently` → `activeRecently` through it, and make the hub TDD suite exercise the
   normalization with a RAW depth-graph payload — hand-built `TrustLink` fixtures alone can go
   green while live data shows nothing.
5. **`/trust/communities` responds with `getCommunityDepthGraph` output directly** (no
   projectPersonGraph pass) — add the boolean at the derivation/route seam and keep fission links
   untouched.
6. **Demo look:** `community_trust_edges` may be thin on the curated baseline — check bridge
   counts in the DB before judging an "inert" hub (sparsity memory). Never mutate protected demo
   personas.
7. **jsdom/D3 gotchas:** `^d3$` → `d3/dist/d3.min.js`, stub ResizeObserver, seed `node.__zoom`
   directly; `next/router` globally mocked; deterministic renderers must render identically in
   jsdom.
8. **`nav.json` silently reverts** — grep-verify after regen.
9. **TDD placement + turbo cache:** workspace `tests/tdd/`; run cross-workspace suites directly.
10. **Post-deploy bookkeeping (ADR-086 → Implemented, handoff COMPLETE) rides the NEXT sprint's
    first PR** — leave uncommitted after deploy.

---

## Task 1: Branch + TDD tests (server + both renderers) — before any implementation

**Files:**
- Create: the three TDD test files (File Map)

- [ ] `git fetch origin master && git checkout -b feature/sprint-119-graph-presentation origin/master`
      (only after PR A is merged + deployed).
- [ ] **Server test**: `/trust/communities` organic links carry `active_recently: true` iff
      `last_interaction_at` is within the shared 30-day constant; missing/old timestamp → `false`
      (fail-closed); the raw timestamp is absent from the response; fission links unchanged.
- [ ] **Ring test**: caller node is placed at 12 o'clock regardless of member order (two orderings,
      same anchor); non-viewer chords are quieted vs viewer chords in the default state; focus
      interaction still lifts a focused neighborhood; place summary renders "bonded with N of M"
      for a bonded viewer and the honest no-bonds line for an unbonded one; **pinned contracts**:
      decayTier band values and `new > caller > focused` precedence asserted unchanged.
- [ ] **Hub test**: an organic bridge with both endpoints `is_member` renders emphasized vs a
      periphery bridge; `active_recently` bridge gets the aliveness treatment; dormant
      member↔member bridge does not; legend lists the new entries; fission lineage rendering
      unchanged. **Feed the renderer through `normalizeCommunityDepthGraph` with a RAW
      depth-graph payload** (raw `active_recently` in, `activeRecently` out, aliveness visible) —
      not only hand-built `TrustLink` fixtures — so the live `BelongingGraph` data path is what's
      proven.

- [ ] **Verification: all three suites RED for the right reason**

```bash
cd services/social-graph-service && npx jest tests/tdd/sprint-119-bridge-aliveness --no-coverage
cd apps/frontend && npx jest tests/tdd/sprint-119-ring-where-you-fit tests/tdd/sprint-119-hub-woven-bridges --no-coverage
```

## Task 2: Server — bridge aliveness on /trust/communities

**Files:**
- Modify: `trustEdgeDb.ts` (`getCommunityDepthGraph`), route/projection seam, `disclosureProjection.ts` (export the window constant)

- [ ] Organic query selects `cte.last_interaction_at`; derive `active_recently` with the exported
      S118 30-day constant; strip the timestamp from the returned link objects.
- [ ] Run `/simplify`.

- [ ] **Verification: Task 1 server suite GREEN; service unit+regression green**

```bash
cd services/social-graph-service && npx jest tests/tdd/sprint-119-bridge-aliveness --no-coverage && npx jest tests/unit tests/regression --no-coverage
```

## Task 3: Shared encoding — viewer emphasis + bridge constants

**Files:**
- Modify: `apps/frontend/src/components/graphs/graphVisualEncoding.ts`

- [ ] Add the viewer-emphasis helper (quieted non-viewer chord opacity factor applied ON TOP of
      decayTier bands — relative band ordering preserved within each group) and hub bridge
      constants (woven emphasis, aliveness hue from the S118 new-bond green family, dormant/
      periphery quieting). Single source of encoding truth — renderers consume, never redefine.
- [ ] Run `/simplify`.

- [ ] **Verification: encoding unit assertions green (part of Task 1 suites); no contract drift**

```bash
cd apps/frontend && npx jest tests/tdd/sprint-119-ring-where-you-fit --no-coverage
```

## Task 4: CommunityRingGraph — "Where do you fit?"

**Files:**
- Modify: `communityRingModel.ts`, `CommunityRingGraph.tsx`

- [ ] Rotate ring placement so `currentUserId` sits at 12 o'clock (model-level, deterministic).
- [ ] Default state: viewer chords full presence (existing caller amber), non-viewer chords
      quieted via the Task 3 helper; focus/selection behavior unchanged on top.
- [ ] Place summary line + "You" legend entry + honest no-bonds line ("No bonds here yet — help
      someone to start weaving in"). Aria labels updated to name the viewer's place.
- [ ] Confirm `TrustGraphTab` / explorer surfaces pass `currentUserId` everywhere the ring renders.
- [ ] Run `/simplify`.

- [ ] **Verification: ring suite GREEN; frontend unit+regression green**

```bash
cd apps/frontend && npx jest tests/tdd/sprint-119-ring-where-you-fit --no-coverage && npm test
```

## Task 5: CommunityHubGraph — "Which are woven together?"

**Files:**
- Modify: `CommunityHubGraph.tsx`, `normalizeGraphData.ts` (`DepthLink.active_recently` +
  mapping), `types.ts` (`TrustLink.activeRecently`)

- [ ] Thread the flag through the normalization hop: `DepthLink` gains
      `active_recently?: boolean`; `normalizeCommunityDepthGraph` maps it to
      `TrustLink.activeRecently` (mirror the `formed_recently` → `formedRecently` pattern).
- [ ] Member↔member organic bridges emphasized; periphery + dormant quieted; `active_recently`
      aliveness treatment; legend entries ("Woven bridge — recent exchange", "Dormant bridge");
      fission lineage untouched. Aria labels name woven vs dormant.
- [ ] Run `/simplify`.

- [ ] **Verification: hub suite GREEN**

```bash
cd apps/frontend && npx jest tests/tdd/sprint-119-hub-woven-bridges --no-coverage && npm test
```

## Task 6: ADR-086 + guides + landing + CONTEXT/registry

**Files:**
- Create: `docs/adr/ADR-086-…md`, landing ADR JSON; Modify: `docs/adr/README.md`, living-graph
  guide, landing regen + `nav.json`, social-graph `CONTEXT.md`, `services/registry.json`,
  `package.json` (11.29.0), onboarding workflow copy if it names the views

- [ ] ADR-086 (status Accepted): the three scale answers, S114-revert lineage
      (ADR-083 → ADR-085 → 086), viewer-anchor convention, bridge aliveness derivation, rejection
      of manufactured emphasis (BUG-029 tie-in).
- [ ] Guide sections for community + across-communities scales (match the S118 ego section voice);
      onboarding workflow copy check.
- [ ] `CONTEXT.md` + `registry.json` for the `/trust/communities` change; regen landing;
      **grep-verify `nav.json`**; bump version.

- [ ] **Verification:**

```bash
npm run feedback:check
cd tests && npx jest regression/doc-context-drift-gate --no-coverage
```

## Task 7: SDLC quality gates

- [ ] `/simplify` — final pass on the branch diff.
- [ ] `/code-review` on the branch diff; resolve correctness findings, justify dismissals.
- [ ] `/security-review` on the branch diff; resolve real findings, justify dismissals.
- [ ] Cross-agent review per protocol if Codex is available.

- [ ] **Verification: all three gates run and recorded in the PR description**

```bash
git diff origin/master --stat
```

## Task 8: Final verification

- [ ] `npx tsc --noEmit` in every touched workspace.
- [ ] Promote green TDD suites (`node scripts/promote-tdd-tests.js`).

```bash
npm test
npm run feedback:check
cd tests && npx jest regression --no-coverage
```

## Task 9: Merge + Deploy (use the `/ship` skill)

- [ ] Open PR (template filled), cross-agent review, then **ask the maintainer for explicit admin
      merge authorization** before `gh pr merge --squash --admin`.
- [ ] Monitor GitHub Actions deploy; verify demo health per service.
- [ ] **Human validation** on the live demo: `maria.reyes` community ring shows Maria at 12
      o'clock with her chords forward and a truthful place summary; a sparse sim user's ring shows
      the honest no-bonds line (check DB degree first — sparsity memory); the across-communities
      view distinguishes woven vs dormant bridges (verify `community_trust_edges` rows exist for
      the story communities first); ego view + `/welcome` arrival unchanged; mobile 375px on both
      surfaces.
- [ ] Update handoff: sprint 119 COMPLETE. **ADR-086 → Implemented + handoff COMPLETE edits stay
      uncommitted, riding the next sprint's first PR.**
