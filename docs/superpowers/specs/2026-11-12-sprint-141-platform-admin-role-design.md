# Sprint 141: Platform Admin Role (BUG-073) — Design Spec

**Date**: 2026-11-12
**Status**: Approved (maintainer, 2026-11-12: scope, designation, scope of the global catalogs, no ride-along, ADR-105 and a minor bump)
**Version**: v11.113.0 → v11.114.0 (provisional; re-derive from `origin/master` at merge time)
**Sprint Branch**: `agent/claude/sprint-141-planning` (base `origin/master` `06685ea4`)
**ADR**: ADR-105, allocated by the maintainer 2026-11-12; Proposed until deployed

---

## Overview

Any authenticated user can create a community, and `POST /communities` inserts the creator as that community's
`admin` (`services/community-service/src/routes/communities.ts:595-599`). Three platform-wide surfaces admit "a live
admin of any community". So in practice every user can edit global configuration that every community depends on
(BUG-073, open since 2026-10-22, proposed HIGH):

- the request-type catalog, `requests.ui_schemas`, through every route on request-service's `/admin/schemas` router
  (9 routes);
- the trust questionnaire, `communities.trust_questions` and its choices, through community-service's six write
  routes;
- the whole-platform provider-trust backfill, `POST /reputation/provider-trust/recalculate`.

`auth.users` has no platform-role column, so "admin of any community" has stood in for a platform admin. The
maintainer decided on 2026-10-26 that these are two roles: **community admin** and **platform admin**.

This sprint adds the platform role as an explicit, live-read grant (`auth.platform_admins`). It re-gates exactly
those three surfaces on it and shows the matching admin UI only to platform admins. It changes nothing about
community admins inside their own communities.

### Core Principle: A platform role is granted, never inherited

Creating or administering a community makes you that community's admin and nothing more. Platform powers come only
from an explicit grant that an operator writes, and the grant gives no powers inside any community.

---

## New Concepts

| Term | Meaning |
|---|---|
| **Community admin** | `communities.members.role = 'admin'` with `status = 'active'` for one community. Unchanged. Governs that community only. |
| **Platform admin** | A row in `auth.platform_admins`. Governs the global catalogs (request-type schemas, the trust questionnaire) and platform-wide jobs (the provider-trust backfill). Holds **no** community-scoped power. |
| **Grant / revoke** | An operator SQL step (`INSERT` / `DELETE` on `auth.platform_admins`). There is no API to grant or revoke in this sprint. |

The two roles are independent. One person may hold both, and each check reads only its own source.

---

## Data Model

New migration `infrastructure/postgres/migrations/20261112-auth-platform-admins.sql`. Its date prefix sorts after
the current last migration, `20261106-matches-offer-id-index.sql`.

```sql
-- Sprint 141 (BUG-073, ADR-105): platform admins are designated explicitly, never inherited from a community role.
CREATE TABLE IF NOT EXISTS auth.platform_admins (
    user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    granted_at timestamptz NOT NULL DEFAULT now(),
    note       text
);

COMMENT ON TABLE auth.platform_admins IS
    'Platform admins (ADR-105). Granted and revoked by operator SQL only. A row gives platform-wide powers and no community role.';
```

- **Foreign keys stay in the same schema** (`auth.users`), so there's no cross-schema FK.
- **`granted_by` is nullable**, because the first grant has no granting admin.
- **No seed rows.** Every environment starts with zero platform admins, which is fail-closed.
- **No RLS**, matching `auth.users`, which has none (`init.sql` enables RLS on only some auth tables, for example
  `auth.user_invitations`). Services read the table with plain queries, as seven services already read `auth.users`.
- **Regenerate `infrastructure/postgres/init.sql`** from the migration chain. Never hand-edit it.
- `infrastructure/claude.md` shows the `auth` schema with 14 tables; this one makes 15.

**Curated demo reset.** `services/simulation-service/src/fixtures/curatedDemo/tablePolicy.ts` must classify every base
table (`tablePolicy.ts:4-8`), and `auth.users` is `reset`.
- Classify `auth.platform_admins` as **`reset`**. Its rows reference reset users, and the reset deletes rather than
  truncates, so `ON DELETE CASCADE` would remove them anyway.
