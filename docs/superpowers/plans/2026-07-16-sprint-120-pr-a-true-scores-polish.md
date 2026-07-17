# Sprint 120 PR A: True Scores & Graph Polish — Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans and work INLINE — this PR's tasks are
> small, well-specified edits where subagent cold-starts cost more than the work (maintainer
> token-efficiency decision, 2026-07-16). Reserve subagents for genuinely large independent tasks.
> Gate calibration for this PR: ONE `/simplify` pass on the branch diff (no per-task passes);
> `/code-review` at MEDIUM effort.

**Goal:** Fix BUG-030 (fractional trust scores vs INTEGER cache column + batch blast radius),
land the six PR #150 polish findings, and carry the S119 close-out bookkeeping.

**Architecture:** One migration (`path_trust_score` → DOUBLE PRECISION) plus per-target error
isolation in the social-graph batch route; six contained polish edits in the shipped S119 graph
components. Nothing new structurally — this PR trues up what already shipped.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

**Version:** v11.29.0 → v11.30.0 · **Branch:** `feature/sprint-120-true-scores-polish` (off `origin/master`)

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `infrastructure/postgres/migrations/20260716-path-trust-score-double-precision.sql` | ALTER `auth.social_distances.path_trust_score` → DOUBLE PRECISION |
| `services/social-graph-service/tests/tdd/sprint-120-bug-030-fractional-score.test.ts` | Fractional-score cache write + batch per-target isolation |
| `apps/frontend/tests/tdd/sprint-120-graph-polish.test.tsx` | Ring truncation phrasing, quieted floor, legend, role="img" |
| `.claude/handoff/archive/2026-07-16-sprint-119-truthful-surfaces-fractal-story-COMPLETE.md` | Archived S119 handoff |

### Existing files to modify
| File | Change |
|------|--------|
| `infrastructure/postgres/init.sql` (L85) | `path_trust_score INTEGER` → `DOUBLE PRECISION` (minimal edit; PR B regenerates wholesale) |
| `scripts/ci-apply-full-schema.sh` | Add sentinel: column type is `double precision` |
| `services/social-graph-service/src/routes/paths.ts` (~L361 loop) | Per-target try/catch; failed target → existing "no connection" shape + server log |
| `services/social-graph-service/src/services/disclosureProjection.ts` | Export `isActiveRecently` alias (same impl, same 30-day constant) |
| `services/social-graph-service/src/database/trustEdgeDb.ts` (L569) | Use `isActiveRecently` at the interaction-recency site |
| `apps/frontend/src/components/graphs/CommunityRingGraph.tsx` (~L272) + `apps/frontend/src/pages/network.tsx` (~L349) | Truncation-scoped summary phrasing ("of the M shown") |
| `apps/frontend/src/components/graphs/graphVisualEncoding.ts` | Quieted-opacity floor > `UNRELATED_OPACITY` (target ≥ 0.12) |
| `apps/frontend/src/components/graphs/CommunityHubGraph.tsx` | Remove redundant "— organic trust" legend entry (L280); memoize `hubBridgeVisual` per link (L123); `role="img"` on labeled `<line>` (L138) |
| `docs/adr/ADR-086-...md` + `apps/landing/src/data/docs/concepts/adr-086-*.json` | Status Accepted → Implemented |
| `docs/BUGS.md` | BUG-030 → fixed (with fix shape) |
| `services/social-graph-service/CONTEXT.md` + `services/registry.json` | Column type, batch isolation semantics |
| `docs/guides/` + landing guide JSON (network/graph guide) | Legend + summary phrasing updates |
| `package.json` (root + touched workspaces per convention) | v11.30.0 |
| `.claude/handoff/CURRENT_HANDOFF.md` | Progress updates throughout |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

Copied from the spec — items 1–5, 11, 12 apply to this PR:

1. **DOUBLE PRECISION migration, NOT rounding.** Write sites stay unrounded: `paths.ts:189`,
   `paths.ts:361`, `pathComputation.ts:525`. After migration, grep `path_trust_score` consumers
   for integer-type assumptions.
