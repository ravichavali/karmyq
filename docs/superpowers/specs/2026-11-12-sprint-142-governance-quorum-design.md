# Sprint 142: Governance Ratification Quorum — Design Spec

**Date**: 2026-11-12
**Status**: Approved by maintainer, 2026-11-12 (including builder-review proposals)
**Version**: v11.114.0 baseline → release version pending maintainer allocation
**Sprint Branch**: `agent/claude/sprint-142-planning`

## Overview

A fixed three-person quorum lets the same small group elevate an administrator in a large community. Sprint 142 makes the participation requirement grow with the community while retaining equal votes. Nominee eligibility stays trust-based; voting does not gain a trust gate or weight.

The maintainer confirmed: quorum is 20% of active members other than the nominee, rounded up, minimum three; the voter roster is fixed at nomination creation; only voters who are still active count; the role grant is atomic. Existing pending nominations close and must be resubmitted. The web UI and documentation explain these rules.

### Core principle: Equal participation, proportional consent

Each eligible member contributes one ratification, and the required participation grows with the electorate.

## Goals and boundaries

- Implement the confirmed quorum policy for both admin and moderator nominations.
- Make the creation, voting, counting and role-grant boundaries agree under concurrent requests.
- Preserve the existing nominee trust-eligibility calculation and ADR-082 privacy boundary.
- Keep simulated nomination/ratification disabled. No new role rotation, delegation, opposition votes, expiry, or general governance rewrite.
- This chat produces planning artifacts only. The next chat implements. No merge, deploy, demo data operation, version bump, dependency edit or new ADR number is authorized.

## Approaches

1. **Chosen:** equal active-member votes with proportional quorum. Maintainer selected 20%, rounded up, minimum three. It increases participation requirements without a second trust hierarchy.
2. **Not chosen:** only trust-qualified members ratify. This narrows participation and couples voting rights to nominee eligibility.
3. **Not chosen:** trust-weighted ratification. This adds weight disclosure/aggregation complexity and concentrates influence.

A strict majority was also offered. The maintainer selected 20% for practical participation. This is a participation threshold, not a claim that most members approve.

## Verified baseline

| Evidence | Current behavior |
|---|---|
| `services/community-service/src/routes/governance.ts:80-98` | Active members can ratify; nominee cannot self-ratify; path community and pending status checked before the DB call. |
| `services/community-service/src/routes/governance.ts:27-64` | Nomination checks nominee trust, but has no explicit active-membership check for nominator or nominee. |
| `services/community-service/src/database/governanceDb.ts:25-26` | Fallback settings include quorum 3. |
| `services/community-service/src/database/governanceDb.ts:119-137` | Creation stores the supplied fixed quorum; duplicate-pending check is outside a transaction. |
| `services/community-service/src/database/governanceDb.ts:145-181` | Voting uses a transaction but no nomination-row lock; DB helper does not recheck pending status or path scope. |
| `infrastructure/postgres/migrations/009-governance-schema.sql:10-32` | Nomination statuses include pending/ratified/rejected/withdrawn; ratification PK is `(nomination_id, ratifier_id)`. |
| `apps/frontend/src/components/GovernanceTab.tsx:99-122` | UI handles own nomination, prior vote and progress from count/required. |
| `docs/concepts/governance.md:11` | Role-holder-only ratification wording disagrees with the route. |
| `docs/adr/ADR-103-authenticated-listings-and-simulation-containment.md:67-70` | Simulation actions have weight zero; enabling requires a separate decision. |
| `.github/workflows/ci.yml:317-326`, `tests/jest.integration.config.js:16-44` | CI replays schema and runs root integration files, not service-local integration tiers. |

These are source observations, not claims that all related governance mechanisms work. Founder bootstrapping, automatic role rotation and template-specific delegation are outside this sprint.

## Policy

Let `E` be the number of active members other than the nominee at the moment the roster is captured. Let `R = max(3, ceil(E / 5))`.

| E | 0 | 1 | 2 | 3 | 10 | 15 | 16 | 50 | 149 |
|---|---|---|---|---|---|---|---|---|---|
| R | 3 | 3 | 3 | 3 | 3 | 3 | 4 | 10 | 30 |

