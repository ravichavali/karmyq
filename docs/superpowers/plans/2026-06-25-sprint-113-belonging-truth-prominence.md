# Belonging Truth & Prominence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the ADR-082 reputation boundary *true on the screen* (kill NaN, reconcile profile,
restore map zoom) and validate it, then elevate My Network into nav + Home with the ego-vs-community
fractal made legible.

**Architecture:** Frontend + docs only over contracts that already shipped in S112 PR A — no DB
migration, no new endpoints, no reputation-math change. Two ordered PRs: PR A (truth + validation)
lands and deploys first; PR B (prominence + fractal clarity) branches from merged master after.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14 (Pages Router), PostgreSQL 15, Bull queue, D3 (HEB renderer).

---

## File Map

### New files to create
| File | Responsibility |
|------|----------------|
| `apps/frontend/src/components/graphs/GraphZoomControls.tsx` | Shared zoom-in/out/reset affordance used by every map surface (BUG-027). |
| `apps/frontend/tests/tdd/sprint-113-governance-no-nan.test.tsx` | Proves governance/stewardship never renders `NaN` when reputation fields are absent (BUG-025). |
| `apps/frontend/tests/tdd/sprint-113-profile-reconciliation.test.tsx` | Proves profile reputation reads only `getMyCommunitySummary` and reconciles (BUG-024/026). |
| `apps/frontend/tests/tdd/sprint-113-graph-zoom.test.tsx` | Proves zoom controls render + call scaleBy on map surfaces (BUG-027). |
| `apps/frontend/tests/tdd/sprint-113-mynetwork-prominence.test.tsx` | Proves My Network in nav + Home preview below decisions (PR B). |

### Existing files to modify
| File | Change |
|------|--------|
| `apps/frontend/src/components/GovernanceTab.tsx` | Remove `Math.round(undefined)` NaN renders (L66/L80/L145); omit-or-coarse (BUG-025). |
| `apps/frontend/src/components/community/StewardRequestsAdmin.tsx`, `.../tabs/StewardshipTab.tsx`, trust-card/nominee lists | Apply same NaN-safe rule to every reader of now-omitted reputation fields (BUG-025). |
| `apps/frontend/src/pages/profile.tsx` (`fetchKarmaData`, L323-353) | Replace the two legacy reads (`getMyKarma` + `getTrustScore`) with the single `getMyCommunitySummary` (BUG-024/026). **NOT** `ProfileTab.tsx` — that's the community settings surface. |
| `apps/frontend/src/components/LeftSidebar.tsx` + `/reputation/karma` self-readers (audit) | Migrate or narrow the claim (BUG-024/026). |
| `apps/frontend/src/components/graphs/TrustGraphHEB.tsx` (L342-354) | **Single zoom owner:** mount controls here, enable on all modes, gated by existing `enableZoom` prop (BUG-027). |
| `apps/frontend/src/components/BelongingGraph.tsx` (L57,121) | Default `enableZoom` on so all surfaces get controls via the one wrapper — do NOT mount in the three wrappers (BUG-027). |
| `apps/frontend/src/components/Layout.tsx` | Add My Network nav link (PR B). |
| `apps/frontend/src/components/Feed/UnifiedFeed.tsx` (Home `!isCommunity`, slot after L249 / before L251) | Add My Network Home preview after offered/suggested panels, before filter chips (PR B). Home no longer has a DecisionBand. |
| `apps/frontend/src/pages/network.tsx`, `.../components/BelongingSection.tsx`, `.../community/tabs/TrustGraphTab.tsx` | Three-scale fractal framing: ego / This Community / Across Communities (PR B). |
| `docs/adr/ADR-082-reputation-disclosure-boundary.md`, `docs/BUGS.md`, `apps/landing/...`, `package.json` | Docs loop + version bump + ADR-082 → Implemented after validation. |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **No `NaN` on a possibly-absent field.** Never `Math.round`/`Number`/`.toFixed` a reputation field
   that ADR-082 may now omit. Guard with an explicit presence check; do **not** use `|| 0` (fake zero is
   the anti-pattern ADR-082 forbids). Omit the element or show a coarse qualitative label.
