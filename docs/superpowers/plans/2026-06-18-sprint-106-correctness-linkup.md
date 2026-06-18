# Post-Facelift Correctness & Link-Up Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close BUG-013…016 from S105 validation and ship one bounded fix for the
community↔service-provider link-up confusion, then deploy v11.14.0.

**Architecture:** All changes are correctness fixes at their correct layer — one backend feed-ranker
projection fix (BUG-014), a decisions-feed + DecisionBand rating-symmetry fix (BUG-013), and frontend
relocation/chrome/legibility passes (BUG-015, BUG-016, link-up). No new endpoints or tables expected.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14 (Pages Router), PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `services/request-service/tests/tdd/sprint-106-feed-request-type.test.ts` | BUG-014: feed ranker carries persisted `request_type`, not `category` |
| `services/request-service/tests/tdd/sprint-106-rating-decision.test.ts` | BUG-013: decisions feed surfaces a `rate` decision for both parties on `fully_completed`-unrated matches |
| `services/reputation-service/tests/tdd/sprint-106-feedback-constraints.test.ts` | BUG-013: `POST /reputation/feedback` accepts both participant roles, rejects non-participants and non-completed matches, and the per-`(rater, match)` double-submission guard lets both parties rate independently |
| `apps/frontend/tests/tdd/sprint-106-decision-band-rating.test.tsx` | BUG-013: DecisionBand renders a first-class rate action; one-sided done does not |
| `apps/frontend/tests/tdd/sprint-106-band-placement.test.tsx` | BUG-015: band mounts in Helping, not Browse |
| `apps/frontend/tests/tdd/sprint-106-header-and-linkup.test.tsx` | BUG-016 + link-up: header breathing room + provider legibility fix |

### Existing files to modify
| File | Change |
|------|--------|
| `services/request-service/src/services/feed/basicFeedRanker.ts` | Project persisted `request_type` enum, not `category` (BUG-014) |
| `services/request-service/src/routes/requests.ts` (decisions/feed projection) | Surface `rate` decision for completed-unrated matches; confirm no other site re-conflates category/request_type (BUG-013, BUG-014) |
| `services/reputation-service/src/routes/reputation.ts` (`POST /feedback`, ~L292) | BUG-013 hardening: add participant + completed-match validation before `insertFeedback` (currently any authenticated user can rate any match) |
| `apps/frontend/src/components/Feed/DecisionBand.tsx` | First-class `rate` decision/action (BUG-013) |
| `apps/frontend/src/components/CommitmentsTab.tsx` (Helping tab) | Mount DecisionBand at top of Helping (BUG-015) |
| `apps/frontend/src/pages/dashboard.tsx` / `apps/frontend/src/components/Feed/UnifiedFeed.tsx` | Remove DecisionBand from Browse (BUG-015) |
| `apps/frontend/src/components/Layout.tsx` + `apps/frontend/src/styles/globals.css` | Topbar breathing room (BUG-016) + provider link-up legibility (link-up) |
| `apps/frontend/src/lib/onboarding/workflows.ts` | Update affected workflow copy |
| `docs/guides/*`, `apps/landing/src/data/docs/**` | Rating symmetry, Helping relocation, provider link-up |
| `services/request-service/CONTEXT.md`, `services/registry.json` | Feed-ranker correctness + any decisions-feed shape change |
| root `package.json` | Version bump to `11.14.0` |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **BUG-014 is a backend seam, not a copy fix.** `getOfferActionLabel` is correct. The bug is
   `basicFeedRanker.ts:131` projecting `category` as `request_type`. Fix the projection to carry the
   persisted enum. Grep every feed/projection site (browsable filtering lives in ~4 places) and
   confirm none reintroduce `category`-as-`request_type`. Never client-side patch.
2. **BUG-013 is investigate-first (Task 1).** Reproduce the rating lifecycle end-to-end before
   writing code; confirm whether the rating write path already accepts both roles. Surfacing-only vs
   write-path is decided by that finding, not assumed.
