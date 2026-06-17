# Sprint 105 - UI Facelift Implementation - READY TO EXECUTE

> **STATUS (2026-06-17):** Sprint 105 is planned on branch
> `feature/sprint-105-ui-facelift-implementation`. Scope is the full maintainer-approved **A-plus**
> rollout from Sprint 104: foundation tokens/components first, then Request feed/detail fossils,
> Profile + chrome, Dashboard Home, Community polish, docs, validation, PR, and deploy.
>
> **Direction is decided:** A-plus = Direction A convergence is mandatory; Direction B contributes
> token hooks only when a S105 finite-state/divider actually consumes them; Direction C is parked. Do
> not re-run visual exploration.
>
> **Cross-agent review folded in:** before implementation, Task 1 must force and record the Request
> feed fate (reskin vs retire); tests should prioritize helper behavior + accessibility over brittle
> class assertions; unused B hooks should be deferred; and any `EmptyState` change must validate all
> direct consumers immediately after the foundation task.
>
> **Sprint 104 state:** Sprint 104 research is complete and produced
> `docs/design/sprint-104-ui-facelift/`, ADR-079 Proposed, and the maintainer verdict. If the S104 PR
> has not merged before execution, verify the research files are present on the S105 branch before
> implementing. Do not self-merge any PR.
>
> **LOCAL STATE:** `scripts/founding-circle-submissions.sh` remains untracked user/local work. Do not
> stage, remove, or rewrite it unless the maintainer explicitly asks.

---

## Quick Start

1. Read this handoff.
2. Check out branch: `git checkout feature/sprint-105-ui-facelift-implementation` (or create it from
   the correct base if absent).
3. Open plan: `docs/superpowers/plans/2026-06-17-sprint-105-ui-facelift-implementation.md`.
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development).
5. Start with Task 1 inventory, including the Request feed fate decision, then Task 2 TDD foundation
   guardrails. Foundation lands before any surface migration.

---

## Sprint Goal

Implement the Sprint 104 "A-plus" UI facelift across all frontend surface clusters so Karmyq speaks
one warm commons design language from Dashboard to Request feed, Profile, chrome, and Community.

---

## Planning Artifacts

- Spec: `docs/superpowers/specs/2026-06-17-sprint-105-ui-facelift-implementation-design.md`
- Plan: `docs/superpowers/plans/2026-06-17-sprint-105-ui-facelift-implementation.md`
- Source research: `docs/design/sprint-104-ui-facelift/README.md`
- Sprint 105 task source: `docs/design/sprint-104-ui-facelift/recommendations.md`
- ADR: `docs/adr/ADR-079-visual-design-system-v2.md`

---

## Scope

### In Scope

- Shared visual foundation:
  - `--measure`, `--radius-card`; `--texture` only if consumed by a S105 finite-state/divider.
  - `kq-headline-sm`, consumer-backed motif/finite-state helpers, canonical `.kq-card` usage.
  - Humanized status/urgency display helper with semantic token classes.
- Request feed + detail cluster:
  - Force the reskin-or-retire decision in Task 1, then implement that known fate for
    `apps/frontend/src/pages/requests/index.tsx`.
  - Remove `% Match` lead, Smart Filtering chrome, match-score slider, wide fossil grid.
  - Migrate request detail, offers, and match detail to warm card/measure/status language.
- Profile + global chrome:
  - Migrate Profile body cards and raw colors.
  - Tokenize Layout title bar and availability/on-duty control.
- Dashboard:
  - Tokenize selector row/on-duty pill.
  - Use warm finite states.
  - Add secondary Home altitude for established users with an empty queue.
- Community:
  - Tokenize pending/error states and make pending indicators non-color-only.
- Docs:
  - Advance ADR-079 as implementation lands.
  - Update UX principles, affected guides, frontend context, onboarding copy if changed.
  - Regenerate landing docs from source.
- Version:
  - Reconcile root `package.json` drift from `11.10.0` to S105 target `11.13.0`.
- Full SDLC gates and demo validation.

### Out of Scope

- New backend endpoints, database migrations, service registry changes.
- New visual direction beyond A-plus.
- App-wide texture enabled by default.
- Reconnect CTA, Dibs relationship-routing follow-up, member forget/export, service consolidation,
  mobile parity beyond responsive validation of touched frontend surfaces.
- Self-merging PRs or direct commits to `master`.

---

## Critical Implementation Notes

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

## Implementation Tasks

Follow the plan exactly:

1. Branch, baseline, surface inventory, and Request feed fate decision.
2. TDD - foundation guardrails.
3. Implement shared token and component foundation; run full frontend tests immediately after if
   `EmptyState` changes.
