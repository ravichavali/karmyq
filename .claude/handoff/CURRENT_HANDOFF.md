# Sprint 108 - Responder Home Actionability & Decision Truth - IN PR REVIEW (v11.15.0 -> v11.16.0)

> **STATUS (2026-06-22):** Sprint 108 is **fully implemented** on branch
> `feature/sprint-108-responder-home-actionability` and opened as **PR #110**
> (https://github.com/ravichavali/karmyq/pull/110). All 11 plan tasks executed; tests green; docs done;
> version bumped to 11.16.0. **Awaiting CI green + cross-agent review + maintainer merge.** Not merged
> or deployed yet.

---

## Quick Start (for the next session)

1. Read this handoff.
2. Check PR #110 state: `gh pr checks 110` and `gh pr view 110`.
3. **If CI green + approved →** merge (squash), confirm `state=MERGED`, then `/deploy` (push-to-master
   → GitHub Actions). Reset local master after merge.
4. **Then the one remaining human step:** browser-validate as `maria.reyes@test.karmyq.com` /
   `password123` once the sim has generated admin-proposed matches — Home "suggested you as a helper"
   preview → Helping DecisionBand accept → matched; offered-awaiting band actionable (Open ask →);
   caught-up copy honest. Validate desktop + mobile.
5. **If review surfaces findings →** address on the branch; the cross-agent reviewer is the other model
   (Codex), per the protocol — Claude authored this PR.

## What shipped (PR #110)

- **Backend** (`request-service/src/routes/requests.ts`): `fetchDecisions` projects `m.admin_proposed`
  and surfaces admin-proposed responder matches as `member_role:'responder'` match decisions
  (accept/decline → `PUT /matches/:id/accept|reject`); ownership flips symmetrically (admin-proposed →
  responder owes; self-offer → requester owes; requester of admin-proposed owes nothing). New
  `suggestedAsHelper:{count,items}` home payload via shared `fetchProposedResponderAsks`.
- **Frontend**: new `SuggestedAsHelperPanel` (Home preview, links to Helping — BUG-015 keeps the
  actionable band off Home); `DecisionBand` labels + routes admin-proposed; `OfferedAwaitingPanel` gets
  an explicit "Open ask →"; `CommitmentsTab` dedupe (proposed matches never render as helping cards).
- **Sim**: `admin-propose-helper-workflow` wired into COMMUNITY_BUILDER (weight + selectWorkflow
  candidate) generating `admin_proposed` matches.
- **BUG-009** verified **fixed** live; **BUG-010** **cannot-reproduce** — both updated in `docs/BUGS.md`.
- **Docs**: guides, both CONTEXT.md, registry.json, onboarding, regenerated landing docs.

---

## Sprint Goal

Preview admin-proposed responder decisions on Home and make them actionable in Helping ("preview on
Home, decide in Helping"), make the caught-up terminal copy
honest, enrich the Home offered-awaiting preview into an actionable band, add a sim workflow that
generates admin-proposed matches, and reproduce-verify BUG-009/BUG-010.

---

## The Core Defect (one paragraph)

`fetchDecisions` ([services/request-service/src/routes/requests.ts:924-928](../../services/request-service/src/routes/requests.ts))
unconditionally drops **every** responder-side `proposed` match, assuming it is always the member's
own offer awaiting the requester. That is wrong for **admin/matchmaker-proposed** matches
(`admin_proposed = TRUE`): there the member owes the accept/decline (the rule `matches.ts:306`
already enforces). These owed decisions reach neither Home (decision band drops them) nor
offered-awaiting (which excludes `admin_proposed`), appearing only as Helping cards. So an active
helper's Home understates owed work — the root of "Maria's Home reads empty" (IDEAS 2026-06-15).

## Design Decision (maintainer-confirmed)

BUG-015 deliberately moved the actionable `DecisionBand` off Home into Helping
([UnifiedFeed.tsx:226](../../apps/frontend/src/components/Feed/UnifiedFeed.tsx)). We keep that intact.
Admin-proposed responder matches become **canonical decisions in the Helping DecisionBand**; Home gets
a **non-actionable preview band** ("N neighbours suggested you as a helper" → Respond in Helping), fed
by a new additive `suggestedAsHelper` field on the curated-home payload. **Do not render
`kind==='decision'` items in Home's UnifiedFeed.**

## In Scope (maintainer-confirmed)

1. **Admin-proposed → Helping DecisionBand + Home preview band** — surface `admin_proposed=TRUE`
   responder matches as canonical Helping decisions; Home previews them and links to Helping. The
   concrete fix.
2. **"Caught up" overclaim** — never claim "That's everyone" when browsable community asks exist;
   scope the claim to direct matches.
3. **Richer Home offered-awaiting** — make `OfferedAwaitingPanel` previewed asks actionable (calm
   band, not a decision).
4. **Sim creates admin-proposed** — new workflow so the demo exercises the fixed path.
5. **Verify BUG-009 + BUG-010** — reproduce-first; their `planned (Sprint 100)` labels predate the
   S100 fixes, so they may already be fixed.

## Out of Scope

- Visible forgetting / "platform forgets" decay arc.
- Dibs server-side relationship routing (IDEAS 2026-06-09).
- Member forget/export; Service Consolidation Phase 2; mobile parity beyond responsive validation.
- A true directed/paid provider-request flow (S99-004 deferral stands).

---

## Critical Implementation Notes (copied from spec)

1. **`admin_proposed` is the only discriminator.** A `proposed` responder match is a decision iff
   `admin_proposed = TRUE`. Self-offers (`FALSE`) stay offered-awaiting — never surface them as
   decisions (re-creates BUG-022/023 duplication).
2. **Project `m.admin_proposed`** in the decisions SELECT (requests.ts:900-917) — not currently
   selected.
3. **Verify the responder decline path.** `PUT /matches/:id/accept` already authorizes the responder
   for admin-proposed (matches.ts:306); confirm the reject/decline path does too, fix if not.
4. **DecisionBand action handler branches on `subject_kind` + `member_role`.** Responder-role `match`
   accept → `PUT /matches/:id/accept`; mirror the existing dibs responder path; do not use the
   requester path. This band renders in **Helping**, not Home.
4a. **Home gets a preview band, not the DecisionBand.** Add `suggestedAsHelper:{count,items}` to the
   home payload and render `SuggestedAsHelperPanel`; do NOT start rendering `kind==='decision'` items
   in `UnifiedFeed` (BUG-015).
5. **Caught-up copy scoped to direct matches.** The non-community branch copy is already honest; the
   residual risk is the community-view "That's everyone for now." Audit every terminal path.
6. **OfferedAwaitingPanel stays a calm band**, visually distinct from the DecisionBand.
7. **Sim admin-propose needs an admin/steward session** (reuse governance/admin pattern); propose only
   eligible members with no existing live match (409s otherwise — handle gracefully).
8. **BUG-009/010 reproduce-first** on live demo before any code.
9. **Counts derive from freshly mapped decision rows**, not stale React state (S107 lesson).
10. **Prove the dedupe both directions** in tests: admin-proposed → DecisionBand only; self-offer →
    offered-awaiting only.

---

## Planning Artifacts

- Spec: `docs/superpowers/specs/2026-06-22-sprint-108-responder-home-actionability-design.md`
- Plan: `docs/superpowers/plans/2026-06-22-sprint-108-responder-home-actionability.md`

---

## Carry-Forward / Known Issues

- **BUG-009 / BUG-010**: stale `planned (Sprint 100)` labels — verify **first** (Task 2, before any
  fix code).
- **Reconnect CTA** remains deferred until real peer messaging / directed-ask.
- **Dibs server-side relationship routing** (IDEAS 2026-06-09) remains open.
- **"Platform forgets" visible decay** remains a future multi-sprint arc.
- **Member forget/export** privacy follow-on remains open.
- **request-forgery FP on `apps/frontend/src/lib/api.ts`** — known/recurring; dismiss as FP.
- **Pre-existing security drift:** Dependabot/CodeQL alerts follow ADR-059/ADR-060 SLA.
- **Pre-existing test drift:** `apps/frontend/tests/tdd/sprint-85-unified-feed.test.tsx` had a stale
  `request_type:'service'` assertion on master; baseline if it appears.

---

## Multi-Sprint Arc

- **S100 (done):** Pulse Truth & Actionability (ADR-078).
- **S101 (done):** Actionability & State Truth.
- **S102 (done):** Visible Memory + Re-warm First Step (v11.11.0).
- **S103 (done):** Governance + Intake Clarity (v11.12.0).
- **S104 (done):** UI Facelift Research (ADR-079 Proposed, no deploy).
- **S105 (done):** UI Facelift Implementation (v11.13.0).
- **S106 (done):** Post-Facelift Correctness & Link-Up Clarity (v11.14.0/.1).
- **S107 (done):** App Shell Clarity & Commitment Truth (v11.15.0).
- **S108 (planned, this sprint):** Responder Home Actionability & Decision Truth (v11.16.0).
- **Deferred:** visible forgetting; Dibs relationship routing; member forget/export; Service
  Consolidation Phase 2; mobile parity.

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
- **`admin_proposed` discriminator:** `requests.matches.admin_proposed` distinguishes a member's
  self-offer (FALSE, requester owes) from an admin/matchmaker proposal (TRUE, responder owes).
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
- Root Turbo `test:unit`/`test:regression` can exit before tests (missing target in one workspace);
  run changed-package unit/regression targets directly.
- DB-backed TDD tests need a reachable local Postgres and may need to seed `creator_id` (cf. S107
  offered-awaiting-truth test).
- `npm audit --package-lock-only --audit-level=high` is blocked by tenant policy in-agent; rely on the
  CI ADR-059 gate.

### Demo / Deploy Drift Watch

`karmyq.org` / demo live content has drifted from `master` before. Confirm the latest deploy
succeeded and live content matches `master` before judging by live content. Demo tester:
`maria.reyes@test.karmyq.com` / `password123` (rich account, the canonical responder-Home repro).