3. **Rating must be symmetric and durable.** Both participants get a rate affordance until each rates;
   it survives reload. A one-sided done must not prompt rating.
4. **BUG-015 relocates, doesn't duplicate.** Move the band to Helping; remove it from Browse. Preserve
   server-ranked ordering, all actions, and the rate affordance.
5. **BUG-016 is chrome-only**, within existing A-plus tokens. No nav-information change.
6. **Link-up cleanup is bounded.** One contained legibility fix; STOP and flag if it needs a model
   change or multi-flow rework.
7. **Semantic + accessible** on every touched surface: tokenized colors, visible focus, keyboard,
   tap targets, not color-only.
8. **useRouter test mock is global** (`apps/frontend/jest.setup.js`) — don't add per-file router mocks.
9. **Docs are source-first** — edit Markdown sources + generator mappings, then regenerate landing
   JSON. Never hand-edit generated landing docs. `nav.json` silently reverts — grep-verify after edit.

---

## Task 1: Branch, baseline, and BUG-013 rating-lifecycle investigation

**Files:**
- Create: none yet (investigation + notes into the handoff)

- [ ] Create branch `feature/sprint-106-correctness-linkup` from up-to-date `master`.
- [ ] Confirm S105 is merged and the working tree is clean (ignore untracked
  `scripts/founding-circle-submissions.sh` — do not stage it).
- [ ] **Investigate BUG-013 end-to-end (systematic-debugging):** trace match completion → rating
  state → decisions feed → DecisionBand. Answer concretely:
  - Where does `mark_done` transition a match to `fully_completed`, and what records a rating?
  - **Known from planning:** the rating write path is **reputation-service `POST /reputation/feedback`**
    (`reputation.ts:292`), reached via the frontend `reputationService.submitFeedback()`
    (`apps/frontend/src/utils/completion.ts:44` → `api.ts:732`) — NOT a request-service route. That
    handler already accepts ratings from ANY authenticated user (no role gate) and guards only against
    double-submission per `(fromUserId, match_id)` via `hasSubmittedFeedback`. It does **not** validate
    that `fromUserId` is a participant of `match_id` nor that the match is completed.
  - What does the decisions feed return for a `fully_completed` match the viewer has not rated?
- [ ] **Record the finding in the handoff**: BUG-013 is **surfacing-only on the rating write side**
  (both roles already accepted) — the real fix is surfacing a durable `rate` decision. Decide whether
  to also harden `POST /feedback` with participant + completed-match validation this sprint (recommended,
  since we are touching the rating flow and `/security-review` is a gate). Write the chosen scope before
  coding.
- [ ] **Diagnose the link-up confusion (bounded):** document where the provider↔community relationship
  reads as confusing (Layout nav split, provider onboarding, provider-in-community discoverability)
  and name the ONE contained fix. If it requires a model/multi-flow change, flag for re-scope here.

```bash
git checkout master && git pull && git checkout -b feature/sprint-106-correctness-linkup
git status   # confirm only expected untracked local files
```

---

## Task 2: TDD — BUG-014 feed-ranker request_type correctness

**Files:**
- Create: `services/request-service/tests/tdd/sprint-106-feed-request-type.test.ts`

- [ ] Write a failing test: a service ask whose `category` holds a skill token is projected by the
  feed ranker with `request_type === 'service'` (the persisted enum), NOT the category token.
- [ ] Assert the same for the other built-in enum values so the projection isn't service-only.
- [ ] Assert exact values (per the robust-testing standard) — no shallow truthiness.

```bash
cd services/request-service && npx jest tests/tdd/sprint-106-feed-request-type.test.ts
```

---

## Task 3: Implement BUG-014 fix

**Files:**
- Modify: `services/request-service/src/services/feed/basicFeedRanker.ts`
- Modify (verify only): other feed/projection sites in `requests.ts`

- [ ] Change the ranker projection so the feed item carries the persisted `request_type` enum, not
  `r.category`.
- [ ] Grep every feed/projection/browsable site; confirm none reintroduce `category`-as-`request_type`.
- [ ] Verify Task 2 test passes.
- [ ] Run `/simplify` on the diff.

