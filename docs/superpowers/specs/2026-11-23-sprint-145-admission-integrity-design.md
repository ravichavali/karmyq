# Sprint 145: Admission integrity — Design Spec

**Date**: 2026-11-23

**Status**: Draft — scope approved; design awaiting maintainer approval

**Version**: Current master v11.117.0; Sprint 145 version unallocated (no version edits authorized)

**Sprint Branch**: `agent/claude/sprint-145-planning`

**Scope approval**: BUG-106 + BUG-108; BUG-107 deferred (maintainer, 2026-11-23)

## Overview

An invitation must not be recorded as accepted when the invitee cannot join, and creating a community that already
exists must not tell a blocked or pending applicant that they joined. Sprint 144 made the database own the active
member count (ADR-106); these two admission paths still need consistent membership decisions around that count.

BUG-106 is fixed by making invitation consumption, membership admission, user attribution and the existing inviter
statistics trigger one transaction. BUG-108 is fixed by classifying the caller's actual membership inside the
duplicate-create transaction. Admission checks the community's live state and authoritative post-write capacity.
Existing active membership stays idempotent; a rejoin resets a former staff role to ordinary member.

### Core principle: acceptance describes committed membership

A success response represents an active membership at the operation's transaction boundary; a refused admission
leaves membership, count, invitation consumption and attribution unchanged.

## Scope and non-goals

- In scope: `POST /invitations/accept` (BUG-106), the existing-public-community branch of `POST /communities`
  (BUG-108), tests and the documentation feedback loop.
- Preserve invitation admission to private communities as active membership. This is an explicit compatibility
  proposal, not a newly granted policy: the current invitation insert defaults to active regardless of access type.
- Preserve duplicate-create's private-community pointer response (`existing: true`, `joined: false`) without writes.
- BUG-107 staff direct-add consent stays deferred. Do not retire or repurpose that endpoint or its fixture callers.
- No dependency/lockfile work, shared-package extraction, new endpoint, schema change, data repair or new ADR number.
- Normal join, staff handlers, governance, fission/fusion capacity and new-community creation remain outside this
  change, except necessary existing-test fixture corrections. Do not refactor those handlers during this sprint.
- Version, merge, deploy, demo data reads/writes and remote disposable test infrastructure remain unallocated.
  Earlier Sprint 144 permissions do not carry forward.

## Verified current behavior

References below describe the source read on branch HEAD `8471a6a7`, based on master `71773476`. Line numbers are
pre-implementation evidence, not future line assignments.

| Evidence | Consequence |
|---|---|
| `services/social-graph-service/src/routes/invitations.ts:110`, `:135`, `:144`, `:155` use separate `pool.query` calls | Acceptance and attribution can persist before membership; no capacity check and no transaction. |
| `services/community-service/src/routes/communities.ts:454`, `:458`, `:484` | Duplicate-create already has a capacity transaction but reports `joined: true` even after a conflict no-op. |
| `services/community-service/src/utils/memberLifecycle.ts:4` | Existing classifier distinguishes absent, active, pending, left and staff-only states. Unknown/NULL states must fail closed. |
| `services/community-service/src/routes/members.ts:143`, `:155`, `:168` | Ordinary join classifies membership, resets left rows to member, and checks capacity after an active write. Its pre-classification full check is not copied into idempotent no-op paths. |
| `services/community-service/src/database/memberCapacity.ts:28` | Capacity refuses `current_members > max_members` after the admitting write on the same transaction client. |
| `infrastructure/postgres/migrations/20261119-community-member-count-trigger.sql:14` | Member changes drive the counter; retain the existing member-before-community lock order. |
| `infrastructure/postgres/init.sql:220`, `:939`, `:3156` | Acceptance updates inviter statistics through a trigger; invitation rows can have NULL community/invitee IDs; the inviter/invitee/community triple is unique. |
| `services/social-graph-service/src/database/liveRole.ts:15` | The existing live-role helper currently uses the pool; a transaction-aware use needs an optional query argument. |
| `apps/frontend/src/pages/invite/[code].tsx:99`, `:103`, `:120`, `:126` | Web accepts, re-logs in for memberships, then arrives; acceptance/session-refresh failure instead routes to discovery after registration. |
| `apps/frontend/src/pages/communities/new.tsx:197`, `:201`, `:205` | Web stores a returned token and navigates on success; errors render the server message. |
| `tests/integration/social-graph.test.ts:103` | An existing acceptance test uses an already-active invitee. Preserve that successful acceptance contract. |
| `tests/jest.integration.config.js:38`, `.github/workflows/ci.yml:323` | The blocking CI integration runner discovers root `tests/integration/*.integration.test.ts`; service integration directories alone are insufficient. |

