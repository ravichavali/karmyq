# Community Service Context

> **Quick Start**: `cd services/community-service && npm run dev`
> **Port**: 3002 | **Health**: http://localhost:3002/health

## Recent Changes

- **2026-11-23 (Sprint 145, BUG-108 fixed in this branch, pending deploy; ADR-062 amended):** the duplicate-create
  join of an existing public community (`POST /communities`) answered `joined: true` even when its
  `ON CONFLICT DO NOTHING` had not admitted anyone: a pending applicant, a blocked member, a NULL/unknown row. It also
  never rejoined a `left` row, and invented role `member` when the refreshed token lacked the community. It now
  decides from the caller's row locked `FOR UPDATE` inside the existing `withTransaction` and re-reads community state
  on that client (contract under POST /communities). `withTransaction` and its failed-rollback limitation
  (`db.ts`) are unchanged. Tests: `tests/regression/sprint-145-duplicate-create.test.ts`, and the root real-DB
  `tests/integration/sprint-145-admission-integrity.integration.test.ts`. Social-graph's invitation acceptance
  (BUG-106) now checks capacity on its own transaction client too, so fusion is the only admission that can exceed
  the cap.

- **2026-11-19 (Sprint 144, ADR-106; BUG-103, BUG-104, BUG-105 fixed, pending deploy):** migration
  `20261119-community-member-count-trigger.sql` makes the database the only writer of
  `communities.current_members`. A sync trigger on `communities.members` applies each row's active-delta to its one
  community (a `community_id` change raises `check_violation`). A column guard on `communities.communities` stores
  `0` on INSERT and ignores every other write unless the transaction-local `karmyq.member_count_sync` flag is on,
  which only the sync and recount functions set (and restore). `communities.recount_current_members(id?)` is the
  only repair path; the migration runs it once. Every hand-written `±1` is gone (join, staff add, DELETE, the
  duplicate-create join, social-graph invitation accept); approval now counts.
  - Capacity is atomic: `src/database/memberCapacity.ts` `assertWithinCapacity` runs after the admitting write, on
    the same transaction client (join to active, staff add, PUT approve, duplicate-create join) and rolls back with
    400 `COMMUNITY_FULL`. The pre-write read stays as an early refusal.
  - The staff PUT is the transition table in `src/utils/staffTransitions.ts` (see its section). Path and body ids
    on PUT, DELETE and staff POST are canonicalized at parse (`src/utils/uuid.ts`); a malformed id is 400 before any
    SQL. Staff POST, PUT and the duplicate-create join use ADR-074 errors with no raw `error.message`.
  - Join from an `inactive` row now says "Ask a community admin to lift the block; then you can rejoin" (code
    `MEMBERSHIP_RESTORE_REQUIRES_STAFF` unchanged). Web Reject uses the PUT; pending applicants get Cancel request.

