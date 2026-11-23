# Sprint 145: Admission integrity — Design Spec

**Date**: 2026-11-23

**Status**: Revised draft — scope approved; policy decisions D1–D3 and design approval pending

**Version**: Current master v11.117.0; Sprint 145 version unallocated (no version edits authorized)

**Sprint Branch**: `agent/claude/sprint-145-planning`

**Scope approval**: BUG-106 + BUG-108; BUG-107 deferred (maintainer, 2026-11-23)

## Overview

An invitation must not be recorded as accepted when the invitee cannot join, and creating a community that already
exists must not tell a blocked or pending applicant that they joined. Sprint 144 made the database own the active
member count (ADR-106); these two admission paths still need consistent membership decisions around that count.

The proposed BUG-106 fix makes invitation consumption, membership admission, user attribution and the existing inviter
statistics trigger one transaction when an admission occurs; an already-active invitee gets a no-write outcome.
The proposed BUG-108 fix classifies the caller's actual membership inside the
duplicate-create transaction. Admission checks the community's live state and authoritative post-write capacity.
Existing active membership stays idempotent; a rejoin resets a former staff role to ordinary member.

### Core principle: acceptance describes committed membership

A success response represents an active membership at the operation's transaction boundary; a refused admission
leaves membership, count, invitation consumption and attribution unchanged.

## Scope and non-goals

- In scope: `POST /invitations/accept` (BUG-106), the existing-public-community branch of `POST /communities`
  (BUG-108), tests and the documentation feedback loop.
- Private admission is a policy decision (D3), not a detail forced by compatibility: the proposed rule lets
  **any active member of a private community admit anyone without admin approval** through an invitation.
- Preserve duplicate-create's private-community pointer response (`existing: true`, `joined: false`) without writes.
- BUG-107 staff direct-add consent stays deferred. Do not retire or repurpose that endpoint or its fixture callers.
- No dependency/lockfile work, shared-package extraction, new endpoint, schema change, data repair or new ADR number.
- Normal join, staff handlers, governance, fission/fusion capacity and new-community creation remain outside this
  change, except necessary existing-test fixture corrections. Do not refactor those handlers during this sprint.
- Generation's missing membership gate and inflated sent statistics are logged as BUG-109, outside this sprint's
  implementation. Acceptance's live-inviter gate is explicitly a security fix, not merely consistency cleanup.
- Version, merge, deploy, demo data reads/writes and remote disposable test infrastructure remain unallocated.
  Earlier Sprint 144 permissions do not carry forward.

## Verified current behavior

