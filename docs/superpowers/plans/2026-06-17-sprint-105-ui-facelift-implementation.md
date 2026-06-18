# UI Facelift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the Sprint 104 "A-plus" UI facelift across all frontend surface clusters: shared
foundation first, then Request feed, Profile/chrome, Dashboard, Community polish, docs, validation,
and deploy.

**Architecture:** This is a frontend design-system convergence sprint. It adds shared tokens/classes
and display helpers, then migrates existing Pages Router surfaces onto them without backend, schema,
or API-contract changes.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|----------------|
| `apps/frontend/src/lib/requestDisplay.ts` | Humanized request status/urgency labels and semantic token classes, if this does not fit cleanly in `requestActionCopy.ts`. |
| `apps/frontend/tests/tdd/sprint-105-design-foundation.test.tsx` | TDD guardrails for helper behavior, token availability, texture default-off/deferred behavior, and EmptyState accessibility. |
| `apps/frontend/tests/tdd/sprint-105-request-feed-facelift.test.tsx` | Request feed fate, detail/offers/match visible copy, and a11y convergence tests. |
| `apps/frontend/tests/tdd/sprint-105-profile-chrome-facelift.test.tsx` | Profile and Layout chrome behavior/a11y convergence tests. |
| `apps/frontend/tests/tdd/sprint-105-dashboard-home-facelift.test.tsx` | Dashboard selector, finite states, and secondary Home altitude tests. |
| `apps/frontend/tests/tdd/sprint-105-community-polish.test.tsx` | Community pending/error accessibility and token tests. |

### Existing files to modify
| File | Change |
|------|--------|
| `apps/frontend/src/styles/globals.css` | Add `--measure`, `--radius-card`; add `--texture` only if a S105 finite-state/divider consumes it; de-emphasize shadow card variants; keep compatibility where needed. |
| `apps/frontend/src/styles/karmyq-shell.css` | Add `kq-headline-sm`; add motif helpers only with a S105 consumer; add any shared shell classes needed by the rollout. |
| `apps/frontend/tailwind.config.js` | Expose any new token utilities if needed (`measure`, radius, texture-safe helpers). |
| `apps/frontend/src/lib/requestActionCopy.ts` | Extend or delegate status/urgency display helpers; keep existing offer action copy intact. |
| `apps/frontend/src/components/EmptyState.tsx` | Either migrate to the warm finite-state style or route callers to the shared `kq-finite-state` treatment. |
| `apps/frontend/src/components/Feed/RequestCard.tsx` | Consume shared status/urgency helpers and ensure match signal remains quiet qualitative meta. |
| `apps/frontend/src/components/Feed/UnifiedFeed.tsx` | Support secondary Home altitude or finite-state updates without changing feed semantics. |
| `apps/frontend/src/pages/requests/index.tsx` | Implement the feed fate chosen and recorded in Task 1: reskin or retire the fossil standalone Request feed. |
| `apps/frontend/src/pages/requests/[id].tsx` | Replace inline Fraunces/error/urgency drift with shared tokens/helpers. |
| `apps/frontend/src/pages/offers/index.tsx` | Migrate fossil list styling to warm cards/measure/status tokens. |
| `apps/frontend/src/pages/matches/[id].tsx` | Migrate fossil detail styling to warm cards/measure/status tokens. |
| `apps/frontend/src/pages/profile.tsx` | Migrate cold body cards, widths, raw grays/reds, and finite states. |
| `apps/frontend/src/components/Layout.tsx` | Tokenize title bar, availability/on-duty control, and topbar width alignment. |
| `apps/frontend/src/pages/dashboard.tsx` | Tokenize selector row/on-duty pill; add warm zero-community and secondary Home altitude. |
| `apps/frontend/src/pages/communities/[id].tsx` | Tokenize pending dot/error colors and add non-color-only pending signal. |
| `apps/frontend/src/lib/onboarding/workflows.ts` | Update onboarding copy if Dashboard Home or request-browse language changes. |
| `apps/frontend/CONTEXT.md` | Document Sprint 105 frontend helpers and migrated surfaces. |
| `docs/adr/ADR-079-visual-design-system-v2.md` | Advance status and implementation notes. |
| `docs/adr/README.md` | Update ADR-079 status. |
| `docs/concepts/ux-design-principles.md` | Document implemented A-plus principles. |
| `docs/guides/dashboard-home.md` | Document updated Home empty/caught-up and secondary altitude behavior. |
| `docs/guides/making-requests-guide.md` | Document request feed/detail visual and route behavior. |
| `docs/guides/fulfilling-requests-guide.md` | Document updated request-helping flow if affected. |
| `docs/guides/managing-commitments-guide.md` | Document offers/matches surface wording if affected. |
| `docs/guides/profile-guide.md` | Document profile visual section updates if guide references old layout. |
| `scripts/generate-docs.ts` | Only if ADR grouping/status handling needs adjustment; otherwise regenerate from sources. |
| `package.json` | Reconcile root version drift to the S105 release target. |
| `.claude/handoff/CURRENT_HANDOFF.md` | Track Sprint 105 execution state and final deploy result. |