- **2026-11-15 (Sprint 143, #340 `a2746057`, v11.116.0; deployed 2026-11-19; BUG-102 fixed):** migration
  `20261115-governance-nomination-lifecycle.sql` adds `governance_nominations.expires_at`, the `declined`
  and `expired` statuses, and an expiry-aware v1 database guard. New v1 rows default to 30 days; replay
  backfills existing v1 rows with exactly `created_at + 30 days`, preserves pre-v1 NULL history, and makes no
  second-run changes. GET hides expired pending rows without writing; nomination writes close them lazily with
  `resolved_at=expires_at`, and creation reclaims their slots. A 409 expiry refusal does not
  roll back that close, and the DB guard refuses expired ballots/final transitions even with the protocol marker.
  - Withdraw and decline are separate POST routes for the active nominator and nominee. They preserve ballots,
    return 404 for foreign-community paths, 403 for the wrong/inactive party, and 409 for retries. Every
    governance write locks nomination then memberships; close versus final ratification serializes atomically.
  - GET adds `expires_at`, coarse `nominee_eligible`, and viewer `can_withdraw`/`can_decline`; `can_ratify`
    mirrors POST, including `nominee_ineligible` and `ready_to_finalize`. No voter roster or personal metric is
    disclosed. Web controls expose confirmed withdrawal/decline and honest ineligible/expiry states.
  - Membership self-leave now stores `left`; staff removal remains `inactive`. Active/pending self-leave is
    allowed, inactive self-leave is 409, and the last-admin refusal remains. Target plus active admins lock in
    one user-ID-ordered statement. Counters change only for active transitions; active self-leave reissues the JWT.
  - A `left` row self-rejoins public as active ordinary `member` or private as pending ordinary `member`, never
    regaining a stored staff role. `inactive` (removed/rejected) requires staff and returns 409
    `MEMBERSHIP_RESTORE_REQUIRES_STAFF`. Active public rejoin increments the counter once and reissues the JWT;
    private pending does neither. Duplicate concurrent joins map to 409 rather than 500.
  - Real-DB replay, lifecycle, privacy, membership and race proof passed on disposable PostgreSQL (2 suites,
    78 tests; superuser+bypass-RLS flags recorded, explicit predicates supply isolation). Initial PR CI run
    [44103556510](https://github.com/ravichavali/karmyq/actions/runs/44103556510) ran 595 of 596 tests successfully;
    its sole failure was the corrected staff-removal assertion. Final reviewed-head CI run
    [44422291966](https://github.com/ravichavali/karmyq/actions/runs/44422291966) passed all 32 integration suites /
    596 tests plus 2 curated-reset tests, including the corrected close and staff-removal races. Final reviewed-head
    `regenerate-init-sql` run [44422291636](https://github.com/ravichavali/karmyq/actions/runs/44422291636) passed
    every applicable step, including independent baseline generation, zero drift and committed-byte comparison.
    The disposable DB and tunnel were removed. No demo data operation was performed.

- **2026-11-13 (Sprint 142, #338 `1692a560`, v11.115.0; deployed 2026-11-15):** migration
  `20261112-governance-quorum.sql` adds frozen nomination electorates and policy metadata. One atomic
  DO block locks ballots then nominations, closes only legacy pending nominations, and installs protocol
  guards. Compatible transactions set transaction-local `app.governance_policy_version=1`; old writers fail
  closed after migration or binary rollback. Resolved history/ballots remain. Both canonical appliers and
  schema-identical replay were verified on isolated demo-host PostgreSQL. The snapshot-voter table is
  classified reset in simulation-service; no live reset or platform grant is authorized.
  - New nomination quorum is `max(3, ceil(E/5))`, with E captured active members excluding the nominee.
    Fewer than three voters refuses creation. Only nominator/nominee memberships are creation-locked;
    their active status, private nominee trust and monotonic role elevation are checked transactionally.
  - Voting locks the path-scoped nomination, then nominee + all existing snapshot memberships (including
    inactive voters), ORDER BY user_id FOR NO KEY UPDATE. Only active snapshot ballots count. Finalization
    rechecks active/private eligibility and higher role, then commits the role and closed nomination together.
    Departures never lower quorum; staff status PUT reactivation restores an original ballot. PostgreSQL
    40P01 rolls back and returns retryable 503 GOVERNANCE_RETRY; no automatic retries or partial writes.
  - GET returns settings.quorum_policy `{version:1, percentage:20, minimum:3}` (legacy quorum_size is no
    longer a public policy), coarse can_nominate, fixed per-nomination electorate_size/required_ratifications/
    quorum_policy_version and viewer `{can_ratify,reason}`. Count and ratifier identities use the same live
    projection. No full roster or personal metrics leave the API. The getter owns a live membership check.
    If restored ballots satisfy quorum, an active prior voter gets reason `ready_to_finalize` with can_ratify=true;
    the UI offers Finalize decision via the existing idempotent POST. GET stays read-only; no second ballot is added.
  - All routes validate IDs/roles, derive identity only from JWT userId, and use ADR-074 errors. DB entry points
    canonicalize valid UUID casing before comparing returned identities. Expected
    codes: UNAUTHORIZED / INVALID_REQUEST / FORBIDDEN / NOT_FOUND; GOVERNANCE_VOTER_NOT_ELIGIBLE,
    GOVERNANCE_SELF_RATIFICATION, GOVERNANCE_NOMINATION_CLOSED, GOVERNANCE_DUPLICATE_NOMINATION,
    GOVERNANCE_ELECTORATE_TOO_SMALL, GOVERNANCE_ELIGIBILITY_NOT_MET, GOVERNANCE_ROLE_ALREADY_HELD,
    GOVERNANCE_RETRY; unexpected errors are logged with route and return opaque INTERNAL_ERROR.
  - Real-DB tests run through an isolated demo-host DB/tunnel. Role flags were superuser+bypass-RLS, so
    isolation evidence tests explicit community_id predicates, including forged foreign JWT claims.
    The root integration suite covers migration replay/cutoff, concurrent votes/departures, staff reactivation,
    role preservation, getter privacy, and real shared-JWT routes. Unit/route/rollback tests are promoted into
    this service's regression tier; UI tests cover authoritative eligibility and stale-community actions.

- **2026-11-12 (Sprint 141, BUG-073 fixed, #337 `898f23ba`, deployed 2026-11-12, ADR-105)**: the six trust-question writes
  (`POST /communities/trust-questions`, `PUT`/`DELETE /:id`, `POST /:id/choices`,
  `PUT`/`DELETE /:id/choices/:choiceId`) admit a live **platform admin** only. `isLivePlatformAdmin`
  (`src/utils/liveRole.ts`) runs `SELECT 1 FROM auth.platform_admins WHERE user_id = $1 LIMIT 1`.
  - A community admin, including any community's creator, gets 403
    `{ success: false, message: 'Platform admin access required', error: 'PLATFORM_ADMIN_REQUIRED' }`, and nothing is
    written.
  - One router-wide gate in `src/routes/trust-questions.ts` covers every non-read method, so a write route added later
    is closed by default. `GET /communities/trust-questions` stays public.
  - `isLiveAdminOfAnyCommunity` had no caller left and is deleted.
  - The "Platform admin only" notes under *Trust Questions* below are now true.
  - Tests: `tests/regression/sprint-141-platform-admin-trust-questions.test.ts`, the updated PR K suite, and the root
    PR K integration suite.
- **2026-11-10 (Sprint 140, BUG-100 fixed, #334, v11.113.0, deployed)**: `GET /communities/my/communities` lists the JWT caller's
  memberships only. It used to require `?user_id=` and bind it into the SQL, so any signed-in user could read another
  user's community list. The query parameter is now ignored (omitted, own or foreign id all return the caller's list),
  and an id-less token gets 401 before any query. SQL, filters, ordering and envelope are unchanged. Side effect contained
  in simulation-service: its id-less nominate/ratify workflows would have started working, so their weights are 0.
  Tests: `tests/regression/sprint-140-my-communities-identity.test.ts`, root
  `tests/integration/sprint-140-community-membership-identity.integration.test.ts`.
- **2026-11-09 (Sprint 139, BUG-082)**: `src/database/db.ts` logs a successful query with the shared
  `createLogger('community-service')` at **debug** (`Executed query`, `{ text, duration, rows }`, never params) instead
  of an unconditional `console.log`. Silent at the default `info`; `LOG_LEVEL=debug` opts in. Errors, connection logs
  and `withTransaction` are unchanged. Policy: ADR-015 (amended). Test: `tests/regression/sprint-139-query-logging.test.ts`.
- **2026-10-22 (Sprint 134 PR K, BUG-069 fixed, ADR-102)**: the tags and location updates, the five fusion and four
  split admin actions, and the six trust-question writes decided from the JWT `communities` claim, so a demoted or
  removed admin kept admin powers until the token expired. They now read `communities.members` through
  `src/utils/liveRole.ts` (`getLiveRole`, moved there from `utils/memberVisibility.ts`, plus `isLiveAdmin` and
  `isLiveAdminOfAnyCommunity`; arguments `(communityId, userId)`; a malformed id answers null, an active row with a
  NULL role is a member). `fusions.ts`/`splits.ts` lose their claim `isAdmin` and their duplicate `isMember`. Trust
  questions keep "admin of any community", now live (that scope admits any community creator: BUG-073; fixed in Sprint 141, which gates them on a platform admin, ADR-105).
  **BUG-072 fixed:** split `PUT .../assignments` and `POST .../execute` now 404 a split that is not the path community's
  (they checked the path community's admin, then acted on any split). Tests: `tests/regression/sprint-134-pr-k-live-role.test.ts`
  and the root integration/static-gate tests named in ADR-102.
- **2026-10-21 (Sprint 134 PR A, BUG-063 fixed)**: all three export routes (`src/routes/export.ts`)
  500'd for everyone since they were written. They named a schema that does not exist (`community.*`;
  the live one is `communities`, with `members` not `memberships`) and columns the live schema lacks:
  `members.created_at`, `help_requests.community_id` (an ask's communities are in
  `requests.request_communities`), `norms.approval_count`, four `settings` columns, and
  `trust_scores.helps_given/helps_received`; the date filter was an unqualified, ambiguous `created_at`.
  The only test mocked `pool.query` with regexes encoding the wrong names, so it stayed green.
  Now: `GET /:communityId/export` returns `community`, `members` (full roster, all statuses, with
  email), `requests` and `matches` (non-directed asks linked through `request_communities`),
  `norms` (`approval_count` counted from `norm_approvals`), `settings` (the live columns:
  `request_ttl_days, offer_ttl_days, message_ttl_days, notification_ttl_days,
  reputation_half_life_months, activity_types, updated_at`) and the ADR-082
  `community_reputation_summary` (≥5 contributors). `/export/activity` has four integer counts per
  active member: Helps Given / Helps Received (completed matches as responder / on own asks),
  Requests Created / Requests Completed (own asks / own asks with status `completed`). The date
  filter is qualified per query and wrapped as `AND (...)`, so the Sprint 132 directed-surface gate
  proves the `NOT r.is_directed` guard without allowlist exceptions. `date_start`/`date_end` must be
  `YYYY-MM-DD` (else 400 `INVALID_DATE_RANGE`, checked after the admin gate; other errors are `sendError`
  `FORBIDDEN` / `NOT_FOUND` / `INTERNAL_ERROR`); `date_end` includes its
  whole day; members filter on `joined_at` (a missing bound is NULL and does not filter, so NULL timestamps still
  appear unfiltered). CSV text starting with `= + - @` tab or CR is prefixed with `'` (CSV injection). The reputation summary ignores the date filter (always
  all-time): overlapping windows could otherwise be subtracted to isolate one member's karma. Proof:
  `tests/regression/sprint-134-export-schema-truth.test.ts` (every table/column against `init.sql`), `tests/regression/sprint-134-export-date-filter.test.ts` and
  root `tests/integration/sprint-134-community-export.integration.test.ts` (real SQL, two communities).

- **2026-10-10 (Sprint 133 PR S, BUG-062)**: member email is admin-only. `GET /communities/:id` and
  `GET /communities/:communityId/members` shape rows through `src/utils/memberVisibility.ts`:
  `user_email` only for a **live** active admin (`communities.members`, never the JWT claim) or on the
  caller's own row; non-active rows and every `join_request_message` (approval never clears it, so active
  rows carry it too) only for live admins and moderators (who approve joins) and the member themself. A non-steward asking the members list for
  `status` ≠ `active` gets 403.

- **2026-10-04 (Sprint 132 PR C, ADR-099)**: stats and export SQL exclude `is_directed`
  requests from request/match lists, counts and per-member engagement joins. Inline
  `/* not-directed */ NOT <alias>.is_directed` uses the same browse rule without importing
  another service's source. Directed exchanges retain normal internal karma/standing;
  their content and attributable activity do not appear in community lists/exports.

- **2026-08-20 (Sprint 126 / ADR-096 — conflict-safe karma carry)**: `fusionService.ts` and
  `fissionService.ts` copy `reputation.karma_records` between communities, and Sprint 126 added
  `uq_karma_match_projection` on `(user_id, community_id, reason, related_entity_id)`. Both carry
  writers had to become conflict-safe or one shared match would abort the whole fusion/split
  transaction.

  **Fusion also had to stop discarding points.** Production splits one match's karma pool across up
  to three shared communities, so a member can legitimately hold the same
  `(reason, related_entity_id)` identity in **both** origin communities. Merging collapses those
  onto a single identity — and a bare `ON CONFLICT DO NOTHING` would keep whichever row the
  executor reached first and silently drop the other's points, nondeterministically, in exactly the
  overlap case fusion exists to serve. The carry is therefore split in two:

  - rows **with** a projection identity are aggregated (`SUM(points)`, `MIN(created_at)`,
    `GROUP BY user_id, reason, related_entity_id`), so the merged community gets the member's real
    total and the earliest timestamp;
  - rows with a **NULL** `related_entity_id` are copied row-for-row, because the index does not
    constrain them and aggregating would merge genuinely distinct manual adjustments.

  Both statements are exported as `KARMA_CARRY_IDENTITY_SQL` / `KARMA_CARRY_UNIDENTIFIED_SQL` so
  tests execute the shipped SQL rather than a retyped copy. Fission selects from a single community
  and cannot collide intra-statement; it carries the guard for re-execution safety.

## Purpose

Manages communities, membership, and community norms (rules). Enforces Dunbar's number (max 150 members) to maintain meaningful relationships and prevent scaling issues.

## Database Schema

### Tables Owned by This Service

Sprint 142 governance additions (migration `20261112-governance-quorum.sql`):

- `communities.governance_nominations.quorum_policy_version SMALLINT` and `electorate_size INTEGER`, nullable
  only for historical metadata. Version-1 rows require E>=3 and the exact proportional required_ratifications;
  partial unique `governance_one_pending_role` enforces one pending `(community_id, nominated_user_id, nominated_for_role)`.
- Sprint 143 adds `expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days')` and extends
  `valid_nomination_status` with `declined` and `expired`. `governance_expiry_metadata` requires every v1 row
  to retain an expiry later than creation; legacy NULL-policy rows may keep NULL. Migration backfill uses
  `created_at + 30 days`, not the migration clock.
- `communities.governance_nomination_voters(nomination_id UUID, user_id UUID)` has a composite primary key;
  nomination FK cascades and user FK references auth.users. This table stores the frozen electorate separately
  from `governance_ratifications` ballots. Curated reset classifies all three as reset.
- Protocol guards reject old nomination/ballot inserts and unauthorized ratified transitions. Sprint 143 also
  rejects ballots and ratified transitions after expiry even when the protocol marker is set. The Sprint 142
  atomic DO block locks ballots then nominations, adds schema, closes only legacy pending rows, and installs guards.
  Neither migration has a top-level transaction wrapper/LOCK TABLE; both replay without schema drift under the
  canonical appliers. Binary rollback intentionally leaves governance writes closed.

```sql
-- communities.communities
CREATE TABLE communities.communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255),
    category VARCHAR(100),
    max_members INTEGER DEFAULT 150,           -- Dunbar's number
    current_members INTEGER DEFAULT 0,         -- ADR-106: trigger-owned count of active members; never write it
    creator_id UUID NOT NULL REFERENCES auth.users(id),
    access_type VARCHAR(50) DEFAULT 'public',  -- public/private
    status VARCHAR(50) DEFAULT 'active',       -- active/archived
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Sprint 36: Geographic and interest-based discovery (Migration 014)
    latitude NUMERIC(10, 7),                   -- geographic coordinate
    longitude NUMERIC(10, 7),                  -- geographic coordinate
    tags TEXT[] DEFAULT '{}',                  -- interest tags for discovery

    -- Sprint 47: Group Communities (Migration 020)
    community_type VARCHAR(50) DEFAULT 'mutual_aid'  -- mutual_aid | group
);

-- communities.members
CREATE TABLE communities.members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',         -- admin/moderator/member
    status VARCHAR(50) DEFAULT 'active',       -- active/pending/invited/left/inactive
    invited_by UUID REFERENCES auth.users(id),
    join_request_message TEXT,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(community_id, user_id)
);

-- communities.norms
CREATE TABLE communities.norms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    rationale TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    status VARCHAR(50) DEFAULT 'proposed',     -- proposed/active/archived
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- communities.norm_approvals
CREATE TABLE communities.norm_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    norm_id UUID NOT NULL REFERENCES communities.norms(id) ON DELETE CASCADE,
    approved_by UUID NOT NULL REFERENCES auth.users(id),
    approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(norm_id, approved_by)
);

-- Indexes
CREATE INDEX idx_communities_status ON communities.communities(status);
CREATE INDEX idx_communities_location ON communities.communities(location);
CREATE INDEX idx_communities_location_geo ON communities.communities(latitude, longitude);
CREATE INDEX idx_communities_tags ON communities.communities USING GIN(tags);
CREATE INDEX idx_members_user_id ON communities.members(user_id);
CREATE INDEX idx_members_community_id ON communities.members(community_id);
CREATE INDEX idx_norms_community_id ON communities.norms(community_id);
```

**Social Karma v2.0 Schema Extensions:**

```sql
-- communities.health_summary (NEW)
CREATE TABLE communities.health_summary (
    community_id UUID PRIMARY KEY REFERENCES communities.communities(id) ON DELETE CASCADE,

    -- Latest metrics (from reputation.community_health_metrics)
    total_exchanges INTEGER DEFAULT 0,
    active_members INTEGER DEFAULT 0,
    network_strength NUMERIC(5,2) DEFAULT 0,

    -- Trend indicators (7-day vs previous 7-day)
    trend_direction VARCHAR(20) DEFAULT 'stable',
    trend_percentage NUMERIC(5,2) DEFAULT 0,

    -- Last updated
    last_calculated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE communities.health_summary IS 'Cached summary of community health for quick access';
COMMENT ON COLUMN communities.health_summary.network_strength IS 'Composite score: activity + quality + density';

-- communities.community_configs (NEW - Migration 011)
CREATE TABLE communities.community_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE UNIQUE,

    -- Identity & Boundaries
    member_cap INTEGER DEFAULT 150 CHECK (member_cap BETWEEN 10 AND 150),
    visibility_mode VARCHAR(50) DEFAULT 'public',  -- public/members_only/hybrid
    outsider_response_allowed BOOLEAN DEFAULT FALSE,

    -- Request Types (community-defined taxonomy as JSONB)
    enabled_request_types JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Karma Mechanics
    karma_split_helper INTEGER DEFAULT 60,
    karma_split_requestor INTEGER DEFAULT 40,
    base_karma_pool_per_request INTEGER DEFAULT 100,
    karma_decay_half_life_days INTEGER DEFAULT 0,  -- 0 = no decay

    -- Trust Mechanics
    trust_depth_weight DECIMAL(3,2) DEFAULT 0.60,
    trust_breadth_weight DECIMAL(3,2) DEFAULT 0.40,
    trust_decay_half_life_days INTEGER DEFAULT 90,
    trust_path_max_hops INTEGER DEFAULT 3,
    min_interactions_for_trust INTEGER DEFAULT 1,

    -- Feed Scoring Weights (7 signals, Sprint 43 v2 — normalized at query time)
    feed_weight_skill_match DECIMAL(3,2) DEFAULT 0.25,
    feed_weight_trust_distance DECIMAL(3,2) DEFAULT 0.20,
    feed_weight_community_relevance DECIMAL(3,2) DEFAULT 0.15,
    feed_weight_urgency DECIMAL(3,2) DEFAULT 0.10,
    feed_weight_requester_trust DECIMAL(3,2) DEFAULT 0.15,
    feed_weight_prior_interaction DECIMAL(3,2) DEFAULT 0.10,
    feed_weight_recency DECIMAL(3,2) DEFAULT 0.05,

    -- Community Onboarding
    request_approval_required BOOLEAN DEFAULT FALSE,
    new_member_karma_lockout_days INTEGER DEFAULT 0,
    join_approval_required BOOLEAN DEFAULT TRUE,
    joining_counts_as_interaction BOOLEAN DEFAULT TRUE,

    -- Metadata
    template_source VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- communities.config_templates (NEW - Migration 011)
CREATE TABLE communities.config_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    config_json JSONB NOT NULL,
    is_public BOOLEAN DEFAULT TRUE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE communities.community_configs IS 'Phase 1: Comprehensive configuration for community trust, karma, and coordination mechanics';
COMMENT ON TABLE communities.config_templates IS 'Pre-made configuration templates for evolutionary discovery';
```

### Provider service columns — who consumes them

`community_configs` carries three columns this service only **stores**; the consumer lives in
another service, so a change here has effects that are invisible from this repo directory:

| Column | Consumed by |
|---|---|
| `provider_services_enabled` | request-service `src/services/providerReachService.ts` |
| `provider_min_personal_trust_score` | same — as a floor on `reputation.trust_scores.score` |
| `provider_services_list` | same — **empty means ALL service types**, not none |

All three are enforced by `GET /requests/providers/community/:communityId` (Sprint 125 /
[ADR-095](../../docs/adr/ADR-095-authenticated-provider-directory-and-reach-gated-standing.md)).

⚠️ **Before Sprint 125 nothing read them.** `GET /:id/config` and `PUT /:id/config` wrote all three
and no service consumed any — a steward could enable provider services and change nothing. If a
future change makes these write-only again, delete them rather than leaving a switch that lies.

⚠️ `GET /:id/config` returns **404** when a community has no config row. The reach gate deliberately
does NOT mirror that: an unconfigured community is *disabled*, and returns an empty layer, because
404 there would let a member probe which communities exist.

-- communities.community_links (NEW - Migration 025, Sprint 15)
CREATE TABLE communities.community_links (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_a_id       UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
  community_b_id       UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
  link_type            TEXT NOT NULL CHECK (link_type IN ('sister', 'parent_child', 'split_origin')),
  trust_carry_factor   NUMERIC(3,2) NOT NULL DEFAULT 0.40,
  show_in_sister_feeds BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_admin_a   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_admin_b   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (community_a_id, community_b_id),
  CHECK (community_a_id <> community_b_id)
);

### communities.activities
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| community_id | UUID FK | → communities.communities(id) ON DELETE CASCADE |
| created_by | UUID FK | → auth.users(id) |
| title | VARCHAR(255) | Required |
| description | TEXT | Optional |
| activity_type | VARCHAR(100) | pickup_game \| group_run \| workout \| social \| other |
| scheduled_at | TIMESTAMPTZ | UTC, display in browser local time |
| duration_minutes | INTEGER | Optional |
| location | TEXT | Optional |
| latitude | NUMERIC(10,7) | Optional |
| longitude | NUMERIC(10,7) | Optional |
| max_participants | INTEGER | Optional cap |
| current_participants | INTEGER | Denormalized counter — increment/decrement in same op as participant insert/delete |
| status | VARCHAR(50) | open \| cancelled \| completed |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### communities.activity_participants
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| activity_id | UUID FK | → communities.activities(id) ON DELETE CASCADE |
| user_id | UUID FK | → auth.users(id) ON DELETE CASCADE |
| joined_at | TIMESTAMP | |
| | UNIQUE(activity_id, user_id) | |

### communities.split_proposals (Sprint 69)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| community_id | UUID FK | → communities.communities(id) |
| proposed_by | UUID FK | → auth.users(id) |
| split_type | TEXT | size_threshold \| admin_initiated |
| rationale | TEXT | Optional |
| group_a_name | TEXT | Required |
| group_b_name | TEXT | Required |
| status | TEXT | discussion → voting → approved/rejected → executed |
| quorum_pct | INTEGER | Default 60 |
| approval_pct | INTEGER | Default 60 |
| voting_ends_at | TIMESTAMPTZ | Set when voting opens |
| executed_at | TIMESTAMPTZ | Set on execution |
| child_community_a_id | UUID FK | Set on execution |
| child_community_b_id | UUID FK | Set on execution |
| | UNIQUE(community_id, status) | One active proposal per community |

### communities.split_votes (Sprint 69)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| proposal_id | UUID FK | → communities.split_proposals(id) ON DELETE CASCADE |
| user_id | UUID FK | → auth.users(id) |
| vote | TEXT | yes \| no \| abstain |
| prestige_weight | NUMERIC(8,2) | Community-scoped trust score at vote time |
| voted_at | TIMESTAMPTZ | |
| | UNIQUE(proposal_id, user_id) | One vote per member per proposal |

### communities.split_member_assignments (Sprint 69)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| proposal_id | UUID FK | → communities.split_proposals(id) ON DELETE CASCADE |
| user_id | UUID FK | → auth.users(id) |
| assigned_to | TEXT | group_a \| group_b \| unassigned |
| cluster_suggestion | TEXT | Algorithm's initial guess: group_a \| group_b \| NULL |
| admin_overridden | BOOLEAN | TRUE if admin changed from cluster_suggestion |
| | UNIQUE(proposal_id, user_id) | One assignment per member per proposal |

### communities.fusion_proposals (Sprint 70)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| community_a_id | UUID FK | → communities.communities(id) — proposing community |
| community_b_id | UUID FK | → communities.communities(id) — target community |
| proposed_by | UUID FK | → auth.users(id) |
| merged_community_name | TEXT | Required |
| rationale | TEXT | Optional |
| status | TEXT | pending_acceptance → discussion → voting → approved/rejected → executed |
| quorum_pct | INTEGER | Default 60 |
| approval_pct | INTEGER | Default 60 |
| accepted_by | UUID FK | → auth.users(id) — admin B who accepted |
| voting_ends_at | TIMESTAMPTZ | Set when voting opens |
| executed_at | TIMESTAMPTZ | Set on execution |
| merged_community_id | UUID FK | → communities.communities(id) — set on execution |

### communities.fusion_votes (Sprint 70)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| proposal_id | UUID FK | → communities.fusion_proposals(id) ON DELETE CASCADE |
| community_id | UUID FK | → communities.communities(id) — which community this vote belongs to |
| user_id | UUID FK | → auth.users(id) |
| vote | TEXT | yes \| no \| abstain |
| prestige_weight | NUMERIC(8,2) | Community-scoped trust score at vote time |
| voted_at | TIMESTAMPTZ | |
| | UNIQUE(proposal_id, user_id) | One vote per member per proposal |

### Tables Read by This Service
- `auth.users` - User details for member profiles and creator names
- `auth.platform_admins` - Live platform admin grant for the trust-question writes (`isLivePlatformAdmin`, Sprint 141, ADR-105)
- `social_graph.trust_edges_live` - Read-only view used for clustering algorithm and prestige weight computation

## API Endpoints

### GET /communities
Get all communities with optional filters.

**Query Parameters:**
- `status` - Filter by status (default: 'active')
- `limit` - Max results (default: 50)
- `offset` - Pagination offset (default: 0)
- `search` - Search in name and description
- `location` - Filter by location
- `category` - Filter by category
- `has_space` - Filter communities with available space ('true')
- `sort` - Sort order: 'activity' (default), 'newest', 'members', 'alphabetical'

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Seattle Mutual Aid",
      "description": "Helping neighbors in Seattle",
      "location": "Seattle, WA",
      "category": "General",
      "max_members": 150,
      "current_members": 42,
      "access_type": "public",
      "creator_id": "uuid",
      "creator_name": "Alice Smith",
      "status": "active",
      "created_at": "2025-01-10T12:00:00Z",
      "inner_circle_count": 3,
      "active_community_count": 12,
      "extended_network_count": 27
    }
  ],
  "count": 1,
  "total": 1
}
```

**Additional query modes (Sprint 36):**

- `mode=geography&lat=X&lng=Y` — sort communities by distance from the given coordinates. Each result includes a `distance_km` field. If no communities have coordinates, falls back to returning all communities and includes `"fallback": true` in the response data.
- `mode=interests&tags=tag1,tag2` — filter communities that have ALL of the specified tags (array overlap via `&&` operator).

**Implementation:** `src/routes/communities.ts:8`

### GET /communities/tags
Return all distinct tags in use across active communities (Sprint 36).

**Response:**
```json
{
  "success": true,
  "data": ["mutual-aid", "food", "housing", "seattle", "childcare"]
}
```

**Implementation:** `src/routes/communities.ts`

### PUT /communities/:id/tags
Update community interest tags (admin only, Sprint 36). Tags are normalized to lowercase and deduplicated.

**Auth:** Caller must be an active admin of the community.

**Request:**
```json
{
  "tags": ["mutual-aid", "Food", "Housing"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "tags": ["food", "housing", "mutual-aid"]
  },
  "message": "Tags updated successfully"
}
```

**Implementation:** `src/routes/communities.ts`

### PUT /communities/:id/location
Update community geographic coordinates (admin only, Sprint 36). Enables geography-mode discovery and distance sorting.

**Auth:** Caller must be an active admin of the community.

**Request:**
```json
{
  "lat": 47.6062,
  "lng": -122.3321
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "latitude": 47.6062,
    "longitude": -122.3321
  },
  "message": "Location updated successfully"
}
```

**Implementation:** `src/routes/communities.ts`

### GET /communities/my/communities
Get the authenticated caller's active memberships in active communities, newest-joined first.

**Identity (Sprint 140, BUG-100):** the user is `req.user.userId` from the verified JWT — nothing else.
A legacy `user_id` query parameter is **ignored** whether it is omitted, the caller's own id or another
user's id; it no longer has any authority (before Sprint 140 the handler bound it into the SQL, so any
signed-in user could list anyone's memberships). A token without a user id is answered 401 before any
query runs. Existing callers that still send `user_id` keep working unchanged.

**Response:**
```json
{
  "success": true,
  "data": {
    "communities": [
      {
        "id": "uuid",
        "name": "Seattle Mutual Aid",
        "role": "admin",
        "joined_at": "2025-01-10T12:00:00Z"
      }
    ],
    "count": 1,
    "total": 1
  }
}
```

**Tests:** `tests/regression/sprint-140-my-communities-identity.test.ts` (omitted/own/foreign id, id-less
token, unauthenticated) and root `tests/integration/sprint-140-community-membership-identity.integration.test.ts`
(two real users with disjoint memberships).

**Implementation:** `src/routes/communities.ts` (`router.get('/my/communities')`)

### GET /communities/:id
Get specific community with all members.

**Member visibility (Sprint 133, BUG-062):** `user_email` appears only for a live active admin or on the
caller's own row. Pending rows appear only for live admins/moderators and for the pending caller's own
row. The caller's role is read live from `communities.members`.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Seattle Mutual Aid",
    "description": "Helping neighbors",
    "members": [
      {
        "id": "uuid",
        "user_id": "uuid",
        "user_name": "Alice Smith",
        "role": "admin",
        "joined_at": "2025-01-10T12:00:00Z"
      }
    ]
  }
}
```

**Implementation:** `src/routes/communities.ts:136`

### POST /communities
Create new community — **idempotent on community identity** (ADR-062).

A community's identity is `(LOWER(TRIM(name)), LOWER(TRIM(COALESCE(location,''))))`. Before inserting, the route looks up an **active** community by this identity key:
- **Match found (public):** one transaction locks the caller's `communities.members` row `FOR UPDATE`, re-reads the community's `status`/`access_type` on that client, and classifies the row (`classifyExistingMembership`; Sprint 145, BUG-108). No row: insert an active member. `left`: rejoin as an ordinary member (role, request message, join time reset). For both, the ADR-106 trigger counts the write, then status and capacity are re-checked on the same client (400 `COMMUNITY_FULL` rolls back). `active`: idempotent no-op that keeps role and join time, with no write and no capacity check, even when full. `pending`: 409 `CONFLICT`. `inactive`, NULL or any other status: 409 `MEMBERSHIP_RESTORE_REQUIRES_STAFF`. A lost insert race locks and classifies the winner (unreadable → 409 `CONFLICT`). A community no longer active: 400 `COMMUNITY_INACTIVE`. A community now private: any tentative write rolls back and the private pointer below is returned, with the community re-read. 40P01/40001: 503 `ADMISSION_RETRY`. Success returns `existing: true, joined: true`, the stored `current_members`, the caller's actual role and a refreshed token, with HTTP **200**; no duplicate row is created. If the post-commit refreshed list lacks the community (staff removed the caller in between), the answer is 409 `MEMBERSHIP_CHANGED` with no token; no role is invented.
- **Match found (private):** not auto-joined, whatever the caller's membership; returns `existing: true, joined: false` and an approval-required message, no token.
- **No match:** the community is created (inserted with `current_members = 0`; the creator's admin row makes it 1) and returned with `existing: false`, the post-trigger count, and HTTP **201**.

Clients should read the `existing` flag rather than assuming a new row was created. A partial unique index `idx_communities_identity_active` enforces one active community per identity.

**Request:**
```json
{
  "name": "Brooklyn Helpers",
  "description": "Mutual aid in Brooklyn",
  "location": "Brooklyn, NY",
  "category": "General",
  "max_members": 100
}
```

**Response (created):**
```json
{
  "success": true,
  "data": {
    "community": { "id": "uuid", "name": "Brooklyn Helpers", "current_members": 1, "role": "admin" },
    "existing": false,
    "config": { },
    "token": "<refreshed-jwt>"
  }
}
```

**Response (joined existing):**
```json
{
  "success": true,
  "data": {
    "community": { "id": "uuid", "name": "Brooklyn Helpers", "role": "member" },
    "existing": true,
    "joined": true,
    "token": "<refreshed-jwt>"
  }
}
```

**Implementation:** `src/routes/communities.ts` — `POST /` (identity lookup before insert)

**Events Published:** `community_created` (only on actual creation)

### PUT /communities/:id
Update community details (admin only). The caller is the JWT user; a body `user_id` is ignored (BUG-061).

**Request:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "max_members": 120
}
```

**Implementation:** `src/routes/communities.ts:258`

### DELETE /communities/:id
Archive community (admin only, soft delete). The caller is the JWT user; no body (BUG-061).

**Implementation:** `src/routes/communities.ts:341`

**Events Published:** `community_archived`

### GET /communities/:communityId/members
Get all members of a community.

**Query Parameters:**
- `status` - Filter by member status (default: 'active'). Any value other than `active` requires a
  **live** admin or moderator role, else **403** (Sprint 133, BUG-062).

`user_email` is included only for a live active admin or on the caller's own row.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "user_name": "Alice Smith",
      "role": "admin",
      "status": "active",
      "joined_at": "2025-01-10T12:00:00Z",
      "layer": "active_community"
    }
  ],
  "count": 1
}
```

**Implementation:** `src/routes/members.ts:8`

### POST /communities/:communityId/join
Join or rejoin a community as the verified JWT caller. Public communities return active membership immediately;
private communities return pending approval. A body `user_id` has no authority and is not read.

**Request:**
```json
{
  "message": "I'd like to join this community!"
}
```

**Existing rows (Sprint 143):** active/pending rows return 409. A `left` row rejoins with `role='member'` and a
refreshed `joined_at`, regardless of its stored prior role. An `inactive` row (staff removal or rejection) returns 409
`MEMBERSHIP_RESTORE_REQUIRES_STAFF` ("Ask a community admin to lift the block; then you can rejoin"). Staff never
reactivate (Sprint 144, decision 8): an admin lifts the block with `PUT … {"status":"left"}`, and the person then
rejoins here under the normal access rules. Conditional updates and the duplicate-key mapping return one success
plus one 409 for concurrent attempts instead of a 500.

**Active response (private pending omits `token` and has `status: 'pending'`):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "active",
    "role": "member",
    "token": "<refreshed-jwt>"
  }
}
```

The ADR-106 trigger counts an active row; the route never writes `current_members`. An active admission (including a
`left` rejoin) runs `assertWithinCapacity` after the write in the same transaction, so a concurrent join into the
last free slot gets 400 `COMMUNITY_FULL` and rolls back. The pre-write full check is only an early refusal.
`issueMembershipToken` rebuilds claims from active rows only; private pending rejoin does not issue a token.

**Implementation:** `src/routes/members.ts` — `POST /:communityId/join`, `classifyExistingMembership`,
`issueMembershipToken`

**Events Published:** `user_joined_community` (public) or `join_request_created` (private)

### POST /communities/:communityId/members
Add a member directly (**active community admin only**, BUG-061). `invited_by` is always the JWT
caller; `role` must be `member` (default), `moderator` or `admin`. Non-admin callers get `403`;
self-service joining is `POST /communities/:communityId/join`, which applies the access policy.

**Request:**
```json
{
  "user_id": "uuid",
  "role": "member"
}
```

`user_id` is canonicalized (400 `VALIDATION_ERROR` when missing or malformed, before any SQL). The insert and the
capacity post-check run in one transaction; the ADR-106 trigger counts the row. Errors use ADR-074 codes:
404 `NOT_FOUND`, 400 `COMMUNITY_INACTIVE` / `COMMUNITY_FULL` / `ALREADY_MEMBER`, 500 `INTERNAL_ERROR` (no raw
detail). **Documented consent exception (decision 10, BUG-107):** this route activates a user directly, without
their action. It is admin-only and API-only (no web, mobile or simulation caller).

**Implementation:** `src/routes/members.ts` — `POST /:communityId/members`

**Events Published:** `user_joined_community`

### PUT /communities/:communityId/members/:userId
A staff change to someone else's membership, as the verified JWT caller (Sprint 144: BUG-104, BUG-105, decision 8).
The body carries **exactly one** of `status` or `role` (D1); both, neither, or any other key except the ignored
legacy `admin_user_id` is 400 `VALIDATION_ERROR`, as is a malformed path id. Both checks run before any SQL.

**Request:** `{ "status": "active" | "inactive" | "left" }` **or** `{ "role": "member" | "moderator" | "admin" }`

Status transitions (`src/utils/staffTransitions.ts`, `planStaffChange`):

| Stored → requested | Who | Effect |
|---|---|---|
| `pending` → `active` (approve) | admin or moderator | role set to `member`; capacity re-checked after the write (400 `COMMUNITY_FULL`) |
| `pending` → `inactive` (reject) | admin or moderator | role unchanged |
| `active` → `inactive` (deactivate) | admin only | 400 `LAST_ADMIN` for the sole active admin |
| `inactive` → `left` (lift the block) | admin only | role set to `member`; admits nobody, the person rejoins via `POST /join` |
| `inactive` → `active` | nobody | admin: 409 `INVALID_MEMBERSHIP_TRANSITION` (lift the block instead); moderator: 403 |
| `active`/`pending` → `left` | nobody | admin: 409 `INVALID_MEMBERSHIP_TRANSITION` (only the member leaves); moderator: 403 |
| `left` → anything, incl. `left` | nobody | 409 `MEMBER_MUST_REJOIN` for every staff caller (checked first) |
| same state | nobody | 409 `INVALID_MEMBERSHIP_TRANSITION` for every staff caller (a retry; checked second) |

Check order for a staff caller: a `left` target (409), then same state (409), then the transition. So a moderator
retrying a reject gets 409, but any other moderator request than approve or reject gets 403 `FORBIDDEN` (decision 4;
the spec's table listed `inactive → active` as 409 for everyone, and Sprint 144 ruled moderators get 403 there).
Role changes are for an **active admin caller and an active target** only: same role is 409, a non-active target
is 409 (`MEMBER_MUST_REJOIN` for `left`), demoting the sole active admin is 400 `LAST_ADMIN`; a moderator sending
`role` gets 403. A non-staff caller gets 403; a missing target is 404 `NOT_FOUND` (staff callers only). A malformed
body is 400 before the caller is checked. Unexpected failures are 500 `INTERNAL_ERROR` without raw detail.

A caller who is not staff (or a moderator sending `role`) is refused 403 before any lock. Inside one transaction the
route then locks the target plus every active admin with `lockTargetAndAdmins` (the
user-ID-ordered statement shared with DELETE), then reads the caller's live role on that client
(`getLiveRole(communityId, caller, q)`, ADR-102), plans, and writes. Every demotion or
removal of staff is itself a PUT/DELETE locking the same admin rows, so it serializes with this request. The
ADR-106 trigger applies any count change. Staff never write `pending` and never return anyone who left or was
removed: the person rejoins themselves (decision 8).

**Response:** 200 `{ success, data: memberRow, message }`.

**Implementation:** `src/routes/members.ts` — `PUT /:communityId/members/:userId`; `src/utils/staffTransitions.ts`

### DELETE /communities/:communityId/members/:userId
Remove member from community (self-leave or admin kick). **Auth required** (router mounts `authMiddleware`).

**Request:** no body. The caller's identity is taken from the verified JWT (`req.user.userId`),
**not** from the request body. Self-leave = JWT userId === `:userId`; removing another member
requires the JWT caller to be an active `admin`, checked early without locks and then re-read with
`getLiveRole(communityId, caller, q)` after the row lock (Sprint 144), so an admin demoted while the request waits is
refused (403). The old `admin_user_id` body field remains ignored.

Path ids are canonicalized (Sprint 144): an uppercase spelling of the caller's own id is self-leave, and a
malformed id is 400 `VALIDATION_ERROR` before any SQL. Self-leave accepts active or pending rows and records `left`
(a pending self-leave is the web's **Cancel request**); inactive/left self-leave returns 409. Staff removal records
`inactive`, including on a `left` row (it blocks the person; an admin lift, `PUT {"status":"left"}`, reverses it).
The last active admin cannot leave or be removed. One user-ID-ordered statement locks the target and every active
admin before checking/updating, preventing two concurrent last-admin departures. The ADR-106 trigger decrements
`current_members` for an active target only; the route never writes the column. Active self-leave returns
`data.token` from `issueMembershipToken`; pending self-leave and staff removal do not. Unexpected failures use the
ADR-074 `INTERNAL_ERROR` envelope without raw database details.

**Implementation:** `src/routes/members.ts` — `DELETE /:communityId/members/:userId`, `canSelfDepart`,
`departureStatus`, `issueMembershipToken`

**Events Published:** `user_left_community`

### GET /communities/:communityId/governance
Return governance state for an active member. Nominations include fixed electorate/quorum metadata, live matching
ratifier count/identities, `expires_at`, coarse `nominee_eligible`, and viewer
`{can_ratify,reason,can_withdraw,can_decline}`. Reasons mirror POST behavior, including `nominee`, `already_ratified`,
`not_in_electorate`, `nominee_ineligible`, `eligible`, and `ready_to_finalize`. No full voter roster or personal
trust/karma values are returned. An expired pending row is hidden without a GET write; ratify, withdraw, decline
and creation perform the lazy stored close. GET alone never grants a role.

### POST /communities/:communityId/governance/nominate
Active members nominate an eligible active member for a higher role. Creation snapshots the other active members,
uses `max(3, ceil(E/5))`, refuses E<3, and stores expiry 30 days after creation. An expired pending slot can be
reclaimed; duplicate pending and same/lower-role requests return 409.

### POST /communities/:communityId/governance/withdraw/:nominationId
The active nominator closes a pending nomination as `withdrawn`; another admin has no special close power.
The active nominee is the only accepted caller for the parallel **decline** endpoint below. Both preserve ballots,
return 404 for a foreign community, 403 for an inactive/wrong party, and 409 for an already closed nomination.
An expired close returns 409 `GOVERNANCE_NOMINATION_EXPIRED` after committing `expired` and
`resolved_at=expires_at`.

### POST /communities/:communityId/governance/decline/:nominationId
The active nominee closes a pending nomination as `declined`, including when quorum is already reachable.

### POST /communities/:communityId/governance/ratify/:nominationId
An active original voter other than the nominee casts one equal vote. The nomination locks before nominee/voter
memberships. Finalization rechecks current active membership, private eligibility and monotonic elevation, then
grants/closes atomically. Duplicate below-quorum ballots are idempotent; expired/closed nominations return 409,
foreign/ineligible callers are refused, and deadlock SQLSTATE 40P01 becomes retryable 503 `GOVERNANCE_RETRY`.

**Implementation (governance):** `src/routes/governance.ts` route handlers and
`src/database/governanceDb.ts` — `getGovernanceState`, `createNomination`, `closeNomination`, `addRatification`

### GET /communities/:communityId/norms
Get all norms for a community.

**Query Parameters:**
- `status` - Filter by norm status ('proposed', 'active', 'archived')

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "description": "No spam or self-promotion",
      "rationale": "Keeps community focused on mutual aid",
      "status": "active",
      "created_by": "uuid",
      "creator_name": "Alice Smith",
      "approval_count": 23,
      "created_at": "2025-01-10T12:00:00Z"
    }
  ],
  "count": 1
}
```

