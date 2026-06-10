# Matching & Dibs Repair + Bug Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. BUG-008 also
> REQUIRES superpowers:systematic-debugging (diagnosis before fix) and every fix REQUIRES
> superpowers:test-driven-development (failing test before implementation).

**Goal:** Root-cause and fix the matching/dibs/completion seam (BUG-007, BUG-008, BUG-005) and
sweep the remaining open bug backlog (BUG-002, BUG-001, BUG-003, BUG-004), each proven by a test.

**Architecture:** No new services. Fixes land in request-service (matching/dibs/feed queries +
matches routes), the frontend help-loop surfaces (`RequestWizard`, `DibsPrompt`, `DecisionBand`,
`CommitmentsTab`, brand/logo), and one idempotent data-repair migration for adminless communities.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `infrastructure/postgres/migrations/20260608-backfill-community-admins.sql` | Backfill an admin for adminless communities (BUG-001), idempotent (dated `YYYYMMDD-slug.sql` naming) |
| `services/request-service/tests/tdd/sprint-92-matching.test.ts` | Failing repro for BUG-008, then locks the fix |
| `services/request-service/tests/unit/dibs-candidate-kind.test.ts` | Dibs candidate kind/branching for neighbor vs provider (BUG-007) |
| `apps/landing/src/data/docs/concepts/adr-072-dibs-scope.json` | ADR-072 (generated from source) |

### Existing files to modify
| File | Change |
|------|--------|
| `services/request-service/src/routes/dibs.ts` | Neighbor vs provider candidate handling (BUG-007) |
| `services/request-service/src/db/dibsDb.ts` | Candidate query correctness (BUG-007/008 per diagnosis) |
| `services/request-service/src/routes/matches.ts` | Matching lifecycle fix (BUG-008 per diagnosis) |
| `services/request-service/src/services/unifiedFeed.ts` (and/or `feed/feedComposer.ts`) | Exclude already-offered + non-open requests (BUG-002) |
| `apps/frontend/src/components/RequestWizard.tsx` | Gate/route dibs-candidate by request kind (BUG-007) |
| `apps/frontend/src/components/requests/DibsPrompt.tsx` | Neighbor vs provider framing (BUG-007) |
| `apps/frontend/src/components/Feed/DecisionBand.tsx` | `mark_done` unlocks rating (BUG-005) |
| `apps/frontend/src/components/CommitmentsTab.tsx` | Gate RatingPrompt on `fully_completed` (BUG-005) |
| `<brand/logo surface — REPRODUCE FIRST>` | Restore "Karmyq" wordmark **where it's actually missing** — Layout.tsx:116 already renders it (BUG-004) |
| `<provider-context offer surfaces — pin precisely>` | "Offer help" → "Offer service" **only in provider context**, not the shared `RequestCard` button (BUG-003) |
| `services/community-service/src/routes/communities.ts` | Last-admin guard (leave/demote) — the create path already inserts admin at :617 (BUG-001) |
| `services/request-service/CONTEXT.md` | Recent Fixes for BUG-001..008 |
| `docs/BUGS.md` | Mark fixed bugs `fixed` with branch + test refs |
| `services/registry.json` | Only if an endpoint contract changes |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **BUG-008 is diagnosis-first** (systematic-debugging): reproduce → failing test → root-cause
   statement → only then fix. No guessing from symptoms.
2. **Fix at the correct layer** — server-side bugs get server-side fixes; never a client filter for
   a server problem.
3. **Find ALL instances** — grep frontend + mobile + simulation + services before editing (the
   "Offer help" label and the completion/rating logic each exist in more than one place).
4. **One help-loop, one source of truth** — `DecisionBand` and `CommitmentsTab` route lifecycle
   actions through the same logic; rating fires on `fully_completed` from both.
5. **Dibs framing (Option A reframe vs B disable) is the maintainer's call**, made after Task 4's
   trace. Recommendation: A. Record in ADR-072.
6. **Migration safety** — idempotent, `IF NOT EXISTS`/`NOT EXISTS` guards, cross-schema safe; only
   adminless communities. Run migration-validator.
7. **Schema `communities.communities`; JWT field `communities`; API unwrap `res.data`.**
8. **Feed exclusion covers non-open statuses** — a matched/dibs_pending request must not reappear
   as browsable.
