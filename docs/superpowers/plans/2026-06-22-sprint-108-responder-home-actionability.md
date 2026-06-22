# Responder Home Actionability & Decision Truth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make admin-proposed responder matches canonical decisions in the Helping `DecisionBand`,
give Home a calm "suggested as a helper" preview band that links to Helping, make the caught-up
terminal copy honest, enrich the Home offered-awaiting preview into an actionable band, add a sim
workflow that generates admin-proposed matches, and reproduce-verify BUG-009/BUG-010.

**Architecture:** Extends the existing Home decisions/offered-awaiting model in request-service
(`fetchDecisions` / `fetchOfferedAwaiting` / `respondHomeFeed`) and the frontend
DecisionBand/OfferedAwaitingPanel — no schema changes, no new endpoints; the discriminator is the
existing `requests.matches.admin_proposed`. BUG-015 keeps the actionable DecisionBand in Helping, so
Home gets a non-actionable preview band fed by a new additive payload field.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `services/request-service/tests/tdd/sprint-108-admin-proposed-decision.test.ts` | DB-backed: admin-proposed responder match → decision + `suggestedAsHelper`; self-offer → offered-awaiting; dedupe both directions. Seeds `creator_id` (S107 lesson). |
| `apps/frontend/src/components/Feed/SuggestedAsHelperPanel.tsx` | Home-only calm preview band linking to Helping (modeled on `OfferedAwaitingPanel`). |
| `apps/frontend/tests/tdd/sprint-108-responder-home-decisions.test.tsx` | Home renders `SuggestedAsHelperPanel` (not the DecisionBand); Helping DecisionBand renders admin-proposed accept/decline routed to the matches endpoint; honest caught-up copy; actionable OfferedAwaitingPanel. |
| `services/simulation-service/src/workflows/admin-propose-helper-workflow.ts` | Admin proposes an eligible member as helper on an open community request. |

### Existing files to modify
| File | Change |
|------|--------|
| `services/request-service/tests/unit/fetch-decisions.test.ts` | **Extend** (do not create a new unit file) with admin_proposed responder vs self-offer cases. |
| `services/request-service/src/routes/requests.ts` | `fetchDecisions`: project `m.admin_proposed`; surface admin-proposed responder matches as decisions. `respondHomeFeed`: add `suggestedAsHelper: { count, items }` to the payload. |
| `apps/frontend/src/types/unified-feed.ts` | Add `suggestedAsHelper` payload field type. |
| `apps/frontend/src/components/Feed/DecisionBand.tsx` | Render responder-role admin-proposed match decisions; route accept/decline to `PUT /matches/:id/accept|reject`. |
| `apps/frontend/src/components/Feed/UnifiedFeed.tsx` | Render `SuggestedAsHelperPanel` on Home; fix residual "That's everyone" caught-up copy. Do **not** render `kind==='decision'` items (BUG-015). |
| `apps/frontend/src/components/Feed/OfferedAwaitingPanel.tsx` | Make each previewed ask actionable (calm band, not a decision). |
| `apps/frontend/src/components/CommitmentsTab.tsx` | Admin-proposed render canonically via Helping DecisionBand; dedupe any separate card path. |
| `services/simulation-service/src/api-client.ts` | Add `proposeMatch(requestId, proposedUserId)`. |
| `services/simulation-service/src/types.ts` | Add `adminProposeHelper?: ActionWeight` to `UserProfile.actions`. |
| `services/simulation-service/src/profiles/index.ts` | Add `adminProposeHelper` weight to admin/steward profile(s) + import + `selectWorkflow` candidate entry. |
| `services/simulation-service/src/workflows/index.ts` | Export the new workflow. |
| `apps/frontend/CONTEXT.md`, `services/request-service/CONTEXT.md` | Document the changes. |
| `services/registry.json` | Note the curated-home `suggestedAsHelper` field + decisions change. |
| `apps/landing/src/data/docs/guides/*`, `services/request-service.json` | Doc updates per spec. |
| `docs/BUGS.md` | BUG-009/BUG-010 status after verification. |

---

## ⚠️ Critical Implementation Notes (read before Task 3)

1. **`admin_proposed` is the only discriminator.** A `proposed` responder match is a decision **iff**
   `admin_proposed = TRUE`. Self-offers (`FALSE`) stay offered-awaiting — do not surface them as
   decisions (re-creates BUG-022/023 duplication).
2. **Project `m.admin_proposed`** in the decisions SELECT (requests.ts:900-917) — not currently
   selected.
