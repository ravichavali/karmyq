# Sprint 97 - Release Readiness Data Quality + Functional Bug Bash - IMPLEMENTED, pending review + merge (v11.5.0 -> v11.6.0)

> **STATUS (2026-06-13, execution):** Implementation tasks 1–10 are complete on
> `feature/sprint-97-release-readiness-data-quality`. The live demo audit ran (read-only) and is
> recorded in `docs/bugs/sprint-97-release-readiness.md`. All three named bugs are fixed with
> tests; the membership-count drift repair migration is written; docs + landing docs are
> regenerated; version is bumped to `11.6.0`. Remaining: SDLC quality gates (Task 11), final
> verification (Task 12), and PR/merge/deploy + post-deploy validation (Tasks 13–14).
>
> **Audit outcome:** BUG-097-002 confirmed pervasive (186 non-member-helper pairs). Membership
> drift on 10 fission-parent communities → idempotent repair migration
> `infrastructure/postgres/migrations/20260613-demo-data-quality-repair.sql`. The "730 orphaned open
> requests" the audit query flagged were a FALSE ALARM: split/merged communities keep full active
> membership and the feed doesn't filter by community status, so those requests stay visible — no
> fix needed. `helpedThisWeek` adopted member-only semantics. Primary tester `maria.reyes` confirmed.

> **Prior status (planning):** Sprint 96 is merged on `master` as `9fb3308` / PR #84 and version
> `11.5.0`. Sprint 97 is an audit-first release-readiness sprint focused on demo data quality and
> first-run functional bugs before release week. The founding-circle admin review screen is
> explicitly deferred because submissions can be queried directly from the DB for launch.

**Branch:** `feature/sprint-97-release-readiness-data-quality` (create from `master`).

**Spec:** `docs/superpowers/specs/2026-06-13-sprint-97-release-readiness-data-quality-design.md`

**Plan:** `docs/superpowers/plans/2026-06-13-sprint-97-release-readiness-data-quality.md`

---

## Quick Start

1. Read this handoff.
2. Check out branch: `git checkout -b feature/sprint-97-release-readiness-data-quality`.
3. Open plan: `docs/superpowers/plans/2026-06-13-sprint-97-release-readiness-data-quality.md`.
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development).

---

## Sprint Goal

Make the release demo path truthful and stable by auditing live/demo data quality, fixing the
highest-risk first-run bugs, documenting a rich tester account, and validating the full
signup-to-help flow before v11.6.0 deploy.

---

## Scope

Release-critical flows:

- Signup/login.
- Join existing community and create community.
- Dashboard load for users with one community, many communities, and no communities.
- Create request from the dashboard wizard.
- Browse the home feed, use "Show more open requests," and reach a finite terminal state.
- Use dibs/matching and decision-band actions where seeded data allows.
- Use provider offer flows where seeded data allows.
- Open community pages, People, Home pulse, How we're connected, and Stewardship access boundaries.
- Confirm landing/docs handoff routes still work.

Explicitly deferred:

- Founding-circle admin review surface.
- Email/Slack notification transport for founding-circle submissions.
- Broad redesign work unrelated to release-blocking bugs.

---

## Named Bugs / Acceptance Items

### BUG-097-001 - Dashboard false zero-community state

Users who are in multiple communities sometimes see "You haven't joined a community yet"; refresh
fixes it. Likely source is `apps/frontend/src/pages/dashboard.tsx` setting render-ready/loading
state before `fetchCommunities(parsedUser.id)` resolves.

Acceptance: users with memberships never see the zero-community empty state before membership fetch
completion; real fetch failure shows the retry banner, not the false empty state.

### BUG-097-002 - Community pulse helper names bleed across membership truth

Reported page:
`https://karmyq.com/communities/12dbd705-8c7a-4ba8-a8d2-fcf1aee4e27f` (`Test 1`) rendered
"thanks to David Park, Kwame Rodriguez, Chen Johansson," but Chen was not visible in that
community's member list.

Planning DB checks found:

- `Test 1` has `current_members=65` and 65 active member rows, so the counter itself is consistent.
- `Chen Johansson` exists globally as `chen.johansson2568@test.karmyq.com`.
- Chen is active in `Test 2` and multiple other communities, but not in `Test 1`.