2. **Batch isolation**: try/catch INSIDE the per-target loop; failure degrades to the existing
   "no connection" per-target shape (no new error shape), logged with target id.
3. **Migration hygiene**: date-named file; run `migration-validator` agent before commit; add the
   ci-apply-full-schema.sh sentinel; NEVER edit `009_social_graph.sql`.
4. **Do not disturb shipped graph contracts**: ring rotation/anchor, decayTier bands,
   `new > caller > focused` precedence, fail-closed `active_recently`, truthful legend colors are
   pinned S115/S118/S119 contracts. Run the promoted Sprint 118/119 regression suites directly
   after touching `graphVisualEncoding.ts`.
5. **One 30-day window**: `isActiveRecently` delegates to `isFormedRecently` — no second constant.
6. **Standing mechanics**: branch off `origin/master`; admin-authorized squash merge (explicit,
   every time); TDD in workspace `tests/tdd/`; direct cross-workspace jest runs; grep-verify
   `nav.json` after landing regen.
7. **S119 bookkeeping rides Task 1** (ADR-086 → Implemented, handoff archive, uncommitted
   handoff edit).

---

## Task 1: Branch + S119 bookkeeping + migration

**Files:**
- Create: `infrastructure/postgres/migrations/20260716-path-trust-score-double-precision.sql`
- Modify: `docs/adr/ADR-086-scale-answers-one-question-per-zoom-level.md`, landing `adr-086` JSON,
  `infrastructure/postgres/init.sql:85`, `scripts/ci-apply-full-schema.sh`

- [ ] Confirm you are on `feature/sprint-120-true-scores-polish` (created at planning off
  `origin/master`; planning docs, handoff, and the S119 handoff archive already ride it)
- [ ] ADR-086 status → `Implemented` in BOTH the ADR file and the landing JSON
- [ ] Write the migration (single ALTER, spec Data Model section); update init.sql:85; add
  ci-apply-full-schema.sh sentinel asserting `path_trust_score` is `double precision`
- [ ] **Verification:** run the `migration-validator` agent on the new migration; grep confirms no
  edit to `009_social_graph.sql`

## Task 2: TDD tests for BUG-030 (before implementation)

**Files:**
- Create: `services/social-graph-service/tests/tdd/sprint-120-bug-030-fractional-score.test.ts`

- [ ] Route-level test (mocked pool): single-path cache INSERT receives the fractional score
  unrounded (e.g. `18.2445981519795`)
- [ ] Batch test: target 2 of 3 throws during compute/INSERT → response 200, targets 1 and 3
  present, target 2 degrades to the "no connection" shape; error logged with target id
- [ ] Feed-ranking guard: `degrees_of_separation` values unchanged by the fix (BUG-029 lesson —
  ranking inputs must not move)
- [ ] **Verification:**

```bash
cd services/social-graph-service && npx jest tests/tdd/sprint-120-bug-030 --no-coverage
# tests exist and FAIL against current code where behavior is wrong (batch isolation)
```

## Task 3: Implement batch isolation + score-type sweep

**Files:**
- Modify: `services/social-graph-service/src/routes/paths.ts` (~L350–375)

- [ ] Wrap the per-target compute+INSERT in try/catch inside the batch loop per note 2
- [ ] Grep all `path_trust_score` consumers (services + frontend + simulation) for integer-type
  assumptions; fix any found at the presentation layer only
- [ ] **Verification:**

```bash
cd services/social-graph-service && npx jest tests/tdd/sprint-120-bug-030 --no-coverage  # green
npx tsc --noEmit
```

## Task 4: isActiveRecently alias

**Files:**
- Modify: `services/social-graph-service/src/services/disclosureProjection.ts`,
  `src/database/trustEdgeDb.ts:569`

- [ ] Export `isActiveRecently` delegating to `isFormedRecently` (same constant); adopt at the
  interaction-recency call site; update the L470 comment
- [ ] **Verification:** existing window suites green:

```bash
cd services/social-graph-service && npx jest tests/regression --no-coverage
```