## Approaches

1. **Recommended: two service-local transaction fixes.** Keep invitation acceptance in social-graph-service and
   duplicate-create in community-service. Reuse the existing community membership classifier and capacity helper
   locally. Social-graph uses equivalent explicit membership decisions and a post-write capacity read on its own
   client, with table-driven parity tests. This is a modest amount of repeated policy but keeps service ownership
   and requires no shared-package or deployment contract change.
2. **Shared admission package or internal service call.** Centralize all admission paths now. This would add shared
   exports or a network contract, touch the ordinary join/staff paths, and complicate atomic invitation attribution.
   Defer until a broader admission refactor is scoped.
3. **Only add a pre-insert capacity read and filter the success response.** This leaves races, consumed failed
   invitations and inconsistent membership state. It does not meet the goal.

The maintainer approved the bug scope. The detailed choices below are the author's proposed design and await
approval; scope approval is not recorded as approval of these choices.

## Membership decisions

Decide from the row locked on the operation's transaction client, never JWT community claims. IDs come from the
verified caller and the stored invitation/community identity. Any caller-supplied community or invitee override is
ignored. A missing row and a row whose `status` is NULL are distinct inputs.

| Existing invitee/caller membership | Invitation acceptance | Duplicate-create, existing public community |
|---|---|---|
| No row | Insert active ordinary member; check capacity; consume invitation | Insert active ordinary member; check capacity; return `joined: true` |
| `left` | Change to active ordinary member; reset join timestamp/request message; check capacity; consume | Same rejoin; return `joined: true` |
| `active` | Consume an unused invitation; preserve membership role, timestamp and count | Idempotent success, `joined: true`; preserve role, timestamp and count |
| `pending` | 409 `CONFLICT`; do not approve or consume | 409 `CONFLICT`; do not approve; no token |
| `inactive` | 409 `MEMBERSHIP_RESTORE_REQUIRES_STAFF`; no changes | Same refusal; no token |
| NULL or another stored status | Same fail-closed 409 as inactive | Same fail-closed 409 as inactive |

An active no-op succeeds even when a community is full or already over its cap; it admits nobody. A new/rejoining
member is refused when the post-write stored count exceeds the current cap. Private duplicate-create is always
the existing pointer response, regardless of caller membership; it does not consume an invitation or request access.

### Invitation-specific rules

- Authentication is required. Body `invitation_code` must be a nonempty string; malformed input is 400 before SQL.
  Lookup uses the supplied stored-code spelling, without inventing a new code format or expiry policy.
- Lock the invitation row before checking acceptance. Any already-used code is still 400, for the same user too;
  no idempotent replay of a consumed invitation. Use `INVITATION_ALREADY_USED` as the ADR-074 code.
- Missing code is 404 `NOT_FOUND`. A stored NULL/missing community is also refused (404 `NOT_FOUND`), with no
  acceptance/attribution write. An inactive community gives 400 `COMMUNITY_INACTIVE`.
- Refuse accepting one's own invitation (400 `VALIDATION_ERROR`), and refuse an unaccepted invitation explicitly
  bound to a different invitee (403 `FORBIDDEN`). Compare UUID identities canonically or in SQL, not raw differently
  cased strings.
- Require the inviter's live active membership in the stored community (403 `FORBIDDEN` if absent/inactive).
  This applies ADR-102 to the invitation's admission authority. A stale JWT or a membership in another community
  never supplies that authority. Any active role may invite; no new admin-only policy is introduced.
- Preserve the existing successful-acceptance attribution behavior: write the invitee's `auth.users.invited_by` and
  `invitation_accepted_at`, including for an already-active invitee. Attribution redesign, first-inviter locking and
  invitation generation/validation policy are separate work. A refused acceptance changes neither field.

## Transaction design

### BUG-106: invitation acceptance