- Do not cap `R` to the electorate. If `E < 3`, creation returns 422 `GOVERNANCE_ELECTORATE_TOO_SMALL`, with no nomination persisted. This implements the confirmed minimum of three independent ratifiers.
- Capture voter IDs and `E` in the creation transaction; exclude nominee. Nominator can vote if in the roster, and nomination itself adds no vote. Self-nomination remains allowed for an eligible active member; self-ratification remains forbidden.
- Later joins do not enter the roster. Later departures remove that member's vote from the live tally but do not lower `R`. Rejoining members regain eligibility if their ID is in the original roster; continuous membership tracking is not introduced.
- A stalled nomination stays pending. This sprint adds no withdrawal endpoint or expiry. A future policy may address that explicitly.
- Recheck nominee's active membership and existing trust eligibility before the grant. Reaching quorum must not elevate an inactive or currently ineligible nominee. A failed recheck rolls back that ratification request; earlier accepted votes stay recorded.
- A completed grant is final for this nomination. Later departures do not retroactively revoke roles. Duplicate retries on a completed nomination return 409 `GOVERNANCE_NOMINATION_CLOSED`; retries of an already recorded vote while pending are idempotent.
- Existing configured `governance_settings.quorum_size` is retained as legacy storage but no longer controls new nominations. `eligibility_threshold` and `template` retain their existing meaning; no new policy editor is added.
- Role elevation is monotonic: member → moderator/admin, moderator → admin. Reject same-role or lower-role nominations at creation and recheck at finalization with 409 `GOVERNANCE_ROLE_ALREADY_HELD`. Admin → moderator through ratification is refused; intentional administrative role changes remain outside this flow. Concurrent admin/moderator nominations serialize on the nominee's membership row.

The details beyond the confirmed scope above are **Codex implementation proposals**, presented for written-design approval.

## Data model

Proposed new migration: `infrastructure/postgres/migrations/20261112-governance-quorum.sql` (verify filename availability again at implementation).

Add to `communities.governance_nominations`:

```sql
quorum_policy_version SMALLINT,
electorate_size INTEGER
```

Keep these nullable for historical rows. Version 1 means exactly the policy in this spec. Add checks for recognized version, nonnegative electorate size and valid new-policy thresholds. All new nominations require version 1 and electorate metadata through the shipped writer; existing resolved history remains readable.

Create:

```sql
CREATE TABLE IF NOT EXISTS communities.governance_nomination_voters (
  nomination_id UUID NOT NULL REFERENCES communities.governance_nominations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  PRIMARY KEY (nomination_id, user_id)
);
```

Preserve ballots separately in `governance_ratifications`. Never seed or reconstruct historical electorates from today's membership. In a transactional, rerunnable migration, change legacy `pending` rows without policy metadata to `withdrawn` and set `resolved_at`; preserve ballots and already resolved rows. Replaying the migration must not withdraw new version-1 nominations.

Add a partial unique index on `(community_id, nominated_user_id, nominated_for_role) WHERE status = 'pending'` after closing legacy rows. The DB enforces duplicate protection; map its named constraint violation to 409. Regenerate `init.sql` from the migration chain; never edit it manually. Evaluate table privileges/RLS against the existing governance tables and the actual app DB role; prove permitted scoped access and foreign-community refusal in real SQL tests. New transactions set DB context on their own checked-out client, not a separate pooled middleware query (`packages/shared/middleware/dbContext.ts:31-38`).

### Rollout fence (Codex proposal following builder review)

`scripts/deploy.sh:150-155` applies migrations before old containers stop at line 225. Fence old writers in the database; do not rely on restart timing. Install named `BEFORE INSERT` guards on nominations and ratifications, plus a guard on transition to `ratified`. They require the transaction-local protocol marker `app.governance_policy_version = '1'`; nomination inserts additionally require valid version-1 metadata. The new writer sets the marker using `set_config(..., true)` after BEGIN. It is a compatibility protocol for trusted application SQL, not authorization.

Install guards and close legacy pending nominations in the same migration transaction, holding the necessary governance-table locks so an already-running old transaction finishes before the cutoff. Legacy code inserts a ballot before any role update (`governanceDb.ts:149-169`); the ballot guard therefore aborts the whole old transaction, including duplicate insert attempts. A legacy creation lacking metadata/marker also fails. Resolved history remains untouched. Administrative membership updates outside governance do not require this marker.