References below describe the source re-read at branch HEAD `32754735`, based on master `71773476`. Line numbers are
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
| `services/social-graph-service/src/database/trustEdgeDb.ts:107`, `:111` | Existing client injection uses `type Queryable = Pick<PoolClient, 'query'>` and `db: Queryable = pool`; use that pattern. |
| `services/community-service/src/database/governanceDb.ts:286` | Existing authority membership is locked `FOR SHARE`; acceptance can share-lock its inviter and update-lock its invitee in UUID order. |
| `services/community-service/src/database/db.ts:48`, `:57`, `:60` | Community-service's existing wrapper swallows rollback failure and releases the client; this sprint does not change it. |
| `apps/frontend/src/lib/api.ts:915`, `:170`, `apps/frontend/src/pages/invite/[code].tsx:50` | Validation uses bare `axios.get`, outside the per-client interceptor. Its nested `response.data.data` and the Sprint 118 fixture are correct. |
| `apps/frontend/src/pages/invite/[code].tsx:99`, `:103`, `:120`, `:126` | Web accepts, re-logs in for memberships, then arrives; acceptance/session-refresh failure instead routes to discovery after registration. |
| `apps/frontend/src/pages/communities/new.tsx:197`, `:201`, `:205` | Web stores a returned token and navigates on success; errors render the server message. |
| `tests/jest.integration.config.js:38`, `.github/workflows/ci.yml:323` | The blocking CI integration runner discovers root `tests/integration/*.integration.test.ts`; service integration directories alone are insufficient. |
| `tests/integration/social-graph.test.ts:103`, `services/social-graph-service/package.json:11` | The root test's filename does not match that runner, and service `npm test` runs only unit/regression. Neither older acceptance test file supplies blocking coverage. |
| `tests/integration/sprint-144-staff-write-integrity.integration.test.ts:476` | The current gated API acceptance coverage admits a new invitee with an active admin inviter. It does not establish an already-active contract. |
| `services/social-graph-service/src/routes/invitations.ts:9`, `:12`, `:49`, `:58` | Generation trusts a supplied community header, inserts an unbound code, and increments sent statistics without a membership check. |
| `infrastructure/postgres/init.sql:950`, `services/social-graph-service/src/routes/invitations.ts:177`, `:179` | Self-acceptance already violates a database constraint; the current catch returns 500. The proposed 400 improves the error contract. |
| `docs/guides/joining-karmyq-guide.md:9`, `docs/guides/onboarding-guide.md:3` | Invitation entry is documented in the joining guide; the onboarding guide concerns first-visit intro screens. |
| `services/social-graph-service/src/services/pathComputation.ts:360`, `:362`, `infrastructure/postgres/init.sql:220` | Accepted invitation rows feed invitation-chain topology and the acceptance statistics trigger. A false acceptance creates effects beyond membership. |
| `infrastructure/postgres/init.sql:3157` | The unique inviter/invitee/community triplet prevents a former invitee from consuming a fresh code from the same inviter in the same community; this is a real rejoin/pending-user refusal. |
| `services/notification-service/src/events/subscriber.ts:259`, `:282`, `:291` | A join request already produces admin notifications. Under D2/D3 another member's invitation can admit the applicant while staff are reviewing, leaving that notification stale. |
| `services/auth-service/src/routes/auth.ts:78`, `:110`, `:128`, `:155` | Registration creates the user/session with no membership. D1's frontend branch is defensive coverage for a separately admitted same-account race, not an ordinary registration outcome. |

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

## Policy decisions requiring maintainer approval

These are revised author recommendations, not approved requirements. The state table, transaction steps and
validation cases below describe this recommended variant; do not write the implementation plan until D1–D3 and
the revised design have been approved.

| Decision | Recommended outcome and reason | Cost of recommendation | Alternative and cost |
|---|---|---|---|
| **D1 — already-active invitee** | Return 200 with no persistent writes: no code consumption, membership/timestamp change, accepted-stat increase, user-attribution overwrite or new invitation-chain edge. Leave the code usable by a newcomer. | Response distinguishes a no-op with `already_member: true` and `accepted_at: null`; keep its defensive frontend guard/test minimal. | Consume and attribute despite no admission. This can fabricate provenance and improve inviter statistics; no running acceptance test requires it. |
| **D2 — pending invitee** | An eligible invitation promotes pending to active ordinary member, with the same post-write capacity check as a newcomer. This avoids penalizing someone who applied before receiving the code. | With D3, any active member can admit an applicant whom staff are reviewing or about to decline. The admin's existing `join_request` notification becomes stale; it is not withdrawn or rewritten in this sprint. | 409, forcing the applicant to withdraw then accept. This gives a pending applicant fewer admission options than a stranger holding the same code. |
| **D3 — private invitation authority** | Require a live active inviter, regardless of role. **Any active member of a private community can admit anyone without admin approval.** This closes outsider-minted-code admission while retaining member-to-member private invitations. | Staff do not have exclusive admission authority, including over pending applicants; capacity and blocked-state refusals still apply. | Restrict private admission to staff or create pending membership instead. Either changes who may admit private members and needs a different state table and guide. |

The live-inviter check is an in-scope security fix under the proposed D3 rule. Today any authenticated outsider can
mint a code for a supplied private community and the unguarded accept handler admits its holder; the source has
no live membership gate at either point. Checking acceptance blocks that admission path, including codes minted
before the fix. BUG-109 separately tracks generation's missing live membership check and sent-stat inflation;
generation remains unchanged in Sprint 145. No demo exploit or live-data probe was performed.

## Membership decisions

Decide from the row locked on the operation's transaction client, never JWT community claims. IDs come from the
verified caller and the stored invitation/community identity. Any caller-supplied community or invitee override is
ignored. A missing row and a row whose `status` is NULL are distinct inputs.