- Consequence: a curated demo reset removes every grant, and the operator re-grants afterwards. This is documented,
  not automated.

---

## API Endpoints

### New

| Method | Path | Service | Auth | Response |
|---|---|---|---|---|
| GET | `/users/me/platform-role` | auth-service | Bearer JWT (`authMiddleware`) | `200 { success: true, data: { platformAdmin: boolean } }`, read live from `auth.platform_admins` for `req.user.userId`. 401 without a valid token |

It is mounted under the existing `/users` router (`services/auth-service/src/index.ts:61`; nginx
`location ~ ^/api/users`, `infrastructure/nginx/nginx.conf:160`). Its two-segment path cannot collide with
`GET /users/:userId` (`users.ts:17`), the same way `/me/settings` (`users.ts:74`) doesn't.

### Re-gated: live platform admin required

A caller who fails the check gets the same 403 body from all three services. It discloses nothing else:

```json
{ "success": false, "message": "Platform admin access required", "error": "PLATFORM_ADMIN_REQUIRED" }
```

| Surface | Today's gate | Sprint 141 gate |
|---|---|---|
| request-service: all 9 routes on `adminSchemasRouter` (`services/request-service/src/routes/admin-schemas.ts:21-566`), mounted at `src/index.ts:89-95` | `adminAuth`, i.e. `requireAdmin` → `isLiveAdminOfAnyCommunity` | `platformAdminAuth` = `[verifyToken, requirePlatformAdmin]` |
| community-service: `POST /communities/trust-questions`, `PUT /:id`, `DELETE /:id`, `POST /:id/choices`, `PUT /:id/choices/:choiceId`, `DELETE /:id/choices/:choiceId` (`trust-questions.ts:49,77,111,135,164,197`) | `isLiveAdminOfAnyCommunity` | `isLivePlatformAdmin` |
| reputation-service: `POST /reputation/provider-trust/recalculate` (`providerReviews.ts:132`) | `isLiveAdminOfAnyCommunity` | `isLivePlatformAdmin` |

`GET /communities/trust-questions` stays public, as `community-service/CONTEXT.md:1128` documents. The public
request-type read, `GET /schemas` (`request-service/src/index.ts:78`), is unchanged.

### Unchanged but renamed

request-service's admin-actions mount (boost, propose-match, urgent; `src/index.ts:145-159`) also uses `adminAuth`
today. Its handlers then scope to the request's own communities. It **keeps** the any-community prefilter.
- To end the ambiguity that let BUG-073 hide, rename `requireAdmin` → `requireAnyCommunityAdmin` and `adminAuth` →
  `communityAdminAuth`.
- Behavior is identical: a community admin still reaches admin actions, and a platform admin with no community role
  does not.

---

## Frontend Changes

| File | Change |
|---|---|
| `apps/frontend/src/lib/api.ts` | Add `platformRoleService.get()` → `api.get('/users/me/platform-role')` on the auth client (`api`, `api.ts:177`). The interceptor already unwraps, so callers read `res.data.platformAdmin`. |
| `apps/frontend/src/hooks/usePlatformAdmin.ts` (new) | `{ loading, platformAdmin }`. It fetches once on mount when a token exists. Any error or missing token gives `platformAdmin: false` (fail closed) without throwing. |
| `apps/frontend/src/pages/admin/schemas/index.tsx`, `new.tsx`, `[id]/edit.tsx`, `[id]/versions.tsx`, `pages/admin/trust-questions/index.tsx` | Replace the any-community `requireAdmin`/`isAdmin` gate (`utils/admin-auth.ts`, which reads the localStorage claim). No token → `/login`, as today. Token → wait for the live check; not a platform admin → `/dashboard`, as today's non-admin path does. **No admin data fetch fires before the check passes.** |
| `apps/frontend/src/components/community/CommunityHero.tsx:95-100` | Show the "Schema Manager →" link only when `usePlatformAdmin` says true, not for community admins. |
| `apps/frontend/src/components/CommunityConfigEditor.tsx:428-433` | Show the "Want a custom type? Open Schema Manager →" hint only to platform admins. Others see no link. |

