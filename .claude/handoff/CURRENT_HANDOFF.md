# Sprint 107 - App Shell Clarity & Commitment Truth - PLANNED / READY TO EXECUTE (v11.14.1 -> v11.15.0)

> **STATUS (2026-06-20):** Sprint 107 is planned and ready for implementation. This supersedes the
> stale `master` handoff that still described Sprint 106 as pending. Git history shows Sprint 106
> (`v11.14.0`, PR #102) and the v11.14.1 chrome follow-up (PR #105) are merged to `master`.
>
> **Sprint 107 scope:** finish full app-shell clarity after the A-plus facelift: decouple topbar
> chrome from the 42rem content measure, add responsive nav overflow, make the overflow/menu
> intentional, tune Dashboard shell rhythm, and fold in BUG-022/BUG-023 from `docs/close-sprint-106`.
>
> **Important source note:** BUG-022/023 may not be visible on `master` because they were captured on
> `docs/close-sprint-106` / PR #106 to avoid a docs-only deploy. Use that branch as evidence if
> needed; do not require PR #106 to be merged before starting Sprint 107.

---

## Quick Start

1. Read this handoff.
2. Check out branch: `git checkout -b feature/sprint-107-app-shell-clarity` (if it already exists
   locally, use `git checkout feature/sprint-107-app-shell-clarity`).
3. Open plan: `docs/superpowers/plans/2026-06-20-sprint-107-app-shell-clarity.md`.
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development).

---

## Sprint Goal

Finish the app shell clarity pass and make Home/Helping commitment surfaces tell one consistent truth.

---

## Planning Artifacts

- Spec: `docs/superpowers/specs/2026-06-20-sprint-107-app-shell-clarity-design.md`
- Plan: `docs/superpowers/plans/2026-06-20-sprint-107-app-shell-clarity.md`
- Evidence branch for BUG-022/023: `docs/close-sprint-106`

---

## Scope Confirmed With Maintainer

**In scope:**

- Full app-shell clarity, not header-only.
- Wide chrome container for topbar/app shell; keep feed/prose at 42rem.
- Responsive overflow for top-level nav.
- Intentional hamburger/user menu with all actions reachable.
- Dashboard shell rhythm around community selector, tabs, and Home heading.
- BUG-022: accepted/pending dibs must not appear in duplicate action surfaces.
- BUG-023: Home offered-awaiting preview must point to rows findable in Helping.
- Docs, registry, landing docs, tests, SDLC gates, human browser validation.

**Out of scope:**

- Visible forgetting / platform-forgets arc.
- Dibs relationship-routing redesign.
- Responder Home actionability for `proposed` simulation matches beyond BUG-023.
- Service request platform scope.
- Simulation/data cleanup.
- Mobile parity beyond responsive web shell validation.

---

## Bugs Folded Into Sprint 107

| Bug | Current evidence | Likely root cause | Fix direction |
|-----|------------------|-------------------|---------------|
| **BUG-022** | `docs/close-sprint-106:docs/BUGS.md` says an already-accepted dibs shows in two places; accepting in one throws on the other. | Helping renders pending dibs twice: server-ranked `DecisionBand` plus separate `DibsCard` list from `getPendingDibsForProvider()`. | Make DecisionBand the canonical dibs response surface; remove duplicate DibsCard action rendering and derive tab badge count from decisions. |
| **BUG-023** | `docs/close-sprint-106:docs/BUGS.md` says Home "You've offered to help on 3 open asks" lists asks the maintainer couldn't find in Helping. | Home uses `fetchOfferedAwaiting()` predicate while Helping uses matches/requests UI with different labeling/surfacing. | Add canonical `GET /requests/offered-awaiting`; Home and Helping share predicate; Helping renders the same awaiting rows explicitly. |

---

## Critical Implementation Notes

1. **Do not widen `--measure`.** The 42rem measure is intentional for feed cards and prose. Add a
   chrome-specific container for topbar/app-shell width.
2. **Responsive overflow is a rule, not a disappearance.** Communities, Service Providers or Become a
   provider, Profile, provider management, duty state, notifications, and logout must remain reachable
   on every viewport.
3. **BUG-022 is a duplicate-surface bug.** Pending dibs should not render both in DecisionBand and in
   a separate DibsCard list. Choose one canonical action surface; this sprint chooses DecisionBand.
4. **BUG-023 is a truth mismatch, not just copy.** The Home offered-awaiting count/preview and the
   Helping list must share the same backend predicate.
5. **If Home says "View all in Helping", Helping must show those asks.** Do not leave the user to infer
   that "Awaiting Acceptance" means the Home preview.
6. **Keep DecisionBand in Helping.** Sprint 106 deliberately moved decisions out of Browse; do not
   reintroduce commitment actions into Browse.