| Existing invitee/caller membership | Invitation acceptance | Duplicate-create, existing public community |
|---|---|---|
| No row | Insert active ordinary member; check capacity; consume invitation | Insert active ordinary member; check capacity; return `joined: true` |
| `left` | Change to active ordinary member; reset join timestamp/request message; check capacity; consume | Same rejoin; return `joined: true` |
| `active` | D1: 200 with no persistent writes; leave the code unconsumed and user attribution/statistics untouched | Idempotent success, `joined: true`; preserve role, timestamp and count |
| `pending` | D2: promote to active ordinary member; reset join timestamp/request message; check capacity; consume | 409 `CONFLICT`; do not approve; no token |
| `inactive` | 409 `MEMBERSHIP_RESTORE_REQUIRES_STAFF`; no changes | Same refusal; no token |
| NULL or another stored status | Same fail-closed 409 as inactive | Same fail-closed 409 as inactive |

An active no-op succeeds even when a community is full or already over its cap; it admits nobody. Invitation
validation, community activity and live-inviter checks still apply before its no-op outcome. New, left and pending
invitation admissions are refused when the post-write stored count exceeds the current cap. Private duplicate-create is always
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
  cased strings. The self-refusal maps an existing database protection to a useful 400 instead of today's 500.
  No current producer binds an invitee before acceptance: generation inserts NULL and acceptance fills it in.
  The bound-invitee refusal is defensive and needs a hand-built fixture, not a claimed live workflow.
- Require the inviter's live active membership in the stored community (403 `FORBIDDEN` if absent/inactive).
  This is the security fix described in D3 and applies ADR-102 to admission authority. A stale JWT or a membership
  in another community never supplies it. The choice to let an ordinary member admit to a private community is
  explicit and pending maintainer approval.
- Only an actual new/left/pending admission writes the invitee's `auth.users.invited_by` and
  `invitation_accepted_at`, consumes the invitation and triggers accepted statistics. An active no-op changes none
  of them. For actual admissions to different communities, existing attribution writes remain; a global
  first-inviter policy is not introduced. Acceptance lineage itself reads accepted invitation rows
  (`services/social-graph-service/src/services/pathComputation.ts`); do not assert it reads `users.invited_by`.
- D1's 200 response keeps `inviter_id` and `community_id`, with `accepted_at: null` and `already_member: true`.
  Actual acceptance retains its stored timestamp and may omit `already_member` (existing consumers stay valid).
  `accepted_at` is therefore a timestamp only when this code was consumed. Do not fabricate an acceptance time
  for the no-op. The used-code check still precedes this branch: a consumed code returns 400, even to a member.
- A previous accepted invitation with the same inviter, invitee and community prevents consuming a fresh code
  for an actual admission (the existing triplet uniqueness constraint). This affects a person who joined via A,
  left and is now left or pending when using another code from A. Keep 409 `INVITATION_CONFLICT` and roll back
  every new effect; do not change the schema, erase the old accepted invitation or merge invitation history.
  Use this actionable message: "You previously joined this community through this inviter. Ask a different member
  for an invitation. If the community is public, rejoin from its community page."
  The fresh code stays unconsumed, user attribution/statistics stay unchanged, and a pending/left row retains its
  prior state. Active no-ops do not consume a code and therefore do not hit this constraint.
- D2 does not cancel an admin's already-created `join_request` notification. Staff actions still use live
  membership transitions; race coverage must exercise invitation versus staff approval/rejection and assert the
  final stored state rather than treating a notification as a current pending-membership guarantee. Do not add a
  notification-service behavior change or new notification event to this sprint.

## Transaction design

### BUG-106: invitation acceptance

Implement with one checked-out social-graph pool client and BEGIN/COMMIT/ROLLBACK. A local helper may contain this
operation; it must not import another service's pool or source. Follow the existing `trustEdgeDb.ts:107–111`
pattern in social-graph `getLiveRole`: `type Queryable = Pick<PoolClient, 'query'>`, with an optional
`db: Queryable = pool` parameter and queries through `db.query`. Existing callers keep the pool default;
acceptance passes its checked-out transaction client.