2. **One canonical self-summary — claim only what you migrate.** Route the member's own reputation
   through `getMyCommunitySummary(communityId)`, never a second/legacy query (BUG-024 was `profile.tsx`
   calling `getMyKarma` AND `getTrustScore`). Audit `LeftSidebar.tsx` + `/reputation/karma` self-readers;
   migrate them or narrow the spec claim — don't assert all surfaces consume the summary unless they do.
3. **Find ALL instances (BUG-025).** Grep the whole frontend for readers of the now-identity-only
   governance payloads before editing; the NaN pattern likely repeats across components.
4. **Never re-add a removed field to fix the UI.** A missing profile value is a contract gap to escalate,
   not a cross-user read. The boundary is self-only by design.
5. **Zoom has ONE owner.** Every surface flows through `BelongingGraph` → `TrustGraphHEB`, and
   `enableZoom` is already threaded. Mount `GraphZoomControls` inside `TrustGraphHEB`; default
   `enableZoom` on in `BelongingGraph`. Do NOT mount in the three wrappers (duplicate-control risk).
   Test representative modes. In tests, seed `__zoom` directly and stub `ResizeObserver` (jsdom can't do
   `d3.zoom().transform`; see the Jest + D3 ESM memory).
6. **Chrome budget.** Adding My Network to `kq-topnav` competes for the reading-measure chrome
   (header already congested per BUG-016/017). Home preview is the primary prominence surface; the nav
   link is secondary and must not re-crowd the header at md widths.
7. **Two-user validation gates the truth claims.** Do not flip ADR-082 → Implemented or mark
   BUG-024/026 fixed until a two-user check (non-zero sentinels) confirms self-only + reconciled.
8. **No DB migration, no reputation-math change.** Frontend + docs only.
9. **Test placement / runner.** Frontend TDD in `apps/frontend/tests/tdd/`. `next/router` is globally
   mocked in `jest.setup`; if a newly-routed component breaks suites, fix the global mock, not N files.
   jest backgrounds long runs here — use `npx jest <path> --runInBand --json --outputFile=X.json --silent`.

---

# PR A — Belonging Truth (`feature/sprint-113-belonging-truth`)

## Task 1: Confirm branch + reproduce the NaN

**Files:**
- Branch `feature/sprint-113-belonging-truth` already created during planning (off the planning commit
  `143366ea`, which carries the spec/plan/handoff); local `master` reset to `origin/master`.

- [ ] Confirm you are on `feature/sprint-113-belonging-truth` with the planning commit at HEAD and a
  clean tree (`git branch --show-current`, `git log --oneline -1`).

```bash
git branch --show-current   # → feature/sprint-113-belonging-truth
```

- [ ] Grep every frontend reader of the now-omitted governance/stewardship reputation fields; list them.

```bash
# expect GovernanceTab.tsx:66/80/145 + any nominee/steward/trust-card consumers
```

## Task 2: BUG-025 — NaN-safe governance/stewardship (TDD)

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-113-governance-no-nan.test.tsx`
- Modify: `GovernanceTab.tsx`, `StewardRequestsAdmin.tsx`, `StewardshipTab.tsx`, any other reader found in Task 1

- [ ] **Write the failing test first**: render governance/stewardship with `eligible_members`/`role_holders`
  whose reputation fields are absent (the ADR-082 shape); assert the output contains no `"NaN"` and shows
  a coarse label or omits the metric.
- [ ] Replace each `Math.round(x)`/numeric render with a presence-guarded coarse label or omission. No `|| 0`.
- [ ] **Verify**

```bash
npx jest apps/frontend/tests/tdd/sprint-113-governance-no-nan.test.tsx --runInBand
```

- [ ] Run `/simplify` on the diff.

## Task 3: BUG-024/026 — profile reconciliation onto the canonical self-summary (TDD)

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-113-profile-reconciliation.test.tsx`
- Modify: `apps/frontend/src/pages/profile.tsx` (`fetchKarmaData`, L323-353) — **NOT** `ProfileTab.tsx` (that is the community settings/overview surface, unrelated to the member profile).
- Audit: `apps/frontend/src/components/LeftSidebar.tsx` + any `/reputation/karma` self-readers.

- [ ] **Write the failing test first**: mock `getMyCommunitySummary`; assert profile renders ONLY those
  values and that neither `getMyKarma` nor `getTrustScore(user.id, …)` is invoked (the two legacy reads
  at `profile.tsx:328-330` are the BUG-024 dual-source mismatch).