### Generated files to update
| File | Source |
|------|--------|
| `apps/landing/src/data/docs/**` | Regenerate from docs sources; never hand-edit. |

---

## Critical Implementation Notes (read before Task 2)

1. **Direction is already decided: A-plus.** Do not re-run visual exploration or pick a new aesthetic.
   Direction A convergence is mandatory; B hooks are default-off and sparse; C is parked.
2. **Foundation lands first.** Add the tokens/helpers/classes before touching the surfaces, so every
   cluster consumes the same vocabulary instead of inventing local fixes.
3. **Force the Request feed fate early.** Decide reskin vs retire during Task 1, record the decision
   in the handoff, and write Task 4 tests against that known answer. Do not leave the highest-risk
   route decision to mid-execution.
4. **No unused B hooks.** `--texture` must default to off/none, and texture/motif hooks land only if a
   S105 finite-state or divider consumes them. If there is no consumer, defer the hook instead of
   shipping dead CSS.
5. **One card language.** Live surfaces should migrate to `.kq-card` and border-based separation.
   Avoid new shadows, new card radii, or nested cards.
6. **One content measure by default.** Use the new measure token for member-facing reading surfaces.
   Dense admin tools may opt out explicitly, but fossils must not keep `max-w-7xl` by habit.
7. **No leading match percentage.** Match signal is qualitative quiet metadata via
   `describeMatchSignal()`. Do not render `{matchScore}% Match` as a visual lead.
8. **Semantic color only.** Status, urgency, errors, availability, and pending dots use tokenized
   semantic colors plus text/aria where needed. No new raw `red-*`, `yellow-*`, `green-*`, or
   `gray-*` status styling.
9. **Test behavior and accessibility first.** Prefer helper output, route fate, visible copy, aria,
   keyboard, and not-color-only assertions. Class-string assertions are allowed only as narrow
   guardrails for fossil-pattern removal, not as the main proof of quality.
10. **EmptyState has broader blast radius.** If `EmptyState` changes, validate all direct consumers:
    requests, offers, communities index, CommitmentsTab, MyRequestsTab, and UnifiedFeed empty/error
    states. Run the full frontend suite immediately after the foundation task.
11. **Accessibility travels with the migration.** Verify contrast, visible focus, keyboard reachability,
   mobile tap targets, and no color-only state on every touched surface.
12. **Frontend-only unless re-scoped.** No database, service, or registry change is expected. If an
   implementation task seems to need a backend endpoint, pause and ask for re-scope.
13. **Version drift is part of the sprint.** Reconcile root `package.json` from `11.10.0` to the
    correct S105 release target (`11.13.0`) and make the docs agree.
14. **Docs are source-first.** Edit Markdown sources and generator mappings, then regenerate landing
    JSON. Do not hand-edit generated landing docs.
15. **Human validation is required.** This is a deploy sprint. Validate desktop and responsive mobile
    web flows for Dashboard, Request feed/detail, Offers, Match detail, Profile, Community, and the
    EmptyState ripple surfaces after deploy. This does not include React Native mobile parity.

---

## Task 1: Branch, baseline, and surface inventory

**Files:**
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

- [ ] Confirm branch is `feature/sprint-105-ui-facelift-implementation`.
- [ ] Read Sprint 104 research before implementation:
      `docs/design/sprint-104-ui-facelift/README.md`,
      `ux-audit.md`, `visual-research.md`, `recommendations.md`, and ADR-079.
- [ ] Read frontend context: `apps/frontend/CONTEXT.md`. Note that `apps/frontend/.claude/README.md`
      may be absent in this checkout; do not block on it if still missing.
