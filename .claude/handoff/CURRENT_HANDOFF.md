# Sprint 104 - UI Facelift Research - READY TO EXECUTE

> **STATUS (2026-06-17):** Sprint 104 planning is complete. Maintainer approved a **research-first,
> no-deploy** UI facelift sprint. The deliverable is a single comprehensive design-research doc —
> **no app implementation and no proof-of-concept page.** Scope covers all four surface clusters:
> Dashboard/Home, Community page, Request feed + detail, and Profile + global chrome. Direction is
> generated via the `frontend-design` skill, anchored to the existing CSS-variable token system.
>
> **Sprint 103 is merged and deployed** (`124caea3` + follow-ups `#97` founding-circle access
> lockdown, `#98` reviewer env vars). BUG-011 (split child admins) and BUG-012 (offer/service copy)
> shipped there — they are still marked `open` in `docs/BUGS.md` but are fixed; close them when
> convenient.
>
> **LOCAL STATE:** `scripts/founding-circle-submissions.sh` remains untracked user/local work. Do not
> stage, remove, or rewrite it unless the maintainer explicitly asks.

---

## Quick Start

1. Read this handoff.
2. Check out branch (it already exists from planning): `git checkout feature/sprint-104-ui-facelift-research`
   (use `git checkout -b ...` only if it's missing in your checkout).
3. Open plan: `docs/superpowers/plans/2026-06-17-sprint-104-ui-facelift-research.md`.
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development). Pair with the
   `frontend-design` skill for the reference-research and direction tasks.

---

## Sprint Goal

Produce one comprehensive **UI Facelift Research doc** that audits the current UI across all four
surface clusters, researches reference products + aesthetic directions (anchored to the existing
token system), and recommends a concrete redesign direction specific enough to scope the S105
implementation sprint. **Doc only — no implementation, no POC, no deploy.**

---

## Planning Artifacts

- Spec: `docs/superpowers/specs/2026-06-17-sprint-104-ui-facelift-research-design.md`
- Plan: `docs/superpowers/plans/2026-06-17-sprint-104-ui-facelift-research.md`

---

## Scope

### In Scope (research deliverables)