Implement with one checked-out social-graph pool client and BEGIN/COMMIT/ROLLBACK. A local helper may contain this
operation; it must not import another service's pool or source. Add an optional query function to the existing
social-graph `getLiveRole` helper so its default callers stay unchanged and the acceptance check uses this client.

1. Validate input and caller identity, then BEGIN and select the invitation by code `FOR UPDATE`. Read all fields
   needed for used/self/bound-invitee checks. Refusals must throw a typed outcome or explicitly roll back; never
   commit on an error sentinel by accident.
2. Read the community's current metadata without locking; refuse NULL/missing communities as 404 and inactive
   communities as 400 before the inviter check. Then lock the inviter's and invitee's existing community membership
   rows together, `ORDER BY user_id FOR UPDATE`,
   with explicit stored `community_id`. Re-read inviter authority on this client after any lock wait. Classify the
   invitee from the locked result. Missing inviter membership is forbidden.
3. Do not take a community lock ahead of member locks. A preliminary capacity check is optional and applies only
   to actual admissions; the authoritative state/capacity check follows the admitting write.
4. Admit as the table specifies. A left-row update is conditional and returns the actual row. With no existing row,
   insert with `ON CONFLICT (community_id,user_id) DO NOTHING RETURNING ...`. If the insert loses a race, lock and
   re-read the winning row and classify it; never infer success from a no-op. If there is still no row, refuse with
   retryable conflict rather than guessing. No loop or blind transaction retry.
5. After a new active insert or left-to-active change, the existing trigger has updated and locked the community
   row. Read `status`, `current_members` and `max_members` on this client. Refuse inactive/missing communities and
   over-capacity, rolling back the membership and counter together. An already-active row is never updated just to
   acquire the counter lock; verify community state without applying an admission capacity check.
6. Update the locked invitation once, then update the invitee's user attribution. Use the stored acceptance
   timestamp returned from the write in the response. The existing inviter-statistics trigger participates in this
   transaction; do not increment it in application code. A triplet uniqueness conflict rolls everything back.
7. Commit, release the client, then log success and send the response. On failure roll back; if rollback fails,
   destroy the client rather than returning an open/broken transaction to the pool. Do not log success before commit.

The lock order is invitation → ordered member rows → trigger-owned community row → attribution/statistics writes.
No new path locks a community before a member. A detected deadlock/serialization failure rolls back and returns
503 `ADMISSION_RETRY`; the client may retry explicitly. No automatic retry can double-consume an invitation.

Different invitations can contend on a common inviter member row. The test harness must account for that
serialization; it must not expect every request to reach the community lock simultaneously.

### BUG-108: duplicate-create join

Keep identity matching and private pointer behavior in place. Inside the existing transaction, lock the caller's
membership, call `classifyExistingMembership`, and apply the public column of the table. Reuse `assertWithinCapacity`
after an actual active admission and `readMemberCount` for an existing active row. Handle insert races by locking
and classifying the winner, as above. Preserve ADR-062's idempotent success for active callers.

Re-read the community after the member write. If it became inactive, roll back with `COMMUNITY_INACTIVE`; if it
became private while the public admission was in flight, roll back with 409 `COMMUNITY_CHANGED` and ask the caller
to refresh. Do not silently admit into a community whose access policy changed. This guard also applies before
returning an active no-op, although that path does not write membership.

Refresh the token after commit using the existing builder. Remove the fallback that invents `role: 'member'` when
the refreshed active-community list lacks this community: return 409 `MEMBERSHIP_CHANGED` without a token or joined
success instead. This can occur if staff removes the caller after the transaction; the committed operation is not
undone. Do not manufacture community claims. New/rejoined rows reset to member; existing active staff keep their
actual role. No new event types or publishers are added to these currently non-publishing paths.

## Data model

No schema or migration changes. The existing ADR-106 member-counter trigger and the invitation-statistics trigger
are prerequisites. Do not edit generated `init.sql` or execute a recount. Tests create active membership rows for
counts and set a community's cap to create full conditions; they never assign the cached count.

## API endpoints

