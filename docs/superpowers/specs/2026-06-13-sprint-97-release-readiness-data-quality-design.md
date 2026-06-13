# Sprint 97: Release Readiness Data Quality + Functional Bug Bash - Design Spec

**Date**: 2026-06-13
**Status**: Approved
**Version**: v11.5.0 -> v11.6.0
**Sprint Branch**: `feature/sprint-97-release-readiness-data-quality`

---

## Overview

Sprint 96 shipped the founding-circle backend intake and moved the platform to v11.5.0. Sprint 97
is the final release-readiness week before launch, so the highest value work is not a new admin
surface: it is making sure the demo path a new user naturally tries is truthful, stable, and
complete. The founding-circle admin review UI stays deferred because submissions can be queried
directly from `auth.founding_circle_submissions` for release week.

This sprint is an audit-first bug bash over the first-run product path: signup/login, joining or
creating a community, dashboard bootstrap, feed browsing, request creation, dibs/matching, provider
offers, community pages, and the landing/docs handoff. It starts with live demo data-quality queries
and UI/API smoke checks, then fixes the highest-risk bugs found. Three already-observed issues are
named acceptance items: the dashboard's false zero-community state, the community pulse naming a
helper who is not a member of that community, and the feed's ambiguous terminal state after "Show
more open requests."

The sprint should also produce a durable answer to a practical demo need: identify and document a
well-connected tester account with rich state. The current best candidate from the live demo DB is
`maria.reyes@test.karmyq.com` / `password123`, with 15 active communities, 28 trust edges, 33
connections, 19 created requests, 418 responder matches, 704 requester-side matches, and four
provider profiles with availability enabled.

### Core Principle: The demo must not lie

Release readiness means a new user can trust what the UI says: membership state, helper names,
feed completion, and community data must reflect the database without refreshes, cross-community
bleed, or ambiguous dead ends.

---

## Multi-Sprint Arc

### Sprint 95 - karmyq.org Multi-Route Relaunch (complete, v11.4.0)
Public landing routes and founding-circle positioning shipped.

### Sprint 96 - Founding-Circle Backend Intake (complete, v11.5.0)
Public persisted founding-circle submission endpoint shipped in auth-service. Admin review UI and
notification transport were deferred.

### Sprint 97 - Release Readiness Data Quality + Functional Bug Bash (this sprint, v11.6.0)
Audit and repair first-run demo bugs and demo data quality before release. Admin review stays
deferred because direct DB queries are sufficient for launch week.

### Sprint 98+ - Founding-Circle Review / Notify or Post-Release Polish (upcoming)
Depending on release feedback: add submission notification transport, authenticated review tooling,
or continue post-release UX hardening.

---

## Release-Critical Flows

The sprint validates these flows end-to-end on local code and the deployed demo:

1. Signup and login.
2. Join an existing community and create a new community.
3. Dashboard load for users with one community, many communities, and no communities.
4. Create a help request from the dashboard wizard.
5. Browse the home feed, use "Show more open requests," and reach a finite terminal state.
6. Use dibs/matching and decision-band actions where seeded data allows.
7. Use provider offer flows where seeded data allows.
8. Open community pages, People, Home pulse, How we're connected, and Stewardship access boundaries.
9. Confirm landing/docs handoff pages still route correctly from `karmyq.org` to `karmyq.com`.

---

## Named Bugs / Acceptance Items

### BUG-097-001 - Dashboard false zero-community state

**Observed:** Users who are in multiple communities sometimes see "You haven't joined a community
yet"; refresh fixes it.

**Likely source:** `apps/frontend/src/pages/dashboard.tsx` sets `loading=false` after starting
`fetchCommunities(parsedUser.id)`, while `fetchCommunities` also owns loading. This permits a
render with `user` set and `userCommunities=[]` before the membership fetch resolves.

**Acceptance:** A user with memberships never sees the zero-community empty state before the
membership request finishes. A fetch failure shows the existing retry banner, not the false empty
state.

### BUG-097-002 - Community pulse helper names bleed across membership truth

**Observed:** `https://karmyq.com/communities/12dbd705-8c7a-4ba8-a8d2-fcf1aee4e27f` (`Test 1`)
rendered "thanks to David Park, Kwame Rodriguez, Chen Johansson," but `Chen Johansson` was not in
the member list for that community.

**Live DB facts from planning:** `Test 1` has `current_members=65` and 65 active member rows, so
the counter itself is consistent. `Chen Johansson` exists globally
(`chen.johansson2568@test.karmyq.com`) and is active in `Test 2` plus other communities, but not
in `Test 1`.

**Likely source:** `fetchCommunityPulse()` in `services/request-service/src/routes/requests.ts`
selects recent helpers from completed matches joined only through `requests.request_communities`
and `auth.users`; it does not require `m.responder_id` to still be an active member of the
community whose pulse is being rendered.

**Acceptance:** The community pulse only names helpers who are active members of the community at
render time, or explicitly labels the row as cross-community help if the product chooses that
meaning. For release, prefer the safer member-only fix.

### BUG-097-003 - Feed terminal state after "Show more open requests"

**Observed:** The feed ends after "Show more open requests" without a clear "no more" state.