- `utils/admin-auth.ts` is still used by `pages/admin/founding-circle.tsx`, whose server gate is a separate env
  allowlist. Leave it as is, and correct its header comment so it doesn't claim to guard the schema or trust-question
  pages.
- Mobile has no admin surface (no `admin/schemas` or `trust-questions` reference in `apps/mobile`, checked
  2026-11-12).

The UI check is a hint. Each service's live check is the boundary.

---

## User Guide & Doc Updates

| Doc | Change |
|---|---|
| `docs/guides/ADMIN_SCHEMA_MANAGEMENT.md` | Who can manage request types (platform admins only), how a platform admin is designated, and what a community admin sees instead |
| `docs/guides/admin-community-guide.md`, `docs/guides/community-admin-guide.md` | Explain the two roles. Remove any claim that a community admin can open the Schema Manager or edit the trust questionnaire |
| `docs/concepts/trust-questions.md` | Only platform admins edit the questionnaire; communities still answer it |
| `apps/frontend/src/lib/onboarding/workflows.ts` | No mention found (grep, 2026-11-12). Re-check at execution and update only if one exists |
| `docs/adr/ADR-105-platform-admin-role.md` (new) + `docs/adr/README.md` + `ADR_GROUPS` in `scripts/generate-docs.ts` | Records the two-role model, the designation choice, global catalogs and fail-closed rollout. It goes in the *Foundation* group next to `adr-102-live-membership-authorization` (`generate-docs.ts:445`) |
| Landing | Regenerate from source (`npm run generate-docs --workspace=apps/landing`). Commit only the substantive output |
| `services/{request,community,reputation,auth}-service/CONTEXT.md` | The gates and the new endpoint. Correct the request-service (`3276-3278`), community-service (`23-25`) and reputation-service (`101-103`) "admin of any community" text. Community-service's `1131-1146` already say "Platform admin only", which becomes true |
| `services/registry.json` | Add the auth-service endpoint, and mark the platform-admin requirement where endpoint entries carry auth notes |
| `docs/BUGS.md` | BUG-073 → fixed on branch (deployed only after deploy) |
| `docs/IDEAS.md` | Record two later features: **community-owned custom request types**, and **folding the founding-circle reviewer allowlist into `auth.platform_admins`** |
| `infrastructure/claude.md` | `auth` table count 14 → 15 |

---

## Acceptance Criteria

1. A live admin of some community, with no platform grant, gets 403 `PLATFORM_ADMIN_REQUIRED` on all 9 schema routes,
   all 6 trust-question writes and the backfill, and nothing is written.
2. A platform admin with no community role passes those gates. They get the same statuses a community admin got
   before this sprint (root integration rows R1, C5 and P1).
3. A platform admin with no community role is still refused every community-scoped admin route that a live community
   admin passes (the other 23 rows of the PR K table). The roles don't leak in either direction.
4. Admin actions behave exactly as before for community admins: the rename changes no behavior.
5. A stale JWT claim never grants either role (the existing PR K M/F rows still return 403).
6. `GET /users/me/platform-role` answers `true` or `false` from the live table and 401 without a token.
7. Admin pages render nothing administrative, and fetch nothing, for a non-platform admin. The two Schema Manager
   links are shown to platform admins and hidden from community admins.
8. The migration replays cleanly, `init.sql` matches the chain, and the curated demo reset classifies the table.
9. With zero grants (any fresh environment), the three surfaces are closed. Nothing automated calls them; checked
   2026-11-12 by grepping `scripts/`, `infrastructure/`, `.github/` and simulation-service, which found only the
   nginx route and the e2e spec.

---

## Out of Scope

- Any API or UI to grant or revoke platform admins.
- Community-owned custom request types. Recorded in IDEAS.
- The founding-circle reviewer gate (`services/auth-service/src/routes/foundingCircle.ts:129-147`, env allowlist
  plus a DB check). Recorded in IDEAS as a possible fold-in.
- Repairing the deferred WIP suites that touch these routes:
  - `services/request-service/tests/tdd/admin-schemas-api.test.ts`;
  - `services/request-service/tests/integration/dynamic-schemas.test.ts`, a service tier CI never runs;
  - root `tests/tdd/trust-questions-api.test.ts`;
  - `apps/frontend/tests/tdd/SchemaManagerNav.test.tsx`, which exercises its own inline stub, not production code.

  All of these are Sprint 140 PR B material. Retiring any of them needs separate maintainer approval.
