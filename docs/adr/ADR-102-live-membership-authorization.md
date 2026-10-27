# ADR-102: Authorization Re-derives the Role from Live Membership

**Date**: 2026-10-22
**Status**: Implemented (Sprint 134 PR K v11.100.0 `dd585016`, deployed 2026-10-27, CI/CD 40441255956)
**Sprint**: 134 — PR K (BUG-069, MEDIUM, due 2026-10-30)
**Deciders**: Maintainer (ADR number allocated 2026-10-20; scope set in the Sprint 134 spec); Claude (implementation)
**Related**: [ADR-010](ADR-010-jwt-multi-community-auth.md) (the JWT `communities` claim; amended by this ADR),
[ADR-064](ADR-064-authorize-from-authenticated-identity.md) (identity from the verified JWT, never the body),
[ADR-082](ADR-082-reputation-disclosure-boundary.md) (live membership for disclosure), BUG-065, BUG-069, BUG-071

## Context

ADR-010 put the caller's communities and roles in the JWT (`communities: [{ id, name, role }]`) so a gate could
authorize "with no database lookup per request". The claim is written at login and refresh
(`services/auth-service/src/routes/auth.ts` `generateJWT`) and lives for an hour. Two properties make it wrong
as an authorization input:

- **It is a snapshot.** An admin who is demoted, or who leaves or is removed from the community, keeps the claim
  until the token expires. Every gate that read it kept granting that person admin powers for up to an hour.
- **It is truncated.** `JWT_COMMUNITIES_LIMIT` keeps the 15 most recently joined communities (it keeps the token
  under the PostgreSQL btree index limit). An admin of a 16th community was wrongly refused.

CLAUDE.md already required live lookups for authorization. Sprint 133 PR V fixed four request-service **read**
gates that used the claim (BUG-065). The Sprint 134 PR K inventory classified every claim read in
`services/*/src` (136 `.communities` hits: 90 SQL table references, 19 reads of other objects, 27 claim reads).
21 of those reads were admin or moderator gates in four services, across 31 routes (BUG-069). The same
inventory found that the requester-offer routes were mounted behind the admin mount (BUG-071).

Two more findings shaped the decision:
- No token issuer signs a `role` field, so every `user.role === 'admin'` "platform admin" branch was dead.
- Once checks move to SQL, a malformed community id would reach Postgres and fail with `22P02` (a 500). Today
  the claim check answers 403 for it.

## Decision

**An authorization or visibility decision reads the caller's role from `communities.members`.** The live role
is the `role` on the caller's row with `status = 'active'`; one row exists per `(community_id, user_id)`. The JWT
`communities` claim is a **hint**. It may pick a default community, fan out a notification, or be echoed back to
its holder. It never decides access.

Each service that gates on a role owns one `liveRole` module, with the same API and the same argument order:

| Function | Answers | SQL (all `status = 'active'`) |
|---|---|---|
| `getLiveRole(communityId, userId)` | `'admin' \| 'moderator' \| 'member' \| null` | `SELECT role FROM communities.members WHERE community_id = $1 AND user_id = $2` |
| `isLiveAdmin(communityId, userId)` | `getLiveRole(...) === 'admin'` | — |
| `isLiveAdminOfAnyCommunity(userId)` | platform-wide admin surfaces | `... WHERE user_id = $1 AND role = 'admin' LIMIT 1` |
| `hasLiveRoleInRequestCommunities(requestId, userId, roles)` | request-service only | joins `requests.request_communities` |

Modules: request-service `src/db/liveRole.ts`, community-service `src/utils/liveRole.ts`, reputation-service
`src/utils/liveRole.ts`, social-graph-service `src/database/liveRole.ts`.

Rules every module follows:
- A missing `userId`, or a community or request id that is not a UUID, answers `null`/`false` without a query, so
  a bad id and a foreign id get the same 403.
- An active row whose `role` is NULL is a `'member'`; the column is nullable with `DEFAULT 'member'`.
- A gate always `await`s the helper. An un-awaited call is a truthy Promise and admits everyone.

Each gate keeps its existing scope; only the source of the role changes. "Admin of this community" stays per
community, and the gate must check the community the action targets (Sprint 134 PR K found split assignments and
execute checking the path community but acting on another community's split, BUG-072). "Admin of any community"
(`requireAdmin`, trust questions, the provider-trust backfill) is **inherited, not endorsed**. Anyone who creates a
community is its admin, so these platform-wide surfaces are open to every user (BUG-073). Choosing a real
platform-admin rule is a separate decision.

**Enforcement.** `tests/regression/sprint-134-pr-k-claim-gate.test.ts` parses every tracked service source file and
the shared middleware with the TypeScript AST. It fails on:
- any dot, bracket or destructured read of `communities`/`communityMemberships` on a user object that is not on a
  reviewed hint-only allowlist (matched by file, scope and line, both ways);
- any un-awaited live-role call;
- any service reading the shared tenant middleware's claim-derived `communityRole`, or using
  `adminOnlyMiddleware`.

`tests/integration/sprint-134-pr-k-live-admin-role.integration.test.ts` drives all 31 routes against real SQL, with a
demoted admin, a removed admin and a live admin whose token claims nothing.

## Consequences

### Positive

- A role change takes effect on the caller's **next request**, not when the token expires.
- Admins of communities beyond the 15-entry claim are no longer refused.
- One helper per service replaces hand-written copies that had already drifted in argument order and in how they
  read the result.
- The static gate makes this class (BUG-065, BUG-069) fail at push time instead of in review.

### Negative

- One indexed lookup per gated request (`idx_members_user_id`, `idx_members_community_id`). ADR-010's
  "fast authorization: no database lookup per request" no longer holds for authorization.
- A database outage now fails gated routes closed (500) instead of answering from the claim.

### Neutral

- The frontend still reads the claim to decide which controls to show. A demoted admin may see a control for up
  to an hour; using it is refused with a 403.
- `packages/shared/middleware/tenant.ts` still copies the claim's role onto `req.communityRole`. The gate proves
  that no service reads it.

## Alternatives Considered

### Shorter token lifetime or a revocation list
Either one narrows or closes the window, but every service would still trust the snapshot between checks. It also
does nothing for the 15-entry truncation. Rejected.

### One helper in `packages/shared`
A single implementation, but the shared package does not own a database pool. Each service would pass its own, so
every caller changes anyway. It would also couple every service to a shared-package release for a
four-line query. Rejected in favour of one small module per service with an identical contract, held
together by the static gate.

### Re-issue the token on every role change
The auth service cannot push a new token to a client that is not making requests, and the old token stays valid
until it expires. Rejected.