```bash
cd services/request-service && npx jest tests/tdd/sprint-106-feed-request-type.test.ts
```

---

## Task 4: TDD — BUG-013 rating symmetry (per Task 1 finding)

**Files:**
- Create: `services/request-service/tests/tdd/sprint-106-rating-decision.test.ts`
- Create: `services/reputation-service/tests/tdd/sprint-106-feedback-constraints.test.ts`
- Create: `apps/frontend/tests/tdd/sprint-106-decision-band-rating.test.tsx`

- [ ] Request-service test: for a `fully_completed` match the viewer has not rated, the decisions feed
  returns a `rate` decision; once rated it disappears; both requester and responder receive it
  independently.
- [ ] Reputation-service test (the actual write path, `POST /reputation/feedback`): a participant of
  either role can submit; the per-`(rater, match)` double-submission guard still lets the OTHER party
  rate the same match independently; a non-participant is rejected; rating a non-completed match is
  rejected. (Asserts the hardening, not just "accepted".)
- [ ] Frontend test: `DecisionBand` renders a first-class rate action for a `rate` decision and calls
  `reputationService.submitFeedback` with the correct `match_id`/`to_user_id`/`community_id`; a
  one-sided `mark_done` does NOT prompt.

```bash
cd services/request-service && npx jest tests/tdd/sprint-106-rating-decision.test.ts
cd ../reputation-service && npx jest tests/tdd/sprint-106-feedback-constraints.test.ts
cd ../../apps/frontend && npx jest tests/tdd/sprint-106-decision-band-rating.test.tsx
```

---

## Task 5: Implement BUG-013 rating symmetry

**Files:**
- Modify: `services/request-service/src/routes/requests.ts` (decisions projection)
- Modify: `apps/frontend/src/components/Feed/DecisionBand.tsx`
- Modify (recommended hardening): `services/reputation-service/src/routes/reputation.ts` (`POST /feedback`)

- [ ] Surface a durable `rate` decision for both parties of a `fully_completed`-unrated match.
- [ ] Render it in `DecisionBand` as a first-class rate action (keep the existing in-place unlock
  after `mark_done` working, but the `rate` decision is the durable, reload-surviving path).
- [ ] Harden `POST /reputation/feedback`: validate `fromUserId` is a participant of `match_id` and the
  match is completed before `insertFeedback` (the write path currently accepts any authenticated user).
  Keep the existing per-`(fromUserId, match_id)` double-submission guard so both parties can still rate.
- [ ] Verify Task 4 tests pass.
- [ ] Run `/simplify` on the diff.

---

## Task 6: TDD + implement BUG-015 — relocate DecisionBand to Helping

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-106-band-placement.test.tsx`
- Modify: `apps/frontend/src/components/CommitmentsTab.tsx` (Helping tab),
  `apps/frontend/src/components/Feed/UnifiedFeed.tsx`, `apps/frontend/src/pages/dashboard.tsx`

- [ ] Failing test: the DecisionBand renders in the Helping tab and is absent from Browse.
- [ ] Mount the band at the top of `CommitmentsTab` with the same data source, server-ranked ordering,
  actions, and rate affordance; remove it from Browse's `UnifiedFeed`.
- [ ] Verify the test passes; run the full frontend suite to catch any Browse/Helping mount ripple.
- [ ] Run `/simplify` on the diff.

```bash
cd apps/frontend && npx jest tests/tdd/sprint-106-band-placement.test.tsx && npm test
```

---

## Task 7: TDD + implement BUG-016 (header) + link-up legibility fix

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-106-header-and-linkup.test.tsx`
- Modify: `apps/frontend/src/components/Layout.tsx`, `apps/frontend/src/styles/globals.css`

- [ ] Test the link-up legibility change (e.g. the provider nav/onboarding copy or seam identified in
  Task 1) renders the intended, clearer affordance.