**Implementation:** `src/routes/norms.ts:8`

### GET /communities/:communityId/norms/:normId
Get specific norm with all approvals.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "description": "No spam or self-promotion",
    "status": "active",
    "approvals": [
      {
        "id": "uuid",
        "approved_by": "uuid",
        "approver_name": "Bob Johnson",
        "approved_at": "2025-01-10T13:00:00Z"
      }
    ],
    "approval_count": 23
  }
}
```

**Implementation:** `src/routes/norms.ts:56`

### POST /communities/:communityId/norms
Propose a new community norm.

**Request:**
```json
{
  "description": "No spam or self-promotion",
  "rationale": "Keeps community focused on mutual aid",
  "created_by": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "proposed",
    "created_at": "2025-01-10T12:00:00Z"
  },
  "message": "Norm proposed successfully"
}
```

**Implementation:** `src/routes/norms.ts:111`

**Events Published:** `norm_proposed`

**Note:** Creator automatically approves the norm upon creation.

### POST /communities/:communityId/norms/:normId/approve
Approve a proposed norm (requires simple majority >50% of members).

**Request:**
```json
{
  "user_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Norm approved and accepted by the community",
  "data": {
    "norm_id": "uuid",
    "status": "active",
    "approvals": 26,
    "required": 26,
    "total_members": 51
  }
}
```

**Implementation:** `src/routes/norms.ts:181`

**Events Published:** `norm_established` (when threshold reached)

### DELETE /communities/:communityId/norms/:normId
Archive a norm (admin or creator only).

**Request:**
```json
{
  "user_id": "uuid"
}
```

**Implementation:** `src/routes/norms.ts:312`

### GET /communities/:id/config
Get community configuration.

**Response:**
```json
{
  "success": true,
  "data": {
    "community_id": "uuid",
    "config": {
      "member_cap": 150,
      "visibility_mode": "public",
      "outsider_response_allowed": true,
      "enabled_request_types": [
        {
          "name": "meal_share",
          "description": "Share meals or cooking",
          "karma_multiplier": 1.0
        }
      ],
      "karma_split_helper": 60,
      "karma_split_requestor": 40,
      "base_karma_pool_per_request": 100,
      "karma_decay_half_life_days": 0,
      "trust_depth_weight": 0.6,
      "trust_breadth_weight": 0.4,
      "trust_decay_half_life_days": 180,
      "trust_path_max_hops": 3,
      "min_interactions_for_trust": 1,
      "feed_weight_skill_match": 0.40,
      "feed_weight_trust_distance": 0.25,
      "feed_weight_community_relevance": 0.20,
      "feed_weight_urgency": 0.15,
      "request_approval_required": false,
      "new_member_karma_lockout_days": 0,
      "join_approval_required": true,
      "joining_counts_as_interaction": true,
      "template_source": "Cohousing Default",
      "created_at": "2025-01-10T12:00:00Z",
      "updated_at": "2025-01-10T12:00:00Z"
    },
    "template_source": "Cohousing Default"
  }
}
```

**Implementation:** `src/routes/config.ts:18`

**Frontend Integration:**
- `apps/frontend/src/pages/communities/[id].tsx` - Displays config in read-only mode (Configuration tab)
- `apps/frontend/src/pages/communities/[id]/admin.tsx` - Fetches config for editing (Configuration tab)

### PUT /communities/:id/config
Update community configuration (founder only for Phase 1).

**Request:**
```json
{
  "config_updates": {
    "karma_split_helper": 70,
    "karma_split_requestor": 30,
    "visibility_mode": "hybrid"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "community_id": "uuid",
    "config": { ... }
  },
  "message": "Community configuration updated successfully"
}
```

**Implementation:** `src/routes/config.ts:82`

**Events Published:** `community.config.updated`

**Frontend Integration:**
- `apps/frontend/src/pages/communities/[id]/admin.tsx` - Founder-only config updates (Configuration tab)

### GET /communities/config-templates
Browse available configuration templates.

**Query Parameters:**
- `sort_by` - Sort order: 'usage', 'name', 'created_at' (default: 'usage')
- `public_only` - Filter to public templates only (default: 'true')

**Response:**
```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "id": "uuid",
        "name": "Cohousing Default",
        "description": "High-trust, balanced participation...",
        "usage_count": 42,
        "config_preview": {
          "karma_split": "60/40",
          "trust_model": "balanced",
          "visibility": "public",
          "member_cap": 150
        },
        "full_config": { ... },
        "created_at": "2025-01-10T12:00:00Z"
      }
    ]
  }
}
```

**Implementation:** `src/routes/config.ts:226`

**Frontend Integration:**
- `apps/frontend/src/pages/communities/config-templates.tsx` - Template browser page
- `apps/frontend/src/pages/communities/new.tsx` - Fetches templates for community creation

### POST /communities/:id/config/copy-from/:source_community_id
Copy configuration from another community.

**Request:**
```json
{
  "include_request_types": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "community_id": "uuid",
    "config": { ... },
    "copied_from": "source-uuid"
  },
  "message": "Configuration copied successfully"
}
```

**Implementation:** `src/routes/config.ts:274`

**Note:** Source community must be public or user must be a member.

**Frontend Integration:**
- `apps/frontend/src/pages/communities/configs/public.tsx` - Copy configuration modal (founders only)

### GET /communities/configs/public
Browse configurations from thriving communities.

**Query Parameters:**
- `min_members` - Minimum member count (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "communities": [
      {
        "community_id": "uuid",
        "name": "Seattle Mutual Aid",
        "member_count": 87,
        "config": { ... }
      }
    ]
  }
}
```

