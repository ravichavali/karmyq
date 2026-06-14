# Release Experience Audit + Fine Tune Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking. Run `/simplify` after each implementation task.
> **Execution split:** Tasks 1-4 are main-session audit and judgment work. Do not dispatch them to
> subagents. Use subagents only for Tasks 5-9 after the fix list names exact repairs and files.

**Goal:** Audit the full demo/evaluator experience and ship a tight set of clarity, trust, and
demo-readiness repairs.

**Architecture:** Sprint 99 adds no new product architecture by default. It creates a structured
release-experience audit, freezes a small fix list, and then makes focused frontend, backend, data,
or landing repairs only where the audit proves a confusing or false release experience.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|----------------|
| `docs/bugs/sprint-99-release-experience-audit.md` | Findings log, triage decisions, fixed/deferred status, and final validation evidence. |
| `scripts/audit-release-experience.sql` | Optional demo-data audit if stale/orphaned records are a confirmed root cause. |
| `apps/frontend/tests/tdd/sprint-99-release-experience.test.tsx` | Focused frontend tests for selected dashboard/community/provider/request clarity repairs. |
| `apps/landing/tests/tdd/sprint-99-network-visualization.test.tsx` | Optional test if the landing network resize/background repair is selected. |
| `services/request-service/tests/tdd/sprint-99-release-experience.test.ts` | Optional service tests if request/provider/feed response semantics change. |
| `services/social-graph-service/tests/tdd/sprint-99-release-experience.test.ts` | Optional service tests if graph/trust response semantics change. |
| `infrastructure/postgres/migrations/20260614-release-experience-repair.sql` | Optional deploy-time data repair if the audit finds release-blocking demo data drift. |

### Existing files to modify
| File | Change |
|------|--------|
| `apps/frontend/src/pages/dashboard.tsx` | Candidate dashboard context, empty/error state, or first-action clarity fixes. |
| `apps/frontend/src/components/Feed/UnifiedFeed.tsx` | Candidate feed hierarchy or terminal-state clarity fixes. |
| `apps/frontend/src/components/Feed/RequestCard.tsx` | Candidate relationship/scope/action wording fixes. |
| `apps/frontend/src/pages/communities/[id].tsx` | Candidate community page framing or tab-state fixes. |
| `apps/frontend/src/components/community/tabs/*` | Candidate community Home, People, Connected, or Stewardship clarity fixes. |
| `apps/frontend/src/components/providers/*` | Candidate provider/community link-up copy and state fixes. |
| `apps/frontend/src/components/requests/DibsPrompt.tsx` | Candidate first-ask routing explanation fixes. |
| `apps/frontend/src/lib/onboarding/workflows.ts` | Update if changed workflows affect onboarding copy. |
| `apps/landing/src/components/NetworkVisualization.tsx` | Candidate canvas resize transform fix. |
| `apps/landing/src/app/page.tsx` | Optional contained first-impression network field adjustment. |
| `services/request-service/src/**` | Only if audit finds response semantics or demo-data truth issues. |
| `services/social-graph-service/src/**` | Only if audit finds relationship/graph response truth issues. |
| `docs/guides/**` | Update affected user guides. |
| `apps/frontend/CONTEXT.md` | Record frontend release-experience fixes. |
| `services/request-service/CONTEXT.md` | Update only if request-service behavior changes. |
| `services/social-graph-service/CONTEXT.md` | Update only if social-graph behavior changes. |
| `services/registry.json` | Update only if endpoint descriptions change. |
| `apps/landing/src/data/docs/*` | Regenerated docs output after source guide updates. |
| `package.json`, `package-lock.json` | Version bump `11.7.0` -> `11.8.0`. |
| `.claude/handoff/CURRENT_HANDOFF.md` | Track execution progress and next-session state. |

---

## Critical Implementation Notes

1. **Audit first, then freeze the fix list.** Do not start patching random polish issues before the
   walkthrough findings are logged and ranked.
2. **Tasks 1-4 stay in the main session.** The audit, judgment, ranking, and fix-list freeze are not
   subagent fan-out work. Dispatch subagents only after Task 4, once exact files and selected repairs
   are named.
3. **Truth beats prettiness.** A small copy or state fix that prevents a false claim is more valuable
   than a visual flourish.
4. **Keep the sprint bounded.** Fix P0/P1 clarity and demo-readiness issues first; defer broad
   redesigns, new concepts, and multi-sprint UX arcs.
5. **Do not hide server truth in the client.** If the frontend is confusing because an API or data
   record is wrong, fix the source or document the limitation.
6. **Provider/community link-up is a top suspect.** Audit whether members can understand the
   difference between provider availability, shared community membership, offers, dibs, and exchange
   trust.
7. **Name exact files at freeze.** Wildcard areas like `community/tabs/*` and `providers/*` are
   discovery hints only. Task 4 must replace them with an exact implementation file list before
   coding starts.