- `tests/e2e/admin/schema-management.spec.ts` (not run in CI). It will need a platform-admin fixture; recorded as a
  follow-up.
- The exchange back-out control. The maintainer kept Sprint 141 focused.

---

## Critical Implementation Notes

1. **Two independent roles.** A platform admin gets no community-scoped power, and a community admin (including a
   creator) gets no platform power. No gate may OR the two checks together.
2. **Live lookup, never a claim** (ADR-102). Add `isLivePlatformAdmin(userId)` to each gated service's live-role
   module:
   - `services/request-service/src/db/liveRole.ts`;
   - `services/community-service/src/utils/liveRole.ts`;
   - `services/reputation-service/src/utils/liveRole.ts`.

   The query is `SELECT 1 FROM auth.platform_admins WHERE user_id = $1 LIMIT 1`. An undefined user answers `false`
   without a query. The JWT payload is unchanged and gets no new claim.
   `tests/regression/sprint-134-pr-k-claim-gate.test.ts` derives helper names from these modules, so run it.
3. **Don't narrow the admin-actions prefilter.** Split request-service's middleware so `/admin/schemas` uses
   `platformAdminAuth` and the `/requests` admin-actions mount keeps the any-community check under its new name. The
   mount's `adminChainPaths` coverage (BUG-071) is unchanged.
4. **One 403 body** in all three services: `{ success: false, message: 'Platform admin access required', error:
   'PLATFORM_ADMIN_REQUIRED' }` (ADR-074 string code). It never reveals whether a user is a community admin.
5. **Migration discipline.**
   - Use `IF NOT EXISTS`, same-schema FKs only and no seed rows. The `migration-validator` agent reviews it before
     commit.
   - Regenerate `init.sql` through the `regenerate-init-sql.yml` workflow, because this box has no Docker. That's
     valid only while the branch's `init.sql` is byte-identical to `origin/master`'s, so check with
     `git hash-object` first.
   - Never hand-edit `init.sql`.
6. **Classify the table `reset`** in `tablePolicy.ts`. A curated demo reset removes all grants, and the docs say so.
7. **Fail-closed rollout.** After deploy, nobody can edit schemas or trust questions, or run the backfill, until an
   operator grants a platform admin.
   - The demo grant is a **separate demo data operation that needs the maintainer's explicit authorization**. It runs
     as DB user `karmyq_prod`, after the deploy is verified.
   - The maintainer chooses the account. Don't grant it to a simulation persona whose credentials are shared.
8. **The frontend is a hint, never the boundary.**
   - `usePlatformAdmin` fails closed on every error.
   - Admin pages fire no admin request before the check passes.
   - The API interceptor already unwraps the envelope, so read `res.data`, not `res.data.data`.
9. **Founding-circle is out of scope.** Leave `utils/admin-auth.ts` working for `pages/admin/founding-circle.tsx`; fix
   only its header comment.
10. **Tests.**
    - New tests start in each changed workspace's `tests/tdd/` and go RED before implementation.
    - Promote exact green files with `git mv`. Never run `scripts/promote-tdd-tests.js` directly.
    - Update the existing PR K live-role regression tests (request, community, reputation) and the root integration
      suite `tests/integration/sprint-134-pr-k-live-admin-role.integration.test.ts` to the new expectations, without
      weakening any assertion. The suite keeps its 31-route coverage.
    - Root integration runs only in CI on this Windows box (no local Docker), so record its result as CI-pending
      until the PR's run.
    - Run new suites with `--no-cache`.
    - Check every mocked SQL column against `init.sql`.
11. **Expect landing churn.** `npm test` can rewrite `architecture.json`, `build.json` and
    `concepts/adr-010-*.json`. Restore those three with the printed `--source=` command; keep the substantive
    ADR-105 output.
12. **License gate.** Paraphrase rather than quote phrases like "internal use only" in any new doc or UI copy
    (`docs/gotchas/license-gate-flags-claim-phrases-in-any-tracked-file.md`).