| Endpoint | Auth/body | Success | Expected refusal |
|---|---|---|---|
| POST `/invitations/accept` | Verified caller; `{ invitation_code: string }` | 200; retain `{ inviter_id, community_id, accepted_at }`, with committed DB timestamp | 400 malformed/self/used/inactive/full; 403 wrong bound invitee or inviter no longer active; 404 missing invitation/community; 409 pending/restoration/triplet conflict; 503 transaction retry |
| POST `/communities`, existing public match | Existing authenticated creation request; caller from JWT | 200 `{ community, existing: true, joined: true, token }` only after an active outcome | 409 pending/restoration/community or membership changed; 400 inactive/full; 503 transaction retry |
| POST `/communities`, existing private match | Unchanged | 200 `{ community, existing: true, joined: false, message }`, no token | Existing validation only |

Errors use ADR-074 `{ success: false, error: string, message: string }`. Use `COMMUNITY_FULL` for capacity;
`CONFLICT` for pending or an unresolved membership insert race; `INVITATION_CONFLICT` for the known invitation
triplet uniqueness collision. Recognize the relevant constraint, not every PostgreSQL 23505. Unexpected failures
are logged with route/context and sent as opaque `INTERNAL_ERROR`; never return SQL text or raw exception messages.
Keep the used-code message compatible with current tests. Restoration copy tells the person to ask an admin to
lift the block and then rejoin themselves.

## Frontend and callers

No new UI is needed. Verify create errors render the server message and do not store a new token or navigate to a
joined destination. Verify successful active duplicate-create still accepts the existing token/response shape.
Verify invite registration preserves the account/session and goes to discovery when acceptance fails; it must not
create invitation arrival context or re-login on a refused acceptance. Successful acceptance retains the re-login
and arrival sequence. The already-registered invitation UX is not redesigned here.

**Adjacent source observation, deferred:** invitation validation reads `response.data.data` at
`apps/frontend/src/pages/invite/[code].tsx:51`, while the interceptor unwraps at `apps/frontend/src/lib/api.ts:81`.
The existing invited-arrival test mocks that nested shape. This is outside the two approved backend bugs; do not
silently fix or claim the entire live invite funnel works. Test API boundary behavior and the acceptance fallback
with the existing page preconditions, and disclose this limitation in the PR/handoff.

## User guide and documentation updates

- `docs/guides/admin-community-guide.md`, member limits: remove invitation acceptance's known capacity exception;
  retain the separate fusion exception and the deferred staff direct-add consent exception.
- `docs/guides/finding-communities-guide.md`, leaving/rejoining: explain that duplicate-create respects pending,
  blocked and left states, and an active retry preserves the person's role.
- `docs/guides/onboarding-guide.md`: document invitation full/inactive/blocked refusals, unconsumed failed codes,
  account preservation, and the private invitation policy separately from ordinary private join requests.
- `docs/concepts/community-identity.md`: qualify join-if-exists with capacity and membership state.
- `docs/adr/ADR-062-community-identity-idempotent-creation.md`: amend the implemented duplicate-create contract to
  reflect lifecycle checks and ADR-106's counter, without rewriting historical migration evidence or allocating
  a new ADR. No cross-three-service architectural change is proposed.
- Both service `CONTEXT.md` files and the two endpoint descriptions in `services/registry.json`: exact state/error
  contracts, atomic side effects, live inviter authority, limitations and BUG-106/108 fix status. BUG-107 stays open.
- `docs/BUGS.md`: mark BUG-106/108 fixed by this sprint only when implemented and verified; do not call them deployed.
- Regenerate landing docs from these sources using the existing generator; no hand edits to generated pages/nav.
  Update onboarding workflow copy only if its current invitation/rejoin explanation becomes inaccurate; do not
  create a new onboarding screen for an API error change.

## Validation design

Write new tests before implementation in each changed workspace's `tests/tdd/`; promote only this sprint's green
files to `tests/regression/`. Real database/race proof belongs in root
`tests/integration/sprint-145-admission-integrity.integration.test.ts`, discovered by the existing CI runner.
Do not put the only SQL or race evidence in an unrun service integration tier.

1. **State matrix:** missing/active/pending/left/inactive/NULL/unknown states across both paths; old admin/moderator
   roles on left rows reset to member, active roles/timestamps remain; active full/overfull no-ops remain successful.
   Include private invitation admission, private duplicate-create no-write behavior and inactive/missing communities.