8. **Feed fixes must trace all query surfaces.** If feed filtering or browsable-request behavior is
   selected, search all request/feed query paths before patching; prior sprint memory warns the logic
   has lived in multiple places, including `services/request-service/src/utils/queryBuilder.ts`.
9. **Use the visual companion only where seeing helps.** Use it for layout/copy comparisons or visual
   state triage, not for textual requirement decisions.
10. **Demo data cleanup must be scripted.** No one-off edits on the demo database without a repeatable
   SQL/script artifact and before/after evidence.
11. **Every implemented repair needs a test.** UI state repairs get focused frontend tests; data/API
   repairs get service or SQL-backed tests.
12. **Docs stay in sync.** If behavior, navigation, or user-facing meaning changes, update source
   docs, generated landing docs, contexts, and onboarding copy where relevant.
13. **Version bump:** root `package.json` and `package-lock.json` move `11.7.0` -> `11.8.0`.

---

## Task 1: Branch and audit log

**Files:**
- Create: `docs/bugs/sprint-99-release-experience-audit.md`

- [ ] Create the feature branch from current `master`.

```bash
git checkout -b feature/sprint-99-release-experience-audit
```

- [ ] Create the audit log with this starter structure.

```markdown
# Sprint 99 Release Experience Audit

**Date opened:** 2026-06-14
**Release target:** v11.8.0
**Primary tester:** `maria.reyes@test.karmyq.com` / `password123`
**Fallback tester:** `aisha.white6964@test.karmyq.com` / `password123`

## Audit Lanes

| Lane | Status | Notes |
|---|---|---|
| Dashboard Home | Pending | Feed, decisions, trust badges, empty states, first action |
| Community pages | Pending | Home, People, How we're connected, Stewardship |
| Provider flows | Pending | Directory, provider detail, shared communities, offers, dibs |
| Request flows | Pending | Get Help/Get Service, scope, request cards, first-ask routing |
| Trust/copy | Pending | Relationship language and unsupported implications |
| Demo data | Pending | Stale, orphaned, contradictory, or noisy records |
| Landing first impression | Pending | Home, join, docs, network visualization |

## Findings

| ID | Severity | Surface | Finding | Root cause | Decision | Status |
|---|---|---|---|---|---|---|

## Fix List Freeze

Record the exact Sprint 99 fix list here before implementation starts.

## Final Validation

Record post-fix API, DB, UI, landing, and docs validation evidence here.
```

- [ ] Run `/simplify` on the audit log scaffold.

---

## Task 2: Live/demo evaluator walkthrough

**Files:**
- Modify: `docs/bugs/sprint-99-release-experience-audit.md`

- [ ] Confirm the walkthrough environment is the live demo, not local dev:

```text
App/API: https://karmyq.com
Landing: https://karmyq.org
```

- [ ] Read the maintainer-local memory note `reference_demo_ux_audit_access.md` if available. Use
  its demo access guidance for SSH, containerized Postgres, seeded tester accounts, and Playwright
  browser/file serving gotchas.

- [ ] Confirm browser or Playwright access before continuing. If no browser automation or manual
  browser access is available, record that blocker in the audit log and pause before ranking findings.

- [ ] Login as the primary rich tester:

```text
maria.reyes@test.karmyq.com / password123
```

- [ ] Walk Dashboard Home:
  - selected community state
  - feed item ordering and decision bands
  - trust badges and request cards
  - show-more/caught-up/empty states
  - primary Get Help/Get Service actions

- [ ] Walk community pages for at least one rich community:
  - Home
  - People
  - How we're connected
  - Stewardship
  - provider/community link-up if present

- [ ] Walk provider flows:
  - provider directory
  - provider detail
  - shared-community labels
  - offer and dibs surfaces

- [ ] Walk request flows:
  - create a help ask
  - create or inspect a service/provider ask
  - inspect scope language and action copy
  - if feed filtering or browsable-request behavior looks wrong, record every suspected request/feed
    query surface before selecting the fix

- [ ] Walk karmyq.org first impression:
  - home
  - join
  - docs
  - resize the home page to check `NetworkVisualization`

- [ ] Record findings as `S99-NNN` rows. Include screenshots or visual companion mockups only where
  seeing the state would clarify the decision.

- [ ] Run `/simplify` on the audit log.

---

## Task 3: Data/API truth probes

**Files:**
- Modify: `docs/bugs/sprint-99-release-experience-audit.md`
- Optional create: `scripts/audit-release-experience.sql`

- [ ] For each confusing UI state, identify whether the root cause is frontend copy/state, API
  response semantics, or demo data.

- [ ] If demo data appears stale or contradictory, create `scripts/audit-release-experience.sql` with
  targeted checks. Start from the exact finding rather than a broad database sweep.