9. **Landing docs are generated** — edit sources, never the JSON; verify nav.json after editing.
10. **Next free ADR = 072.**

---

## Task 1: Feature branch + fold S91 doc tail

**Files:**
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`, `docs/BUGS.md`, `docs/IDEAS.md`

- [ ] Create the branch off master

```bash
git checkout master && git pull
git checkout -b feature/sprint-92-matching-repair
```

- [ ] Stage the carry-forward doc tail from Sprint 91 (handoff, BUGS.md BUG-007/008, IDEAS
  captures) so it rides in this branch's first commit — never a standalone docs push to master.
- [ ] Verify the working tree matches expectations (no `.playwright-mcp/` staged)

```bash
git status
```

---

## Task 2: BUG-008 — reproduce + diagnose (systematic-debugging)

**Files:**
- Create: `services/request-service/tests/tdd/sprint-92-matching.test.ts`

- [ ] **Reproduce the broken matching behavior** against the demo/sim or a seeded local DB. Capture
  the ACTUAL wrong behavior (what was expected vs what happened) — do not theorize.
- [ ] Investigate the suspect areas from the spec (mutual-aid 0-interaction candidate admission;
  offer→match→accept→reject reopen logic; matched requests still browsable). Confirm which one(s)
  actually reproduce.
- [ ] **Write a failing test** in `sprint-92-matching.test.ts` that encodes the broken behavior.

```bash
cd services/request-service && npm run test:tdd -- sprint-92-matching   # expect RED  (npm test = unit+regression only — would false-green a tdd/ file)
```

- [ ] **Write a one-paragraph root-cause statement** into the test file header AND append it to
  `docs/BUGS.md` BUG-008. This is the gate for Task 3.

---

## Task 3: BUG-008 — fix matching logic

**Files:**
- Modify: `services/request-service/src/routes/matches.ts` and/or
  `services/request-service/src/db/dibsDb.ts` (per Task 2 root cause)

- [ ] Implement the fix at the layer identified in Task 2. Trace end-to-end: config → query →
  route → frontend; confirm no other path reintroduces the bug.
- [ ] Make the Task 2 test pass; add edge-case assertions (exact values, not just truthiness).

```bash
cd services/request-service && npm run test:tdd -- sprint-92-matching   # expect GREEN
```

- [ ] Run `/simplify` on the diff so far.

---

## Task 4: BUG-007 — neighbor vs provider dibs framing

**Files:**
- Create: `services/request-service/tests/unit/dibs-candidate-kind.test.ts`
- Modify: `services/request-service/src/routes/dibs.ts`, `src/db/dibsDb.ts`,
  `apps/frontend/src/components/RequestWizard.tsx`,
  `apps/frontend/src/components/requests/DibsPrompt.tsx`

- [ ] **Trace the full flow** (RequestWizard → getDibsCandidate → dibs.ts branch →
  getMutualAidBestCandidate → DibsPrompt copy) and **present Option A (reframe) vs Option B
  (disable) to the maintainer; get ratification.** Recommendation: A.
- [ ] **Write the failing unit test** for the chosen behavior:
  - Option A: candidate carries a `kind: 'neighbor' | 'provider'` discriminator; service requests →
    provider, non-service → neighbor.
  - Option B: non-service requests return `null` (no candidate / no prompt).
- [ ] Implement backend **candidate** selection + shape by request kind (`dibs-candidate`).
- [ ] **Implement the BUG-007 submit-path (Option A only — easy to miss):** `POST /requests/:id/dibs`
  validates the nominated person through provider-only `getEligibleCandidates`
  ([dibs.ts:148](../../../services/request-service/src/routes/dibs.ts)). A neighbor first-ask will
  **403 (`NO_PRIOR_INTERACTION`)** unless this is updated to validate neighbor candidates via the
  mutual-aid path when the request is non-service. Also update payload naming/copy and the
  pending-dibs language (`getPendingDibsForProvider` join / DibsCard) so a neighbor isn't labeled a
  "provider." Add a submit-path test asserting a valid neighbor is accepted (not 403).
- [ ] Implement frontend: `RequestWizard` routes by kind; `DibsPrompt` uses neighbor-framed copy
  and warm visual for neighbors (Option A) OR isn't rendered for non-service (Option B).

```bash
cd services/request-service && npm run test:unit -- dibs-candidate-kind   # GREEN (unit/ file → test:unit)
cd services/request-service && npm run test:tdd -- sprint-92-matching     # submit-path repro (tdd/)
cd apps/frontend && npm run lint
```

- [ ] Run `/simplify` on the diff.

---

## Task 5: BUG-005 — unify completion → rating across both surfaces

**Files:**
- Modify: `apps/frontend/src/components/Feed/DecisionBand.tsx`,
  `apps/frontend/src/components/CommitmentsTab.tsx`
- Create/extend: `apps/frontend` test for the rating-unlock condition (TDD)

- [ ] **Write the failing test(s):** (a) marking done from `DecisionBand` when it completes the
  exchange unlocks the rating flow; (b) `CommitmentsTab` shows `RatingPrompt` only when
  `fully_completed`, not on a one-sided done.
- [ ] Implement: rating fires on the `fully_completed` transition consistently from both surfaces
  (shared helper / shared condition). One source of truth for the completion→rating logic.

```bash
cd apps/frontend && npm test -- CommitmentsTab DecisionBand 2>/dev/null || npm run test
```

- [ ] Run `/simplify` on the diff.

---

## Task 6: BUG-002 — feed excludes already-offered + non-open requests

**Files:**
- Modify: `services/request-service/src/services/unifiedFeed.ts` (and/or `feed/feedComposer.ts`)
- Extend: `services/request-service/tests/tdd/sprint-92-matching.test.ts` (or a feed test)

- [ ] **Write the failing test:** a request the viewer already has an active offer/match on, and a
  non-open (matched/dibs_pending) request, are excluded from that viewer's browsable feed even when
  no other open requests exist.
- [ ] Implement the server-side exclusion in the feed candidate query. No client-side filter.

```bash
cd services/request-service && npm run test:tdd -- sprint-92-matching   # GREEN
```

- [ ] Run `/simplify` on the diff.

---

## Task 7: BUG-001 — no adminless communities (backfill + last-admin guard)

**Root cause (corrected — do NOT "fix creation"):** the create path *already* inserts the creator
as `admin` ([communities.ts:617](../../../services/community-service/src/routes/communities.ts)).
Adminless communities come from **data** (sim-seeded communities, or the last admin leaving / being
demoted), not from the create path. So the fix is (1) a data-repair backfill, and (2) a guard
preventing the last admin from leaving/being demoted — NOT changing the create insert.

**Files:**
- Create: `infrastructure/postgres/migrations/20260608-backfill-community-admins.sql`
- Modify: `services/community-service/src/routes/communities.ts` (last-admin guard on leave/demote)
- Create: unit test for the last-admin guard

- [ ] **First, confirm the cause** for the reported community (`ec1b8b22-…` in BUG-001): was it
  sim-seeded, or did its admin leave? This decides whether the guard is needed or only the backfill.
- [ ] Write the idempotent backfill migration (promote `created_by` if still an active member, else
  earliest-joined active member; only communities with **zero** active admins; `NOT EXISTS` guards;
  cross-schema auth+communities safe).
- [ ] **Write the failing test** for the last-admin guard, then implement it (leave/demote of the
  sole admin is rejected or auto-promotes a successor — pick per the cause finding).
- [ ] Run the migration-validator agent on the new migration file.

```bash
cd services/community-service && npm test   # GREEN
# then: migration-validator agent on infrastructure/postgres/migrations/20260608-backfill-community-admins.sql
```

- [ ] Run `/simplify` on the diff.

---

## Task 8: BUG-003 + BUG-004 — provider copy + wordmark logo (quick wins)

**Files:**
- Modify: provider offer-label surfaces (frontend + mobile + sim — grep first); brand/logo
  component

- [ ] BUG-003: grep ALL surfaces for offer labels. **Do not blanket-replace** — "Offer to Help" in
  [RequestCard.tsx:152](../../../apps/frontend/src/components/Feed/RequestCard.tsx) is the shared
  button used for mutual-aid too; changing it everywhere damages neighbor copy. Pin "Offer service"
  to **provider-context surfaces only** (branch on request_type === 'service' / provider mode). Add
  a render test proving provider context shows "Offer service" AND mutual-aid still shows the
  neighbor label.
- [ ] BUG-004: **REPRODUCE FIRST** — [Layout.tsx:116](../../../apps/frontend/src/components/Layout.tsx)
  already renders `.kq-wordmark-seed` + "Karmyq". Identify the actual surface/viewport/state where
  only the green dot shows (CSS hiding the text? a different header? auth pages where the nav is
  suppressed? mobile breakpoint?). Fix that specific surface; add a render/visual assertion for it.
  If it can't be reproduced, mark BUG-004 `cannot-reproduce` in BUGS.md rather than blind-editing.

```bash
cd apps/frontend && npm run lint && npm test
```

- [ ] Run `/simplify` on the diff.

---

## Task 9: Docs — user guide + concept + ADR-072 + landing

**Files:**
- Modify: relevant guide in `apps/landing/src/data/docs/guides/` (via source), concept page,
  `apps/landing/src/data/docs/nav.json`
- Create: ADR-072 (source markdown in `docs/adr/` + landing JSON
  `adr-072-dibs-scope.json`) + `docs/adr/README.md` index entry

- [ ] Write **ADR-072 "Dibs scope: the neighbor/provider first-ask seam"** documenting the A-vs-B
  decision and the unified completion→rating flow; status `Implemented`.
- [ ] Update the help-request / dibs **user guide** for the shipped first-ask behavior + rating
  flow.
- [ ] Add/update the **concept page** clarifying the community/provider two-facet relationship
  (addresses the IDEAS "link-up confusing" note).
- [ ] Regenerate landing docs from sources; **verify nav.json** entries exist after generation
  (it silently reverts — re-apply if needed); `git add -f` the generated JSON.

```bash
cd apps/landing && npm run generate-docs   # = npx tsx ../../scripts/generate-docs.ts (wipes + regenerates docs/)
git add -f apps/landing/src/data/docs/
```

---

## Task 10: CONTEXT.md + registry.json + TDD integration test

**Files:**
- Modify: `services/request-service/CONTEXT.md`, `services/registry.json` (only if a contract
  changed), `docs/BUGS.md`

- [ ] Move BUG-001..008 (those fixed this sprint) from Known Issues → Recent Fixes in CONTEXT.md
  with branch + test refs.
- [ ] Update `services/registry.json` only if an endpoint contract changed (dibs-candidate shape /
  feed query are internal — likely no change).
- [ ] Mark each fixed bug `fixed` in `docs/BUGS.md` with the branch and test file.
- [ ] Ensure the TDD integration test in `tests/tdd/` covers the end-to-end matching/dibs path.

```bash
npm run feedback:check
```

---

## Task 11: SDLC quality gates (all four)

- [ ] **Testing** — full suite green:

```bash
npm test && npm run test:tdd
```

- [ ] **`/simplify`** — final pass on the whole branch diff.
- [ ] **`/code-review`** — on the branch diff; resolve correctness/logic findings before merge.
- [ ] **`/security-review`** — on the branch diff; resolve real findings, justify dismissals in the
  PR (e.g. the recurring `js/request-forgery` FP on `api.ts` baseURL).

---

## Task 12: Final type check + pre-push verification

- [ ] Type check + feedback + audit

```bash
npm run build   # or tsc --noEmit per service
npm test
npm run feedback:check
npm audit --package-lock-only --audit-level=high
```

- [ ] Confirm all success criteria checked; no silently skipped tests.

---

## Task 13: Merge + Deploy

Use the `/deploy` skill.

- [ ] Open the PR with the cross-agent contract template (Summary / Validation / Docs / Quality
  gates / Security dismissals / Follow-ups / Lane). Cross-agent review per protocol if a second
  model is available.
- [ ] On maintainer "pull it in": `gh pr merge --admin --squash --delete-branch`.
- [ ] Push triggers GitHub Actions → Deploy to Demo. Monitor the run; re-run the Code Scanning Gate
  if it false-fails on the rescan race (verify open critical/high = 0 first).
- [ ] SSH only if the backfill migration must be applied manually on the demo DB; otherwise confirm
  deploy.sh migration step ran.
- [ ] **Post-deploy validation** (human/API smoke):
  - Create a neighbor (non-service) request → no provider-framed dibs prompt (BUG-007).
  - Mark a match done from the Dashboard → rating flow unlocks (BUG-005).
  - Reload the feed with no open requests → no already-offered requests reappear (BUG-002).
  - Adminless community now has an admin (BUG-001) — DB check.
  - Provider sees "Offer service" (BUG-003); wordmark renders (BUG-004).
  - Bump root `package.json` 11.0.0 → 11.1.0.