- [ ] Inventory current fossil and warm surfaces with `rg` before editing:
      `kq-card`, `feed-card`, `shadow-`, `% Match`, `max-w-7xl`, `text-red-`, `bg-yellow-`,
      `bg-gray-`, `bg-green-`.
- [ ] **Force the Request feed fate now.** Decide whether `apps/frontend/src/pages/requests/index.tsx`
      will be reskinned in place or retired with a deliberate redirect. Record the decision in the
      handoff before writing Task 4 tests. Consider deep links, docs, tests, and the browsable-request
      filtering surfaces called out in project memory.
- [ ] Record in the handoff that Sprint 105 execution has started and S104's A-plus verdict is the
      scope source, including the Request feed fate decision.

- [ ] **Verification:**

```bash
git branch --show-current
rg -n "Match|matchScore|shadow-|max-w-7xl|bg-red-|text-red-|bg-yellow-|bg-gray-|bg-green-" apps/frontend/src
rg -n "requests|/requests|browsable|open-asks|feed" apps/frontend/src docs/guides apps/frontend/src/lib/onboarding/workflows.ts
```

---

## Task 2: TDD - foundation guardrails

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-105-design-foundation.test.tsx`

- [ ] Write failing tests or source-level guardrails that prove the foundation exists:
      `kq-headline-sm`, `--measure`, `--radius-card`, and a shared status/urgency display helper.
- [ ] Add tests for humanized urgency/status labels and semantic token class names.
- [ ] Add a guardrail that any texture/motif hook either has a S105 finite-state/divider consumer and
      defaults to off/none, or is explicitly absent/deferred.
- [ ] Add EmptyState accessibility expectations that prove visible heading/body/CTA semantics survive
      the foundation change.

- [ ] **Verification step:**

```powershell
Push-Location apps/frontend
npm run test:tdd -- sprint-105-design-foundation
Pop-Location
```

Expected before Task 3: tests may fail because implementation has not landed yet.

---

## Task 3: Implement shared token and component foundation

**Files:**
- Modify: `apps/frontend/src/styles/globals.css`
- Modify: `apps/frontend/src/styles/karmyq-shell.css`
- Modify: `apps/frontend/tailwind.config.js`
- Modify: `apps/frontend/src/lib/requestActionCopy.ts`
- Create/modify: `apps/frontend/src/lib/requestDisplay.ts`
- Modify: `apps/frontend/src/components/EmptyState.tsx`

- [ ] Add CSS variables: `--measure`, `--radius-card`.
- [ ] Add `--texture` and motif utilities only if at least one S105 finite-state/divider consumes
      them; otherwise document the B hook deferral in the handoff and ADR implementation notes.
- [ ] Add `kq-headline-sm` and any small shell utilities needed for measure/card use.
- [ ] Keep `.kq-card` as the canonical card primitive. Do not break older `.card` call sites in the
      foundation task; migrate them in surface tasks.
- [ ] Add or extend a request display helper for:
      humanized urgency labels, humanized status labels, semantic classes for status/urgency/error,
      and text-safe fallback for unknown values.
- [ ] Align `EmptyState` with the warm finite-state treatment or leave a compatibility wrapper that
      renders the same visual language.
- [ ] If `EmptyState` changes, validate every direct consumer immediately: `requests/index.tsx`,
      `offers/index.tsx`, `communities/index.tsx`, `CommitmentsTab.tsx`, `MyRequestsTab.tsx`, and
      `UnifiedFeed.tsx` empty/error states.
- [ ] Run `/simplify` on just the foundation diff before moving to surfaces.

- [ ] **Verification step:**

```powershell
Push-Location apps/frontend
npm run test:tdd -- sprint-105-design-foundation
npm test
Pop-Location
npx tsc --noEmit
rg -n "<EmptyState|EmptyState\\(" apps/frontend/src
```

---

## Task 4: TDD - Request feed/detail/offers/match cluster

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-105-request-feed-facelift.test.tsx`

- [ ] Write tests that pin the Task 1 request-feed fate decision: reskinned route behavior OR
      deliberate redirect behavior. Do not write tests that pass under both fates.
- [ ] Test that `% Match` is not a leading card pill on the standalone request feed.
- [ ] Test that request detail renders humanized urgency/status and does not use raw error color copy.
- [ ] Test offers and match detail visible copy/a11y invariants where practical; keep class-string
      assertions to narrow fossil-pattern guardrails only.