- [ ] If an API response appears misleading, smoke the exact endpoint with `curl` and record the
  request/response summary in the audit log.

- [ ] Do not repair data yet. Finish triage first.

- [ ] Run `/simplify`.

---

## Task 4: Triage and freeze the Sprint 99 fix list

**Files:**
- Modify: `docs/bugs/sprint-99-release-experience-audit.md`
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

- [ ] Rank each finding:
  - P0: demo-blocking false state, crash, or security/data risk
  - P1: high-confusion trust, relationship, provider, community, or request flow issue
  - P2: polish or minor comprehension issue
  - Deferred: larger than Sprint 99 or not release-critical

- [ ] Freeze a small fix list:
  - include all P0 findings
  - include the highest-impact P1 findings
  - cap implementation to repairs that can be tested and reviewed safely
  - replace wildcard areas such as `community/tabs/*` and `providers/*` with exact file paths
  - name the exact test files each selected repair will use

- [ ] Update the handoff immediately with the frozen fix list and any deferred next-sprint
  candidates.

- [ ] If visual layout/copy alternatives are needed, use the browser companion now and record the
  selected direction in the audit log.

- [ ] Run `/simplify`.

---

## Task 5: TDD for selected frontend repairs

**Files:**
- Create/modify: `apps/frontend/tests/tdd/sprint-99-release-experience.test.tsx`
- Implementation targets: selected frontend files from the frozen fix list

- [ ] Write focused failing tests for every selected frontend repair. Examples:
  - dashboard does not show contradictory feed/empty/action states
  - community page labels distinguish People, How we're connected, and provider link-up correctly
  - provider shared-community copy does not imply exchange trust
  - request card scope/action copy matches the selected community/platform state
  - dibs prompt renders server reason as a relationship choice, not a client-side hint

- [ ] Run the focused test and confirm it fails before implementation.

```bash
cd apps/frontend
npm run test:tdd -- sprint-99-release-experience.test.tsx --runInBand
```

As of planning, `apps/frontend` defines `test:tdd` as `jest tests/tdd --passWithNoTests`, so file
arguments after `--` are expected to forward to Jest.

- [ ] Run `/simplify`.

---

## Task 6: Implement selected frontend repairs

**Files:**
- Modify: selected frontend files from the frozen fix list
- Test: `apps/frontend/tests/tdd/sprint-99-release-experience.test.tsx`

- [ ] Implement only the frontend repairs in the frozen fix list.

- [ ] Keep changes within existing design patterns and `kq-*` shell classes.

- [ ] Avoid a broad visual facelift. If a fix starts requiring new IA or a new product concept, move it
  to deferred findings.

- [ ] Run focused and frontend tests.

```bash
cd apps/frontend
npm run test:tdd -- sprint-99-release-experience.test.tsx --runInBand
npm run test:unit
```

- [ ] Run `/simplify` on the frontend diff.

---

## Task 7: TDD for selected backend or data repairs, if any

**Files:**
- Optional create/modify: `services/request-service/tests/tdd/sprint-99-release-experience.test.ts`
- Optional create/modify: `services/social-graph-service/tests/tdd/sprint-99-release-experience.test.ts`
- Optional create: `scripts/audit-release-experience.sql`
- Optional create: `infrastructure/postgres/migrations/20260614-release-experience-repair.sql`

- [ ] Skip this task if Task 4 froze only frontend/landing repairs.

- [ ] For each selected service repair, write a focused failing test in the owning service.

- [ ] For each selected data repair, write or update a repeatable SQL audit and define expected
  before/after counts.

- [ ] Run focused tests and confirm failures before implementation.

```bash
cd services/request-service
npm run test:tdd -- sprint-99-release-experience.test.ts

cd ../social-graph-service
npm run test:tdd -- sprint-99-release-experience.test.ts
```

- [ ] Run `/simplify`.

---

## Task 8: Implement selected backend or data repairs, if any

**Files:**
- Modify: selected service files from the frozen fix list
- Optional modify: `services/registry.json`
- Optional create/modify: data repair SQL

- [ ] Implement only selected backend/data repairs.

- [ ] Update `services/registry.json` if endpoint behavior or descriptions change.

- [ ] If a data repair exists, make it idempotent and record before/after evidence in the audit log.

- [ ] Run focused service tests.

```bash
cd services/request-service
npm test

cd ../social-graph-service
npm test
```

- [ ] Run `/simplify`.

---

## Task 9: Landing first-impression repair, if selected

**Files:**
- Optional modify: `apps/landing/src/components/NetworkVisualization.tsx`
- Optional modify: `apps/landing/src/app/page.tsx`
- Optional create/modify: `apps/landing/tests/tdd/sprint-99-network-visualization.test.tsx`

- [ ] Skip this task if landing is deferred in Task 4.