- **Current-state audit** of all four clusters against a shared scorecard (extend Sprint 87's).
- **Reference & visual research** via the `frontend-design` skill, anchored to existing tokens.
- **2–3 whole-product design directions** + one static throwaway HTML mockup each.
- **Recommendation** of one direction + per-cluster change list sized for S105.
- **ADR-079 (Proposed):** Karmyq Visual Design System v2 — source `docs/adr/ADR-079-*.md`.
- **Landing docs (via generator):** edit source `docs/concepts/ux-design-principles.md` + add the
  ADR-079 slug to `ADR_GROUPS` in `scripts/generate-docs.ts`, then `npm run generate-docs` and
  `git add -f` the output. **Never hand-edit `apps/landing/src/data/docs/**` or `nav.json`.**

### Out of Scope

- Any edit to `apps/frontend/src/**`, `globals.css`, or `tailwind.config.js`.
- A proof-of-concept page wired into the app.
- Master deploy / demo-deploy validation (this is `no-deploy`).
- API, schema, or platform-feature changes.
- Moving ADR-079 to Accepted/Implemented (that's S105).

---

## Critical Implementation Notes

1. **Research-first, no app code.** Do not touch `apps/frontend/src/pages/**`, `src/components/**`,
   `globals.css`, or `tailwind.config.js`. Tempting "quick fixes" become S105 recommendations.
2. **Anchor to the existing token system.** Express every direction as deltas to the existing
   CSS-variable tokens (`apps/frontend/src/styles/globals.css` + `tailwind.config.js`). Per-community
   ThemeProvider skins override tokens — any direction must survive re-skinning.
3. **Extend Sprint 87, don't restart.** Reuse `docs/design/sprint-87/scorecard.md`, `ux-audit.md`,
   `visual-research.md` as the baseline; cite what changed since S87.
4. **Mockups are throwaway research artifacts.** Static HTML under
   `docs/design/sprint-104-ui-facelift/mockups/`; no app imports, no API calls, not route-reachable.
5. **No-deploy sprint.** No merge+deploy task; ships via a reviewed PR. No demo-deploy validation
   (no runtime change). Do not push docs alone to master to "deploy."
6. **frontend-design skill is the direction engine.** Feed it existing tokens + the cluster audit as
   constraints; avoid generic Tailwind defaults.
7. **ADR-079 ships Proposed, not Implemented.** S105 advances its status.
8. **Version drift to flag (not fix here):** `package.json` reads `11.10.0` while the S103 handoff
   tracks `v11.12.0`. Note it as S105 housekeeping; do not bump versions in a research sprint.
9. **Demo screenshots optional.** Use the documented demo UX-audit access; fall back to local
   `npm run dev` or annotated component inventory if the demo is unreachable.

---

## Implementation Tasks

Follow the plan exactly:

1. Branch + baseline review (read S87 docs, token system, anchoring UX ADRs).
2. Current-state audit — Dashboard/Home + Request feed/detail (+ shared scorecard).
3. Current-state audit — Community page + Profile/global chrome (+ cross-cluster drift findings).
4. Reference & visual research via `frontend-design` skill.
5. Design-direction synthesis + 2–3 static mockups.
6. Recommendation + per-cluster S105 scope + primary README.
7. ADR-079 (Proposed) source + concept source + `ADR_GROUPS` slug → `npm run generate-docs` → `git add -f`.
8. SDLC gates: `/simplify`, `/code-review`, `/security-review` (docs-appropriate) + guardrail check.
9. Final verification + PR (no deploy) + handoff update.

---

## Carry-Forward / Known Issues

- **BUG-011 / BUG-012** fixed in S103; still marked `open` in `docs/BUGS.md` — close when convenient.
- **Reconnect CTA remains deferred:** restore only after real peer messaging or a directed-ask flow.
- **Responder Home actionability** (empty Home for established users; ~335 `proposed` matches that
  never surface) is an S104+ functional candidate NOT chosen for S104 — keep on the list.
- **Dibs server-side relationship routing** (IDEAS 2026-06-09, ADR-072 next step) still open.
- **Member forget/export** privacy follow-on still open.
- **Pre-existing security drift:** GitHub Dependabot previously showed 1 high advisory on default
  branch while local `npm audit` was clean. Track under ADR-059 SLA.

---

## Multi-Sprint Arc

- **S100 (done):** Pulse Truth + Feed Actionability (v11.9.0).
- **S101 (done):** Actionability + State Truth (v11.10.0).
- **S102 (done):** Visible Memory + Re-warm First Step (v11.11.0).
- **S103 (done):** Governance + Intake Clarity (v11.12.0).
- **S104 (planned / this sprint):** UI Facelift Research — whole-product visual audit + recommended
  direction. Doc only, no-deploy.
- **S105+ (upcoming):** UI Facelift Implementation — execute the recommended direction surface-by-
  surface against the agreed reference; net-new code, token changes, per-surface rollout, deploy.
  Advances ADR-079 to Accepted → Implemented. Reconcile the version drift here.
- **Deferred:** reconnect CTA (needs a real target); responder Home actionability; Dibs relationship
  routing; member forget/export; Service Consolidation Phase 2; mobile parity.

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
- **ADR numbering:** ADR-078 is the highest shipped; next free = **079** (used by this sprint, Proposed).
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

- Every sprint runs testing, `/simplify`, `/code-review`, and `/security-review` (docs-appropriate
  for a research sprint).
- Every sprint updates docs; for this sprint the docs ARE the deliverable.
- No docs-only push to `master`; this `no-deploy` sprint ships via a reviewed PR, not a deploy push.
- nginx.conf changes take effect on the next deploy (deploy.sh copies + reloads).
- `nav.json` silently reverts - always grep-verify after editing.
- Widely-rendered components using `useRouter` need the global `apps/frontend/jest.setup.js` router mock.

### Deploy Drift Watch

`karmyq.org` live content has drifted from `master` before. Confirm the latest deploy succeeded and
live content matches `master` before judging by live content.