4. TDD - Request feed/detail/offers/match cluster.
5. Implement Request feed + detail convergence.
6. TDD - Profile + global chrome.
7. Implement Profile + global chrome convergence.
8. TDD - Dashboard Home polish.
9. Implement Dashboard Home convergence and secondary altitude.
10. TDD - Community light polish.
11. Implement Community reference-surface polish.
12. User guides, ADR, landing docs, and version reconciliation.
13. Promote/organize tests and run frontend verification.
14. SDLC quality gates.
15. Final pre-push and human validation.
16. Merge + Deploy.

---

## Carry-Forward / Known Issues

- **S104 PR may still be open** depending on when S105 starts. Verify S104 research artifacts are on
  the S105 base branch.
- **Reconnect CTA remains deferred:** restore only after real peer messaging or a directed-ask flow.
- **Responder Home actionability** remains a functional candidate. S105 only adds secondary Home
  altitude for empty queues; do not solve proposed-match surfacing unless explicitly re-scoped.
- **Dibs server-side relationship routing** remains open.
- **Member forget/export** privacy follow-on remains open.
- **Pre-existing security drift:** Dependabot/CodeQL alerts follow ADR-059/ADR-060 SLA. The recurring
  request-forgery false positive on `apps/frontend/src/lib/api.ts` is known.

---

## Multi-Sprint Arc

- **S100 (done):** Pulse Truth + Feed Actionability (v11.9.0).
- **S101 (done):** Actionability + State Truth (v11.10.0).
- **S102 (done):** Visible Memory + Re-warm First Step (v11.11.0).
- **S103 (done):** Governance + Intake Clarity (v11.12.0).
- **S104 (done / PR flow):** UI Facelift Research - A-plus verdict, ADR-079 Proposed, no deploy.
- **S105 (this sprint):** UI Facelift Implementation - full A-plus rollout, ADR-079 implemented,
  version reconciled to v11.13.0, deploy.
- **Deferred:** reconnect CTA; responder Home actionability; Dibs relationship routing; member
  forget/export; Service Consolidation Phase 2; mobile parity.

---

## Persistent Context

### Multi-agent PR process - live on master

- `.github/pull_request_template.md` = the cross-agent PR contract.
- Master branch protection requires CI checks, 1 approving review, and Admin merge authority.
- Agents do not self-merge or push directly to `master`.
- Every task = one branch = one PR.
- When using `gh pr create`, manually copy `.github/pull_request_template.md` into the PR body.
- Cross-agent review protocol: the agent that did not author a plan/PR/branch/commit reviews it when
  two models are available.

### Architecture Gotchas

- **Frontend is Pages Router** (`apps/frontend/src/pages`), not App Router.
- **Design token system:** CSS-variable backed, in `apps/frontend/src/styles/globals.css` +
  `apps/frontend/tailwind.config.js`; per-community skins via `ThemeContext`/ThemeProvider.
- **Prior design research:** `docs/design/sprint-87/` (audit, scorecard, visual-research, mockups);
  `docs/design/sprint-84-unified-feed/`. Extend, don't restart.
- **Landing page docs:** `apps/landing/src/data/docs/` is gitignored - `git add -f` when generated
  docs must be committed. Generated by `scripts/generate-docs.ts`; edit sources, never generated JSON.
- **ADR numbering:** ADR-079 exists for visual design system v2. Next free = **080**.
- **JWT field** is `communities`, not `communityMemberships`.
- **Schema is `communities.communities`** (plural schema name); auth tables are `auth.*`.
- **API response unwrap:** `createApiClient` interceptor already unwraps the envelope - use `res.data`,
  not `res.data.data`.
- **Error contract (ADR-074):** `{ success:false, message:string, error:string }`.
- **trust_edges_live is a VIEW:** never INSERT/UPDATE it.
- **`git add` on CLAUDE.md:** tracked as lowercase `claude.md`.
- **Solo dev - no worktrees:** work directly on feature branches.
- **CI security gates:** dependency audit (ADR-059) + CodeQL (ADR-060) run on push.
- **request-forgery FP on `apps/frontend/src/lib/api.ts`** is a known recurring false positive.
- **request-service serves the feed** now (`/requests/feed`); there is no feed-service.

### Workflow Gotchas

- Every sprint runs testing, `/simplify`, `/code-review`, and `/security-review`.
- Every sprint updates docs and landing docs.
- No docs-only push to `master`; master push triggers a full deploy.
- nginx.conf changes take effect on the next deploy (deploy.sh copies + reloads).
- `nav.json` silently reverts - always grep-verify after editing.
- Widely-rendered components using `useRouter` need the global `apps/frontend/jest.setup.js` router
  mock.

### Deploy Drift Watch

`karmyq.org` live content has drifted from `master` before. Confirm the latest deploy succeeded and
live content matches `master` before judging by live content.