- [ ] If fixing the resize bug, ensure the canvas context transform is reset before applying
  `devicePixelRatio` scaling on every resize.

- [ ] If extending the network field beyond the hero, keep the change contained and verify text
  remains readable across mobile and desktop.

- [ ] Add a focused test where practical, or record manual resize validation in the audit log.

- [ ] Run landing checks.

```bash
cd apps/landing
npm test
npm run build
```

- [ ] Run `/simplify`.

---

## Task 10: Docs, contexts, generated docs, and version bump

**Files:**
- Modify: `docs/bugs/sprint-99-release-experience-audit.md`
- Modify: affected `docs/guides/**`
- Modify: `apps/frontend/src/lib/onboarding/workflows.ts` if applicable
- Modify: `apps/frontend/CONTEXT.md`
- Optional modify: `services/request-service/CONTEXT.md`
- Optional modify: `services/social-graph-service/CONTEXT.md`
- Optional modify: `services/registry.json`
- Generated modify: `apps/landing/src/data/docs/*`
- Modify: `package.json`, `package-lock.json`
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

- [ ] Update user guides for changed workflows, navigation, or user-facing meaning.

- [ ] Update onboarding workflow copy if a changed surface appears in onboarding.

- [ ] Update local contexts for every changed app/service area.

- [ ] Regenerate landing docs.

```bash
npm run build --workspace apps/landing
```

- [ ] Force-add changed generated docs.

```bash
git add -f apps/landing/src/data/docs
```

- [ ] Bump root version `11.7.0` -> `11.8.0`.

- [ ] Update handoff with current progress, remaining work, and post-deploy validation notes.

- [ ] Run `/simplify`.

---

## Task 11: SDLC quality gates

**Files:**
- Entire branch diff.

- [ ] Run final `/simplify` on the whole diff.

```bash
git diff --stat
```

- [ ] Run `/code-review` on the branch diff and resolve correctness findings.

```bash
git diff -- apps/frontend apps/landing services docs scripts infrastructure package.json package-lock.json
```

- [ ] Run `/security-review` on the branch diff and resolve real findings. Record false positives in
  the PR body.

```bash
npm audit --package-lock-only --audit-level=high
```

- [ ] Run new TDD tests directly, not only through Turbo cache.

```bash
cd apps/frontend
npm run test:tdd -- sprint-99-release-experience.test.tsx --runInBand
```

- [ ] Run service or landing focused tests too if Tasks 7-9 created them.

---

## Task 12: Final verification

**Files:**
- Entire branch.

- [ ] Type-check.

```bash
npx tsc --noEmit
```

- [ ] Run unit + regression tests.

```bash
npm test
```

- [ ] Run TDD suite.

```bash
npm run test:tdd
```

- [ ] Run feedback check.

```bash
npm run feedback:check
```

- [ ] Run service analysis if `services/registry.json` or service dependencies changed.

```bash
npm run analyze:services
```

- [ ] Update the audit log with final fixed/deferred status.

---

## Task 13: Merge + Deploy

**Files:**
- PR body: `.github/pull_request_template.md`
- Handoff: `.claude/handoff/CURRENT_HANDOFF.md`

- [ ] Create a PR from `feature/sprint-99-release-experience-audit` to `master`.
  `gh pr create` does not auto-apply the template, so copy `.github/pull_request_template.md`
  into the PR body and fill every section.

- [ ] Complete cross-agent review, `/code-review`, and `/security-review`.

- [ ] After Admin authorization, merge to `master` and push. CI/CD is the primary deploy path.

- [ ] Monitor GitHub Actions until v11.8.0 deploy is green.

- [ ] If a repair migration/script was created, confirm it applied and re-run the relevant audit SQL.

---

## Task 14: Sprint 99 Post-Deploy Validation

### 1. Rich tester walkthrough

Login as:

```text
maria.reyes@test.karmyq.com / password123
```

Expected: dashboard, community, provider, request, and trust/copy surfaces match the fixed/deferred
decisions in the Sprint 99 audit log.

### 2. Fallback tester smoke

Login as:

```text
aisha.white6964@test.karmyq.com / password123
```

Expected: simpler member state does not show false empty states, unsupported trust claims, or broken
primary actions.

### 3. Landing first impression

Visit:

```text
https://karmyq.org/
https://karmyq.org/join
https://karmyq.org/docs
```

Expected: selected landing repairs render correctly and resize behavior remains stable.

### 4. API/data smoke, if applicable

Run the exact curl or SQL checks recorded for selected backend/data repairs.

Expected: before/after evidence in `docs/bugs/sprint-99-release-experience-audit.md` remains true on
demo after deploy.

### 5. Handoff update

Expected: `.claude/handoff/CURRENT_HANDOFF.md` records Sprint 99 final status, deployed version,
remaining deferred findings, and recommended Sprint 100 direction.
