# Sprint 102 - Visible Memory + Re-warm First Step - READY TO EXECUTE

> **STATUS (2026-06-16):** Sprint 102 is planned and ready for implementation on
> `feature/sprint-102-visible-memory-rewarm`. Sprint 101 and PR #93 are merged and deployed on
> karmyq.com. This sprint should productize the existing Sprint 90 forgetting/decay surfaces without
> new schema, new endpoints, or new decay math.
>
> **Important local state:** `docs/BUGS.md` was already modified before Sprint 102 planning. Treat it as
> user/local work unless the implementer explicitly decides to fold it into Sprint 102.

---

## Quick Start

1. Read this handoff.
2. Check out branch: `git checkout feature/sprint-102-visible-memory-rewarm` (or `git checkout -b feature/sprint-102-visible-memory-rewarm` if it does not exist locally).
3. Open plan: `docs/superpowers/plans/2026-06-16-sprint-102-visible-memory-rewarm.md`.
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development).

---

## Sprint Goal

Make Karmyq's "designed to forget" promise visible and trustworthy in Profile, community trust, and
weekly pulse surfaces while keeping counts humane rather than accounting-like.

---

## Planning Artifacts

- Spec: `docs/superpowers/specs/2026-06-16-sprint-102-visible-memory-rewarm-design.md`
- Plan: `docs/superpowers/plans/2026-06-16-sprint-102-visible-memory-rewarm.md`

---

## Scope

### In Scope

- **Profile memory as first-class surface:** `MemorySection` should render relationship memory for the
  selected community even when karma display is off, and explain active/fading/nearly-forgotten bonds in
  readable text.
- **Re-warm first step:** `ReWarmingNudge` remains self-suppressed unless there are nearly-forgotten
  bonds, then offers one gentle reconnect action with optional, non-punitive copy.
- **Community trust memory legend:** the "How we're connected" tab should explain why some bonds look
  softer and what nearly-forgotten means.
- **Community pulse copy:** keep `helpedThisWeek` count semantics unchanged, but reframe the row from
  "N neighbours helped each other" to "N neighbours showed up for one another" (or equivalent final copy)
  so the count reads as care/evidence, not accounting.
- **Docs/onboarding/context:** update memory guide, designed-to-forget concept, community-home concept,
  reading-the-trust-graph concept, onboarding copy, frontend context, and regenerated landing docs.

### Out of Scope

- New retention policy or schema changes.
- Per-item delete/export controls.
- New endpoints or API contracts.
- New notifications, automated reminders, or engagement campaigns.
- Broad profile redesign.
- Trust graph algorithm or visualization rewrite.
- New decay math or community-tunable decay bands.

---

## Critical Implementation Notes

1. **No new decay math.** Use existing `decayTier` values and `decayPresentation`; do not duplicate or
   reinterpret `classifyDecayTier` thresholds in frontend code.
2. **`trust_edges_live` is read-only.** It is a VIEW. Sprint 102 must not write to it or add a decay job.
3. **Memory must not depend on karma visibility.** The profile memory section should render relationship
   memory for a selected community even when the member has not enabled "Show My Karma."
4. **Counts are evidence, not scoreboards.** Keep truthful counts, but phrase them as signs of care and
   community memory. Do not add leaderboard, streak, productivity, or engagement language.
5. **Re-warm is optional and gentle.** A nearly-forgotten bond may be let go. Copy must not imply failure,
   penalty, or urgency manipulation.
6. **No notification or messaging expansion.** Keep the existing `/messages?to=` reconnect action unless
   implementation discovers it is broken; do not add automated reminders.
7. **Fading must be text-legible.** Opacity alone is not enough. Add readable labels/explanations for
   fading and nearly-forgotten states.
8. **Do not scatter router mocks.** Preserve the global `apps/frontend/jest.setup.js` `next/router` mock;
   use per-test mocks only when a custom query or spy is needed.
