# Sprint 132: Inventories and Skills — Design Spec

**Date**: 2026-09-30
**Status**: Approved (maintainer, planning chat 2026-09-30)
**Version**: v11.74.0 → three minor bumps, one per PR, each taken from `origin/master` **at merge time**
**Sprint Branch**: `agent/claude/sprint-132-inventories-skills` (planning + PR A); PR B and PR C each get
a fresh branch cut from `origin/master` after the previous PR deploys
**ADR**: **ADR-099** (allocated by the maintainer, 2026-09-30)

---

## Overview

Karmyq lets people ask for help and offer help. It has no way to say *"I have this and you can use it"*.
The only item-shaped concept is the `borrow` request type (`BorrowRequestForm`, with
`payload.item_category` / `duration_days` / `condition_min`), and it only works one way: someone asks,
and the community hopes someone has one. A household that owns a ladder, a pressure washer and a
canning kit can't record that, and a community tool library can't list its stock. The seed idea is
`docs/IDEAS.md` [2026-09-30] architecture: *individuals and communities should have inventories; we
also need to work on skills*.

Skills are the other half of "what I can offer", and today they are split in two. The profile page
edits **two unrelated stores**: a fixed picker writing `auth.user_skills` (`apps/frontend/src/pages/profile.tsx:22`,
`AVAILABLE_SKILLS`) and a free-text tag editor writing `auth.user_tags` with `tag_type='skill'`
(`apps/frontend/src/components/ProfileTagsSection.tsx`). **Only the first one is used for matching.**
`getUserProfile` (`services/request-service/src/routes/requests.ts:302-329`) reads `auth.user_skills`
and feeds the curated feed's `calculateMatchScore` (`packages/shared/src/matching/index.ts:114`), so a
member who types "Carpentry" into the tag editor, the more prominent control, gets no match credit
for it. The demo seeds neither table (`infrastructure/postgres/seed-data.sql`: 0 rows for either).

This sprint ships **four PRs**. First comes **PR S** (rev 2, maintainer 2026-09-30), a standalone security PR that closes two HIGH authorization holes in live code, BUG-055 (notifications) and BUG-057 (match views); it needs no schema. Then **PR A** makes `user_tags` the single skill store, with a canonical
vocabulary that matching reads. **PR B** adds inventories: personal items that are private until
shared with chosen communities, and community-owned items that admins manage. Members browse what is
reachable to them. **PR C** adds *Ask to borrow*: a request **directed** at the item's owner (or, for a
community item, that community's admins) that nobody else can see, and that then runs the existing
offer → match → message → complete → karma loop unchanged.

### Core Principle: Private until shared, and visibility is re-derived live

An item or a directed request is visible only to the people a live membership lookup says may see it,
never to someone a JWT claim, a feed ranking or an RLS policy happens to let through. Every read path
answers "who is the audience?" with one shared predicate, and a gate fails the build when a new read
path skips it.

---

## Multi-Sprint Arc

### Sprint 131 — Maintenance backlog (complete, v11.56.0–v11.74.0)
About 18 maintenance PRs. The maintainer stopped the upgrade treadmill on 2026-09-30, so product
work is the default from here on.

### Sprint 132 — Inventories + skills single source (this sprint)
PR S security (BUG-055, BUG-057), then PR A skills, PR B inventory catalog, PR C directed borrow. ADR-099.

### Sprint 133+ — candidates (not committed)
- **Skills depth:** endorsements or verification ("vouched by 3 members"), skill-based discovery
  ("who in my community does carpentry?"), and dropping the deprecated `auth.user_skills` table.