- [ ] **Verification step:**

```powershell
Push-Location apps/frontend
npm run test:tdd -- sprint-105-request-feed-facelift
Pop-Location
```

Expected before Task 5: tests may fail because implementation has not landed yet.

---

## Task 5: Implement Request feed + detail convergence

**Files:**
- Modify: `apps/frontend/src/pages/requests/index.tsx`
- Modify: `apps/frontend/src/pages/requests/[id].tsx`
- Modify: `apps/frontend/src/pages/offers/index.tsx`
- Modify: `apps/frontend/src/pages/matches/[id].tsx`
- Modify as needed: `apps/frontend/src/components/Feed/RequestCard.tsx`

- [ ] Implement the Request feed fate recorded in Task 1. Do not revisit it mid-task unless source
      reality invalidates the decision; if that happens, update handoff/tests first.
- [ ] Remove "Smart Filtering", "Minimum Match Score", and leading `% Match` UI.
- [ ] Replace broad fossil widths with the shared measure unless a dense admin exception is explicit.
- [ ] Replace raw urgency/status/error colors with semantic token helpers.
- [ ] Replace raw DB strings with humanized labels.
- [ ] Migrate offers and match detail to the same card, width, status, and heading language.
- [ ] Run `/simplify` on this cluster before continuing.

- [ ] **Verification step:**

```powershell
Push-Location apps/frontend
npm run test:tdd -- sprint-105-request-feed-facelift
Pop-Location
rg -n "% Match|Smart Filtering|Minimum Match Score|max-w-7xl|text-red-600|bg-yellow-100" apps/frontend/src/pages/requests apps/frontend/src/pages/offers apps/frontend/src/pages/matches
```

The `rg` check should return no live fossil UI, except comments documenting removed behavior if any.

---

## Task 6: TDD - Profile + global chrome

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-105-profile-chrome-facelift.test.tsx`

- [ ] Test Profile preserves member-facing behavior while exposing stable headings, actions, and
      accessible status/error copy after the visual migration.
- [ ] Test Layout title bar renders the expected page title semantics without relying primarily on
      class-name strings.
- [ ] Test availability/on-duty state has text plus accessible state, not raw green-only state.
- [ ] Use class-name assertions only as narrow fossil-pattern guardrails when no better user-visible
      assertion exists.

- [ ] **Verification step:**

```powershell
Push-Location apps/frontend
npm run test:tdd -- sprint-105-profile-chrome-facelift
Pop-Location
```

Expected before Task 7: tests may fail because implementation has not landed yet.

---

## Task 7: Implement Profile + global chrome convergence

**Files:**
- Modify: `apps/frontend/src/pages/profile.tsx`
- Modify: `apps/frontend/src/components/Layout.tsx`

- [ ] Migrate Profile body cards from shadow-based fossil cards to `.kq-card`.
- [ ] Replace raw grays/reds/greens with semantic token classes.
- [ ] Align Profile's width to the shared measure unless a section explicitly requires a wider
      treatment.
- [ ] Keep memory, karma, privacy, and trust-evolution behavior unchanged.
- [ ] Make the Layout `title=` bar use the serif shell heading style and align topbar/content width.
- [ ] Tokenize the availability/on-duty control and preserve existing provider behavior.
- [ ] Run `/simplify` on this cluster before continuing.

- [ ] **Verification step:**

```powershell
Push-Location apps/frontend
npm run test:tdd -- sprint-105-profile-chrome-facelift
Pop-Location
rg -n "shadow-md|bg-gray-|text-red-|bg-red-|bg-green-|text-green-|rgb\\(34 197 94\\)" apps/frontend/src/pages/profile.tsx apps/frontend/src/components/Layout.tsx
```

---

## Task 8: TDD - Dashboard Home polish

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-105-dashboard-home-facelift.test.tsx`

- [ ] Test the zero-community state renders the warm finite-state treatment.
- [ ] Test the community selector/on-duty row uses tokenized, legible status copy.
- [ ] Test the secondary Home altitude appears for an established user with an empty primary queue and
      does not appear while loading or for a truly new/no-community user.
- [ ] If existing feed fixtures are not enough, add focused mocks rather than changing API contracts.

- [ ] **Verification step:**

```powershell
Push-Location apps/frontend
npm run test:tdd -- sprint-105-dashboard-home-facelift
Pop-Location
```

Expected before Task 9: tests may fail because implementation has not landed yet.