1. Validate input and caller identity, then BEGIN and select the invitation by code `FOR UPDATE`. Read all fields
   needed for used/self/bound-invitee checks. Refusals must throw a typed outcome or explicitly roll back; never
   commit on an error sentinel by accident.
2. Read the community's current metadata without locking; refuse NULL/missing communities as 404 and inactive
   communities as 400 before the inviter check. Then acquire a `FOR SHARE` lock on the inviter membership and a
   `FOR UPDATE` lock on the invitee membership, one identity at a time in ascending canonical UUID/user_id order,
   with explicit stored `community_id`. This is one global order, not "inviter first"; self-acceptance is already
   refused. Each locked SELECT returns the live row after any wait. Re-read inviter authority through
   `getLiveRole(..., client)` and classify the locked invitee. Missing inviter membership is forbidden. Do not
   take both rows `FOR UPDATE`: different invitees can share the same inviter's authority lock.
3. Do not take a community lock ahead of member locks. A preliminary capacity check is optional and applies only
   to actual admissions; the authoritative state/capacity check follows the admitting write.
4. For an existing active invitee, re-read community activity and return D1's no-write outcome after the above
   checks. Otherwise admit as the table specifies. Left/pending updates are conditional on the classified stored
   state, reset role to member, and return the actual row. With no existing row, insert with
   `ON CONFLICT (community_id,user_id) DO NOTHING RETURNING ...`. If the insert loses a race, lock and
   re-read the winning row and classify it; never infer success from a no-op. If there is still no row, refuse with
   retryable conflict rather than guessing. No loop or blind transaction retry.
5. After a new active insert or left/pending-to-active change, the existing trigger has updated and locked the
   community row. Read `status`, `current_members` and `max_members` on this client. Refuse inactive/missing communities and
   over-capacity, rolling back the membership and counter together. An already-active row is never updated just to
   acquire the counter lock; verify community state without applying an admission capacity check.
6. For an actual admission only, update the locked invitation once, then update the invitee's user attribution.
   Use the stored acceptance timestamp returned from the write in the response. The existing inviter-statistics trigger participates in this
   transaction; do not increment it in application code. A triplet uniqueness conflict rolls everything back.
7. Commit, release the client, then log success and send the response. On failure roll back; if rollback fails,
   destroy the client rather than returning an open/broken transaction to the pool. Do not log success before commit.

The lock order is invitation → ordered member rows → trigger-owned community row → attribution/statistics writes.
No new path locks a community before a member. A detected deadlock/serialization failure rolls back and returns
503 `ADMISSION_RETRY`; the client may retry explicitly. No automatic retry can double-consume an invitation.

Shared inviter locks are compatible across acceptances. Test two requests with the same active inviter and
different invitees reaching the admission/capacity barrier; both must be able to hold authority locks concurrently.
An exclusive staff removal still waits for those authority locks, and acceptance waits behind a prior removal.

### BUG-108: duplicate-create join

Keep identity matching and private pointer behavior in place. Inside the existing transaction, lock the caller's
membership, re-read current community metadata before deciding an outcome, call `classifyExistingMembership` for
a still-public community, and apply the public column of the table. Reuse `assertWithinCapacity`
after an actual active admission and `readMemberCount` for an existing active row. Handle insert races by locking
and classifying the winner, as above. Preserve ADR-062's idempotent success for active callers.

Re-read the community after an admitting write, or before returning an active no-op. If it became inactive,
refuse with `COMMUNITY_INACTIVE` (rolling back any writes). If it is now private, return the existing private
pointer: 200 `existing: true`, `joined: false`, approval message, no token. An active no-op can return that pointer
without mutation. If an INSERT/rejoin already occurred, roll it back first and read the community again for the
pointer response, so its count does not include a rolled-back member. Use an explicit typed private outcome to
prevent the transaction wrapper from committing tentative admission. This applies the same pointer rule to all
private matches; do not introduce a `COMMUNITY_CHANGED` error for a member whose community turned private.

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
| POST `/invitations/accept` | Verified caller; `{ invitation_code: string }` | D1–D3 proposal: 200 `{ inviter_id, community_id, accepted_at }` for actual admission; active no-op adds `already_member: true` with `accepted_at: null` and no writes | 400 malformed/self/used/inactive/full; 403 wrong bound invitee or inviter no longer active; 404 missing invitation/community; 409 restoration/triplet conflict; 503 transaction retry |
| POST `/communities`, existing public match | Existing authenticated creation request; caller from JWT | 200 `{ community, existing: true, joined: true, token }` only after an active outcome; if now private, use private pointer after rolling back any tentative write | 409 pending/restoration/membership changed; 400 inactive/full; 503 transaction retry |
| POST `/communities`, existing private match | Unchanged | 200 `{ community, existing: true, joined: false, message }`, no token | Existing validation only |