2. **Atomic invitation effects:** exact before/after rows for invitation, user attribution, inviter stats, membership
   and stored/actual active count. Force a failure after member insertion (e.g. a real invitation triplet conflict)
   and prove every write rolls back. A separate injected user-attribution query failure after acceptance proves
   the statistics trigger also rolls back. Pure query-order mocks are supplemental evidence, never DB proof.
3. **Single-use races:** two users accept the same code (one winner); two codes for one user; repeat a used code.
   Assert exact winners, consumed invitation IDs and final attribution/stats, not just status-code totals. For
   two different inviters racing, attribution remains the existing last-successful-acceptance behavior; do not
   assert a new first-inviter policy.
4. **Capacity races:** two invites for the last slot; invitation versus normal join, staff add/approval and
   duplicate-create; two duplicate creates; left rejoin races. Final stored count equals actual active rows and
   does not exceed the cap because of the tested admissions; the loser leaves no partial invitation effects.
   For a shared inviter, use a barrier on the shared membership lock; for independent invitations, use distinct
   inviters when the proof needs both requests past that check. Do not use arbitrary sleeps as race evidence.
5. **State/authority races:** block or change the invitee while acceptance waits; remove the inviter while acceptance
   waits; archive a community or make a public match private while admission waits. Assert the committed winner's
   state determines the response. Forged JWT community claims and foreign membership rows never confer authority.
6. **Resource cleanup:** all paths release checked-out clients; failed rollback destroys the client. Barrier helpers
   unconditionally release locks and settle in-flight requests on assertion failure, following the corrected S144
   helper (`tests/integration/sprint-144-staff-write-integrity.integration.test.ts:178`).
7. **Caller coverage:** focused frontend success/refusal tests using the existing per-service envelope; keep
   existing Sprint 118 arrival, Sprint 143 lifecycle and Sprint 144 capacity/count suites green. Adjust SQL mocks
   for the additional locked reads without weakening their rollback/count assertions. Service-local mocked
   invitation integration tests may need transaction-client mocks; do not mistake running them for real DB proof.

No database/remote server is authorized by planning. Execution can obtain DB evidence from the isolated CI test
stack after a PR is opened; local remote-container proof requires a new explicit authorization. Record any locally
unrun DB cases as CI-owed, never as passed. Print role flags in DB evidence and test explicit community predicates:
CI's superuser/bypass-RLS roles do not prove RLS isolation.

Final execution verification includes changed-workspace type checks, unit + regression, root integration CI,
documentation drift, and the mandatory simplify/code/security review gates. The full pre-commit skill runs once
at final verification; intermediate commits retain normal git hooks and focused tests. Release/deployment remain
outside this planning authorization; tag the implementation plan `no-deploy` and finish at a reviewable PR.

## Critical implementation notes

1. One transaction client owns invitation consumption, membership, counter effect, attribution and inviter stats;
   failed admission consumes nothing. Rollback failure destroys the client.
2. Lock invitation, then ordered member rows, then let the trigger lock the community. Never lock a community
   before a member or copy a pre-read-only capacity gate.
3. Existing active is an idempotent membership outcome; pending is not approval; inactive/NULL/unknown fail closed;
   only left self-rejoins and resets to ordinary member. Private invite admission stays active by proposal.
4. A conflict no-op must be followed by a locked state read. A missing row is not a NULL-status row. Never infer
   active membership from row existence or fall back to an invented role/token claim.
5. Live inviter authority is read inside the locked acceptance transaction; use the stored invitation's community
   and verified caller. Reject self-acceptance and another user's bound invite without mutation.
6. Capacity checks follow real active admissions on the same client. The database owns current_members; no deltas,
   counter assignments, recounts, schema changes, generated init.sql edits or new dependency are needed.
7. Preserve existing API shapes, private duplicate-create pointers, active member roles, used-code status and
   post-commit token refresh. No new event publications or attribution policy are bundled.
8. Prove SQL, rollback and interleavings against the real CI database; mocks alone do not prove them. Include
   member-lock serialization in barriers and unconditionally clean up failed barriers.
9. BUG-107 and the observed invite validation envelope mismatch stay deferred. Do not claim live UI smoke or
   deployment from API tests, source inspection or historical Sprint 144 evidence.
10. Version, merge, deploy, demo data and remote test infrastructure remain unauthorized; planning produces docs
    only, with execution in the next chat after design/plan readiness.