- [ ] Header breathing-room pass on `kq-topbar` within A-plus tokens — no nav-information change.
- [ ] Ship the ONE bounded link-up fix from Task 1. If it grew beyond contained, STOP and flag.
- [ ] Verify accessibility: focus, keyboard, tap targets, not color-only.
- [ ] Run `/simplify` on the diff.

```bash
cd apps/frontend && npx jest tests/tdd/sprint-106-header-and-linkup.test.tsx
```

---

## Task 8: Docs — guides, landing, onboarding, ADR (if warranted), version

**Files:**
- Modify: `docs/guides/*`, `apps/landing/src/data/docs/**`,
  `apps/frontend/src/lib/onboarding/workflows.ts`, root `package.json`
- Create (only if BUG-013 is judged architectural): `docs/adr/ADR-080-*.md` + landing ADR JSON

- [ ] Update the rating/completion guide: both sides rate, prompt now in Helping.
- [ ] Update the "Needs your response" location reference (now Helping).
- [ ] Update the provider guide for the link-up clarification.
- [ ] Update onboarding workflow copy for any changed step.
- [ ] Regenerate landing docs from source (`apps/landing npm run generate-docs`); grep-verify
  `nav.json` did not silently revert.
- [ ] **Force-add the generated docs** — `apps/landing/src/data/docs/` is gitignored, so regenerated
  files vanish from the PR unless force-added: `git add -f apps/landing/src/data/docs`.
- [ ] Bump root `package.json` to `11.14.0`.
- [ ] ADR-080 only if rating symmetry is an architectural behavior change; else document in CONTEXT.md.

```bash
cd apps/landing && npm run generate-docs
cd ../.. && git add -f apps/landing/src/data/docs
```

---

## Task 9: CONTEXT.md + registry.json + TDD integration test

**Files:**
- Modify: `services/request-service/CONTEXT.md`, `services/registry.json`
- Create: `tests/tdd/sprint-106-integration.test.ts` (cross-cutting smoke if DB available)

- [ ] Document the feed-ranker `request_type` correctness and any decisions-feed `rate` addition in
  request-service CONTEXT.md "Recent Fixes".
- [ ] Update `services/registry.json` only if the decisions feed response shape changed.
- [ ] Run `npm run feedback:check`.

```bash
npm run feedback:check
```

---

## Task 10: SDLC quality gates

- [ ] **Testing:** `npm test` (unit + regression) green; `npm run test:tdd` green or documented.
- [ ] **`/simplify`** — final pass on the whole branch diff.
- [ ] **`/code-review`** — on the branch diff; resolve correctness findings before merge.
- [ ] **`/security-review`** — on the branch diff; resolve real findings, justify dismissals (the
  `apps/frontend/src/lib/api.ts` request-forgery FP is known/recurring).
- [ ] Confirm CI security gates (ADR-059 dependency audit, ADR-060 CodeQL) are accounted for.

```bash
npm test && npm run test:tdd
```

---

## Task 11: Final pre-push verification + human validation

- [ ] `cd apps/frontend && npx tsc --noEmit` passes; backend `tsc --noEmit` for request-service passes.
- [ ] `npm test` and `npm run feedback:check` pass.
- [ ] Cross-agent review: the agent that did NOT author the branch reviews it (when two models avail).
- [ ] **Human browser validation** (deploy sprint): provider feed shows "Offer service"; both parties
  can rate a completed exchange; "Needs your response" is in Helping; header is uncramped; provider
  link-up reads clearly. Desktop + responsive mobile web.

```bash
cd apps/frontend && npx tsc --noEmit
cd ../.. && npm test && npm run feedback:check
```

---

## Task 12: Merge + Deploy

- [ ] Open the PR using `.github/pull_request_template.md`; do not self-merge.
- [ ] After CI green and approval, Admin-merge to `master`.
- [ ] Monitor GitHub Actions "Deploy to Demo"; confirm health-gated deploy + live v11.14.0.
- [ ] Use the `/deploy` skill. Verify live content matches `master` (deploy-drift watch).
- [ ] Update the handoff: S106 complete, deployed, next-sprint direction.
