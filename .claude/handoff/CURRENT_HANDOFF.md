# Sprint 103 - Governance + Intake Clarity - PR OPEN / REVIEW NEEDED

> **STATUS (2026-06-17):** Sprint 103 planning is complete. The maintainer approved the combined scope:
> repair split governance truth (BUG-011), lock service-vs-help action copy (BUG-012), and ship
> founding-circle review tooling without outbound notifications. Sprint 102 and its reconnect follow-up
> are merged and deployed (`298c9fc6`, `2745063`).
>
> **LOCAL STATE:** `scripts/founding-circle-submissions.sh` remains untracked user/local work. Do not
> stage, remove, or rewrite it unless the maintainer explicitly asks. This handoff was rewritten for
> Sprint 103 from the Sprint 102 deployed handoff.
>
> **REVIEW FOLLOW-UP (Claude, 2026-06-17):** plan reviewed as ready to execute. Three doc fixes were
> folded in: Task 3 now says to modify the existing `executeSplit` carry-forward loop in place (no second
> loop), the spec no longer leaves a status CHECK migration half-open, and pending offer copy keeps the
> existing ellipsis glyph (`Offering…` / `Offering service…`).
>
> **EXECUTION UPDATE (Codex, 2026-06-17):** implementation tasks 1-10 are complete on
> `feature/sprint-103-governance-intake-clarity`. Focused tests are green for split admin selection,
> request action copy, founding-circle review endpoints, and the admin review page. Docs/contexts/
> registry were updated and `apps/landing/src/data/docs/**` regenerated. Remaining work is focused
> verification, type checks, SDLC gates, commit, push, and PR. `scripts/founding-circle-submissions.sh`
> is still untracked local work and was not touched.
>
> **VERIFICATION UPDATE (Codex, 2026-06-17):** focused tests, service/frontend type checks,
> `npm run feedback:check`, `npm run analyze:services`, `npm audit --package-lock-only --audit-level=high`,
> `git diff --check`, process-reviewer, and root `npm test` are complete. Root `npm test` passes when
> `TEMP`/`TMP` point at a workspace temp directory; default `%LOCALAPPDATA%\Temp` and `C:\tmp` produced
> Jest cache permission errors in this sandbox. Root `npm run test:tdd` is not wired in Turbo; direct
> workspace TDD runs still expose older DB-backed/frontend TDD failures outside Sprint 103, while all
> Sprint 103 focused tests are green.
>
> **PR UPDATE (Codex, 2026-06-17):** commit `044bd4a8` was pushed and PR #96 is open:
> `https://github.com/ravichavali/karmyq/pull/96`. The PR body is filled with validation evidence.
> Formal `/code-review` is intentionally unchecked because the reviewer subagent hit a usage limit
> before returning findings; Claude/Admin review is required before merge. Do not self-merge.

---

## Quick Start

1. Read this handoff.
2. Check out branch: `git checkout -b feature/sprint-103-governance-intake-clarity`.
3. Open plan: `docs/superpowers/plans/2026-06-17-sprint-103-governance-intake-clarity.md`.
4. Review PR #96, run formal `/code-review`, address any findings, then Admin decides merge/deploy.

---

## Sprint Goal

Make Karmyq's split governance, provider/mutual-aid actions, and founding-circle intake feel truthful
and operable: no misleading inherited admins, no wrong "help/service" CTA language, and no black-box
submissions.

---

## Planning Artifacts

- Spec: `docs/superpowers/specs/2026-06-17-sprint-103-governance-intake-clarity-design.md`
- Plan: `docs/superpowers/plans/2026-06-17-sprint-103-governance-intake-clarity.md`

---

## Scope

### In Scope

- **BUG-011 split child admins:** `executeSplit` should no longer promote the executing parent admin into
  both children by default. Each child admin must be selected from that child's assigned members.
- **BUG-012 offer action copy:** centralize action labels so service asks say "Offer service" and
  mutual-aid asks say "Offer to Help" on both cards and detail pages.
- **Founding-circle review tooling:** add authenticated reviewer endpoints and a small admin page to list
  persisted submissions and mark them `new`, `reviewed`, `contacted`, or `archived`.
- **Targeted community/provider clarity:** update copy/docs around the touched service surfaces only.
- **Docs/context/registry:** update source docs, service contexts, frontend context, service registry, ADR-076,
  and regenerated landing docs.