**Implementation:** `src/routes/config.ts:420`

**Note:** Only returns communities with public or hybrid visibility.

**Frontend Integration:**
- `apps/frontend/src/pages/communities/configs/public.tsx` - Thriving communities browser page

### GET /health
Service health check.

**Response:**
```json
{
  "service": "community-service",
  "status": "healthy",
  "timestamp": "2025-01-10T12:00:00Z"
}
```

### Community Links (Sprint 15)

#### POST /communities/:communityId/links
Propose a link from this community to another (admin-only). Creates a `pending` link awaiting approval by the other community's admin.

**Body:**
```json
{
  "target_community_id": "uuid",
  "link_type": "sister | parent_child | split_origin",
  "trust_carry_factor": 0.40,
  "show_in_sister_feeds": false
}
```

#### PUT /communities/:communityId/links/:linkId
Approve a pending link (other community's admin), or update `trust_carry_factor`/`show_in_sister_feeds`. Use `action: "approve"` or `action: "deactivate"` in the body.

#### GET /communities/:communityId/links
List all links involving this community. Optional `?status=pending|active|inactive` filter. Returns `partner_community_id` and `partner_community_name` for convenience.

#### DELETE /communities/:communityId/links/:linkId
Remove a link (sets status to `inactive`). Either community's admin can do this.

### Activities (Sprint 47)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /communities/:id/activities | member | List upcoming open activities with is_joined flag |
| POST | /communities/:id/activities | admin | Create activity (validates type enum, future date) |
| GET | /communities/:id/activities/:activityId | member | Get activity detail with participant list |
| POST | /communities/:id/activities/:activityId/join | member | Join activity (400 if full, 409 if already joined) |
| DELETE | /communities/:id/activities/:activityId/leave | member | Leave activity |

## Dependencies

### Calls (Outbound)
- None (community service does not call other services)

### Called By (Inbound)
- Frontend (for community browsing, creation, management)
- Request Service (to verify community membership)
- Feed Service (to get user's communities for feed personalization)

### Events Published
- `community_created` - When new community is created
- `community_archived` - When community is archived
- `community.config.created` - When community configuration is created
- `community.config.updated` - When community configuration is updated
- `user_joined_community` - When user joins a community
- `join_request_created` - When user requests to join private community
- `user_left_community` - When user leaves or is removed from community
- `norm_proposed` - When new norm is proposed
- `norm_established` - When norm reaches approval threshold

### Trust Questions (Sprint 45)

#### GET /communities/trust-questions
Returns active trust questionnaire questions with choices, ordered by `display_order`. Public endpoint — no auth required.

#### POST /communities/trust-questions
Create a trust question. Platform admin only: a live `auth.platform_admins` row (`isLivePlatformAdmin`, ADR-105); anyone else gets `403 PLATFORM_ADMIN_REQUIRED`. The same gate guards every write below.

#### PUT /communities/trust-questions/:id
Update question text, subtext, display_order, or active status. Platform admin only.

#### DELETE /communities/trust-questions/:id
Deactivate a trust question (sets active=false). Platform admin only.

#### POST /communities/trust-questions/:id/choices
Add a choice to a question. Platform admin only.

#### PUT /communities/trust-questions/:id/choices/:choiceId
Update a choice's label, description, config_delta, or display_order. Platform admin only.

#### DELETE /communities/trust-questions/:id/choices/:choiceId
Remove a choice permanently. Platform admin only.

---

### Events Consumed
- None

### External Dependencies
- PostgreSQL (communities schema)
- Redis (event publishing via Bull queue)

## Environment Variables

```bash
# Server
PORT=3002
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/karmyq_db

# Redis
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info                   # debug, info, warn, error
```

## Key Files

### Entry Point
- `src/index.ts` - Express app initialization, route registration

### Routes
- `src/routes/communities.ts` - Community CRUD operations
- `src/routes/members.ts` - Membership management (join, leave, invite)
- `src/routes/norms.ts` - Community norms proposal and approval

### Services
- None (business logic is in routes for simplicity)

### Database
- `src/database/db.ts` - PostgreSQL connection pool

### Events
- `src/events/publisher.ts` - Redis event publishing

## Common Development Tasks

### Add a New Community Field

1. **Create migration:**
```sql
-- infrastructure/postgres/migrations/00X_add_community_field.sql
ALTER TABLE communities.communities
ADD COLUMN new_field VARCHAR(255);
```

2. **Update TypeScript types:**
```typescript
// src/types/community.ts
interface Community {
  // ... existing fields
  new_field?: string;
}
```

3. **Update create endpoint:**
```typescript
// src/routes/communities.ts - POST /communities
const { new_field } = req.body;

const result = await query(
  `INSERT INTO communities.communities
    (name, description, ..., new_field)
  VALUES ($1, $2, ..., $N)
  RETURNING *`,
  [name, description, ..., new_field]
);
```

4. **Update GET endpoints to include field:**
```typescript
// src/routes/communities.ts - GET /communities
SELECT
  c.id, c.name, ..., c.new_field
FROM communities.communities c
```

### Change Dunbar's Number Limit

**Option 1: Change default in database**
```sql
ALTER TABLE communities.communities
ALTER COLUMN max_members SET DEFAULT 100;  -- New default
```

**Option 2: Change validation in code**
```typescript
// src/routes/communities.ts - POST /communities
if (max_members < 1 || max_members > 100) {  // Changed from 150
  return res.status(400).json({
    success: false,
    message: 'Max members must be between 1 and 100',
  });
}
```

### Add New Member Role

1. **Update validation:**
```typescript
// src/routes/members.ts
const validRoles = ['admin', 'member', 'moderator'];  // Add new role

if (role && !validRoles.includes(role)) {
  return res.status(400).json({
    success: false,
    message: `Role must be one of: ${validRoles.join(', ')}`,
  });
}
```

2. **Update permission checks:**
```typescript
// Example: Allow moderators to update members
const canUpdate = ['admin', 'moderator'].includes(adminCheck.rows[0].role);
```

### Change Norm Approval Threshold

```typescript
// src/routes/norms.ts - POST /:communityId/norms/:normId/approve

// Current: Simple majority (>50%)
const approvalThreshold = Math.ceil(totalMembers / 2);

// Option 1: Two-thirds majority
const approvalThreshold = Math.ceil(totalMembers * 2 / 3);

// Option 2: Fixed threshold (e.g., 10 members)
const approvalThreshold = Math.min(10, Math.ceil(totalMembers / 2));

// Option 3: Percentage-based (e.g., 60%)
const approvalThreshold = Math.ceil(totalMembers * 0.6);
```

### Add Private Community Approval Workflow

1. **Get pending join requests:**
```typescript
// src/routes/members.ts
router.get('/:communityId/pending-requests', async (req, res) => {
  const { communityId } = req.params;

  const result = await query(
    `SELECT
      m.id, m.user_id, m.join_request_message, m.joined_at,
      u.name as user_name, u.email as user_email
    FROM communities.members m
    LEFT JOIN auth.users u ON m.user_id = u.id
    WHERE m.community_id = $1 AND m.status = 'pending'
    ORDER BY m.joined_at ASC`,
    [communityId]
  );

  res.json({
    success: true,
    data: result.rows,
    count: result.rowCount,
  });
});
```

2. **Approve join request:**
```typescript
// src/routes/members.ts
router.post('/:communityId/approve-request/:userId', async (req, res) => {
  const { communityId, userId } = req.params;
  // The admin is always the JWT caller, never a body field (BUG-061).
  const admin_user_id = (req as any).user?.userId;

  // Verify admin permission
  const adminCheck = await query(
    `SELECT role FROM communities.members
     WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
    [communityId, admin_user_id]
  );

  if (adminCheck.rowCount === 0 || adminCheck.rows[0].role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Only admins can approve join requests',
    });
  }

  // Update member status
  await query(
    `UPDATE communities.members
     SET status = 'active'
     WHERE community_id = $1 AND user_id = $2 AND status = 'pending'`,
    [communityId, userId]
  );

  // Increment current_members
  await query(
    `UPDATE communities.communities
     SET current_members = current_members + 1
     WHERE id = $1`,
    [communityId]
  );

  // Publish event
  await publishEvent('join_request_approved', {
    community_id: communityId,
    user_id: userId,
    approved_by: admin_user_id,
  });

  res.json({
    success: true,
    message: 'Join request approved',
  });
});
```

### Add Community Categories

1. **Define categories:**
```typescript
// src/constants/categories.ts
export const COMMUNITY_CATEGORIES = [
  'General',
  'Housing',
  'Food',
  'Transportation',
  'Childcare',
  'Healthcare',
  'Education',
  'Technology',
  'Arts & Culture',
  'Environmental',
] as const;