Likely source: `fetchCommunityPulse()` in `services/request-service/src/routes/requests.ts`
selects recent helpers through completed matches and `requests.request_communities`, but does not
require `m.responder_id` to be an active member of the pulse community.

Acceptance: recent helper names are active members of the community being rendered, or explicitly
labeled as cross-community help. For release, prefer the safer member-only fix. Also choose and
document the visible `helpedThisWeek` semantics so the pulse does not say neighbours helped each
other while naming zero qualifying helpers.

### BUG-097-003 - Feed terminal state after "Show more open requests"

After widening the feed with "Show more open requests," the feed ends without clear "no more"
copy.

Acceptance: after `showingMoreOpen`/`minScore=0`, the bottom of the feed clearly says everyone/no
more open asks are shown. It must not appear before the user clicks Show more.

---

## Tester Accounts

Primary rich-state tester:

```text
maria.reyes@test.karmyq.com / password123
```

Live demo evidence from planning query:

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

## Critical Implementation Notes

1. **Audit first.** Do not jump straight into the three known fixes before running the release
   data-quality queries; the point of Sprint 97 is to find launch-risk bugs, not only fix the
   examples already noticed.
2. **No founding-circle admin screen in this sprint.** Direct DB queries are sufficient for release
   week; keep this sprint on data quality and functional demo bugs.
3. **Tester account:** use `maria.reyes@test.karmyq.com` / `password123` as the primary rich-state
   tester unless the audit finds it broken. Keep `aisha.white6964@test.karmyq.com` / `password123`
   as a simpler member-only fallback.
4. **Dashboard bug is a loading-state bug until proven otherwise.** Fix the false empty state at
   the frontend state boundary; do not paper over it with a timeout.
5. **Pulse helper names must not lie.** Prefer joining `communities.members` on
   `m.responder_id = members.user_id`, `members.community_id = $1`, `members.status='active'`.
6. **Data repairs must be idempotent.** If demo data needs repair, write SQL that can run twice
   safely and document exactly what it changes.
7. **Do not hand-edit generated landing docs.** Update `docs/guides/*` and `scripts/generate-docs.ts`
   if needed; generated `apps/landing/src/data/docs/*` is wiped by the generator and must be
   committed with `git add -f` when changed.
8. **Robust tests are required.** Frontend component tests belong in `apps/frontend/tests/tdd/*.test.tsx`
   and run with `cd apps/frontend && npm run test:tdd`; root `tests/tdd` is for root harness tests,
   not jsdom component rendering. Cover the actual bug conditions: async dashboard community load,
   non-member helper excluded from pulse, and widened feed terminal copy.
9. **Use live demo validation at the end.** The human checklist must hit API, DB, and UI on
   `karmyq.com` after deploy.
10. **Version bump:** root `package.json` and `package-lock.json` move `11.5.0` -> `11.6.0`.

---

## Post-Deploy Validation Required

The plan ends with a human checklist:

1. Login with `maria.reyes@test.karmyq.com` / `password123`; dashboard must not flash the false
   no-community state.
2. Open `Test 1`; pulse must not name `Chen Johansson` unless he is now an active member of that
   exact community.
3. Click **Show more open requests**; feed bottom must clearly say no more/everyone is shown.
4. API-smoke `GET /api/requests/community/:id/pulse`; all recent helper names must be active
   members of the community.
5. Re-run `scripts/audit-demo-data.sql` on the demo DB; release-blocking drift must be fixed or
   explicitly deferred in `docs/bugs/sprint-97-release-readiness.md`.

---

## Multi-Sprint Arc

- **S92 (done):** Matching & Dibs Repair (v11.1.0).
- **S93 (done):** Provider<->Community link-up + carry-forward fixes (v11.2.0, PR #80).
- **S94 (done):** Error Contract Cleanup / ADR-074 (v11.3.0, PR #82).
- **S95 (done):** karmyq.org multi-route relaunch + logo fix (v11.4.0, PR #83).
- **S96 (done):** Founding-circle backend intake (v11.5.0, PR #84).
- **S97 (planned):** Release Readiness Data Quality + Functional Bug Bash (v11.6.0).
- **S98+ (deferred):** Founding-circle notify/review surface or post-release UX hardening.
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
- **ADR numbering:** ADR-076 shipped in S96; next free ADR = 077.
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