Errors use ADR-074 `{ success: false, error: string, message: string }`. Use `COMMUNITY_FULL` for capacity;
`CONFLICT` for pending or an unresolved membership insert race; `INVITATION_CONFLICT` for the known invitation
triplet uniqueness collision. Recognize the relevant constraint, not every PostgreSQL 23505. Unexpected failures
are logged with route/context and sent as opaque `INTERNAL_ERROR`; never return SQL text or raw exception messages.
Keep the used-code message compatible with current tests. `INVITATION_CONFLICT` is a real user-facing repeat-invite
refusal and uses the alternate-path message above, not an unexplained duplicate error. Restoration copy tells the
person to ask an admin to lift the block and then rejoin themselves.

## Frontend and callers

No new screen is needed. Verify create errors render the server message and do not store a new token or navigate to a
joined destination. Verify successful active duplicate-create still accepts the existing token/response shape.
Verify invite registration preserves the account/session and goes to discovery when acceptance fails; it must not
create invitation arrival context or re-login on a refused acceptance. Actual acceptance retains the re-login
and arrival sequence. The invitation page currently offers registration only, not acceptance for an existing
account. Registration itself adds no community membership. Do not add a logged-in acceptance flow. D1's frontend
guard is defensive: a same newly created account would first need a separate admission, such as two authenticated
tabs accepting different codes. If that rare case returns D1's no-op, refresh its session as usual and route to
the existing community without calling `beginArrival` for an invitation bond. Keep this guard and its one focused
test minimal; do not build a new screen, multi-tab coordinator or funnel redesign for it.

Validation intentionally uses the raw Axios envelope (`response.data.data`), while acceptance uses the unwrapped
per-service client (`response.data`). Keep both shapes and the corresponding Sprint 118 mocks; there is no
validation envelope defect to fix or defer.

## User guide and documentation updates

- `docs/guides/admin-community-guide.md`, member limits: remove invitation acceptance's known capacity exception;
  retain the separate fusion exception and the deferred staff direct-add consent exception.
- `docs/guides/finding-communities-guide.md`, leaving/rejoining: explain that duplicate-create respects pending,
  blocked and left states, and an active retry preserves the person's role.
- `docs/guides/joining-karmyq-guide.md`, invited path: qualify "you join their community directly" with the
  admission checks; describe full/inactive/blocked refusals and unconsumed failed codes, the no-write active
  outcome, D2's pending promotion and the account-preserving fallback. State D3's ordinary-member private
  admission authority separately from ordinary private join requests. Do not target `onboarding-guide.md`,
  which documents first-visit intro screens rather than this invitation flow.
  Include the same-inviter repeat-invitation limitation and alternate paths: another member's code, or self-rejoin
  from a public community's page. Explain that the rejected fresh code remains unused and the prior invitation
  history is kept. Include the D2 trade-off: member-issued invitations can resolve pending membership while staff
  are reviewing, so a prior admin join-request notification may no longer describe current membership.
- `docs/concepts/community-identity.md`: qualify join-if-exists with capacity and membership state.
- `docs/adr/ADR-062-community-identity-idempotent-creation.md`: amend the implemented duplicate-create contract to
  reflect lifecycle checks and ADR-106's counter, without rewriting historical migration evidence or allocating
  a new ADR. No cross-three-service architectural change is proposed.
- Both service `CONTEXT.md` files and the two endpoint descriptions in `services/registry.json`: exact state/error
  contracts, atomic side effects, live inviter authority, limitations and BUG-106/108 fix status. BUG-107 stays open.