9. **Avoid unsafe localStorage parsing.** If touching profile localStorage reads, wrap JSON parsing or use
   existing guarded patterns.
10. **Docs are part of done.** User guides, concept pages, onboarding, frontend context, and generated
    landing docs ship with the sprint.
11. **Generated landing docs are gitignored.** After regeneration, use `git add -f` for changed
    `apps/landing/src/data/docs/*` files that must be committed.
12. **Known CodeQL false positive.** Editing `apps/frontend/src/lib/api.ts` can re-trigger the recurring
    `js/request-forgery` false positive on trusted `NEXT_PUBLIC_API_URL` base URLs. Avoid api.ts edits
    unless necessary; if it recurs, dismiss with the documented false-positive rationale and re-run.

---

## Carry-forward from Sprint 101

- Post-deploy UI validation from Sprint 101 was still listed in the previous handoff:
  1. Dashboard Home shows pending offered items, each linking to detail.
  2. A community open ask opens `/requests/[id]` with details + action.
  3. Offering from detail moves it to awaiting response / Helping.
  4. Expanding a completed Asks item does not say "No offers yet."
  5. Direct/forged API offer on expired-open or out-of-audience ask returns 400/403, and duplicate offer
     returns 409.
- PR #93 deploy re-triggered known CodeQL `js/request-forgery` false positives in
  `apps/frontend/src/lib/api.ts` after nearby edits. If api.ts is edited and these recur, dismiss as the
  documented trusted-env-baseURL false positive and re-run the gate.
- Moderate dependency advisories remain within ADR-059 SLA; high/critical audit remains blocking.

---

## Sprint 102 - Post-Deploy Validation

### 1. Profile memory smoke test

Login:

```text
maria.reyes@test.karmyq.com / password123
```

Open `https://karmyq.com/profile`.

Expected: memory section appears for a selected community even if karma display is hidden; fading and
nearly-forgotten states have readable text; `/about/memory` link works.

### 2. Community trust smoke test

Open one of Maria's communities, then **How we're connected**.

Expected: graph area shows "How memory fades" legend; any re-warm nudge is gentle and optional; graph
still renders.

### 3. Community pulse copy check

Open a community Home with weekly help activity.

Expected: helped row says "N neighbours showed up for one another"; zero helped rows remain hidden;
open asks row still links to `/communities/:id/open-asks`.

### 4. Retention transparency check

Open `https://karmyq.com/about/memory`.

Expected: retention windows load; page still says private details are anonymized/deleted while aggregates
are kept.

---

## Previous Sprint State

- **Sprint 101 (v11.10.0) deployed + validated by CI.** PR #92 merged (squash `654937d5`).
- **PR #93 eligibility fix deployed.** Offer eligibility now follows feed visibility boundary, not
  membership-only and not any-UUID. PR #93 merged (squash `bbae8788`).
- What shipped: offered-awaiting Home item preview, canonical request detail action page, lifecycle-true
  Asks copy, community open-asks action path, deterministic community-depth ring ordering, and
  write-path offer eligibility enforcement.
- Verification from previous handoff: `npm test` pass; frontend and request-service type checks clean;
  audit high gate clean; known unrelated TDD failures persisted on `master`.

---

## Multi-Sprint Arc

- **S97 (done):** Release Readiness Data Quality + Functional Bug Bash (v11.6.0).
- **S98 (done):** Trust Truth Audit + Functional Repairs (v11.7.0).
- **S99 (done):** Release Experience Audit + Fine Tune (v11.8.0).
- **S100 (done):** Pulse Truth + Feed Actionability (v11.9.0).
- **S101 (done):** Actionability + State Truth (v11.10.0).
- **S102 (planned):** Visible Memory + Re-warm First Step (v11.11.0).
- **S103+ candidates:** community/provider link-up clarity; founding-circle review/notify surface;
  research-first UI facelift; member-controlled forget/export.
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