3. **BUG-015 keeps the DecisionBand in Helping.** Do NOT render `kind==='decision'` items in Home's
   `UnifiedFeed`. The actionable accept/decline rows live in `CommitmentsTab` (Helping). Home gets
   only the non-actionable `SuggestedAsHelperPanel`, fed by the new `suggestedAsHelper` payload field.
4. **Verify the responder decline path.** `PUT /matches/:id/accept` already authorizes the responder
   for admin-proposed (matches.ts:306). Confirm `PUT /matches/:id/reject` authorizes the responder; if
   not, fix it as part of this sprint.
5. **DecisionBand action handler branches on `subject_kind` + `member_role`.** Responder-role `match`
   accept → `PUT /matches/:id/accept`; mirror the existing dibs responder path; do not use the
   requester path.
6. **Caught-up copy is scoped to direct matches.** Audit every terminal path; never claim "everyone"
   when browsable open asks exist outside the current filter/community.
7. **OfferedAwaitingPanel and SuggestedAsHelperPanel stay calm**, visually distinct from the
   DecisionBand (the actionable surface lives in Helping).
8. **Sim admin-propose needs an admin/steward session** (reuse governance/admin pattern); propose only
   eligible members with no existing live match (409s otherwise — handle gracefully). A workflow with
   no `UserProfile.actions` weight AND no `selectWorkflow` candidate entry compiles but never runs.
9. **Counts derive from freshly mapped decision rows**, not stale React state (S107 lesson).
10. **Prove the dedupe both directions** in tests: admin-proposed → decision/`suggestedAsHelper` only;
    self-offer → offered-awaiting only.

---

## Task 1: Feature branch + carry the planning artifacts

**Files:** none (branch + cherry-pick)

Local `master` is 1 commit ahead of `origin/master` with the spec/plan/handoff. Branching off
`origin/master` (correct, to avoid leaking a docs-only master commit) would drop those files from the
worktree — so cherry-pick the planning commit onto the execution branch. It rides into the sprint PR
and squashes in with the feature (not a separate docs-only master push).

- [ ] Create the branch off `origin/master` and bring the planning commit along

```powershell
# PowerShell (primary shell on this Windows repo)
git fetch origin
git checkout -b feature/sprint-108-responder-home-actionability origin/master
# The planning commit (spec + plan + handoff) is the local-master tip ahead of origin/master:
$PLAN_COMMIT = git rev-parse master
git cherry-pick $PLAN_COMMIT
```

- [ ] Verify the plan + spec are present on the branch

```bash
ls docs/superpowers/plans/2026-06-22-sprint-108-responder-home-actionability.md \
   docs/superpowers/specs/2026-06-22-sprint-108-responder-home-actionability-design.md
git log --oneline -2
```

---

## Task 2: Reproduce-verify BUG-009 and BUG-010 (before any fix code)

**Files:**
- Modify: `docs/BUGS.md`

Their `planned (Sprint 100)` labels predate the S100/ADR-078 fixes, so verify before writing anything.

- [ ] **BUG-009** (pulse "N neighbours helped" vs empty "How we're connected"): verify against the
  live community using the demo access pattern (`reference_demo_ux_audit_access`). The S100 fix
  (distinct responders + connection reconciliation, ADR-078) may already resolve it. If fixed → mark
  `fixed` with verifying evidence. If a live defect reproduces → note the layer; fix in this task with
  a regression test.
- [ ] **BUG-010** (split failure on a specific community): reproduce-first against the live community +
  server logs. If reproducible → fix + regression test; if not → document `cannot-reproduce` with
  evidence.
- [ ] Update both statuses in `docs/BUGS.md`.

---

## Task 3: TDD — admin-proposed decision (RED first)

**Files:**
- Modify: `services/request-service/tests/unit/fetch-decisions.test.ts`
- Create: `services/request-service/tests/tdd/sprint-108-admin-proposed-decision.test.ts`

- [ ] **Extend the existing unit file** (`fetch-decisions.test.ts`) with cases:
  - an `admin_proposed = TRUE` responder match → decision, `member_role:'responder'`,
    `actions:['accept_offer','decline_offer']`
  - a self-offer (`admin_proposed = FALSE`) responder match → **not** in decisions
- [ ] **Write the DB-backed TDD file** asserting end-to-end:
  - self-offer appears in `fetchOfferedAwaiting`, admin-proposed does **not**
  - admin-proposed appears in the `suggestedAsHelper` payload count/items, self-offer does **not**
  - seeds `creator_id` + real schema rows (cf. S107 offered-awaiting-truth test)

- [ ] **Confirm RED**

```bash
cd services/request-service && npx jest tests/unit/fetch-decisions.test.ts
```

---

## Task 4: Backend — decisions + suggestedAsHelper payload

