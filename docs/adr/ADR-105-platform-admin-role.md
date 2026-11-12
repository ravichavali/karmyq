# ADR-105: Platform Admin Is a Granted Role, Separate from Community Admin

**Date**: 2026-11-12
**Status**: Proposed (Sprint 141; becomes Implemented when deployed)
**Sprint**: 141 (BUG-073, proposed HIGH)
**Deciders**: Maintainer (the two-role decision 2026-10-26; scope, designation, global catalogs and this ADR number,
allocated 2026-11-12); Claude (implementation)
**Related**: [ADR-102](ADR-102-live-membership-authorization.md) (authorization reads live state, never the JWT claim;
it recorded the "admin of any community" scope as inherited, not endorsed),
[ADR-010](ADR-010-jwt-multi-community-auth.md) (the JWT `communities` claim, unchanged here),
[ADR-032](ADR-032-server-driven-ui-dynamic-schemas.md) (the request-type schema catalog), BUG-073

## Context

Any authenticated user can create a community, and `POST /communities` makes the creator that community's `admin`.
Three platform-wide surfaces admitted "a live admin of any community":

- the request-type catalog, `requests.ui_schemas`, through the nine routes of request-service's `/admin/schemas`;
- the trust questionnaire, `communities.trust_questions` and its choices (a global table with no community column),
  through community-service's six write routes;
- the whole-platform provider-trust backfill, `POST /reputation/provider-trust/recalculate`.

So in practice every user could edit configuration that every community depends on (BUG-073). `auth.users` has no
platform-role column, so "admin of some community" had stood in for a platform admin. ADR-102 made these gates read
live membership and recorded their scope as inherited. On 2026-10-26 the maintainer decided there are two roles:
**community admin** and **platform admin**.

## Decision

### 1. A platform admin is a row in `auth.platform_admins`

```sql
CREATE TABLE IF NOT EXISTS auth.platform_admins (
    user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    granted_at timestamptz NOT NULL DEFAULT now(),
    note       text
);
```

(`infrastructure/postgres/migrations/20261112-auth-platform-admins.sql`.) The grant is explicit, never inherited:
creating or administering a community makes you that community's admin and nothing more. There are no seed rows, so
every environment starts with zero platform admins. The table has no RLS, matching `auth.users`.

**Operators grant and revoke by SQL only.** This ADR adds no grant API and no UI for it. On the demo host, a grant is a
demo data operation (DB user `karmyq_prod`) that needs the maintainer's authorization, and the maintainer chooses the
account. It must not be a simulation persona whose credentials are shared.

### 2. The two roles are independent, and each check reads only its own source

- A **platform admin** governs the global catalogs (request-type schemas, the trust questionnaire) and platform-wide
  jobs (the provider-trust backfill). The grant gives **no** community-scoped power.
- A **community admin** (`communities.members.role = 'admin'`, `status = 'active'`) governs that community only, and
  gets no platform power.
- No gate ORs the two checks. One person may hold both roles.

### 3. Every check is live (ADR-102)

Each service that gates a platform surface reads the table through its own live-role module:
`isLivePlatformAdmin(userId)` runs `SELECT 1 FROM auth.platform_admins WHERE user_id = $1 LIMIT 1`. An undefined user
answers `false` without a query. The JWT gets no platform claim.

| Surface | Gate |
|---|---|
| request-service `/admin/schemas` (9 routes) | `platformAdminAuth = [verifyToken, requirePlatformAdmin]` |
| community-service trust-question writes (6) | `isLivePlatformAdmin` in each handler |
| reputation-service `POST /reputation/provider-trust/recalculate` | `isLivePlatformAdmin` |

All three refuse with the same body, which does not say whether the caller administers a community:

```json
{ "success": false, "message": "Platform admin access required", "error": "PLATFORM_ADMIN_REQUIRED" }
```

`GET /communities/trust-questions` stays public, because communities still answer the questionnaire.

request-service's admin-actions mount (boost, propose-match, urgent) keeps its any-community prefilter. Its handlers
then scope to the request's own communities. To end the ambiguity that let BUG-073 hide, the middleware is renamed
`requireAnyCommunityAdmin` / `communityAdminAuth`, with unchanged behavior.

### 4. The catalogs stay global

`requests.ui_schemas` and `communities.trust_questions` stay platform-wide and become platform-admin only. Community-owned
custom request types are a separate, later feature (`docs/IDEAS.md`).

### 5. The UI follows the live check as a hint

auth-service answers `GET /users/me/platform-role` → `{ platformAdmin: boolean }` for the verified token's user, read
live. The frontend's `usePlatformAdmin` hook fails closed on every error. The platform admin pages render and fetch
nothing administrative until it says yes, and the two "Schema Manager" links are shown only to platform admins. The
services remain the boundary.

### 6. The curated demo reset clears every grant

`services/simulation-service/src/fixtures/curatedDemo/tablePolicy.ts` classifies `auth.platform_admins` as `reset`. Its
rows reference reset users, and the reset deletes them, so `ON DELETE CASCADE` would remove them anyway. After a
curated reset the operator re-grants. That step is documented, not automated.

## Consequences

- **Fail-closed rollout.** After deploy, nobody can edit request-type schemas or trust questions, or run the backfill,
  until an operator grants a platform admin. Nothing automated calls those surfaces (checked 2026-11-12 across
  `scripts/`, `infrastructure/`, `.github/` and simulation-service).
- **One demo grant is owed after deploy**, and again after every curated demo reset.
- **Community admins lose the two "Schema Manager" links** and access to the admin trust-questions page. They keep
  every community-scoped power, including choosing which request types their community enables.
- **The founding-circle reviewer gate stays separate.** It is an env allowlist plus a DB check in auth-service
  (`routes/foundingCircle.ts`). Folding it into `auth.platform_admins` is recorded in `docs/IDEAS.md`.
- The e2e spec `tests/e2e/admin/schema-management.spec.ts` (not run in CI) needs a platform-admin fixture before it can
  pass again.

## Alternatives Considered

- **A role column on `auth.users`.** That mixes an authorization grant into the identity row, and it can't record who
  granted it or when. A separate table keeps grants auditable and cascades cleanly.
- **A config allowlist (env var of user ids or emails).** Every change needs a redeploy, it drifts between
  environments, and nothing in the database records it. The founding-circle gate's allowlist is the cautionary
  example.
- **A designated "platform" community whose admins are platform admins.** It would reuse the community-role machinery,
  but it reintroduces exactly the coupling BUG-073 is about. Anyone promoted in that community would silently gain
  platform power.
- **Per-community request types and questionnaires.** Each community would own its catalog, and no platform role would
  be needed. That is a larger product change. It is deferred as a separate feature; the global catalogs stay.
- **A platform claim in the JWT.** Rejected by ADR-102. A claim is a login-time snapshot that a revoked admin keeps
  until the token expires.