export type CommunityCategory = typeof COMMUNITY_CATEGORIES[number];
```

2. **Add validation:**
```typescript
// src/routes/communities.ts - POST /communities
import { COMMUNITY_CATEGORIES } from '../constants/categories';

if (category && !COMMUNITY_CATEGORIES.includes(category)) {
  return res.status(400).json({
    success: false,
    message: `Category must be one of: ${COMMUNITY_CATEGORIES.join(', ')}`,
  });
}
```

## Security Considerations

### Dunbar's Number Enforcement
- `max_members` caps a community's active members, to keep it small enough that people know each other. Community
  create validates it to 1–150; `PUT /communities/:id` does not re-validate it (pre-existing).
- There is **no database constraint** on the cap. The application enforces it atomically (Sprint 144, ADR-106):
  every admitting path runs `assertWithinCapacity` after its member write, on the same transaction client, and a
  `CommunityFullError` rolls the write back with 400 `COMMUNITY_FULL`. The sync trigger's `UPDATE` holds the
  community row lock until commit, so concurrent admitters serialize and the later one sees the committed count.
- Fission and fusion do not check capacity (a merged community can exceed `max_members`); that is unchanged.

```typescript
// src/routes/members.ts — inside withTransaction, after the member INSERT/UPDATE
if (memberStatus === 'active') await assertWithinCapacity(q, communityId); // throws → rollback → COMMUNITY_FULL
```

### Admin Permissions
- Only admins can update community details
- Only admins can remove other members, lift a block or change roles; moderators approve and reject only
- The last active admin cannot be demoted, deactivated, removed or leave

The PUT and DELETE handlers lock the target and every active admin in one user-ID-ordered statement, then decide on
the locked rows, comparing canonical ids:

```typescript
// src/routes/members.ts — lockTargetAndAdmins(), shared by PUT and DELETE
const locked = await q(
  `SELECT user_id,role,status FROM communities.members
   WHERE community_id=$1 AND (user_id=$2 OR (role='admin' AND status='active'))
   ORDER BY user_id FOR UPDATE`,
  [communityId, userId]   // both canonicalUuid() at parse
);
const activeAdmins = locked.rows.filter((row) => row.role === 'admin' && row.status === 'active');
const isSoleActiveAdmin = activeAdmins.length <= 1 && activeAdmins.some((row) => row.user_id === userId);
```

### Member-Only Actions
- Only active community members can propose norms
- Only active members can approve norms
- Check membership before allowing actions

```typescript
// src/routes/norms.ts - Member verification
const memberCheck = await query(
  `SELECT id FROM communities.members
   WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
  [communityId, created_by]
);

if (memberCheck.rowCount === 0) {
  return res.status(403).json({
    success: false,
    message: 'Only community members can propose norms',
  });
}
```

### Input Validation
- Community name: 3-255 characters
- Max members: 1-150 (Dunbar's number)
- Sanitize all user inputs
- Validate UUIDs for foreign keys

## Debugging Common Issues

### "Community is full" errors
1. Check current_members vs max_members: `SELECT current_members, max_members FROM communities.communities WHERE id = '...'`
2. Verify count matches reality: `SELECT COUNT(*) FROM communities.members WHERE community_id = '...' AND status = 'active'`
3. If mismatch, sync the count:
```sql
UPDATE communities.communities c
SET current_members = (
  SELECT COUNT(*) FROM communities.members m
  WHERE m.community_id = c.id AND m.status = 'active'
)
WHERE c.id = '...';
```

### Norm not being accepted
1. Check approval count: `SELECT COUNT(*) FROM communities.norm_approvals WHERE norm_id = '...'`
2. Check member count: `SELECT COUNT(*) FROM communities.members WHERE community_id = '...' AND status = 'active'`
3. Verify threshold calculation (>50% = ceil(members / 2))
4. Check norm status: `SELECT status FROM communities.norms WHERE id = '...'`

### Member can't join community
1. Check community status: `SELECT status FROM communities.communities WHERE id = '...'`
2. Check if already member: `SELECT status FROM communities.members WHERE community_id = '...' AND user_id = '...'`
3. Check if community is full
4. Check access_type (public vs private)

### Permission denied errors
1. Verify user is member: `SELECT role, status FROM communities.members WHERE community_id = '...' AND user_id = '...'`
2. Check if user is admin: `... WHERE role = 'admin'`
3. The acting user is always the JWT caller (`req.user.userId`); no route reads caller identity from the body (BUG-061)

### Database connection errors
1. Check DATABASE_URL is correct
2. Verify PostgreSQL is running: `docker ps | grep postgres`
3. Test connection: `psql $DATABASE_URL`
4. Check communities schema exists: `\dn` in psql

## Testing

### Manual Testing with curl

**Create Community:**
```bash
curl -X POST http://localhost:3002/communities \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Community",
    "description": "A test community",
    "location": "Seattle, WA",
    "category": "General",
    "max_members": 50,
    "creator_id": "uuid-here"
  }'
```

**List Communities:**
```bash
curl "http://localhost:3002/communities?status=active&limit=10"
```

**Join Community:**
```bash
curl -X POST http://localhost:3002/communities/COMMUNITY_UUID/join \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "uuid-here",
    "message": "I would like to join!"
  }'
```

**Propose Norm:**
```bash
curl -X POST http://localhost:3002/communities/COMMUNITY_UUID/norms \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Be respectful to all members",
    "rationale": "Creates a positive community environment"
  }'  # proposer = JWT caller (BUG-061)
```

**Approve Norm:**
```bash
curl -X POST http://localhost:3002/communities/COMMUNITY_UUID/norms/NORM_UUID/approve \
  -H "Authorization: Bearer $TOKEN"  # approver = JWT caller (BUG-061)
```

### Unit Tests

Run tests:
```bash
npm test
```

Test structure:
```
src/
├── __tests__/
│   ├── communities.test.ts    # Community CRUD tests
│   ├── members.test.ts        # Membership tests
│   └── norms.test.ts          # Norms and approval tests
```

## Performance Considerations

- Database queries use indexes on frequently queried columns
- Member count is denormalized (stored on community record) for fast access
- Approval count is calculated on-demand (could be cached if needed)
- Connection pooling for PostgreSQL (max 20 connections)
- JOIN queries limited to necessary data only

## Recent Changes

### Sprint 103 (2026-06-17) — Split child admins are child-local
- **FIXED (`executeSplit`)**: executing a split no longer promotes the executing parent admin into
  both child communities by default. Each child now receives exactly one admin selected from that
  child's assigned members: the executing admin if assigned there, otherwise an assigned parent admin,
  otherwise the strongest assigned member by within-child trust degree with deterministic
  `joined_at`/user-id tie-breaks. `split_origin` links and Sprint 86 trust/karma carry-forward remain
  unchanged. (`src/services/fissionService.ts`)

### Sprint 132 (2026-10-06) — BUG-061: six more handlers derive the caller from the JWT (ADR-064)
- **FIXED (SECURITY)**: these handlers authorized a client-supplied body id. Each now uses
  `req.user.userId` and ignores the body field (401 without a JWT identity):
  - `POST /communities/:communityId/members` took `user_id`, `role` **and** `invited_by` from the
    body with no caller check, so any logged-in user could add themselves as **admin** of any
    community. It is now **admin-only**, `invited_by` = JWT caller, role ∈ member/moderator/admin.
  - `PUT /communities/:id`, `DELETE /communities/:id` (body `user_id` named the admin).
  - `POST /:communityId/norms` (body `created_by`), `POST /:communityId/norms/:normId/approve`
    and `DELETE /:communityId/norms/:normId` (body `user_id`): forged proposals, votes, archives.
- Tests: `tests/regression/sprint-132-body-identity.test.ts` (14 cases, red before the fix) and
  root `tests/integration/sprint-132-body-identity.integration.test.ts` (real Postgres).
  `tests/fixtures/volumeSeeder.ts` now adds members with the creator's admin token.

### Sprint 93 (2026-06-10) — Members DELETE derives caller from JWT (ADR-064 close-out)
- **FIXED (`DELETE /communities/:communityId/members/:userId`)**: the handler read `admin_user_id`
  from the request **body**, so an attacker could spoof an admin — or set it equal to the target
  `:userId` to fake a "self-remove" and bypass the admin check entirely, removing any member. The
  caller is now taken from the verified JWT (`req.user.userId`), mirroring the PUT handler; the body
  is ignored. Last-admin guard and the `user_left_community` event (`removed_by` = JWT caller) are
  unchanged. All clients dropped the `admin_user_id` argument (`apps/frontend/src/lib/api.ts`, shared
  `packages/shared/api/client.ts`, `ActiveTab.tsx`). Test:
  `tests/tdd/sprint-93-members-delete-jwt.test.ts`. (`src/routes/members.ts`)

### Sprint 86 follow-up (2026-06-05) — Split carries trust + karma forward
- **FIXED (`executeSplit`)**: a split moved members to child communities but left their trust edges
  (`social_graph.trust_edges`) and karma (`reputation.karma_records`) under the parent `community_id`,
  so each child started at 0 — connections "vanished" even though the split clusters on strong bonds.
  `executeSplit` now copies, per child: **within-group trust edges at full weight** (both endpoints in
  the same child; cross-group trust still flows via the `split_origin` link at 0.40) and the group's
  **karma records**. (`src/services/fissionService.ts`)
- **Data repair**: `infrastructure/postgres/migrations/20260605-split-carry-trust-karma-backfill.sql`
  backfills already-split communities — within-group parent edges → child (ON CONFLICT DO NOTHING),
  and group karma → child (guarded to children with no karma yet, so re-runs never duplicate the ledger).

### Sprint 86 follow-up (2026-06-05) — Fusion member-count fix
- **FIXED (`executeFusion`)**: the merged community was created with `current_members` left at the table default (0) and the count was **never recomputed** after migrating members — so a merged community rendered "0 members" in the header while the member list showed everyone (the same class of bug Sprint 78 fixed for `executeSplit`, but the fix had never been applied to the fusion path). `executeFusion` now upserts the executing admin as an active `admin` and recomputes `current_members` from actual active membership. (`src/services/fusionService.ts`)
- **Data repair**: `infrastructure/postgres/migrations/20260605-fusion-member-count-backfill.sql` recomputes `current_members` from actual active rows for already-drifted communities (past fusions, pre-fix splits, or ordinary join/leave counter drift). Idempotent.

### Sprint 78 (2026-05-31) — Autonomous fission fixes (ADR-057)
- **FIXED (`executeSplit`)**: child communities were created with `current_members` left at the table default (0) and **no admin member** (only `creator_id` was set) — so they rendered empty and un-administrable. `executeSplit` now upserts the executing admin as an active `admin` in BOTH children and recomputes `current_members` from actual membership. (`src/services/fissionService.ts`)
- Enables autonomous fission: the simulation votes split proposals to `approved` (auto-approve at quorum in the vote route), then a sim admin executes them. Used to split the post-dedup over-cap communities (>150) back under Dunbar's number.

### Sprint 77 (2026-05-30) — Community Identity & Idempotent Creation (ADR-062)
- **MODIFIED**: `POST /communities` is now **idempotent on community identity** `(LOWER(TRIM(name)), LOWER(TRIM(COALESCE(location,''))))`. An active match is joined (returns `existing: true`, HTTP 200) instead of inserting a duplicate; a new identity creates as before (`existing: false`, HTTP 201). Private matches are not auto-joined. Extracted `buildRefreshedToken()` helper (shared by create + join paths) and `src/utils/identity.ts` (`identityKey`, `pickCanonical`).
- **NEW**: partial unique index `idx_communities_identity_active` on `communities.communities (LOWER(TRIM(name)), LOWER(TRIM(COALESCE(location,'')))) WHERE status='active'` — enforces one active community per identity going forward; partial-on-active so archived/split/fused names stay re-creatable.
- **NEW**: one-time de-duplication migration `infrastructure/postgres/migrations/20260530-community-dedup.sql` — FK-discovery-driven re-parent-before-delete that collapsed the demo DB's 707 communities (~23 distinct identities) onto the oldest canonical survivor per identity. Inter-duplicate relationship rows (community_links, community_trust_edges, fusion/split proposals) are dropped rather than re-parented; `community_trust_edges` is recomputable.
- **FIXED (cap bug, sim)**: `create-community-workflow.ts` previously fetched `discoverCommunities({limit:11})` then checked `>= 15` — unreachable dead code. Replaced with a coherent `MAX_COMMUNITIES = 50` bound.
- **FIXED (sim hygiene)**: simulation actor pool now explicitly excludes `@karmyq.test` e2e/integration fixture accounts (`SIM_ACTOR_POOL_FILTER`).

### Sprint 70 (2026-05-28) — Fusion Mechanism
- **MODIFIED**: `GET /communities/:id` — now also returns `active_fusion_proposal` (id, status, community_a/b_id, merged_community_name) if a non-executed/rejected proposal exists
- **NEW**: `POST /communities/:id/fusions` — admin A creates fusion proposal targeting another community
- **NEW**: `POST /communities/:id/fusions/:fusionId/accept` — admin B accepts, moves to discussion
- **NEW**: `POST /communities/:id/fusions/:fusionId/reject` — admin B rejects proposal
- **NEW**: `GET /communities/:id/fusions/:fusionId` — proposal detail + both community tallies + my_vote + my_community
- **NEW**: `POST /communities/:id/fusions/:fusionId/start-vote` — either admin opens parallel vote
- **NEW**: `POST /communities/:id/fusions/:fusionId/vote` — member casts trust-weighted vote for their community
- **NEW**: `POST /communities/:id/fusions/:fusionId/execute` — either admin executes approved fusion (atomic: creates merged community, migrates members + trust×0.70 + karma, creates fusion_origin links, archives originals)
- **NEW**: `communities.fusion_proposals` table — bilateral proposal lifecycle (status: `pending_acceptance → discussion → voting → approved → executed | rejected`)
- **NEW**: `communities.fusion_votes` table — per-member, per-community votes with prestige weighting
- **NEW**: `community_links.link_type` CHECK extended to include `'fusion_origin'`
- **NEW**: `src/database/fusionsDb.ts` — DB query functions for fusion tables
- **NEW**: `src/services/fusionService.ts` — atomic execute transaction
- **NEW**: `src/routes/fusions.ts` — all 7 fusion route handlers (mounted at /communities)

### Sprint 69 (2026-05-27) — Fission Mechanism
- **MODIFIED**: `GET /communities/:id` — now returns `size_alert` ('approaching'|'recommend_split'|'urgent_split'|null) computed from `current_members`, and `active_split_proposal` (id, status, group names) if a non-executed/rejected proposal exists
- **NEW**: `POST /communities/:id/splits` — admin creates split proposal; runs trust-graph clustering; seeds `split_member_assignments`
- **NEW**: `GET /communities/:id/splits/:splitId` — get proposal detail + member assignments + prestige-weighted vote tally
- **NEW**: `PUT /communities/:id/splits/:splitId/assignments` — admin bulk-updates member assignments
- **NEW**: `POST /communities/:id/splits/:splitId/start-vote` — admin transitions proposal from `discussion` → `voting`
- **NEW**: `POST /communities/:id/splits/:splitId/vote` — member casts vote (prestige-weighted by community trust score)
- **NEW**: `POST /communities/:id/splits/:splitId/execute` — admin executes approved split (atomic transaction: creates 2 child communities, moves members, creates split_origin link, marks parent status='split')
- **NEW**: `communities.split_proposals` table — proposal lifecycle
- **NEW**: `communities.split_votes` table — per-member prestige-weighted votes
- **NEW**: `communities.split_member_assignments` table — per-member group assignment (cluster_suggestion vs assigned_to)
- **NEW**: `src/database/splitsDb.ts` — DB query functions for proposals, votes, assignments
- **NEW**: `src/services/fissionService.ts` — greedy bisection clustering algorithm + atomic execute transaction
- **NEW**: `src/routes/splits.ts` — all 6 split route handlers (mounted at /communities)

### Sprint 67 (2026-05-26) — Trust-Gated Governance
- **NEW**: `GET /communities/:id/governance` — returns governance state: settings, maturity (constrained/mature), eligible members, pending nominations, current role holders
- **NEW**: `POST /communities/:id/governance/nominate` — nominate eligible member for a role; validates trust score ≥ eligibility threshold; 409 on duplicate pending nomination
- **NEW**: `POST /communities/:id/governance/ratify/:nominationId` — ratify a nomination; auto-grants role at quorum in a single transaction
- **NEW**: `communities.governance_nominations` + `communities.governance_ratifications` tables (migration 009-governance-schema.sql)
- **NEW**: `communities.communities.governance_settings` JSONB column (eligibility_threshold, quorum_size, template)
- **NEW**: `src/database/governanceDb.ts` — all governance DB queries
- **NEW**: `src/routes/governance.ts` — governance route handlers

### Sprint 56 (2026-05-17) — Publisher centralization
- **CHANGED**: `src/events/publisher.ts` — delegates to `createPublisher('community-service')` from `@karmyq/shared`; local Bull setup removed
- **CHANGED**: `package.json` — added `@karmyq/shared` to dependencies (was missing, caused implicit resolution)

### Sprint 40 (2026-03-25) — Geo Mode Graceful Fallback
- `GET /communities?mode=geography` now falls back to returning all communities when the geo query returns 0 rows (no communities have coordinates); response includes `fallback: true`

### Sprint 36 (2026-03-23) — Geographic and Interest-Based Discovery
- Added `latitude`, `longitude`, and `tags` columns to `communities.communities` (migration 014)
- Added GIN index on `tags` and composite index on `(latitude, longitude)`
- New query modes on `GET /communities`: `mode=geography` (sort by distance) and `mode=interests` (filter by tags)
- New `GET /communities/tags` endpoint returns all distinct tags across active communities
- New `PUT /communities/:id/tags` endpoint for admins to set community interest tags
- New `PUT /communities/:id/location` endpoint for admins to set community coordinates

## Future Enhancements (TODO)

- [x] Community tags/keywords for better discovery (completed Sprint 36)
- [ ] Community avatars/images
- [ ] Member roles beyond admin/member (moderator, organizer, etc.)
- [ ] Community activity feed
- [ ] Email notifications for join requests (private communities)
- [ ] Community analytics dashboard
- [ ] Sub-communities or working groups
- [ ] Community-specific help request categories
- [ ] Norm voting with expiration (time-limited voting period)
- [ ] Federation support (cross-instance communities)

## Related Documentation

- Main architecture: `/docs/ARCHITECTURE.md`
- Database schema: `/infrastructure/postgres/init.sql` (lines 33-91)
- Federation communities: `/docs/FEDERATION_PROTOCOL.md` (section: Federated Communities)

## Sprint 112 — Governance + export disclosure (ADR-082, 2026-06-24)

- `GET /communities/:id/governance` — eligibility is still computed from exact trust-weight sums
  INTERNALLY, but the response projects member rows to identity + a coarse reason only:
  `eligible_members: { user_id, name, eligible:true, eligibility_reason:'established_community_relationships' }`
  and `role_holders: { user_id, name, role }`. No member `trust_score`/`karma`. Community maturity
  aggregate + configured threshold remain (not a member's personal score). A failed nomination returns
  `422 GOVERNANCE_ELIGIBILITY_NOT_MET` with no score/threshold numbers. (`database/governanceDb.ts`)
- `GET /communities/:communityId/export` — no per-member `karma_records`/`trust_scores`; instead a
  non-identifying `community_reputation_summary { participating_members, transaction_count,
  total_karma_points }` only when ≥5 active members, omitted otherwise.
- `GET /communities/:communityId/export/activity` — keeps per-member activity counts (helps/requests)
  but drops Total Karma, Trust Score, and karma-ranked ordering. (Sprint 134 PR A redefined the four
  counts against the live schema; see Recent Changes.)

---

## Sprint 122 — Express 5 (2026-07-29)

`@types/express` **4.17.21 → 5.0.6**. Express 5's `path-to-regexp` 8 widened route params to
`string | string[]` (a repeatable `:ids+` or wildcard `*splat` segment captures an array), which
surfaced as `TS2345` at every `req.params` read. Karmyq declares no such segment, so params are
narrowed back to `string` via **`RouteParams`** (exported from `@karmyq/shared/middleware/auth`)
rather than widened with `as any`. The invariant is enforced by
`tests/regression/sprint-122-express5-route-params.test.ts`, which fails if any route literal
introduces wildcard or repeatable syntax.

Changed: `src/routes/communities.ts` — the `GET /:id` handler is now `Request<RouteParams>`.

Express **4.18.2 → 5.2.1**, supplied by the root `package.json` **production** dependency
(the Dockerfiles copy the root manifest and `npm install --omit=dev`). **No endpoint, payload,
status code or event contract changed** — `feedback:check` flags this service's `src/routes/`
diff as a "route change", but the diff is type annotations only, so the API Endpoints section
above is still accurate.

Express 5 semantics now in force: async handler rejections auto-forward to the error middleware,
`res.status()` throws `RangeError` on an out-of-range code, and `req.query` is a getter rather
than a writable own property.

**⚠️ `req.body` default restored (the bug this PR actually shipped to CI).** body-parser 1
initialised `req.body` to `{}` on every request; body-parser 2 leaves it **undefined** unless a
body was parsed, so `const { x } = req.body` throws a `TypeError` on a bodyless request and the
route's catch turns it into a **500**. `app.use(normalizeRequestBody)` is now mounted immediately
after `express.json()` in `src/index.ts` to restore the Express 4 behaviour. It fills in only a
*missing* body, so a parsed array or explicit `null` is untouched.

## Sprint 131 PR B2 — declared imports (2026-09-17)

Now declares `cors`, `dotenv`, `express`, `jsonwebtoken`, `pg` in `dependencies` at root's exact
ranges (BUG-046). They were imported but undeclared, resolving only through root hoisting. Resolved versions are
unchanged. `tests/regression/sprint-131-workspace-declarations.test.ts` fails on any undeclared import, and fails
when root's hoisted version stops satisfying a range declared here — so a root-only major bump (e.g. D1 dotenv 17)
must bump this manifest in the same PR. Range satisfaction alone could not enforce that: npm answers a stranded
range by nesting a satisfying older copy under the workspace, which keeps a plain satisfaction check green.

No endpoint, payload, event or schema change.

## Sprint 131 D1 — dotenv 17 (2026-09-19)

`dotenv` **16.6.1 → 17.4.2** (root plus all 9 npm workspaces that declare it; the ranges moved together in
one PR, which the declarations gate requires. The two non-workspace test manifests, `tests/e2e/package.json` and
`tests/load/package.json`, deliberately stay on `^16.3.1` with their own nested installs — dotenv 16 accepts
`quiet` too, so their call sites are fixed either way). `src/index.ts` now calls **`dotenv.config({ quiet: true })`**.

`quiet` is not cosmetic here. dotenv 16 defaulted it to `true`; 17 defaults it to falsy, so a bare
`config()` prints `◇ injected env (N) from .env // tip: …` on every call — and the tip is drawn at random
from an 8-entry list that includes third-party promo URLs. Without the flag this service would log a
non-deterministic marketing line on every container start.
`tests/regression/sprint-131-dotenv-quiet.test.ts` discovers the call sites from tracked source and fails
on any `config()` that omits `quiet`.

No endpoint, payload, event or schema change. `parse()` output is byte-identical between 16 and 17, and
nothing here reads `config()`’s return value.