After a binary rollback, governance writes fail closed until compatible code returns; do not remove guards or reopen old pending nominations to recover availability. Reads and unrelated app operations remain available. Prove this with the exact legacy statement sequence on a real DB, including concurrent migration/legacy transactions, duplicate ballots and post-rollback writes. No global deploy-script change is needed for this fence.

## Transactions and authorization

Creation takes community ID, caller ID, nominee ID and role; it does not accept quorum or electorate from the client. Validate UUIDs and role before queries. In one transaction, set context/protocol marker, verify community existence, lock/check active caller and nominee membership, apply the existing private trust threshold and role-elevation check, capture the active voter roster once, derive E and R, create the version-1 pending row with complete metadata and persist exactly that roster. Use a single consistent roster read, locking the selected memberships in deterministic order, rather than independent count and voter queries. Roll back if too small or duplicate.

Ratification takes path community ID, nomination ID and caller ID. Lock the nomination with `SELECT ... FOR UPDATE` and recheck community, status, policy version, caller roster inclusion and active membership inside that transaction. Lock the relevant membership rows in deterministic user-ID order before tallying so a departure cannot race the final grant; use a consistent locking order for creation/voting and test deadlocks/races. Count only ballots joined to snapshot voters and current active community membership. Insert at most one ballot per voter. Check the nominee again and grant the role only while it is still active and eligible, then close the nomination within the same commit. Re-read tally after the insert, rather than incrementing a remembered number.

Do not broaden this into changes to all membership writers. The implementer must demonstrate the chosen PostgreSQL row-lock behavior using two real connections, including member departure versus finalization. Lock all involved membership rows in deterministic user-ID order, using an update-strength lock for the nominee whose role may change and compatible locks for voters; avoid taking shared locks on the same nominee in two transactions and then both upgrading. If existing membership mutations delete/reinsert rows rather than updating them, preserve the same effective outcome through locks and the FK/unique constraints; verify those writer paths before choosing the exact lock statements.

## API endpoints

Keep existing route paths and ADR-074 envelopes. Proposed response fields are additive except replacing the obsolete settings quorum number; search all consumers before that replacement.

| Method/path (service path) | Auth/body | Result |
|---|---|---|
| GET `/communities/:communityId/governance` | Active member, live lookup | Existing identity/coarse eligibility data; settings expose `quorum_policy: { version: 1, percentage: 20, minimum: 3 }`; nominations include fixed `electorate_size`, required count, live ratification count and viewer eligibility/reason. |
| POST `/communities/:communityId/governance/nominate` | Active caller; `{ nominated_user_id, role }`; active trust-eligible nominee | 201 with ID and policy/count metadata; 409 duplicate; 422 too few voters or nominee ineligible. |
| POST `/communities/:communityId/governance/ratify/:nominationId` | Active snapshot voter other than nominee; empty body | 200 `{ ratified, ratification_count, required_ratifications }`; 403 not an active snapshot voter; 404 wrong-community/missing; 409 closed; 422 nominee eligibility changed. |

Use stable error codes for all touched denials: `UNAUTHORIZED`, `INVALID_REQUEST`, `FORBIDDEN`, `GOVERNANCE_VOTER_NOT_ELIGIBLE`, `GOVERNANCE_SELF_RATIFICATION`, `GOVERNANCE_NOMINATION_CLOSED`, `GOVERNANCE_DUPLICATE_NOMINATION`, `GOVERNANCE_ELECTORATE_TOO_SMALL`, existing `GOVERNANCE_ELIGIBILITY_NOT_MET`, `NOT_FOUND`, `INTERNAL_ERROR`. Log internal failures without exposing SQL, voter rosters or personal trust values. Keep ratifier identity rows consistent with the live count. Do not expose the full snapshot electorate through GET.

If consumer search finds a real client needing `settings.quorum_size`, retain it temporarily as explicitly legacy and add the policy field; UI always displays the new policy. Do not guess a single numeric replacement for every nomination.

## Frontend changes

Update `apps/frontend/src/components/GovernanceTab.tsx` in place. Display “20% of eligible voters · at least 3”; per nomination show “X of R ratifications” and “R fixed when nominated from E eligible voters.” Hide voting for the nominee, already counted voters and viewers outside the snapshot; show a plain reason for ineligible viewers. Treat the server as the authority when a stale screen is rejected and refresh after successful actions. Disable duplicate submissions while pending, show accessible inline errors and support loading/error states.