---

## Task 9: Implement Dashboard Home convergence and secondary altitude

**Files:**
- Modify: `apps/frontend/src/pages/dashboard.tsx`
- Modify as needed: `apps/frontend/src/components/Feed/UnifiedFeed.tsx`
- Modify: `apps/frontend/src/lib/onboarding/workflows.ts`

- [ ] Tokenize the community selector row and on-duty pill.
- [ ] Use the shared finite-state treatment for zero-community and caught-up states.
- [ ] Add secondary Home altitude for established users with an empty primary queue. Keep it calm:
      recent helps, open community asks, or communities needing a hand are acceptable; fake urgency,
      infinite-scroll language, and engagement metrics are not.
- [ ] Reuse existing data already available to Dashboard/UnifiedFeed where possible.
- [ ] Update onboarding workflow copy if first-screen or empty-state language changes.
- [ ] Run `/simplify` on this cluster before continuing.

- [ ] **Verification step:**

```powershell
Push-Location apps/frontend
npm run test:tdd -- sprint-105-dashboard-home-facelift
Pop-Location
rg -n "bg-amber-100|bg-primary|You haven't joined|caught up|That's everyone" apps/frontend/src/pages/dashboard.tsx apps/frontend/src/components/Feed/UnifiedFeed.tsx apps/frontend/src/lib/onboarding/workflows.ts
```

---