- [ ] Replace the `fetchKarmaData` `Promise.allSettled([getMyKarma, getTrustScore])` with a single
  `reputationService.getMyCommunitySummary(communityId)`; delete the stale reads.
- [ ] Audit `LeftSidebar.tsx` + `/reputation/karma` self-readers: migrate active ones to the summary, or
  narrow the spec claim to only the surfaces actually migrated.
- [ ] **Verify**

```bash
npx jest apps/frontend/tests/tdd/sprint-113-profile-reconciliation.test.tsx --runInBand
```

- [ ] Run `/simplify` on the diff.

## Task 4: BUG-027 — zoom controls, single owner (TDD)

**Files:**
- Create: `apps/frontend/src/components/graphs/GraphZoomControls.tsx`, `apps/frontend/tests/tdd/sprint-113-graph-zoom.test.tsx`
- Modify: `TrustGraphHEB.tsx` (the one owner), `BelongingGraph.tsx` (default `enableZoom` on). **Do NOT** mount controls in `dashboard/TrustNetworkWidget.tsx` or `community/tabs/TrustGraphTab.tsx` — they already route through `BelongingGraph`, so wrapper mounts would duplicate.

- [ ] **Write the failing test first**: render a representative mode; assert zoom-in/out/reset controls
  exist and clicking zoom-in calls the zoom behavior (`scaleBy`). Seed `__zoom`, stub `ResizeObserver`.
- [ ] Build `GraphZoomControls` (in/out/reset buttons wired to the `d3.zoom` behavior + svg ref).
- [ ] In `TrustGraphHEB.tsx`, attach zoom on all modes when `enableZoom` (not explorer-only; keep the
  seeded initial transform) and render the controls inside the renderer.
- [ ] In `BelongingGraph.tsx`, default `enableZoom` on so every surface inherits controls from the single
  wrapper. Verify no surface renders two control clusters.
- [ ] **Verify**

```bash
npx jest apps/frontend/tests/tdd/sprint-113-graph-zoom.test.tsx --runInBand
```

- [ ] Run `/simplify` on the diff.

## Task 5: Docs + context (PR A)

**Files:**
- Modify: `docs/adr/ADR-082-reputation-disclosure-boundary.md` (add defense-in-depth UI section; leave status flip to Task 7),
  `services/reputation-service/CONTEXT.md`, belonging/network user guide in `docs/guides/`, `apps/landing/` concept page + `nav.json`

- [ ] Document the NaN-safe rendering rule + profile reconciliation in ADR-082 (status flip deferred to
  validation in Task 7). Update the reputation CONTEXT.md note. Regenerate landing docs.
- [ ] **Verify** `npm run feedback:check` is clean; run the direct doc-context drift test.

## Task 6: SDLC quality gates (PR A)

- [ ] `/simplify` final pass on the full PR A diff. **Verify:** no new findings.
- [ ] `/code-review` on the branch diff. **Verify:** correctness findings resolved.
- [ ] `/security-review` on the branch diff. **Verify:** real findings resolved, dismissals justified
  (the recurring `js/request-forgery` api.ts baseURL FP is a known dismissal).

## Task 7: Verify, deploy, validate (PR A)

> PR A merges and deploys **before** validation, so the ADR/BUG status closures are NOT in this PR —
> they are the first commit of PR B (Task 8). PR A ends at a passing two-user validation.

- [ ] `npm test` (unit + regression) green; `tsc --noEmit` clean across changed workspaces; `npm run feedback:check` clean.
- [ ] Invoke `pre-commit-check`, open PR (fill `.github/pull_request_template.md`), cross-agent review, Admin merge.
- [ ] Use the `/deploy` skill; confirm GitHub Actions deploy success and live content matches master.
- [ ] **Two-user validation** (Maria + a second member, non-zero sentinels): exact reputation is self-only
  on every surface AND profile reconciles with the community view; no `NaN`; zoom works on each map. Record
  the PASS/FAIL result for Task 8 to act on. **Do not** edit ADR/BUGS status here — that lands in PR B.

---

# PR B — Belonging Prominence + Fractal Clarity (`feature/sprint-113-belonging-prominence`)

> Branch from merged `origin/master` only after PR A deploy + validation.

## Task 8: Branch + record validated status closures + My Network nav + Home preview (TDD)

