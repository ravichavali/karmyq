# Sprint 99 - Release Experience Audit + Fine Tune - IMPLEMENTED, pending PR/deploy (v11.8.0)

> **STATUS (2026-06-14):** All 6 frozen repairs implemented + tested; version bumped 11.7.0→11.8.0;
> SDLC gates passed (/simplify, /code-review, /security-review clean; `npm audit` 0 vulns; new TDD
> 10/10 green; zero new failures vs master). Committed on `feature/sprint-99-release-experience-audit`.
>
> **PENDING (needs maintainer):**
> 1. **Push branch → open PR → cross-agent review → admin merge → deploy** (agents don't self-merge).
> 2. **Run the S99-003 demo-data repair (post-deploy, manual)** —
>    `scripts/repair-release-experience-demo-data.sql`. Codex review moved it OUT of `migrations/` so
>    deploy does not auto-apply it; it is now a manual post-deploy DB script (maintainer approved running
>    post-deploy scripts). It prints its own BEFORE/AFTER audit. The ad-hoc apply was blocked by the
>    safety classifier (shared-DB write) — run it explicitly post-deploy and paste the empty AFTER audit.
> 3. **Community names APPROVED** (maintainer): `Test 1`→`Bayview Neighbors`, `Test 2`→`Excelsior Mutual
>    Aid`, `Test Community …`→`Glen Park Community Care` (renamed not deleted — 60+ real members each).
>    Open: whether to normalize the em-dash `—` in single fission suffixes ("weird characters" note).
> 4. **Post-deploy validation** (Task 14 below).
>
> Audit + all evidence: `docs/bugs/sprint-99-release-experience-audit.md`. Walkthrough was live
> Playwright as `maria.reyes@test.karmyq.com` across all 7 lanes.
>
> **Frozen fix list (6 repairs, maintainer-confirmed):**
> - **S99-001** Stewardship 403 — gate admin-only `/stats` fetch to admins. `apps/frontend/src/pages/communities/[id].tsx` L79.
> - **S99-002** "You're caught up" overclaims — scope terminal copy to best-matches. `apps/frontend/src/components/Feed/UnifiedFeed.tsx` L256-265.
> - **S99-003** Demo-data cleanup — scripted/idempotent, **rename not delete** (Test 1/2 hold 60+ members each): rename Test 1/2 + Test Community, fix "Aficianados"/"Foster city" typos, collapse stacked fission suffixes. `scripts/audit-release-experience.sql` + `scripts/repair-release-experience-demo-data.sql` (manual post-deploy; NOT in migrations/).
> - **S99-004** Provider Get Service copy — payload already sends `preferred_provider_id`; tell the user. `apps/frontend/src/components/RequestWizard.tsx` L264/381/418.
> - **S99-005** Landing NetworkVisualization resize — redistribute nodes + recompute connectionDistance (the plan's DPR/transform hypothesis is WRONG; canvas.width assignment already resets transform). `apps/landing/src/components/NetworkVisualization.tsx`.
> - **S99-006** Mask member emails on People roster for non-admins. `apps/frontend/src/components/community/tabs/ActiveTab.tsx` L247.
>
> **Deferred (logged, not fixed):** S99-007 docs ADR count 75 vs 72, S99-008 empty "—" column on People, S99-009 dual Available/On-duty indicators, S99-010 raw "Dibs, pending" label, S99-011 401 wall on logged-out splash.
>
> **Planning artifacts:**
> - Spec: `docs/superpowers/specs/2026-06-14-sprint-99-release-experience-audit-design.md`
> - Plan: `docs/superpowers/plans/2026-06-14-sprint-99-release-experience-audit.md`
> - Audit log: `docs/bugs/sprint-99-release-experience-audit.md`
>
> **Important:** Pre-existing modification in `docs/IDEAS.md` predates Sprint 99. Do not overwrite
> or "clean up" that change unless the user asks.

---

## Quick Start

1. Read this handoff.
2. Check out branch: `git checkout -b feature/sprint-99-release-experience-audit`.
3. Open plan: `docs/superpowers/plans/2026-06-14-sprint-99-release-experience-audit.md`.
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development).

---

## Sprint Goal

Audit the full demo/evaluator experience and ship a tight set of clarity, trust, and demo-readiness
repairs.

---

## Scope

Audit lanes:

- Dashboard Home: feed hierarchy, decision bands, show-more/caught-up states, empty states, trust
  badges, and first useful action.
- Community pages: Home, People, How we're connected, Stewardship, tab labels, member/provider
  relationship language, and community-scoped truth.
- Provider flows: provider directory, provider detail, shared-community labels, offers, dibs prompts,
  and whether provider/community link-up is understandable.
- Request flows: ask creation, Get Help/Get Service split, platform/community scope, request cards,
  offer states, and first-ask routing explanation.
- Trust and relationship copy: distinguish exchange trust, indirect path, fellow member, provider
  availability, shared community, and invitation lineage.
- Demo data quality: stale, orphaned, contradictory, or noisy demo records that make the platform
  harder to evaluate.
- Landing first impression: karmyq.org home/join/docs first impression, including contained visual or
  functional defects such as the `NetworkVisualization` resize bug.

Allowed repairs:

- Focused frontend copy/state/layout repairs in existing components.
- Focused backend or SQL repairs only when audit evidence shows the UI confusion is caused by data or
  API truth.
- Contained landing polish that directly improves first impression or fixes a real bug.
- Demo-data cleanup scripts if the audit finds repeatable stale/orphaned records.

Explicitly deferred:

- Broad UI facelift or new visual language.
- New social features such as introductions, endorsements, testimonials, or blog publishing.
- Founding-circle review/notify workflow.
- Service consolidation phase 2.
- Mobile parity unless a shared API bug affects mobile too.
- Full provider/community architecture redesign.
- Large schema changes unless the audit finds a release-blocking correctness bug that cannot be fixed
  otherwise.

---

## Critical Implementation Notes

1. **Audit first, then freeze the fix list.** Do not start patching random polish issues before the
   walkthrough findings are logged and ranked.
2. **Use the live demo for the walkthrough.** Task 2 targets `https://karmyq.com` and
   `https://karmyq.org`, not local dev. Read maintainer-local memory note
   `reference_demo_ux_audit_access.md` if available for SSH, container Postgres, seeded testers, and
   Playwright gotchas.
3. **Tasks 1-4 stay in the main session.** The audit, judgment, ranking, and fix-list freeze are not
   subagent fan-out work. Dispatch subagents only after Task 4, once exact files and selected repairs
   are named.
4. **Truth beats prettiness.** A small copy or state fix that prevents a false claim is more valuable
   than a visual flourish.
5. **Keep the sprint bounded.** Fix P0/P1 clarity and demo-readiness issues first; defer broad
   redesigns, new concepts, and multi-sprint UX arcs.
6. **Do not hide server truth in the client.** If the frontend is confusing because an API or data
   record is wrong, fix the source or document the limitation.
7. **Provider/community link-up is a top suspect.** Audit whether members can understand the
   difference between provider availability, shared community membership, offers, dibs, and exchange
   trust.
8. **Name exact files at freeze.** Wildcard areas like `community/tabs/*` and `providers/*` are
   discovery hints only. Task 4 must replace them with an exact implementation file list before
   coding starts.
9. **Feed fixes must trace all query surfaces.** If feed filtering or browsable-request behavior is
   selected, search all request/feed query paths before patching; prior sprint memory warns the logic
   has lived in multiple places, including `services/request-service/src/utils/queryBuilder.ts`.
10. **Use the visual companion only where seeing helps.** Use it for layout/copy comparisons or visual
   state triage, not for textual requirement decisions.
11. **Demo data cleanup must be scripted.** No one-off edits on the demo database without a repeatable
   SQL/script artifact and before/after evidence.
12. **Every implemented repair needs a test.** UI state repairs get focused frontend tests; data/API
   repairs get service or SQL-backed tests.
13. **Docs stay in sync.** If behavior, navigation, or user-facing meaning changes, update source
   docs, generated landing docs, contexts, and onboarding copy where relevant.
14. **Version bump:** root `package.json` and `package-lock.json` move `11.7.0` -> `11.8.0`.

---

## Tester Accounts

Primary rich-state tester:

```text
maria.reyes@test.karmyq.com / password123
```

Known rich-state evidence from prior sprints:

- 15 active communities.
- 28 trust edges.
- 33 connections.
- 19 created requests.
- 418 responder matches.
- 704 requester-side matches.
- 4 provider profiles.
- Provider availability true.

Fallback simpler member tester:

```text
aisha.white6964@test.karmyq.com / password123
```

Previously confirmed as a plain member of Berkeley Community Care
(`ff54a7d5-fe01-45ad-b816-ecf4d3e9ee23`).

---

## Post-Deploy Validation Required

The plan ends with this human checklist:

1. Rich tester walkthrough as `maria.reyes@test.karmyq.com`: dashboard, community, provider, request,
   and trust/copy surfaces match the fixed/deferred decisions in the Sprint 99 audit log.
2. Fallback tester smoke as `aisha.white6964@test.karmyq.com`: simpler member state does not show
   false empty states, unsupported trust claims, or broken primary actions.
3. Landing first impression: `https://karmyq.org/`, `/join`, and `/docs` render selected landing
   repairs correctly and resize behavior remains stable.
4. API/data smoke if applicable: exact curl or SQL checks recorded for selected backend/data repairs
   still pass on demo after deploy.
5. Handoff update: final Sprint 99 status, deployed version, remaining deferred findings, and
   recommended Sprint 100 direction are written here.

---

## Multi-Sprint Arc

- **S92 (done):** Matching & Dibs Repair (v11.1.0).
- **S93 (done):** Provider<->Community link-up + carry-forward fixes (v11.2.0, PR #80).
- **S94 (done):** Error Contract Cleanup / ADR-074 (v11.3.0, PR #82).
- **S95 (done):** karmyq.org Multi-Route Relaunch (v11.4.0, PR #83).
- **S96 (done):** Founding-circle backend intake (v11.5.0, PR #84).
- **S97 (done):** Release Readiness Data Quality + Functional Bug Bash (v11.6.0, PR #86).
- **S98 (done):** Trust Truth Audit + Functional Repairs (v11.7.0, PR #87 per memory).
- **S99 (planned):** Release Experience Audit + Fine Tune (v11.8.0).
- **S100+ candidates:** founding-circle review/notify surface, platform-scoped service requests,
  broader provider/community UX, or research-first UI facelift.
- **Deferred:** Service Consolidation Phase 2 - geocoding -> client-side, 10->9 (ADR-071).
- **Deferred to post-rollout:** mobile parity.

---

## Persistent Context

### Multi-agent PR process - live on master

- `.github/pull_request_template.md` = the cross-agent PR contract.
- Master branch protection requires CI checks, 1 approving review, and Admin merge authority.
- Agents do not self-merge or push directly to `master`.
- Every task = one branch = one PR.
- When using `gh pr create`, manually copy `.github/pull_request_template.md` into the PR body.
- Cross-agent review protocol: the agent that did not author a plan/PR reviews it when two models
  are available.

### Architecture Gotchas

- **Landing page docs:** `apps/landing/src/data/docs/` is gitignored - `git add -f` when generated
  docs must be committed. Generated by `scripts/generate-docs.ts`; edit sources, never generated JSON.
- **ADR numbering:** ADR-077 shipped in S98; next free ADR = 078.
- **JWT field** is `communities`, not `communityMemberships`.
- **Schema is `communities.communities`** (plural schema name); auth tables are `auth.*`.
- **API response unwrap:** `createApiClient` interceptor already unwraps the envelope - use
  `res.data`, not `res.data.data`.
- **Error contract (ADR-074):** `{ success:false, message:string, error:string }`; use shared
  `sendError`/`sendValidationError`.
- **CORS on auth-service** is driven by `ALLOWED_ORIGINS` env (comma-separated origins).
- **trust_edges_live is a VIEW:** never INSERT/UPDATE it.
- **`git add` on CLAUDE.md:** tracked as lowercase `claude.md`.
- **Solo dev - no worktrees:** work directly on feature branches.
- **CI security gates:** dependency audit (ADR-059) + CodeQL (ADR-060) run on push.
- **request-forgery FP on `apps/frontend/src/lib/api.ts`** is a known recurring false positive.
- **request-service serves the feed** now (`/requests/feed`); there is no feed-service.

### Workflow Gotchas

- Every sprint runs testing, `/simplify`, `/code-review`, and `/security-review`.
- Every sprint updates docs; do not treat docs as optional.
- No docs-only push to `master`; every master push triggers a full deploy.
- nginx.conf changes take effect on the next deploy (deploy.sh copies + reloads).

### Deploy Drift Watch

`karmyq.org` live content has drifted from `master` before. Confirm the latest deploy succeeded and
live content matches `master` before judging by live content.
