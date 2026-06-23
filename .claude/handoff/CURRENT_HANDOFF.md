# Sprint 111 — Belonging Graph System: Implementation & Ship (v11.18.0)

> **STATUS (2026-06-23):** Sprint 110 is **complete and PR-ready** (`feature/sprint-110-belonging-graph-research`).
> Research/ADR sprint — no version bump, no deploy.
> **Sprint 111 is the implementation sprint** — executes ADR-081, ships v11.18.0.

---

## Quick Start

1. Read this handoff.
2. Review the S110 PR (once merged): confirm ADR-081 (Proposed) is in master.
3. Check out branch: `git fetch origin && git checkout -b feature/sprint-111-belonging-graph-system origin/master`
4. Open spec: `docs/superpowers/specs/2026-06-22-sprint-111-belonging-graph-system-design.md`
5. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint 111 Goal

Implement ADR-081 — one HEB engine, one client data model, one expandable full-page `/network` explorer,
raised profile altitude, dead-lib removal. Ships as **v11.18.0**.

## S110 Completed Deliverables

- `docs/design/sprint-110-belonging-graphs/audit.md` — six-surface audit with file:line evidence
- `docs/design/sprint-110-belonging-graphs/references.md` — reference study (Obsidian, LinkedIn, Are.na, GitHub, D3 HEB)
- `docs/adr/ADR-081-belonging-graph-system.md` — **Status: Proposed** — records D1–D6 decisions
- `apps/landing/src/data/docs/concepts/adr-081-belonging-graph-system.json` — generated landing concept page
- `docs/superpowers/specs/2026-06-22-sprint-111-belonging-graph-system-design.md` — **ready-to-execute S111 spec**

## S111 Key Implementation Tasks

1. `components/graphs/types.ts` — canonical `TrustNode`/`TrustLink`/`GraphData`/`BelongingMode` types
2. `components/BelongingGraph.tsx` — single wrapper dispatching to `TrustGraphHEB` (all 4 modes)
3. `TrustGraphHEB.tsx` extensions — `communities` mode, hover-highlight, click-to-expand, `<title>` tooltips
4. `pages/network.tsx` — full-bleed explorable `/network` page (D4)
5. `components/BelongingSection.tsx` + `BelongingPulse.tsx` — raised profile altitude (D6)
6. Dead-lib removal — `cytoscape`, `react-cytoscapejs`, `@types/cytoscape`, `react-force-graph-2d`
7. Backend: `GET /graph/neighborhood/:userId` in social-graph-service (for expand)
8. Update callers: `TrustNetworkWidget`, `TrustGraphTab`, `FissionTab`, `profile.tsx`
9. Update ADR-081 status → Implemented; regenerate landing docs; version bump → 11.18.0

## S111 Spec

`docs/superpowers/specs/2026-06-22-sprint-111-belonging-graph-system-design.md`

## The audit, already established (verify in code, then formalize)

Six surfaces, three visual idioms:
1. **Dashboard "Your Trust Network"** (`dashboard/TrustNetworkWidget`) — People (ego HEB) / Communities
   (depth force) toggle; **dead `View full →` link to `/network`.**
2. **Profile** (`pages/profile.tsx` L842) — reuses the *same* widget; belonging gets no prominent treatment.
3. **Community page** (`community/tabs/TrustGraphTab` → `TrustGraph` → `graphs/TrustGraphHEB`) — richest surface.
4. **Inter-community** (`graphs/CommunityDepthGraph`) — a **different D3 idiom** (force) than the HEB views.
5. **Inline** (`TrustPathBadge` + `useTrustPath`) — in RequestCard, OfferItem, DibsPrompt, KarmaBadge, MemorySection, providers.
6. **Fission** — HEB in `fission` mode.

Root causes of "patchy": two D3 idioms not one; **3 dead graph libs** (`cytoscape`,
`react-cytoscapejs`, `react-force-graph-2d` — unused); a **dead `/network` route**; **4 wrappers**
redeclaring the same types; **expand was removed in S79** (must be reintroduced deliberately).

Healthy, keep: `socialGraphClient`, `useLazyGraphData` (lazy D3), `useTrustPath`, social-graph-service
(port 3010) contracts. This sprint is **frontend presentation + consolidation**, not a backend rewrite.

## Proposed direction ADR-081 records (validate in research)