Conceptual text only; use the existing layout and design tokens. No new screen or visual redesign is planned. Fix any repeated response unwrap on this component's actual API path while wiring the new payload; prove the production interceptor-shaped response in tests. Preserve identity-only nominee/role-holder displays.

## User guide and doc updates

- `docs/concepts/governance.md`: actual voters, formula/examples, frozen roster, live tally, small-community limit; distinguish shipped behavior from historical aspirations.
- `docs/guides/admin-community-guide.md` and/or `docs/guides/community-admin-guide.md`: inspect their existing stewardship sections, update the relevant source guide with nominate/ratify flow and pending-nomination transition. Verify exact sections before editing.
- `apps/frontend/src/lib/onboarding/workflows.ts`: stewardship walkthrough explains equal votes and proportional participation briefly.
- Amend existing `docs/adr/ADR-055-trust-governance-architecture.md` with the dated quorum decision and its bounded scope; update `docs/adr/README.md`. No new ADR number is assigned.
- `services/community-service/CONTEXT.md`, `services/registry.json`: document metadata, voter rules, errors and transaction behavior. Do not claim automatic rotation has been implemented.
- Generate affected landing JSON from source via `npm run generate-docs --workspace=apps/landing`; remove unrelated build timestamp, dependency-graph and ADR-010 line-ending churn.

## Validation and acceptance

Write new service and frontend tests in each changed workspace's `tests/tdd/` before implementation, then promote only this sprint's green files to `regression/`. No global promotion sweep. Real PostgreSQL integration tests belong in root `tests/integration/sprint-142-governance-quorum.integration.test.ts` so CI discovers them.

Prove formula boundaries, electorate exclusion of nominee, minimum-three refusal, snapshot membership, no implicit nominator vote, duplicate creation/voting, own nomination refusal, foreign-community isolation, inactive caller/nominee, threshold recheck without metric disclosure, departure/rejoin tally, monotonic role elevation and rollback. Two-connection tests prove simultaneous last votes finalize exactly once, duplicate concurrent votes count once, departure/finalization cannot grant from an ineligible tally, and competing admin/moderator nominations cannot demote an admin. Exercise the shipped transaction code rather than retyped SQL or regex mocks alone.

Migration proof: populated legacy pending/resolved rows; first apply closes only legacy pending and retains ballots; replay preserves new policy nominations and history; duplicate pending index fails correctly; generated schema converges. UI tests mount the real component, assert actual API payloads, server-shaped response, policy/progress rendering, hidden/visible actions, stale errors and refresh. Retain privacy and no-NaN regressions.

Run unit+regression, type checks, the four SDLC gates and final pre-commit check. Real DB validation is mandatory for implementation; this Windows host has no Docker. Use an explicitly authorized disposable DB environment or CI, never the demo application DB as a test fixture. Do not infer new demo authorization from this plan.

## Critical implementation notes

1. `R = max(3, ceil(E / 5))`; E excludes the nominee and is captured once. Never reduce R for departures or cap it to E.
2. Snapshot voter IDs; count ballots only from snapshot voters who are currently active. Nomination adds no vote.
3. Lock the nomination and relevant membership rows before finalization; recheck active nominee and existing private trust eligibility inside the transaction.
4. Legacy pending nominations close once; preserve resolved history and ballots. Rerunning migration must preserve new policy nominations.
5. Keep ADR-082 identity/coarse eligibility disclosure. Trust metrics and the full voter roster never leave the API.
6. Root integration config discovers `tests/integration/*.integration.test.ts`; service-local integration tests alone do not supply CI coverage.
7. Keep simulation governance actions disabled. No demo grant/check, merge, deploy, version bump, dependency lane or new ADR number is authorized.
8. `init.sql` and landing JSON are generated artifacts. Regenerate from source and remove unrelated churn; no hand edits.
9. Database protocol guards fence the legacy writer before containers restart; binary rollback leaves governance writes closed. Preserve history and unrelated membership operations.
10. Ratification only elevates roles; same/lower-role nominations fail. Lock nominee membership for update before granting, with deterministic ordering across all membership locks.