**Likely source:** `UnifiedFeed.tsx` shows a terminal empty state when no request cards exist, but
does not render a finite "that's everyone" note when request cards exist and the widened
`minScore=0` feed has simply ended.

**Acceptance:** After widening the feed, the bottom of the feed clearly says there are no more
open asks to show. The copy must not appear before the user chooses "Show more open requests."

---

## Data Quality Audit

Sprint 97 begins with a repeatable audit script or documented SQL checklist that answers:

- Do `communities.communities.current_members` values match active `communities.members` rows?
- Are any community pulse recent helpers not active members of the pulse community?
- Are there active members whose JWT/local user state can go stale after join/create?
- Are open requests attached to active communities through `requests.request_communities`?
- Are feed-visible requests excluded when the viewer is already engaged as responder?
- Are provider profiles and provider offers coherent enough for a release demo?
- Which seeded account is best for a rich tester walkthrough?

The audit should write findings to a sprint bug log and, for data repairs, include idempotent SQL
or a small script rather than manual one-off edits.

---

## Data Model

No new product table is planned.

Potential migration/script only:

```sql
-- If the audit finds counter drift, repair current_members from active membership rows.
UPDATE communities.communities c
SET current_members = counts.active_count
FROM (
  SELECT community_id, COUNT(*)::int AS active_count
  FROM communities.members
  WHERE status = 'active'
  GROUP BY community_id
) counts
WHERE counts.community_id = c.id
  AND c.current_members IS DISTINCT FROM counts.active_count;
```

If the audit finds release-blocking demo data drift that cannot be fixed by application logic, add
an idempotent migration under `infrastructure/postgres/migrations/` and mirror any schema-affecting
change in `infrastructure/postgres/init.sql`. Do not add schema for the founding-circle admin
surface in this sprint.

---

## API Endpoints

No new endpoint is required by default.

Modified behavior:

| Method | Path | Service | Change |
|---|---|---|---|
| GET | `/requests/community/:communityId/pulse` | request-service | Recent helper names must be scoped to active members of `:communityId` unless deliberately labeled as cross-community. |
| GET | `/requests/curated` | request-service/frontend consumer | Feed response may stay unchanged; frontend terminal copy should make the widened feed finite and clear. |
| GET | `/communities/my/communities` | community-service/frontend consumer | Dashboard should wait for this response before deciding whether the user has no communities. |

---

## Frontend Changes

- `apps/frontend/src/pages/dashboard.tsx`
  - Separate auth/session loading from community-membership loading, or otherwise prevent the
    zero-community empty state until `getMyCommunities` has completed.
  - Keep the retry banner for actual fetch failures.

- `apps/frontend/src/components/Feed/UnifiedFeed.tsx`
  - Add a post-"Show more" terminal note after the rendered request cards when `showingMoreOpen`
    is true.
  - Ensure this does not appear while loading, on errors, for filtered views, or before the widen
    action.

- Community page surfaces
  - Confirm `CommunityPulse` renders the fixed helper set from the server.
  - Avoid client-side filtering of server data unless used only as defensive display cleanup.

- Landing/docs handoff
  - Verify `karmyq.org` first-run routes still point users to the working app and docs without
    dead ends after the Sprint 96 intake changes.

---

## User Guide & Doc Updates

Docs are mandatory this sprint even though this is a bug/data-quality release.

Update source docs, then regenerate landing docs from `scripts/generate-docs.ts`:

- `docs/guides/getting-started-guide.md`
  - Add or tighten a short release-demo walkthrough: create account, join community, create ask,
    browse feed, respond to help.

- `docs/guides/demo-data.md`
  - Document the recommended rich tester account:
    `maria.reyes@test.karmyq.com` / `password123`.
  - Add the data-quality checklist used in this sprint, including membership count drift, pulse
    helper membership, feed terminal state, and provider flow readiness.

- `docs/guides/dashboard-home.md`
  - Update feed terminal behavior after "Show more open requests."

- `docs/guides/finding-communities-guide.md`
  - Clarify that the dashboard waits for memberships before showing the no-community state.

- `apps/frontend/src/lib/onboarding/workflows.ts`
  - Update any feed/community onboarding copy affected by the new finite terminal copy if needed.

- Landing generated docs
  - Run the docs generator through the existing build/prebuild path and force-add changed generated
    docs under `apps/landing/src/data/docs/`.

No ADR is required unless the audit discovers a new architectural decision. If an ADR is needed,
the next number is ADR-077.

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
8. **Robust tests are required.** Cover the actual bug conditions: async dashboard community load,
   non-member helper excluded from pulse, and widened feed terminal copy.
9. **Use live demo validation at the end.** The human checklist must hit API, DB, and UI on
   `karmyq.com` after deploy.
10. **Version bump:** root `package.json` and `package-lock.json` move `11.5.0` -> `11.6.0`.

---

## Success Criteria

- Release-critical first-run flows pass local tests and live smoke validation.
- The dashboard no longer flashes a false no-community state for multi-community users.
- Community pulse helper names are scoped to active community members.
- The feed has a clear terminal state after widening.
- A repeatable data-quality audit exists and identifies the recommended tester account.
- Required docs and landing generated docs are updated.
- `npm test`, `npm run test:tdd`, `npm run feedback:check`, type checks, audit, `/simplify`,
  `/code-review`, and `/security-review` all complete before merge.