D1 one HEB engine (decide CommunityDepthGraph's fate) · D2 drop dead libs · D3 one client data model +
one `<BelongingGraph mode>` wrapper · D4 a real, prominent, zoomable, expandable `/network` explorer ·
D5 reintroduce expand deliberately (answer why S79 removed it) · D6 raise belonging's altitude on profile.

## Critical Implementation Notes (copied from spec)

1. **No-deploy, no version bump.** ADR-081 **Proposed**; version stays `11.17.0`; plan omits deploy. Mirror S104/ADR-079.
2. **The audit is the deliverable — verify every claim in code** with file:line evidence before writing references/ADR.
3. **No app-code edits in S110** (no deleting dead libs / merging wrappers — that's S111). Keep the branch docs-only.
4. **Re-introducing expand must answer S79** (why removed; how this avoids that) — rationale into ADR-081.
5. **Keep the data layer** (socialGraphClient, useLazyGraphData, useTrustPath, social-graph contracts).
6. **Drift gate:** ADR-081 in `docs/adr/README.md` + landing concept wired via `ADR_GROUPS`, or CI fails.
7. **Landing docs are GENERATED — do NOT hand-edit `nav.json`/concept JSON.** `scripts/generate-docs.ts`
   builds them from `docs/adr` + `ADR_GROUPS` and wipes `OUT_DIR` each run (this is the real "nav.json
   reverts" cause). Add the slug to `ADR_GROUPS`, run `cd apps/landing && npm run generate-docs`, commit.
8. **Landing generated docs are gitignored** — `git add -f apps/landing/src/data/docs` after generating.
9. **ADR numbering:** S110 uses **ADR-081**; next free = 082.
10. **Decide `CommunityDepthGraph`'s fate explicitly** in ADR-081 (fold to HEB, or sanctioned exception).
11. **Windows/PowerShell repo** — use `rg`/PowerShell verification commands, not Bash.
12. **Pre-push gate still runs `npm test`** even for this docs sprint — run it before pushing.
13. **Expected-dirty tree at execution start:** the planning artifacts (plan/spec) + modified handoff
    are carried onto the S110 branch by `checkout -b` — confirm correct base + expected WIP, not clean.

---

## Carry-Forward / Known Issues

- **Cleanup-service replacement** — considered in S110 planning, **deferred again**: it is the
  platform's scheduled-job runner for real guarantees (ADR-069 forgetting cascade, dibs release every
  5 min, reputation decay, trust-edge sweep, TTL/hard-delete). Pure plumbing risk, no user-visible
  upside. If revisited, the choice is fold-into-owning-services (request + reputation, 10→9) vs
  swap node-cron for durable Bull repeatable jobs; **the forgetting logic must be preserved verbatim.**
- **Member forget/export** privacy follow-on remains open.
- **Responder Home / sim liveliness** (IDEAS 2026-06-15) — established demo accounts read empty;
  `proposed` matches don't surface; sim pace low. Candidate for a later sprint.
- **request-forgery FP on `apps/frontend/src/lib/api.ts`** — known/recurring; dismiss as FP.
- **Moderate dependency alerts**: baseline high:0/critical:0; S109 reduced moderates 21→3 (remaining =
  `tar`→`@expo/cli`→`expo` chain; keep exact `tar` override). Pre-existing Dependabot/CodeQL alerts
  follow ADR-059/ADR-060 SLA.
- **Pre-existing test drift:** root Turbo test targets can cache/skip changed-package coverage; run
  focused suites directly.

---

## Multi-Sprint Arc

- **S104 (done):** UI Facelift Research (ADR-079 Proposed, no deploy).
- **S105 (done):** UI Facelift Implementation (v11.13.0).
- **S106 (done):** Post-Facelift Correctness & Link-Up Clarity (v11.14.0/.1).
- **S107 (done):** App Shell Clarity & Commitment Truth (v11.15.0).
- **S108 (done):** Responder Home Actionability & Decision Truth (v11.16.0).
- **S109 (done):** Geocoding Cache Hardening & Dependency Hygiene (v11.17.0, #111).
- **S110 (done):** Belonging Graph System — Research & ADR-081 Proposed (no-deploy, v11.17.0 — PR open).
- **S111 (this sprint):** Belonging Graph System — Implementation & ship (v11.18.0).
- **Deferred:** cleanup-service replacement; member forget/export; responder-Home/sim liveliness; mobile parity.

---

## Persistent Context

### Active Session (update on every role handoff)

- **Driving agent:** Claude Sonnet 4.6 (S110 execution complete 2026-06-23)
- **Phase:** S110 complete → PR open → waiting for merge → S111 ready to execute
- **Branch + files in flight:** `feature/sprint-110-belonging-graph-research` (PR open, no deploy)

> Keep this stanza current. Claude + Codex share ONE working tree (two VS Code sessions, same
> folder, time-sliced — see AGENTS.md "Same-machine reality"). The clash safeguard is: one agent
> edits at a time, and **the active agent commits or stashes before handing the session over**, so
> the next agent starts from a clean tree. Never edit/commit on top of the other agent's
> uncommitted WIP.

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
- **Graph engine is D3 HEB** (`graphs/TrustGraphHEB`); `CommunityDepthGraph` is a separate D3 force
  layout; `cytoscape`/`react-cytoscapejs`/`react-force-graph-2d` are installed but **unused**.
- **`/network` page does not exist** despite `TrustNetworkWidget` linking to it (dead link).
- **category vs request_type seam:** `help_requests.category` is mixed-vocab (enum on new rows, skill
  tokens on old/seed/sim rows). Never pass `category` where `request_type` (the enum) is expected.
- **Feed query surfaces:** browsable-request filtering lives in multiple places; the feed ranker
  projection (`basicFeedRanker.ts`) is a separate seam. Change all relevant sites.
- **`admin_proposed` discriminator:** `requests.matches.admin_proposed` distinguishes a member's
  self-offer (FALSE, requester owes) from an admin/matchmaker proposal (TRUE, responder owes).
- **Design token system:** CSS-variable backed, in `apps/frontend/src/styles/globals.css` +
  `apps/frontend/tailwind.config.js`; per-community skins via `ThemeContext`/`ThemeProvider`.
- **Landing page docs:** `apps/landing/src/data/docs/` is gitignored - `git add -f` when generated
  docs must be committed. Generated by `scripts/generate-docs.ts`; edit sources, never generated JSON.
- **ADR numbering:** S110 creates ADR-081; next free = **082**.
- **JWT field** is `communities`, not `communityMemberships`.
- **Schema is `communities.communities`** (plural schema name); auth tables are `auth.*`.
- **API response unwrap:** `createApiClient` interceptor already unwraps - use `res.data`, not
  `res.data.data`.
- **Error contract (ADR-074):** `{ success:false, message:string, error:string }`.
- **trust_edges_live is a VIEW:** never INSERT/UPDATE it.
- **`git add` on CLAUDE.md:** tracked as lowercase `claude.md`.
- **Solo dev - no worktrees:** work directly on feature branches.
- **request-service serves the feed** (`/requests/feed`); there is no feed-service.
- **cleanup-service is the scheduled-job runner** (forgetting/dibs/decay/TTL) — load-bearing; left intact.

### Workflow Gotchas

- Every sprint runs testing, `/simplify`, `/code-review`, and `/security-review` (for a docs sprint
  these largely confirm no code risk — record the result, don't skip the gate).
- Every sprint updates docs and landing docs; research sprints ship the ADR landing concept now and
  defer user-guide updates to the implementing sprint. **Landing docs are generated** by
  `scripts/generate-docs.ts` from `docs/adr` + `ADR_GROUPS` — wire new ADRs via `ADR_GROUPS` and
  regenerate; never hand-edit `nav.json` or the concept JSON (the generator wipes and rebuilds them).
- No docs-only push to `master`; master push triggers a full deploy. A research-sprint PR still merges
  via CI but with no version bump and no manual deploy.
- nginx.conf changes take effect on the next deploy (deploy.sh copies + reloads).
- `nav.json` silently reverts - always grep-verify after editing.
- Widely-rendered components using `useRouter` need the global `apps/frontend/jest.setup.js` router mock.
- Root Turbo `test:unit`/`test:regression` can exit before tests (missing target in one workspace);
  run changed-package unit/regression targets directly.
- DB-backed TDD tests need a reachable local Postgres and may need to seed `creator_id`.
- `npm audit --package-lock-only --audit-level=high` may need network/escalated shell; CI ADR-059 gate
  remains authoritative.

### Demo / Deploy Drift Watch

`karmyq.org` / demo live content has drifted from `master` before. Confirm the latest deploy
succeeded and live content matches `master` before judging by live content. Demo tester:
`maria.reyes@test.karmyq.com` / `password123`.