## Task 5: TDD tests for graph polish (before implementation)

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-120-graph-polish.test.tsx`

- [ ] Truncated ring: summary text scopes to rendered subset ("of the M shown" phrasing per spec)
- [ ] `quietedRelatedOpacity > UNRELATED_OPACITY` assertion (encoding-level)
- [ ] Hub legend renders Woven/Dormant WITHOUT the "— organic trust" slate entry
- [ ] Labeled hub `<line>` elements carry `role="img"`
- [ ] Pin unchanged contracts FIRST: decayTier bands, stroke precedence, legend truthful colors
  (jsdom/D3 gotchas: `^d3$` → `d3/dist/d3.min.js`, stub ResizeObserver, seed `node.__zoom`)
- [ ] **Verification:** suite runs; new-behavior tests fail, contract pins pass

## Task 6: Implement the six polish findings

**Files:**
- Modify: `CommunityRingGraph.tsx`, `pages/network.tsx`, `graphVisualEncoding.ts`,
  `CommunityHubGraph.tsx` (per File Map)

- [ ] Findings 1–5 as specced (phrasing, quieted floor, legend removal, memoized
  `hubBridgeVisual`, `role="img"`)
- [ ] **Verification:**

```bash
cd apps/frontend && npx jest tests/tdd/sprint-120-graph-polish --no-coverage   # green
npx jest tests/regression --no-coverage                                        # S118/S119 pins green
npx tsc --noEmit
```

## Task 7: Docs — guides, landing, BUGS, CONTEXT, registry

- [ ] `docs/BUGS.md`: BUG-030 → fixed (migration + isolation, date)
- [ ] Network/graph user guide (`docs/guides/` + landing guide JSON): legend + summary phrasing
- [ ] `services/social-graph-service/CONTEXT.md`: column type, batch isolation semantics, alias;
  `services/registry.json` if the batch contract note changes
- [ ] **Verification:** `npm run feedback:check` clean for this diff; grep-verify `nav.json`
  after any landing regen; direct run of the doc-context drift gate:

```bash
cd tests && npx jest regression/doc-context-drift-gate --no-coverage
```

## Task 8: Version bump + TDD promotion

- [ ] v11.30.0 (root `package.json` + convention-touched workspaces)
- [ ] Promote green sprint-120 TDD suites to `tests/regression/` (script or manual per
  `scripts/promote-tdd-tests.js`)
- [ ] **Verification:** `npm test` green at root (rerun any turbo-suspect failure directly)

## Task 9: SDLC quality gates (calibrated — see plan header)

- [ ] `/simplify` — the ONE pass for this PR, on the full branch diff
- [ ] **Verification:** applied or explicitly dismissed findings, noted in handoff
- [ ] `/code-review` at MEDIUM effort — branch diff; resolve correctness findings before merge
- [ ] **Verification:** zero unresolved confirmed findings
- [ ] `/security-review` — branch diff; resolve real findings, written justification for dismissals
- [ ] **Verification:** zero unresolved findings; dismissals justified in handoff

## Task 10: Final verification

- [ ] `npx tsc --noEmit` in every touched workspace
- [ ] **Verification:**

```bash
npm test                # unit + regression, blocks
npm run feedback:check  # advisory clean
```

- [ ] Invoke `pre-commit-check`; update `CURRENT_HANDOFF.md` status; commit

## Task 11: Merge + Deploy (`/ship` or `/deploy` skill)

- [ ] Open PR (fill `.github/pull_request_template.md`); all checks green
- [ ] **PAUSE for explicit Admin merge authorization** — then `gh pr merge --squash --admin`
- [ ] Monitor GitHub Actions deploy; verify demo health (frontend/login/communities 200)
- [ ] **Post-deploy validation:** as `maria.reyes`, re-run the BUG-030 repro
  (maria.reyes → Fatima Alhassan single path + a `/paths/batch` sweep) — 200s, fractional score
  cached; confirm `degrees` unchanged on a known pair
- [ ] Update handoff; PR B branches off fresh `origin/master` next