- `docs/BUGS.md`: BUG-109 records the out-of-scope generation security gap. Mark BUG-106/108 fixed by this sprint
  only when implemented and verified; do not call them deployed. Do not mark BUG-109 fixed by an acceptance guard.
- Regenerate landing docs from these sources using the existing generator; no hand edits to generated pages/nav.
  Update onboarding workflow copy only if its current invitation/rejoin explanation becomes inaccurate; do not
  create a new onboarding screen for an API error change.

## Validation design

Write new tests before implementation in each changed workspace's `tests/tdd/`; promote only this sprint's green
files to `tests/regression/`. Real database/race proof belongs in root
`tests/integration/sprint-145-admission-integrity.integration.test.ts`, discovered by the existing CI runner.
Do not put the only SQL or race evidence in an unrun service integration tier.

1. **State matrix:** missing/active/pending/left/inactive/NULL/unknown states across both paths; old admin/moderator
   roles on left rows and promoted pending invitation rows reset to member, active roles/timestamps remain;
   active full/overfull no-ops remain successful. Include D1's no-write accepted-stat/attribution/lineage invariants,
   D2's pending promotion on public/private invitations, private duplicate-create pointers (including a mid-request
   change) and inactive/missing communities. Add real-history cases for both left and pending invitees: accept a
   first code, leave (and reapply for the pending case), then try a fresh code from the same inviter/community.
   Assert 409 `INVITATION_CONFLICT`, the actionable message, the unused fresh code, unchanged prior history and
   exact membership/count/attribution/statistics rollback. Prove a different inviter's code succeeds and public
   self-rejoin is an available alternative. The bound-invitee case uses a synthetic fixture; self-acceptance proves
   the existing constraint still holds and the API returns 400, not 500.
2. **Atomic invitation effects:** exact before/after rows for invitation, user attribution, inviter stats, membership
   and stored/actual active count. Use the real repeat-invitation conflict above to prove every tentative admission
   write rolls back, not merely as an artificial failure injection. A separate injected user-attribution query failure after acceptance proves
   the statistics trigger also rolls back. Pure query-order mocks are supplemental evidence, never DB proof.
3. **Single-use races:** two eligible newcomers accept the same code (one winner); two codes for one user in the
   same community (one actual admission, then D1 no-op leaves the other code usable); repeat a used code. Assert
   exact winners, consumed/unconsumed invitation IDs and final attribution/stats, not just status-code totals.
   Distinct inviters for that same-community race must not overwrite the winner's attribution or add a second
   accepted edge/stat increment. For actual admissions to different communities, the existing user-attribution
   writes remain; do not assert a new global first-inviter policy.
4. **Capacity races:** two invites for the last slot; invitation versus normal join, staff add/approval and
   duplicate-create; two duplicate creates; left rejoin races. Final stored count equals actual active rows and
   does not exceed the cap because of the tested admissions; the loser leaves no partial invitation effects.
   Use the same active inviter for two different invitees and prove both pass their compatible authority locks
   before releasing the capacity barrier. No workaround using distinct inviters to hide exclusive inviter locking.
   Do not use arbitrary sleeps as race evidence.
5. **State/authority races:** block or change the invitee while acceptance waits; remove the inviter while acceptance
   waits; archive a community or make a public match private while admission waits. Include pending admission
   against staff approval/rejection. Assert the committed winner's state determines the response. Admin notification
   creation is established by the existing subscriber; no notification-service test or cleanup is added here.
   Forged JWT community claims and foreign membership rows never confer authority.
6. **Resource cleanup:** the new social-graph transaction releases checked-out clients; failed rollback destroys
   its client. BUG-108 retains community-service's existing wrapper, whose failed-rollback handling is a known
   limitation outside scope (`src/database/db.ts:57–60`); do not claim destroy-on-failure for it. Barrier helpers
   unconditionally release locks and settle in-flight requests on assertion failure, following the corrected S144
   helper (`tests/integration/sprint-144-staff-write-integrity.integration.test.ts:178`).