### Out of Scope

- New platform-role schema or true platform-admin model.
- Outbound founding-circle email, Slack, webhook, queue event, or notification transport.
- Peer messaging, restored reconnect CTA, or directed-ask flow.
- New governance roles beyond existing `admin`/`member`.
- Broad provider/community redesign or UI facelift.
- Changes to trust/karma carry-forward during splits.

---

## Critical Implementation Notes

1. **Do not create a new platform-role system in Sprint 103.** Founding-circle reviewer permission is
   defined as any active community admin, matching the existing admin UI gate. A true platform role is a
   future architectural decision.
2. **Split child admins must be child-local.** The executing parent admin is not automatically inserted
   as admin into both children. Each child admin must be selected from that child's assigned members.
3. **Keep the `split_origin` link.** The relationship between child communities is preserved by
   `communities.community_links`, not by shared admin authority.
4. **Never leave a child adminless.** If no assigned parent admin exists for a child, promote the
   strongest assigned member by within-child trust degree with deterministic tie-breaks.
5. **Do not change trust/karma carry-forward semantics.** Sprint 103 changes roles only; within-group
   trust and karma copying from Sprint 86 stays intact.
6. **Centralize offer action copy.** Do not reintroduce inline `request_type === 'service'` label checks
   in multiple components.
7. **Service asks are not peer messaging.** Do not restore the Sprint 102 reconnect CTA or add direct
   peer messages as part of service/provider clarity.
8. **Founding-circle review is not notification.** No email, Slack, webhook, queue event, or outbound
   transport in this sprint.
9. **Use the ADR-074 error contract.** New auth-service review endpoints return string `error` codes.
10. **API interceptor unwraps envelopes.** Frontend callers should read `res.data`, not `res.data.data`.
11. **Editing `apps/frontend/src/lib/api.ts` can retrigger CodeQL `js/request-forgery`.** If it recurs,
    dismiss with the documented trusted env-baseURL rationale and re-run the gate.
12. **Docs are part of done.** Update source docs, service contexts, registry, frontend context, and
    regenerated landing docs in the same PR.

---

## Implementation Tasks

Follow the plan exactly:

1. Branch + context check.
2. TDD for child-local split admin selection.
3. Implement child-local split admins in `services/community-service/src/services/fissionService.ts`.
4. TDD for shared offer action copy.
5. Implement `apps/frontend/src/lib/requestActionCopy.ts` and consume it in request card/detail.
6. TDD for founding-circle review endpoints.
7. Implement auth-service list/update review endpoints.
8. TDD for founding-circle admin page.
9. Implement `/admin/founding-circle` and admin nav/API wrappers.
10. Update docs, contexts, registry, ADR-076, and regenerated landing docs.
11. Run focused verification.
12. Run SDLC gates: testing, `/simplify`, `/code-review`, `/security-review`, feedback, audit.
13. Final pre-push verification + PR.
14. Merge + deploy only after Admin authorization.

---

## Carry-Forward / Known Issues

- **BUG-011** is fixed on this branch and verified: split child admins are selected from assigned
  child members; executing parent admin is not inserted into both children by default.
- **BUG-012** is fixed on this branch and verified: offer action copy is centralized in
  `apps/frontend/src/lib/requestActionCopy.ts`.
- **Reconnect CTA remains deferred:** restore only after real peer messaging or a directed-ask flow exists.
- **Sprint 102 post-deploy UI validation still useful if not already done:**
  1. Profile memory shows with karma display off.
  2. Community graph memory legend renders.
  3. Community pulse says "N neighbours showed up for one another."
  4. `/about/memory` retention windows load.
- **Pre-existing security drift:** GitHub Dependabot previously showed 1 high advisory on default branch
  while local `npm audit --package-lock-only --audit-level=high` was clean. Track under ADR-059 SLA.

---

## Sprint 103 - Post-Deploy Validation

### 1. Split admin smoke test

Create or use an approved split where the executing parent admin is assigned to only one child, execute it,
then inspect both child communities.

Expected: executing admin is admin only in their assigned child; sibling child has one assigned member as
admin; siblings still have an active `split_origin` link.

### 2. Offer action copy smoke test

Open a mutual-aid ask and a service ask from both feed/card and detail.