- **Inventory-aware matching:** `BorrowMatcher` still guesses possession from skills
  (`packages/shared/src/matching/matchers/borrow.ts:23-43`, with "In real implementation, check user's
  item inventory" at `:103`). Feed it real inventory. That changes a shared package, so it gets its
  own PR.
- **Lending lifecycle:** item-level `on_loan` state, due dates, return confirmation, condition notes.
  Maintainer decision 2026-09-30: not in v1.
- Item photos (needs an upload story), sister-community sharing of items, and a demo seed of skills and items.

---

## New Concepts

| Term | Meaning |
|---|---|
| **Skill vocabulary** | `auth.skill_vocabulary`: canonical skill slugs (e.g. `carpentry`, `pet_care`), each with a display label and synonyms. It seeds from the 24 legacy picker slugs plus the 15 tag suggestions. |
| **Canonical skill slug** | `auth.user_tags.skill_slug`. It is set when a free-text skill tag resolves to a vocabulary entry. Matching reads the slug when present, otherwise a normalized form of the text. |
| **Item** | A row in `inventory.items`: a thing that can be lent. It has exactly one owner, either a user **or** a community. |
| **Share** | A row in `inventory.item_shares`: the owner makes a personal item visible to one community they actively belong to. No shares means private. |
| **Item audience** | The owner; the active members of each community the item is shared with, *while the owner is still an active member of it*; and, for a community-owned item, that community's active members. |
| **Directed request** | A `help_requests` row with `is_directed = TRUE`. Its audience is the requester plus `directed_to_user_id`, or the active admins of `directed_to_community_id`. It never appears on any **browse** surface (feed, curated, open-asks, pulse, matched, dibs, admin lists, export, broadcast notification), **not even for its audience**. The audience reaches it only through **private-access** surfaces: detail, own requests, the Helping inbox, match views, its own notifications. |

---

## Data Model

Migration conventions: `YYYYMMDD-slug.sql`, `IF NOT EXISTS` guards, then
`scripts/regenerate-init-sql.sh` and commit both (`tests/regression/sprint-120-init-sql-drift-gate.test.ts`
enforces it). Run the `migration-validator` agent before committing each migration.

⚠️ **RLS is not a boundary for these tables.** `init.sql` states that the entrypoint's `POSTGRES_USER`
owns every object, and it has no `FORCE ROW LEVEL SECURITY`, so owner-role connections bypass the
existing policies (for example `community_isolation` on `requests.help_requests`, `init.sql:6749`).
The role the demo services connect as is **UNVERIFIED** (`DATABASE_URL` comes from the host env).
**All visibility in this sprint is enforced in application SQL and proven by tests.** No RLS policy
is added, so there is no false sense of safety.

### PR A — `20260930-skill-vocabulary.sql`

```sql
CREATE TABLE IF NOT EXISTS auth.skill_vocabulary (
  slug      VARCHAR(50)  PRIMARY KEY,
  label     VARCHAR(100) NOT NULL,
  synonyms  TEXT[]       NOT NULL DEFAULT '{}'   -- lower-cased, trimmed
);
-- Seed: the 24 slugs of profile.tsx AVAILABLE_SKILLS (driving … organizing) with labels, plus the
-- 15 TAG_SUGGESTIONS.skill entries (services/auth-service/src/constants/tagSuggestions.ts) folded
-- in as labels/synonyms. 'Spanish tutoring' → tutoring, 'Moving help' → moving, 'Pet care' → pet_care,
-- 'Elder care' → elder_care (new slug), 'Bookkeeping' → bookkeeping (new), 'Web design' → design, etc.
INSERT INTO auth.skill_vocabulary (slug, label, synonyms) VALUES (...) ON CONFLICT (slug) DO NOTHING;

ALTER TABLE auth.user_tags
  ADD COLUMN IF NOT EXISTS skill_slug VARCHAR(50) NULL REFERENCES auth.skill_vocabulary(slug);
-- A slug only makes sense on a skill tag. Named constraint, guarded, for idempotency:
--   CHECK (skill_slug IS NULL OR tag_type = 'skill')

-- Backfill 1: resolve existing free-text skill tags.
UPDATE auth.user_tags t SET skill_slug = v.slug FROM auth.skill_vocabulary v
 WHERE t.tag_type = 'skill' AND t.skill_slug IS NULL
   AND (lower(trim(t.tag_value)) = v.slug OR lower(trim(t.tag_value)) = lower(v.label)
        OR lower(trim(t.tag_value)) = ANY (v.synonyms));
-- Backfill 2: copy legacy picker skills in as tags (label as text, slug resolved).
INSERT INTO auth.user_tags (user_id, tag_type, tag_value, skill_slug)
SELECT s.user_id, 'skill', v.label, v.slug
  FROM auth.user_skills s JOIN auth.skill_vocabulary v ON v.slug = s.skill
ON CONFLICT ON CONSTRAINT user_tags_unique DO NOTHING;

COMMENT ON TABLE auth.user_skills IS 'DEPRECATED Sprint 132 (ADR-099): superseded by auth.user_tags '
  '(tag_type=skill, skill_slug). Kept only so an image rollback still boots; drop in a later sprint.';
```

⚠️ **The vocabulary rows must ALSO go into `infrastructure/postgres/seed-data.sql`** (rev 1, after plan
review). `scripts/regenerate-init-sql.sh` dumps **schema only** (`--schema-only`, `:53`), appends
`seed-data.sql`, and then writes a ledger marking **every** migration applied (`append_migration_backfill`).
A fresh database built from `init.sql` would therefore have an empty `auth.skill_vocabulary`, and
`apply-migrations.sh` would skip the seeding migration because the ledger says it has run. CI's
full-chain replay (`scripts/ci-apply-full-schema.sh`) re-runs the migration, and that hides the gap.
The same `INSERT … ON CONFLICT (slug) DO NOTHING` goes in both files. A no-DB regression test asserts
**exact parity** between the slug/label/synonym sets in the migration and in `seed-data.sql`, and it
fails if either file drifts. PR A's validation runs the vocabulary check against a database
initialized from the regenerated `init.sql` **before** any migration replay.

`auth.user_skills` is **not dropped**. A failed deploy rolls back the images but not the database
(`scripts/deploy.sh`), and the old images still read it.

### PR B — `2026MMDD-inventory-schema.sql`

```sql
CREATE SCHEMA IF NOT EXISTS inventory;

CREATE TABLE IF NOT EXISTS inventory.items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id      UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_community_id UUID NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
  name               VARCHAR(120) NOT NULL,
  description        TEXT,
  -- Same vocabulary as BorrowMatcher's itemCategorySkills keys (borrow.ts:25-34), so PR C's
  -- prefilled borrow request carries a category the matcher already understands.
  category           VARCHAR(30) NOT NULL
    CHECK (category IN ('tools','electronics','kitchen','books','sports','camping','party','other')),
  -- Same vocabulary as BorrowRequestPayload.condition_min (BorrowRequestForm.tsx:12).
  condition          VARCHAR(20) NULL CHECK (condition IN ('fair','good','like_new','new')),
  status             VARCHAR(20) NOT NULL DEFAULT 'available'
    CHECK (status IN ('available','unavailable')),
  created_by         UUID NOT NULL REFERENCES auth.users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT items_exactly_one_owner CHECK ((owner_user_id IS NULL) <> (owner_community_id IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_items_owner_user      ON inventory.items(owner_user_id)      WHERE owner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_items_owner_community ON inventory.items(owner_community_id) WHERE owner_community_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS inventory.item_shares (
  item_id      UUID NOT NULL REFERENCES inventory.items(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
  shared_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (item_id, community_id)
);
CREATE INDEX IF NOT EXISTS idx_item_shares_community ON inventory.item_shares(community_id);
```

`created_by` has no `ON DELETE` action. A user who created community items can therefore not be
hard-deleted until those items are reassigned or removed. **The executor must check** how account
deletion works today (grep `DELETE FROM auth.users`) and choose `ON DELETE SET NULL` with a nullable
column if deletion is a live path. Record the decision in ADR-099.

Shares are only valid on personal items. The app rejects a share on a community-owned item with a 400.
A trigger is not needed, because the audience predicate below only consults shares for
`owner_user_id` items.

### PR C — `2026MMDD-directed-requests.sql`

```sql
ALTER TABLE requests.help_requests
  ADD COLUMN IF NOT EXISTS is_directed              BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS directed_to_user_id      UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS directed_to_community_id UUID NULL REFERENCES communities.communities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inventory_item_id        UUID NULL REFERENCES inventory.items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_help_requests_directed_user ON requests.help_requests(directed_to_user_id)
  WHERE is_directed;
```

**`is_directed` is the fail-closed switch, not the target columns.** If the target user or community
is deleted, `SET NULL` empties the target. Because visibility keys off `is_directed`, the request then
narrows to the requester alone. It never widens to the community.

---

## Audience predicates (the heart of the sprint)

Each predicate lives in **one** module, as SQL fragments with a bound viewer parameter. Every
read path composes them; no read path writes its own version.

**Item predicates** (`services/request-service/src/db/inventoryDb.ts`), for viewer `$v`. The *manager*
predicate is defined separately and composed into the *audience*, so management access never depends
on availability. (Rev 1, after plan review: the first draft admitted every member to an `unavailable`
community item.)

```
-- itemManagerSql: may see every status and may write
i.owner_user_id = $v
OR (i.owner_community_id IS NOT NULL AND EXISTS (active ADMIN $v of i.owner_community_id))

-- itemAudienceSql: may see (read paths use this)
<itemManagerSql>
OR (i.status = 'available' AND (
      (i.owner_community_id IS NOT NULL AND EXISTS (active member $v of i.owner_community_id))
   OR (i.owner_user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM inventory.item_shares s
        JOIN communities.members viewer ON viewer.community_id = s.community_id AND viewer.user_id = $v AND viewer.status = 'active'
        JOIN communities.members owner  ON owner.community_id  = s.community_id AND owner.user_id  = i.owner_user_id AND owner.status = 'active'
        WHERE s.item_id = i.id))))
```

**Only managers see a non-`available` item.** A personal item's manager is its owner; a community
item's managers are that community's active admins. Ordinary members and outsiders see only
`available` items, and only through membership or a live share. Leaving a community silently
withdraws the owner's shares there: they stay in the table and reappear if the owner rejoins.

**Directed requests have two predicates, for two different kinds of surface** (rev 1, after plan
review: the first draft used one predicate everywhere, which would have put a directed ask on its
*recipient's* browse feed).

```
-- notDirectedSql: BROWSE surfaces (feed, curated, open-asks, pulse, matched, dibs, admin lists, export)
NOT r.is_directed

-- directedAudienceSql: PRIVATE-ACCESS surfaces (detail, own requests, Helping inbox, match views, offering)
NOT r.is_directed
OR r.requester_id = $v
OR r.directed_to_user_id = $v
OR (r.directed_to_community_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM communities.members m WHERE m.community_id = r.directed_to_community_id
        AND m.user_id = $v AND m.status = 'active' AND m.role = 'admin'))
```

A directed ask is **never on any browse surface, not even for its recipient or requester.** It is
reachable only through private-access surfaces, and only by its audience. Both fragments live in
`services/request-service/src/db/directedAudience.ts`.

The JWT `communities` claim is never consulted (CLAUDE.md, *Authorization decisions MUST re-derive
membership from a live lookup*).

---

## API Endpoints

All responses use the ADR-074 envelope. New request-service routes mount under `/requests/inventory`,
which nginx already forwards (`infrastructure/nginx/nginx.conf:178`, `location ~ ^/api/requests(/.*)?$`).
No nginx change is needed.

### PR S — security: caller and participant scoping (BUG-055, BUG-057), no schema

Extracted from PR C's Task C4b on 2026-09-30 (maintainer): both holes affect existing data today, and
neither fix needs inventory. `directedAudienceSql` on match views stays in PR C.

| Method | Path | Change |
|---|---|---|
| GET | `/notifications/:userId`, `/:userId/unread-count`, `/:userId/preferences` | 403 `FORBIDDEN` unless `:userId` equals the JWT `userId` |
| PUT | `/notifications/:userId/read-all`, `/:userId/preferences` | same |
| PUT/DELETE | `/notifications/:notificationId/read`, `/notifications/:notificationId` | owner = JWT `userId`; body `user_id` ignored; not the caller's → 404 |
| GET | `/matches` | rows restricted to matches where the caller is requester, responder or offerer; the `user_id` query param is ignored (the caller is always the subject); other filters still narrow |
| GET | `/matches/:id` | 404 unless the caller is requester, responder or offerer |


| Method | Path | Change |
|---|---|---|
| GET | `/auth/profile/tags/suggestions?tag_type=skill` | Serves labels from `auth.skill_vocabulary` instead of the constant. `interest`/`need` keep using `TAG_SUGGESTIONS`. |
| POST | `/auth/profile/tags` | For `tag_type='skill'`, resolves `skill_slug` (case-insensitive match on slug, label or synonym) and returns it. Unresolved text is accepted with `skill_slug: null`. |
| GET | `/auth/profile/tags` | Each skill entry gains `skill_slug`. |
| GET/POST/DELETE | `/users/:userId/skills[/:skillId]` | **Removed** (`services/auth-service/src/routes/users.ts:69-140`). The only caller is the profile picker this PR deletes (the repo-wide grep on 2026-09-30 found `profile.tsx` only; mobile has none). This also closes the unauthenticated `GET /users/:userId/skills`. |
| GET | `/requests/curated` | Unchanged contract. `getUserProfile` reads skills from `user_tags`. |
| GET | `/requests/matched/for-user` | Its `EXISTS` over `auth.user_skills` (`requests.ts:262-279`) moves to `user_tags.skill_slug`. It has no frontend caller (`api.ts:488` `getMatchedRequests` is never called), so it is noted in IDEAS as a removal candidate, not removed here. |

### PR B — request-service, `/requests/inventory`

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/requests/inventory/mine` | JWT | — | `{ items: Item[] }` (own personal items, every status, each with `shared_with: {id,name}[]`) |
| GET | `/requests/inventory/community/:communityId` | JWT + live active membership, else 403 | — | `{ community_owned: Item[], shared_by_members: (Item & {owner:{id,name}})[] }` filtered by the item audience |
| GET | `/requests/inventory/items/:id` | JWT | — | `Item`, or **404 when not in the audience** (existence is not leaked) |
| POST | `/requests/inventory/items` | JWT; a live admin check when `owner_community_id` is set | `{ name, description?, category, condition?, owner_community_id? }` | 201 `Item`. Personal items start with no shares (private) |
| PATCH | `/requests/inventory/items/:id` | owner, or a live admin of the owning community | any of `name, description, category, condition, status` | `Item` |
| DELETE | `/requests/inventory/items/:id` | same as PATCH | — | `{ deleted: true }` (hard delete; PR C references it by `SET NULL`) |
| PUT | `/requests/inventory/items/:id/shares` | owner of a **personal** item | `{ community_ids: string[] }` (replaces the set; `[]` means private) | `{ shared_with }`. 400 if any id isn't a community where the owner is an active member, or if the item is community-owned |

Input validation is **hand-written, like the existing request-service routes**. (Rev 1: the first
draft said "zod, like the existing routes", which was false. request-service declares no `zod`
(`services/request-service/package.json`), and no service imports it directly; shared zod schemas
reach request-service only as types, e.g. `routes/providers.ts:5`.) Importing zod would need a
declared dependency plus a lockfile splice, which is dependency work the sprint doesn't need.
The bounds: `name` is 1–120 characters after trimming, `description` at most 2000, `category` and
`condition` must be in the enum, and `community_ids` holds at most 50 unique UUIDs.

### PR C — request-service (+ notification-service)

| Method | Path | Change |
|---|---|---|
| POST | `/requests/inventory/items/:id/borrow` | **New.** Body `{ community_id, duration_days, return_date?, description? }`. The server checks, live, that the item is in the requester's audience **through `community_id`**, that the requester doesn't own it, and that it is `available`. It then creates a `borrow` request with `is_directed=TRUE`, the target (owner user, or `directed_to_community_id` for community items), `inventory_item_id`, a title derived from the item name, `payload.item_category` = item category, and one `request_communities` row for `community_id` (karma/standing attribution stays per community). It publishes **`directed_request_created`**, never `request_created`. |
| GET | `/requests/inventory/asks/incoming` | **New (rev 2).** Open, unexpired directed requests where the caller is in the audience **and is not the requester** and has no live match (`proposed`/`matched`) on it, newest first. Mounted under the inventory router (before `requestsRouter`, note 3). After the recipient offers, the ask leaves this list and appears in Helping through `GET /matches`. |
| GET | `/requests/:id` | Returns **404** for a directed request when the viewer isn't in its audience. Response gains `is_directed`, `inventory_item_id` and `directed_to` (`{kind:'user'|'community_admins', id, name}`) for audience members. |
| POST | `/matches` | For a directed request, only an audience member other than the requester may offer. Everyone else gets 403 `NOT_IN_AUDIENCE`, through `getRequestReachability` (`services/request-service/src/db/eligibility.ts`), which gains the directed predicate. |
| every browse list/feed/pulse/export | (see *Surfaces* below) | Directed requests are **always** excluded (`notDirectedSql`), for every viewer including the audience. |
| GET | `/matches`, `/matches/:id` | **Participant scoping ships in PR S** (rev 2); PR C adds only `directedAudienceSql`. Background (BUG-057): Today `GET /matches` has only optional, client-supplied filters (`matches.ts:15-40`, `user_id` spoofable), and `GET /matches/:id` checks only the id (`matches.ts:83-104`). Both return request content and emails. Rows are restricted to matches where the caller (JWT `userId`) is the requester, responder or offerer, **plus** `directedAudienceSql`. A `user_id` query param must equal the caller or it is ignored; `/:id` returns 404 otherwise. The frontend passes only the caller's own id (`CommitmentsTab.tsx:165`, `MyRequestsTab.tsx:61`), so it is unaffected. |
| ALL | `notification-service` `/notifications/*` user routes | **Ships in PR S** (rev 2); PR C only depends on it. Background (BUG-055): `GET /:userId`, `/:userId/unread-count`, `PUT /:userId/read-all` and `GET/PUT /:userId/preferences` trust the URL id (`notifications.ts:75,108,163,219,238`). `PUT /:notificationId/read` and `DELETE /:notificationId` trust a **body** `user_id` (`:127,:184`). Every route uses the JWT `userId`: a URL id that differs gets 403 (the same shape as the SSE stream's existing check, `:19-35`), and a body `user_id` is ignored. The frontend passes only the caller's own id (`api.ts:643-655`). Without this, `directed_request_created` would put the ask's title where any logged-in user can read it. |
| `POST /requests` | — | Rejects client-supplied `is_directed`, `directed_to_*` and `inventory_item_id` with 400, because directed requests come only from the borrow endpoint. |

**Event:** `directed_request_created` `{ request_id, requester_id, recipient_user_ids[], title, inventory_item_id }`
→ Notification. Request-service resolves `recipient_user_ids` live at publish time (owner, or the
community's active admins). The subscriber notifies exactly those ids. This is needed because
`request_created` notifies **every active member** of the community, with the title
(`services/notification-service/src/events/subscriber.ts:164-173`).

### Surfaces that must apply the directed predicate (PR C)

These are the read paths over `requests.help_requests`, from a grep on 2026-09-30. The executor must
re-derive the list with the **untruncated** grep (`grep -rn "help_requests" services/*/src`) and
classify **every** hit, not trust this table:

Each surface is **browse** (`notDirectedSql`: excluded for everyone) or **private access**
(`directedAudienceSql`: audience only). Treat any surface you're unsure about as browse.

| File | Surface | Kind → treatment |
|---|---|---|
| `request-service/src/routes/requests.ts` | `GET /` (:186), `/matched/for-user` (:216), `/curated` (:333), `/community/:id/pulse` (:1484), `/community/:id/open-asks` (:1529) | **browse** → `notDirectedSql`, **except `GET /` with `requester_id`** (rev 2, traced: `MyRequestsTab.tsx:60` passes `requester_id`, which `queryBuilder.ts:87-91` applies as a client-controlled filter). Directed rows are admitted **only when `requester_id` equals the JWT caller**, and the requester restriction stays. A missing `requester_id`, or one naming another user, excludes directed rows. |
| `request-service/src/routes/requests.ts` | `GET /:id` (:1675), `/offered-awaiting` (:1590) | **private access** → 404 / `directedAudienceSql` |
| `request-service/src/services/feed/feedComposer.ts`, `utils/queryBuilder.ts`, `services/feed/basicFeedRanker.ts` | `/requests/feed` | **browse** |
| `request-service/src/routes/dibs.ts`, `db/dibsDb.ts` | dibs candidates | **browse** (provider dibs doesn't apply) |
| `request-service/src/routes/adminActions.ts` | boost / propose-match / triage | **browse** → 404 on directed requests (admins act on the community feed, and a directed ask isn't on it) |
| `request-service/src/routes/matches.ts`, `db/offersDb.ts` | offer creation, `GET /matches`, `GET /matches/:id` | **private access**. These views are **NOT participant-scoped today** (BUG-057): add participant scoping **and** `directedAudienceSql` (see the API table). Offer creation: audience only, via `getRequestReachability`. |
| **Incoming asks (NEW, PR C)** `GET /requests/inventory/asks/incoming` | the recipient's unanswered directed asks | **private access**. Rev 2, traced: Helping has **no** inbox for a request without a match. `CommitmentsTab.tsx:165` builds from `GET /matches`, and its decision band (`:147-149`) uses `/requests/curated`, which is browse. No predicate change can surface an unanswered ask, so PR C adds this query and a Helping section for it. |
| `community-service/src/routes/stats.ts`, `routes/export.ts` | community stats / admin export | **browse**: exclude directed rows from lists. Counts may include them (**executor decides, recorded in ADR-099**). |
| `notification-service/src/events/subscriber.ts` | `request_created` fan-out | never receives directed requests; new handler for `directed_request_created` |
| `notification-service/src/routes/notifications.ts` | notification reads/writes | **Not a `help_requests` read, so the scan below can't see it.** It carries the ask's title after PR C, so it must be caller-scoped (BUG-055; see the API table). |
| reputation / cleanup / social-graph / messaging / simulation hits | karma, expiry, paths, message joins | classify each hit as *not a listing* or *needs a predicate*, with a reason in the gate allowlist |

A **regression gate** (`services/request-service/tests/regression/sprint-132-directed-audience-gate.test.ts`
after promotion) scans the untruncated set of SQL strings over `requests.help_requests` in `services/*/src`.
Every hit must reference `notDirectedSql` or `directedAudienceSql` (by marker comment) or sit in an
allowlist entry that carries a reason. A negative fixture (a new listing query with neither predicate)
proves the gate fails. **The scan only sees `help_requests` SQL.** Data derived from a directed ask
that lives in another table (notifications, messages) is covered by the per-route authorization
tests, not by the gate.

---

## Frontend Changes

### PR A
- `apps/frontend/src/pages/profile.tsx`: delete `AVAILABLE_SKILLS`, the `UserSkill` state,
  `fetchUserSkills` and the picker UI. `ProfileTagsSection` becomes the only skills editor.
- `ProfileTagsSection.tsx`: skill suggestions come from the vocabulary endpoint. A resolved tag shows
  a subtle "matched to *Carpentry*" hint (`skill_slug` present), so members understand why a skill counts.
- Tests: the render shows no second picker, and adding "carpentry" posts `{tag_type:'skill', tag_value:'carpentry'}`.

### PR B
- `apps/frontend/src/lib/api.ts`: `inventoryService` on the request-service client
  (`mine`, `forCommunity`, `get`, `create`, `update`, `remove`, `setShares`).
- **New page** `apps/frontend/src/pages/inventory/index.tsx` ("My things"): list, add/edit form
  (name, category, condition, description, available toggle), and a *Share with…* checklist of the
  member's communities. The empty state explains "private until you share it".
- **New community tab** `apps/frontend/src/components/community/tabs/InventoryTab.tsx` ("Shared
  things"), wired in `pages/communities/[id].tsx` next to `BrowseTab`/`ActiveTab`. It has two
  sections, *Community-owned* and *Shared by members*, and an **Add community item** button rendered
  only for admins. The render gate uses the role hint; the server enforces it with the live check.
- Nav entry in `Layout.tsx` ("My things"), plus an onboarding workflow step in
  `apps/frontend/src/lib/onboarding/workflows.ts`.

### PR C
- An **Ask to borrow** button on item cards (community tab and item view), hidden on your own items
  and on `unavailable` ones. It opens a compact form (duration, optional return date and note, and
  which community when the item is visible to you through more than one), then
  `POST /requests/inventory/items/:id/borrow` and navigates to the new request.
- Request detail shows a "Private request to *Maria*" / "…to *Southeast PDX Helpers* admins" banner.
- **New Helping section "Asked of you"** (rev 2) in `CommitmentsTab.tsx`, fed by
  `GET /requests/inventory/asks/incoming`, rendered **before** an offer exists: item, requester,
  duration, and an **Offer** action that runs the normal `POST /matches`. After the offer, the ask
  leaves this section and shows as a commitment from `GET /matches`. The owner is also notified.

---

## User Guide & Doc Updates

| PR | Doc | Change |
|---|---|---|
| A | `docs/guides/profile-guide.md` | Replace the two-skills-editors description with the single Skills tag editor. Explain "matched to" and why matching uses it. |
| A | `docs/guides/fulfilling-requests-guide.md` | The "requests ranked by your skills" wording now points at profile skill tags. |
| A | `apps/frontend/src/lib/onboarding/workflows.ts` | The Dashboard step's "ranked by your skills" copy is unchanged, but check that the profile step references the tag editor. |
| B | **New** `docs/guides/sharing-your-things-guide.md` | Add items, private by default, sharing per community, leaving a community withdraws shares, community-owned items (admins). Add the slug to `GUIDE_ORDER` in `scripts/generate-docs.ts`. |
| B | **New** `docs/concepts/inventories.md` | Why inventories, private-until-shared, the two owners, and the audience rule. Add to `CONCEPT_ORDER` **and** `howItWorks`. |
| B | `docs/guides/community-admin-guide.md` | A "Community-owned items" section. |
| C | `docs/guides/sharing-your-things-guide.md` | An "Asking to borrow" section: private to the owner, what the owner sees, and that the karma loop is unchanged. |
| C | `docs/guides/making-requests-guide.md` | Borrow requests: the difference between a general borrow ask (community-visible) and *Ask to borrow* on an item (private). |
| C | `docs/concepts/inventories.md` | Directed requests and the fail-closed rule. |
| A | **ADR-099** `docs/adr/ADR-099-inventories-and-directed-requests.md` | Written in **PR A** (status Accepted) covering the whole sprint: skills single source, inventory schema + audience, directed requests. PR B and PR C amend its implementation notes, and it flips to Implemented when PR C deploys. Indexed in `docs/adr/README.md`, with the slug added to an `ADR_GROUPS` group in `scripts/generate-docs.ts`. It also records the skills single-source decision from PR A. |

Author sources only; never hand-edit `apps/landing/src/data/docs/`. A newly generated page needs
`git add -f`, and the timestamp/sha churn from `npm test` has to be reverted before each commit.

---

## Critical Implementation Notes

1. **RLS doesn't protect these tables. Application SQL does.** The owner connection bypasses the
   existing policies (there's no `FORCE ROW LEVEL SECURITY` in `init.sql`, and the demo connection role
   is UNVERIFIED). Every visibility rule is a SQL predicate in one module, with tests proving both
   halves: the audience sees it and a non-audience member gets 404 or absence.
2. **Live membership only.** Item audience, admin writes, share validation and directed audience
   all query `communities.members` (`status='active'`, `role='admin'` where relevant). Never read
   `req.user.communities` for a decision. `adminActions.ts:9-23` is the anti-pattern (claim-derived
   admin check); don't copy it.
3. **Route order: mount `/requests/inventory` BEFORE `requestsRouter`** in
   `services/request-service/src/index.ts`, the same way `/requests/feed` is mounted first (`index.ts:99-106`).
   Otherwise `GET /requests/:id` (`requests.ts:1675`) captures `/requests/inventory` as `id='inventory'`.
   A test must hit `GET /requests/inventory/mine` through the real app and see the inventory handler.
4. **Directed requests fail closed on `is_directed`.** The target columns are `ON DELETE SET NULL`.
   Visibility keys off `is_directed`, so a deleted target narrows the audience to the requester and
   never opens it to the community. Test it: set the target to NULL, and a community member still
   gets 404.
5. **Never publish `request_created` for a directed request.** Its subscriber broadcasts the title to
   every active member (`notification-service/src/events/subscriber.ts:164-173`). Publish
   `directed_request_created` with live-resolved recipients. Update `services/registry.json` events and
   both services' CONTEXT.md.
6. **Classify every `help_requests` read path, untruncated.** The Surfaces table is a starting
   point from a 2026-09-30 grep. Re-run the grep without `| head`, classify every hit, and make the gate
   derive its inventory from the same live scan, not from a hand-written list. The gate must go red on
   an injected unguarded listing query (proven on a committed tree, restored from a byte copy).
7. **`GET /requests/:id` 404s a directed request for non-audience viewers *before* building the
   response.** That route currently returns any request, including `requester_email`, to any
   authenticated caller who has the id. That pre-existing breadth for *non-directed* requests is
   **out of scope**: it is logged as **BUG-056** (the maintainer decides). Don't widen this sprint to fix it.
8. **Don't drop `auth.user_skills` in PR A.** A failed deploy rolls back the images and not the
   schema, and the old images read that table. Deprecate it with a `COMMENT` and drop it in a later sprint.
9. **Skill-slug resolution is exact after normalization, not fuzzy.** Normalize with
   lower + trim, then match on the slug, the label or a synonym. Don't use substring matching at write
   time: the shared matchers already substring-match at score time (`packages/shared/src/matching/utils.ts:62-66`),
   and doing it twice over-credits. An unresolved tag still reaches matching as
   `lower(regexp_replace(trim(tag_value), '[^a-z0-9]+', '_', 'gi'))`.
10. **Item categories and conditions reuse the existing borrow vocabularies**
    (`borrow.ts:25-34` keys; `BorrowRequestForm.tsx:12`), so PR C's prefilled request is a valid borrow
    request that the matcher understands. Don't invent a third vocabulary.
11. **No `packages/shared` change this sprint.** Inventory-aware `BorrowMatcher` is a Sprint 133
    candidate. Keeping shared untouched keeps the blast radius to auth, request, notification,
    community (read-only filters) and frontend.
12. **Version and merges.** Each PR bumps the minor from `origin/master`'s `package.json` at merge time
    (both `package.json` and `package-lock.json` root version). Merge one PR at a time, and wait for
    the deploy and health verify to finish. Each merge needs explicit maintainer authorization.
13. **Demo data.** The curated demo seeds no skills or items (`seed-data.sql`; both tables are `reset`
    in `simulation-service/src/fixtures/curatedDemo/tablePolicy.ts:41,49`). The reset only walks
    `MANAGED_SCHEMAS` (`tablePolicy.ts:11`), and an unclassified base table in a managed schema is a
    hard failure (`tablePolicy.ts:5-6`). So PR B must **add `'inventory'` to `MANAGED_SCHEMAS`** and
    classify `inventory.items` and `inventory.item_shares` as `'reset'`. If the schema were left
    unmanaged, reset would silently ignore it, and its FKs into `auth.users` /
    `communities.communities` would break the reset's truncation of those tables. PR A adds
    `auth.skill_vocabulary` as **`'preserve'`** (global reference data, like the preserved global
    templates), because a reset that wipes it breaks tag resolution. Verify both with
    `services/simulation-service/tests/regression/sprint-117-reset-safety.test.ts`. Seeding demo items
    is out of scope, and any demo data operation needs its own per-operation authorization.

**Added in rev 1 (plan review relayed by the maintainer, 2026-09-30; each finding verified against the repo):**

14. **Close the existing read holes FIRST, in PR S (rev 2; was PR C Task C4b), BUG-055 and BUG-057.**
    Notification routes trust a URL or body user id (`notification-service/src/routes/notifications.ts:75,108,127,163,184,219,238`),
    and `GET /matches` / `GET /matches/:id` aren't participant-scoped (`request-service/src/routes/matches.ts:15-40,83-104`).
    PR C caller-scopes all of them, with cross-user tests for each route: an unrelated viewer, omitted
    filters, and a spoofed `user_id` in the URL, query or body. The `help_requests` gate can't see these,
    because notifications live in another table.
15. **Reference data goes in `seed-data.sql` as well as the migration.** `init.sql` is schema-only
    plus `seed-data.sql` plus a ledger marking every migration applied, so a migration-only seed is
    lost on fresh installs. An exact-parity regression test guards it (see *Data Model → PR A*).
    **Fresh-install proof is a blocking CI step** (rev 2): in `ci.yml` `test-integration`, after the
    environment is healthy and **before** *Prove init.sql matches the full migrated schema* (`ci.yml:316`),
    `docker exec karmyq-postgres-test psql` (initialized from `init.sql` via
    `tests/docker-compose.test.yml:24`) asserts the exact vocabulary contents and the ledger row for
    `20260930-skill-vocabulary.sql`. Regenerating the committed `init.sql` still needs Docker on the Mac or an authorized disposable host.
16. **Integration tests live in ROOT `tests/integration/`.** That is the only place CI's
    *Integration Tests* job looks (`tests/jest.integration.config.js:17` `roots: ['<rootDir>/integration']`,
    `testMatch: ['**/*.integration.test.ts']`). Workspace `tests/integration/` files are run by no CI job.
    Under `CI=true` the tests must **fail**, not skip, when the database is unreachable. The executor
    confirms from the *Integration Tests* job log that the sprint-132 files ran.
17. **Browse vs private access.** Browse surfaces use `notDirectedSql` and exclude every directed ask
    for every viewer; private-access surfaces use `directedAudienceSql`. A test proves that the
    **recipient's own** browse feed does not contain the ask.
18. **`init.sql` regeneration** needs `REGEN_PG_CONTAINER` (a dedicated, disposable Postgres 15
    container; `regenerate-init-sql.sh:108-118`) and writes `init.sql.generated` by default (`:15`).
    Review its diff against `init.sql`, then promote it (copy over `init.sql`) and delete the
    `.generated` file. Never hand-edit `init.sql`.
19. **No zod.** request-service validates by hand; follow that style (see *API → PR B*).
20. **`GET /requests` with `requester_id`** (rev 2): directed rows only when `requester_id` equals the
    JWT caller. Three tests: own id → own directed asks included; missing → excluded; another user's
    id → excluded, and that user's directed asks never leak.
21. **Unanswered directed asks need their own query** (rev 2): `GET /requests/inventory/asks/incoming`
    plus the Helping *Asked of you* section. Test the transition: the ask is listed → the recipient offers →
    it leaves *incoming* and appears through `GET /matches`.
22. **BUG-056 stays separate** from the authorization fixes. It is a visibility-policy decision with its
    own severity, owner and deadline in `docs/BUGS.md`.