**Files:**
- Modify: `services/request-service/src/routes/requests.ts`

- [ ] **Project `m.admin_proposed`** in the `fetchDecisions` matches SELECT (add to SELECT + GROUP BY).
- [ ] **Replace the unconditional responder skip** (requests.ts:924-928):

```ts
if (m.status === 'proposed') {
  if (!isRequester) {
    // A responder's SELF-offer is awaiting the requester (offered-awaiting), not a decision.
    // An ADMIN/matchmaker-proposed match is awaiting THIS responder's accept/decline.
    if (!m.admin_proposed) continue;
    actions = ['accept_offer', 'decline_offer'];
  } else {
    actions = ['accept_offer', 'decline_offer'];
  }
}
```

- [ ] **Add `suggestedAsHelper: { count, items }` to `respondHomeFeed`** (requests.ts:1200-1219) via a
  **dedicated query** (sibling to `fetchOfferedAwaiting`), not a filter over `decisionItems`. Filtering
  decision items would overcount: a responder also owes `mark_done` on `matched` rows, and the decision
  payload carries no `admin_proposed` flag or `hr.status`/`hr.expired` to prove "distinct open". The
  query must select **only** `m.status='proposed' AND m.admin_proposed=TRUE AND m.responder_id=$1`,
  joined to `help_requests` with `hr.status='open' AND NOT expired`, `COUNT(DISTINCT m.request_id)` for
  the count. Run it in the existing `Promise.all` alongside `fetchDecisions`/`fetchOfferedAwaiting`.
- [ ] **Confirm the responder decline path** authorizes the responder for admin-proposed
  (matches.ts reject path); fix + unit-test if it only allows the requester.

- [ ] **Verify GREEN** for Task 3

```bash
cd services/request-service && npx jest tests/unit/fetch-decisions.test.ts tests/tdd/sprint-108-admin-proposed-decision.test.ts --runInBand
```

- [ ] `/simplify` on the request-service diff

---