Expected: mutual-aid surfaces say "Offer to Help"; service surfaces say "Offer service"; offering still
creates the same match.

### 3. Founding-circle review smoke test

Log in as an existing community admin and open `https://karmyq.com/admin/founding-circle`.

Expected: submissions load, status filter works, and marking a row reviewed/contacted/archived updates
the row without sending any notification.

### 4. API verification

```bash
curl -H "Authorization: Bearer $TOKEN" "https://karmyq.com/api/founding-circle/submissions?status=new" | jq '.data.items | length'
```

Expected: authenticated reviewer gets a numeric length; non-reviewer gets `403 FORBIDDEN`.

---

## Previous Sprint State

- **Sprint 102 (v11.11.0) deployed.** PR #94 squash `298c9fc6`.
- **Reconnect follow-up deployed.** PR #95 squash `2745063`; removed dead `/messages?to=<peerId>` CTA.
- **Sprint 101 (v11.10.0) deployed + validated by CI.** PR #92 squash `654937d5`.
- **PR #93 eligibility fix deployed.** Offer eligibility follows feed visibility boundary, not membership-only
  and not any-UUID. PR #93 squash `bbae8788`.
- Moderate dependency advisories remain within ADR-059 SLA; high/critical audit remains blocking.

---

## Multi-Sprint Arc

- **S97 (done):** Release Readiness Data Quality + Functional Bug Bash (v11.6.0).
- **S98 (done):** Trust Truth Audit + Functional Repairs (v11.7.0).
- **S99 (done):** Release Experience Audit + Fine Tune (v11.8.0).
- **S100 (done):** Pulse Truth + Feed Actionability (v11.9.0).
- **S101 (done):** Actionability + State Truth (v11.10.0).
- **S102 (done):** Visible Memory + Re-warm First Step (v11.11.0).
- **S103 (verified / PR-ready):** Governance + Intake Clarity (v11.12.0).
- **S104+ candidates:** reconnect CTA once a real target exists; broader community/provider link-up
  clarity; research-first UI facelift; member-controlled forget/export.
- **Deferred:** Service Consolidation Phase 2 (geocoding -> client-side, ADR-071); mobile parity.

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

- **Landing page docs:** `apps/landing/src/data/docs/` is gitignored - `git add -f` when generated docs
  must be committed. Generated by `scripts/generate-docs.ts`; edit sources, never generated JSON.
- **ADR numbering:** ADR-078 shipped in S100; next free ADR = **079** if this sprint needs one.
- **JWT field** is `communities`, not `communityMemberships`.
- **Schema is `communities.communities`** (plural schema name); auth tables are `auth.*`.
- **API response unwrap:** `createApiClient` interceptor already unwraps the envelope - use `res.data`,
  not `res.data.data`.
- **Error contract (ADR-074):** `{ success:false, message:string, error:string }`; use shared
  `sendError`/`sendValidationError`.
- **CORS on auth-service** is driven by `ALLOWED_ORIGINS` env (comma-separated origins).
- **trust_edges_live is a VIEW:** never INSERT/UPDATE it.
- **`git add` on CLAUDE.md:** tracked as lowercase `claude.md`.
- **Solo dev - no worktrees:** work directly on feature branches.
- **CI security gates:** dependency audit (ADR-059) + CodeQL (ADR-060) run on push.
- **request-forgery FP on `apps/frontend/src/lib/api.ts`** is a known recurring false positive.
- **request-service serves the feed** now (`/requests/feed`); there is no feed-service.
- **Pulse single source of truth:** `fetchCommunityPulse` feeds both the in-feed ActivityCard and
  `GET /pulse`.

### Workflow Gotchas

- Every sprint runs testing, `/simplify`, `/code-review`, and `/security-review`.
- Every sprint updates docs; do not treat docs as optional.
- No docs-only push to `master`; every master push triggers a full deploy.
- nginx.conf changes take effect on the next deploy (deploy.sh copies + reloads).
- `nav.json` silently reverts - always grep-verify after editing.
- Widely-rendered components using `useRouter` need the global `apps/frontend/jest.setup.js` router mock.
  Do not patch many test files with duplicate router mocks.

### Deploy Drift Watch

`karmyq.org` live content has drifted from `master` before. Confirm the latest deploy succeeded and live
content matches `master` before judging by live content.