7. **Caller coverage:** focused frontend success/refusal tests using the existing per-service envelope; keep
   existing Sprint 118 arrival, Sprint 143 lifecycle and Sprint 144 capacity/count suites green. Adjust SQL mocks
   for the additional locked reads without weakening their rollback/count assertions. New service route/client
   tests belong in service `tests/tdd/`, promoted to gated `tests/regression/`; do not spend this sprint updating
   mocked tests in service `tests/integration/`, which standard CI/npm test never selects. New real DB coverage is
   in the root `*.integration.test.ts` file. Frontend tests cover actual acceptance, failure and D1's no-bond guard
   while preserving validation's raw envelope; keep D1's defensive no-bond test to one focused case. Do not
   "correct" the validation mock to the acceptance client's shape.

No database/remote server is authorized by planning. Execution can obtain DB evidence from the isolated CI test
stack after a PR is opened; local remote-container proof requires a new explicit authorization. Record any locally
unrun DB cases as CI-owed, never as passed. Print role flags in DB evidence and test explicit community predicates:
CI's superuser/bypass-RLS roles do not prove RLS isolation.

Final execution verification includes changed-workspace type checks, unit + regression, root integration CI,
documentation drift, and the mandatory simplify/code/security review gates. The full pre-commit skill runs once
at final verification; intermediate commits retain normal git hooks and focused tests. Release/deployment remain
outside this planning authorization; tag the implementation plan `no-deploy` and finish at a reviewable PR.

## Critical implementation notes

1. One transaction client owns actual invitation consumption, membership, counter effect, attribution and inviter
   stats; failed admission consumes nothing. Failed rollback destroys the new social-graph transaction's client
   only; community-service's existing wrapper remains unchanged with its documented cleanup limitation.
2. Lock invitation, then inviter FOR SHARE and invitee FOR UPDATE in global user_id order, then let the trigger
   lock the community. Use the existing Queryable/client injection pattern. Never pre-lock a community.
3. Pending D1–D3 approval: active invitees get a no-write 200 with an unconsumed code; pending invitees become
   active ordinary members after capacity validation; any active private member can admit anyone without admin
   approval (subject to capacity and blocked-state refusals). Duplicate-create still refuses pending; both paths
   refuse inactive/NULL/unknown and reset left rejoins to ordinary member.
4. A conflict no-op must be followed by a locked state read. A missing row is not a NULL-status row. Never infer
   active membership from row existence or fall back to an invented role/token claim.
5. Live inviter authority is an in-scope security fix; read it inside the locked acceptance transaction using the
   stored community and verified caller. BUG-109 tracks unguarded generation separately. Self-acceptance already
   has a DB guard (now map to 400); bound-invitee refusal is defensive fixture-only coverage.
6. Capacity checks follow real active admissions on the same client. The database owns current_members; no deltas,
   counter assignments, recounts, schema changes, generated init.sql edits or new dependency are needed.
7. Preserve private duplicate-create pointers, including a mid-request change (rollback tentative admission
   first), active member roles, used-code status and post-commit token refresh. D1 adds already_member: true and
   accepted_at: null; the invite caller must not manufacture an invitation bond for that no-write outcome.
8. Prove SQL, rollback and interleavings against the real CI database; mocks alone do not prove them. Include
   compatible shared inviter locks in barriers and unconditionally clean up failed barriers. Put new acceptance
   coverage in gated tiers, not the unselected old root/service integration files.
9. BUG-107 and generation BUG-109 stay out of scope. Validation uses bare Axios, so its nested envelope is correct.
   Do not claim live UI smoke or deployment from API tests, source inspection or historical Sprint 144 evidence.
10. Version, merge, deploy, demo data and remote test infrastructure remain unauthorized; planning produces docs
    only, with execution in the next chat after design/plan readiness.
11. Repeat invitations from the same inviter/community can hit the existing unique triplet on a left or pending
    invitee. Keep 409 INVITATION_CONFLICT with the alternate-path message, joining-guide explanation and real-history
    state-matrix/rollback proof. No schema change or deletion of accepted history.
12. D2/D3 let an ordinary member admit an applicant while staff review, leaving a prior join-request notification
    stale. This is an explicit policy cost, not a notification cleanup task. The D1 frontend guard is defensive
    and gets one minimal test because registration itself creates no membership.