**Files:**
- Create: branch `feature/sprint-113-belonging-prominence` off merged `origin/master` (after PR A deploy + PASS); `apps/frontend/tests/tdd/sprint-113-mynetwork-prominence.test.tsx`
- Modify: `docs/adr/ADR-082-reputation-disclosure-boundary.md`, `docs/BUGS.md`, `apps/frontend/src/components/Layout.tsx`, `apps/frontend/src/components/Feed/UnifiedFeed.tsx`

- [ ] **First commit — status closures from PR A's validation.** Only if PR A's two-user validation
  PASSED: flip **ADR-082 → Implemented** and mark **BUG-024/025/026/027 fixed** in `docs/BUGS.md`. (These
  could not land in PR A because it merged before validation.) If validation FAILED, stop and re-open PR A.
- [ ] **Write the failing test first**: assert My Network link appears in primary nav, and the Home preview
  renders **after** the offered/suggested panels and **before** the filter chips (ordering assertion against
  the real `UnifiedFeed` Home structure), linking `/network`.
- [ ] Add My Network → `/network` to desktop `kq-topnav` + hamburger with active-state; respect the chrome
  budget (compact on narrow viewports — Critical Note #6).
- [ ] Add the prominent My Network preview to the Home feed in `UnifiedFeed.tsx` (`!isCommunity`), in the
  slot after `SuggestedAsHelperPanel` (L249) and before `FilterChipRow` (L251). Home no longer has a
  DecisionBand (BUG-015) — do not anchor to it.
- [ ] **Verify**

```bash
npx jest apps/frontend/tests/tdd/sprint-113-mynetwork-prominence.test.tsx --runInBand
```

- [ ] Run `/simplify` on the diff.

## Task 9: Fractal legibility — three explicit zoom levels

**Files:**
- Modify: `apps/frontend/src/pages/network.tsx`, `apps/frontend/src/components/BelongingSection.tsx`,
  `apps/frontend/src/components/community/tabs/TrustGraphTab.tsx` (sub-tabs + headings)

- [ ] Frame **My Network** (`ego`) as **Scale 1** — person-centric (you + first-degree), travels across communities.
- [ ] Frame **This Community** (`community`) as **Scale 2** — whole-community member topology (group scale).
  Re-label so it no longer reads as a second "My Network."
- [ ] Surface **Across Communities** (`communities` mode) as **Scale 3** — communities-as-nodes, "how
  communities connect" (the level-up). It already exists in `BelongingGraph` (`mode === 'communities'`);
  give it a clear entry/heading on the community network surface so the three scales read as one continuum.
- [ ] Add/extend a test asserting the three surfaces carry distinct scale framing.
- [ ] Run `/simplify` on the diff.

## Task 10: Docs + context (PR B)

**Files:**
- Modify: belonging/network user guide (`docs/guides/`), `apps/landing/` concept page describing the
  fractal + new entry points (+ `nav.json` wiring), `apps/frontend/src/lib/onboarding/workflows.ts`, `package.json` (→ v11.20.0)

- [ ] Author the three-scale fractal explanation (My Network ego → This Community member topology →
  Across Communities communities-as-nodes) + new nav/Home entry in the user guide and landing concept
  page; wire nav.json (grep-verify it didn't silently revert).
- [ ] Update onboarding workflow copy if the authenticated nav changed. Bump version to v11.20.0.
- [ ] **Verify** `npm run feedback:check` clean; doc-context drift test green.

## Task 11: SDLC quality gates (PR B)

- [ ] `/simplify` final pass on the full PR B diff. **Verify:** no new findings.
- [ ] `/code-review` on the branch diff. **Verify:** correctness findings resolved.
- [ ] `/security-review` on the branch diff. **Verify:** real findings resolved, dismissals justified.

## Task 12: Verify + deploy (PR B)

- [ ] `npm test` green; `tsc --noEmit` clean; `npm run feedback:check` clean.
- [ ] Invoke `pre-commit-check`; open PR (fill template), cross-agent review, Admin merge.
- [ ] Use the `/deploy` skill; confirm GitHub Actions deploy success, v11.20.0 live, content matches master.
- [ ] Human check on demo: My Network reachable from nav + Home; the three scales (My Network / This
  Community / Across Communities) read as distinct zoom levels; zoom works on every map surface; no NaN anywhere.