## Task 5: Frontend TDD — Home preview + Helping decisions (RED first)

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-108-responder-home-decisions.test.tsx`

- [ ] **Write failing tests** asserting:
  - Home `UnifiedFeed` renders `SuggestedAsHelperPanel` when `suggestedAsHelper.count > 0`, with a
    "Respond in Helping" link, and does **not** render inline accept/decline on Home
  - the Helping `DecisionBand` renders a responder-role admin-proposed match decision with
    accept/decline; clicking accept calls `PUT /matches/:id/accept` (mock asserts the matches
    endpoint, not the requester path)
  - the OfferedAwaitingPanel exposes an inline action per previewed ask
  - the caught-up state never shows "That's everyone" when browsable asks exist (honest copy + Browse
    CTA)
  - uses the global `next/router` jest mock (no per-file router mock)

- [ ] **Confirm RED**

```bash
cd apps/frontend && npx jest tests/tdd/sprint-108-responder-home-decisions.test.tsx
```

---

## Task 6: Frontend — panels, DecisionBand, caught-up copy

**Files:**
- Create: `apps/frontend/src/components/Feed/SuggestedAsHelperPanel.tsx`
- Modify: `apps/frontend/src/types/unified-feed.ts`
- Modify: `apps/frontend/src/components/Feed/UnifiedFeed.tsx`
- Modify: `apps/frontend/src/components/Feed/DecisionBand.tsx`
- Modify: `apps/frontend/src/components/Feed/OfferedAwaitingPanel.tsx`
- Modify: `apps/frontend/src/components/CommitmentsTab.tsx`

- [ ] Add the `suggestedAsHelper` type to `unified-feed.ts`.
- [ ] Build `SuggestedAsHelperPanel` (calm, links to `/dashboard?tab=helping`); render it in
  `UnifiedFeed` on Home when `count > 0`, near `OfferedAwaitingPanel`. **Do not render decision items
  in UnifiedFeed.**
- [ ] `DecisionBand`: render responder-role admin-proposed match decisions; branch the action handler
  on `subject_kind` + `member_role` (responder `match` accept → `PUT /matches/:id/accept`, decline →
  reject). Copy: "{requester} suggested you as a helper — accept?"
- [ ] `CommitmentsTab`: confirm admin-proposed now flow through the Helping DecisionBand; dedupe any
  separate card path (BUG-022 lesson).
- [ ] `OfferedAwaitingPanel`: add a calm inline action per previewed ask; keep visually distinct from
  the DecisionBand.
- [ ] `UnifiedFeed`: audit terminal-copy paths; scope "caught up" to direct matches and always point
  to browsable asks when they exist.

- [ ] **Verify GREEN**

```bash
cd apps/frontend && npx jest tests/tdd/sprint-108-responder-home-decisions.test.tsx
```

- [ ] `/simplify` on the frontend diff

---

## Task 7: Simulation — generate admin-proposed matches (with dispatch wiring)

**Files:**
- Modify: `services/simulation-service/src/api-client.ts`
- Create: `services/simulation-service/src/workflows/admin-propose-helper-workflow.ts`
- Modify: `services/simulation-service/src/types.ts`
- Modify: `services/simulation-service/src/profiles/index.ts`
- Modify: `services/simulation-service/src/workflows/index.ts`

- [ ] Add `proposeMatch(requestId, proposedUserId)` → `POST /requests/:id/propose-match`.
- [ ] New workflow: an admin/steward session picks an open request in a community they administer and
  proposes an eligible member (in the community, no existing live match); handle 409/400 gracefully.
- [ ] Add `adminProposeHelper?: ActionWeight` to `UserProfile.actions` in `types.ts`.
- [ ] In `profiles/index.ts`: add an `adminProposeHelper` weight to the admin/steward-capable
  profile(s), import the workflow, and add a `candidates` entry in `selectWorkflow` (mirror how
  `joinCommunity` is wired). **Without both the weight and the candidate entry the workflow never
  runs.**
- [ ] Export the workflow from `workflows/index.ts`.

- [ ] **Verify build + dispatch reachability**

```bash
cd services/simulation-service && npx tsc --noEmit
grep -n "adminProposeHelper" src/types.ts src/profiles/index.ts
```

- [ ] `/simplify` on the sim diff

---

## Task 8: Docs — guides, registry, CONTEXT, landing

**Files:**
- Modify: `apps/landing/src/data/docs/guides/{dashboard-home-or-managing-commitments}.json`
- Modify: `apps/landing/src/data/docs/services/request-service.json`
- Modify: `apps/frontend/CONTEXT.md`, `services/request-service/CONTEXT.md`
- Modify: `services/registry.json`
- Modify: `apps/frontend/src/lib/onboarding/workflows.ts` (if Home/Helping copy referenced)

- [ ] Update the Dashboard Home / Managing Commitments guide: Home previews "someone suggested you as
  a helper" (respond in Helping); the caught-up-vs-open-asks distinction.
- [ ] Update request-service landing doc + registry note for the `suggestedAsHelper` payload + decisions
  change.
- [ ] Update both CONTEXT.md files.
- [ ] **Grep-verify nav.json did not silently revert** if any nav entry was touched.

```bash
grep -rn "Managing Commitments\|Dashboard Home" apps/landing/src/data/docs/nav.json
```

---

## Task 9: SDLC quality gates

**Files:** none (review only)

- [ ] `/simplify` — final pass on the whole branch diff (altitude, reuse, dead code)
- [ ] `/code-review` — on the branch diff; resolve correctness/logic findings
- [ ] `/security-review` — on the branch diff; resolve real findings, justify dismissals
  (the `apps/frontend/src/lib/api.ts` request-forgery hit is a known recurring FP — dismiss with note)
- [ ] Standing CI gates (ADR-059 dependency audit, ADR-060 CodeQL) run automatically on push.

---

## Task 10: Final verification

**Files:** none

- [ ] Type checks clean

```bash
cd services/request-service && npx tsc --noEmit
cd apps/frontend && npx tsc --noEmit
cd services/simulation-service && npx tsc --noEmit
```

- [ ] Changed-package unit + regression green (run directly per package — root Turbo `test:unit` has a
  missing-target project; cf. S107)

```bash
cd services/request-service && npm run test:unit && npm run test:regression
cd apps/frontend && npm run test:unit
```

- [ ] **TDD sweep** (repo-mandated, CLAUDE.md): `npm run test:tdd` — reports, never blocks; record any
  known failures.
- [ ] `npm run feedback:check` passes (stage changes first)
- [ ] **Human browser validation** as `maria.reyes@test.karmyq.com` after the sim has generated
  admin-proposed matches: Home shows the "suggested you as a helper" preview band → Helping; the
  Helping DecisionBand accept moves it to matched; offered-awaiting band is actionable; caught-up copy
  is honest. Validate desktop + mobile.

---

## Task 11: Merge + Deploy

**Files:** none

- [ ] Open the PR using `.github/pull_request_template.md` (copy template into the body); do not
  self-merge — cross-agent review per the protocol.
- [ ] After approval + green CI, merge to master (squash); confirm PR state = MERGED.
- [ ] Use the `/deploy` skill; monitor GitHub Actions deploy. The sim change ships with the deploy; no
  migration scripts needed (no schema change).
- [ ] Confirm live demo Home reflects the change once the sim has run.