7. **Use semantic and accessible controls.** Icon/menu buttons need labels, focus states, and keyboard
   behavior. Status must not be color-only.
8. **Use the global `next/router` Jest mock.** Do not add one-off router mocks for widely rendered
   shell components unless a test needs custom query behavior.
9. **BUG-022/023 evidence may live only on `docs/close-sprint-106`.** Do not assume PR #106 is merged;
   copy the exact bug text into Sprint 107 docs if needed.
10. **Human browser validation is required.** Validate desktop, tablet, and 320-375px mobile chrome,
    plus Home -> Helping flows for pending dibs and offered-awaiting rows.

---

## Carry-Forward / Known Issues

- **Reconnect CTA remains deferred:** restore only after real peer messaging or a directed-ask flow.
- **Responder Home actionability** ([IDEAS 2026-06-15]): `proposed` matches don't surface as
  actionable on responder Home; only BUG-023's offered-awaiting truth is in Sprint 107.
- **Dibs server-side relationship routing** ([IDEAS 2026-06-09]) remains open and out of Sprint 107.
- **"Platform forgets" visible decay** ([IDEAS 2026-06-04]) remains a future multi-sprint arc.
- **Member forget/export** privacy follow-on remains open.
- **request-forgery FP on `apps/frontend/src/lib/api.ts`** is known/recurring; dismiss as FP.
- **Pre-existing security drift:** Dependabot/CodeQL alerts follow ADR-059/ADR-060 SLA.
- **Pre-existing test drift:** `apps/frontend/tests/tdd/sprint-85-unified-feed.test.tsx` had a
  stale `request_type:'service'` assertion on master during Sprint 106; baseline if it appears.

---

## Multi-Sprint Arc

- **S102 (done):** Visible Memory + Re-warm First Step (v11.11.0).
- **S103 (done):** Governance + Intake Clarity (v11.12.0).
- **S104 (done):** UI Facelift Research - A-plus verdict, ADR-079 Proposed, no deploy.
- **S105 (done):** UI Facelift Implementation - A-plus rollout, ADR-079 Implemented (v11.13.0).
- **S106 (done):** Post-Facelift Correctness & Link-Up Clarity + v11.14.1 chrome follow-up.
- **S107 (planned):** App Shell Clarity & Commitment Truth (v11.15.0).
- **Deferred:** visible forgetting; responder Home actionability; Dibs relationship routing; member
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
- **category vs request_type seam:** `help_requests.category` is mixed-vocab (enum on new rows, skill
  tokens on old/seed/sim rows). Never pass `category` where `request_type` (the enum) is expected.
- **Feed query surfaces:** browsable-request filtering lives in multiple places; the feed ranker
  projection (`basicFeedRanker.ts`) is a separate seam. Change all relevant sites.
- **Design token system:** CSS-variable backed, in `apps/frontend/src/styles/globals.css` +
  `apps/frontend/tailwind.config.js`; per-community skins via `ThemeContext`/`ThemeProvider`.
- **Landing page docs:** `apps/landing/src/data/docs/` is gitignored - `git add -f` when generated
  docs must be committed. Generated by `scripts/generate-docs.ts`; edit sources, never generated JSON.
- **ADR numbering:** ADR-079 is the last; next free = **080**.
- **JWT field** is `communities`, not `communityMemberships`.
- **Schema is `communities.communities`** (plural schema name); auth tables are `auth.*`.
- **API response unwrap:** `createApiClient` interceptor already unwraps - use `res.data`, not
  `res.data.data`.
- **Error contract (ADR-074):** `{ success:false, message:string, error:string }`.
- **trust_edges_live is a VIEW:** never INSERT/UPDATE it.
- **`git add` on CLAUDE.md:** tracked as lowercase `claude.md`.
- **Solo dev - no worktrees:** work directly on feature branches.
- **request-service serves the feed** (`/requests/feed`); there is no feed-service.

### Workflow Gotchas

- Every sprint runs testing, `/simplify`, `/code-review`, and `/security-review`.
- Every sprint updates docs and landing docs.
- No docs-only push to `master`; master push triggers a full deploy.
- nginx.conf changes take effect on the next deploy (deploy.sh copies + reloads).
- `nav.json` silently reverts - always grep-verify after editing.
- Widely-rendered components using `useRouter` need the global `apps/frontend/jest.setup.js` router
  mock.
- `npm audit --package-lock-only --audit-level=high` is blocked by tenant policy in-agent (exports
  private dep metadata externally); rely on the CI ADR-059 gate, don't work around it locally.

### Deploy Drift Watch

`karmyq.org` / demo live content has drifted from `master` before. Confirm the latest deploy
succeeded and live content matches `master` before judging by live content.