## Task 10: TDD - Community light polish

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-105-community-polish.test.tsx`

- [ ] Test pending/stewardship notification state is not color-only: it has text, `aria-label`, or
      equivalent accessible naming.
- [ ] Test community error state uses semantic error styling.
- [ ] Guard that the community page remains on the existing warm IA; do not redesign tabs.

- [ ] **Verification step:**

```powershell
Push-Location apps/frontend
npm run test:tdd -- sprint-105-community-polish
Pop-Location
```

Expected before Task 11: tests may fail because implementation has not landed yet.

---

## Task 11: Implement Community reference-surface polish

**Files:**
- Modify: `apps/frontend/src/pages/communities/[id].tsx`

- [ ] Tokenize the pending dot and error state.
- [ ] Add text/aria to pending indicators so state is not color-only.
- [ ] Apply convergence tokens only where they reinforce the existing reference surface.
- [ ] Do not redesign the four-tab community IA.
- [ ] Run `/simplify` on this cluster before continuing.

- [ ] **Verification step:**

```powershell
Push-Location apps/frontend
npm run test:tdd -- sprint-105-community-polish
Pop-Location
rg -n "bg-red-500|text-red-500" apps/frontend/src/pages/communities/[id].tsx
```

---

## Task 12: User guides, ADR, landing docs, and version reconciliation

**Files:**
- Modify: `docs/adr/ADR-079-visual-design-system-v2.md`
- Modify: `docs/adr/README.md`
- Modify: `docs/concepts/ux-design-principles.md`
- Modify: `docs/guides/dashboard-home.md`
- Modify: `docs/guides/making-requests-guide.md`
- Modify: `docs/guides/fulfilling-requests-guide.md`
- Modify: `docs/guides/managing-commitments-guide.md`
- Modify: `docs/guides/profile-guide.md`
- Modify: `apps/frontend/CONTEXT.md`
- Modify: `package.json`
- Regenerate: `apps/landing/src/data/docs/**`

- [ ] Advance ADR-079 from Proposed to Implemented once the rollout is complete and describe what
      shipped under A-plus.
- [ ] Update the ADR index status.
- [ ] Update the UX design principles concept from "recommended" to "implemented".
- [ ] Update user guides for Dashboard Home, request browsing/detail, fulfilling/offers/matches, and
      Profile where visible copy or route behavior changed.
- [ ] Update frontend context with the new helpers/classes and migrated surfaces.
- [ ] Reconcile root `package.json` version to `11.13.0` and ensure docs mention the same release.
- [ ] Regenerate landing docs and force-add generated output.
- [ ] Confirm `services/registry.json` is unchanged; if it changes, the sprint has likely drifted into
      backend scope and needs review.

- [ ] **Verification step:**

```powershell
Push-Location apps/landing
npm run generate-docs
Pop-Location
git add -f apps/landing/src/data/docs
npm run feedback:check
git diff -- services/registry.json
```

---

## Task 13: Promote/organize tests and run frontend verification

**Files:**
- Move/update as appropriate: `apps/frontend/tests/tdd/sprint-105-*.test.tsx`
- Move/update as appropriate: `apps/frontend/tests/regression/`

- [ ] Run each Sprint 105 TDD suite and make it green.
- [ ] Promote stable tests to regression if that is the repo's current frontend test practice for
      completed behavior. If promotion is manual, move the files and update imports.
- [ ] Run frontend unit + regression tests.
- [ ] Run TypeScript.
- [ ] Run a targeted fossil-pattern grep across touched frontend files.
- [ ] Run `/simplify` on the whole branch diff before formal review gates.

- [ ] **Verification step:**

```powershell
Push-Location apps/frontend
npm run test:tdd
npm test
Pop-Location
npx tsc --noEmit
rg -n "% Match|Smart Filtering|Minimum Match Score|max-w-7xl|shadow-md|shadow-sm|text-red-600|bg-yellow-100|bg-gray-200|bg-green-500" apps/frontend/src/pages apps/frontend/src/components apps/frontend/src/styles
```

---

## Task 14: SDLC quality gates

**Files:** none, unless review findings require fixes.

- [ ] **Testing gate:** run root unit + regression tests after frontend verification.

```bash
npm test
```

- [ ] **`/simplify` gate:** final pass on the whole branch diff. Resolve unnecessary abstraction,
      duplicated helpers, lingering fossil styles, and doc drift.

```bash
git diff --stat master...
```

- [ ] **`/code-review` gate:** review branch diff for correctness, visual regressions, stale tests,
      route behavior, and docs consistency. Resolve real findings.

```bash
git diff --name-only master...
```

- [ ] **`/security-review` gate:** confirm no new unsafe HTML/CSS injection, no exposed secrets in docs
      or screenshots, no auth/role behavior changes, and no new request-forgery pattern. Document any
      false positives in the PR security-dismissals section.

```bash
npm audit --package-lock-only --audit-level=high
```

---

## Task 15: Final pre-push and human validation

**Files:**
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

- [ ] Run final type, tests, docs, and diff checks.
- [ ] Start the frontend locally and validate desktop + responsive mobile web viewports for:
      Dashboard Home, Request feed/detail, Offers, Match detail, Profile, Community Home/Stewardship.
      This does not include React Native mobile parity.
- [ ] Validate EmptyState ripple surfaces in desktop + responsive mobile web viewports:
      Requests empty, Offers empty/error, Communities index empty, CommitmentsTab helping/asks empty,
      MyRequestsTab empty, and UnifiedFeed loading/error/caught-up/filtered-empty states.
- [ ] Validate the Request feed route fate explicitly: reskinned route works, or retired route
      redirects deliberately.
- [ ] Human validation checklist:
      API smoke test: login/session works and existing feed/detail calls still return envelopes the
      client consumes correctly.
      DB check: no schema migration was introduced; demo data still supports tested flows.
      UI check: no overlapping text, no blank/unstyled surface, no color-only pending/error state.
- [ ] Update handoff with final state, blockers, PR link, deploy status, and any deferred polish.

- [ ] **Verification step:**

```powershell
npx tsc --noEmit
npm test
Push-Location apps/frontend
npm run test:tdd
Pop-Location
npm run feedback:check
git diff --check
git status --short
```

---

## Task 16: Merge + Deploy

**Files:** PR body / deployment notes.

- [ ] Open a PR from `feature/sprint-105-ui-facelift-implementation` using
      `.github/pull_request_template.md`; fill every required section.
- [ ] Include screenshots or a concise visual validation note for desktop and mobile surfaces.
- [ ] Include "Security dismissals" notes for any CodeQL/audit false positives.
- [ ] Do not self-merge. Admin owns merge authority.
- [ ] After Admin authorizes merge, use the `/deploy` skill / CI-first path: merge to `master`, push,
      monitor GitHub Actions, and only SSH if CI/CD is unavailable or broken.
- [ ] After deploy, validate live demo surfaces and update handoff.

- [ ] **Verification step:**

```bash
gh pr status
gh run list --limit 5
```

---

## Notes

- S105 is a deploy sprint. Unlike S104, it changes runtime frontend code and requires demo validation.
- Keep `scripts/founding-circle-submissions.sh` untracked unless the maintainer explicitly asks to
  include it.
- If S104's PR has not merged before execution begins, verify the S104 research/ADR files are present
  on the execution branch before implementing. Do not self-merge S104.
