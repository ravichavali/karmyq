# Sprint 125: Provider Standing & Community Reach — Design Spec

**Date**: 2026-08-13
**Status**: Approved
**Version**: v11.44.0 → v11.45.0
**Sprint Branch**: `feature/sprint-125-provider-standing`

---

## Overview

Migration `022-provider-profiles.sql` shipped a complete community policy for the paid-provider
layer: three config columns under the comment *"Community config: opt-in to showing provider
services layer"*. ADR-041 designed that policy deliberately. The admin UI exposes it. **Nothing
reads it.**

A community admin today opens the community Profile tab, sees *"Enable provider services — Allow
members to discover neighborhood service providers in this community"*, flips the switch, sets a
minimum trust score, and saves. The values persist to `communities.community_configs`. No service
consults them, and there is no community provider surface for them to govern. The admin is
operating a control that does nothing, and the manifesto claim *"You cannot arrive and immediately
offer paid work. You have to earn standing first"* is false in code.

Sprint 125 finishes the design that already shipped. It builds the community-scoped provider
surface ADR-041 assumed, enforces all three config columns there, and closes the unauthenticated
global directory. It is prefixed by an urgent security task: the two `image-size` advisories whose
time-boxed exemptions stop being valid on **2026-08-18** and will then block every PR.

### Core Principle: Enforce the design that shipped, don't redesign it

The provider gap is a missing-enforcement bug, not an architectural crisis. ADR-041 already
specified community-gated *visibility* alongside open *self-registration*. Sprint 125 changes
neither decision — it makes the first one real. The one genuinely new decision, closing the
public directory, gets its own ADR because it narrows an explicit ADR-041 sentence.

---

## Multi-Sprint Arc

### Sprint 123 — Licensing and truth audit (complete, v11.43.0)
### Sprint 124 — Exemption mechanism and honest Expo drift gate (complete, v11.44.0)
### Sprint 125 — `image-size` Task 0 + provider standing and community reach ← **this sprint**
### Sprint 126 — Honest demo-data backfill through production math (upcoming)
### Sprint 127 — Live simulation across all users (upcoming)

---

## Verified starting state

Every claim below was read out of the file before this spec was written.

### The three config columns are inert

`infrastructure/postgres/migrations/022-provider-profiles.sql:54-58`:

```sql
-- Community config: opt-in to showing provider services layer
ALTER TABLE communities.community_configs
  ADD COLUMN IF NOT EXISTS provider_services_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS provider_min_personal_trust_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_services_list TEXT[] DEFAULT '{}';
```

Consumers, across `services/`, `packages/`, `apps/frontend/src`, `apps/mobile` (excluding
`node_modules`, `dist/`, `coverage/`):

| Location | Operation |
|---|---|
| `services/community-service/src/routes/config.ts:58-60` | SELECT (read back to admin) |
| `services/community-service/src/routes/config.ts:209-211,240-242` | UPDATE (admin write) |
| `apps/frontend/src/components/community/tabs/ProfileTab.tsx:120-122,342-361` | admin UI state + switch |

**No enforcement path exists.** The only other matches are generated `dist/` and `coverage/`
artifacts of the same `config.ts`.

### There is no community-scoped provider surface

Every route in `services/request-service/src/routes/providers.ts`:

| Line | Route | Auth | Scope |
|---|---|---|---|
| `:28` | `GET /` | **none (public)** | global, `ORDER BY pts.trust_score DESC NULLS LAST` |
| `:315` | `GET /:providerId` | **none (public)** | global |
| `:158` | `GET /:providerId/rate-cards` | **none (public)** | global |
| `:108` | `GET /my` | auth | caller's own profiles |
| `:352` | `POST /` | auth | create (validates only that `service_type` + `display_name` are non-empty) |
| `:413`, `:471`, `:497` | `PUT`/`DELETE`/`PATCH /:providerId` | auth | owner-only writes |

There is no `GET /communities/:id/providers`. The arc design said to enforce the threshold "at the
point of selecting providers for a community surface" — **that surface does not exist**, which is
why this sprint builds it rather than only adding a `WHERE` clause.

### `shared_communities` already exists, but only annotates

`providers.ts:64-82` joins `communities.members` twice (viewer × provider, both `status = 'active'`)
to attach `shared_communities` to each row, deliberately from **live** membership rather than the
JWT claim (ADR-073, Sprint 93). It changes no row's presence in the response. This is the correct
hook to reuse for the new endpoint — do not derive membership a second way.

### Two different scores share the word "trust"

| Table | Grain | Meaning | Default |
|---|---|---|---|
| `reputation.trust_scores` (`init.sql:2188-2202`) | **user × community** | ADR-037 personal trust — what `provider_min_personal_trust_score` means | `score` **DEFAULT 50** |
| `reputation.provider_trust_scores` (`022-provider-profiles.sql:43-52`) | **provider profile** | service quality: 60% avg_stars + 30% completion_rate + 10% response_rate | `trust_score` DEFAULT 0 |

⚠️ The directory ranks by the *second*; the community gate filters on the *first*. Confusing them
silently produces a gate that rejects the wrong people.

### ADR-041, verbatim

- Layer 2 — Professional Services: *"Publicly visible (not community-gated) — a rickshaw stand
  serves the neighborhood, not one community"*
- Self-registration: *"Any authenticated user can create a provider profile. Communities can gate
  visibility with `provider_services_enabled` and `provider_min_personal_trust_score`."*

Open creation is therefore ADR-041's deliberate design, not drift. The manifesto's "earn standing"
claim is satisfied at the reach layer, which is exactly where the shipped column applies.

### `image-size`, re-measured 2026-08-13 against live arbiters

| Measurement | Result |
|---|---|
| `npm view image-size version` | `2.0.2` — unchanged |
| `GHSA-w3rx-r6r6-pgpr` (GitHub advisories API) | affected `<= 2.0.2`, `first_patched_version: null`, not withdrawn |
| `GHSA-5p2g-fcmc-qvqq` | affected `<= 2.0.2`, `first_patched_version: null`, not withdrawn |
| `npm view metro@latest dependencies.image-size` | `^1.0.2` at `metro@0.87.0` — unchanged |
| Resolved tree (`npm ls image-size --all`) | `@karmyq/mobile → expo@57.0.12 → @expo/metro@56.0.0 → metro@0.84.4 → image-size@1.2.1` |
| `node scripts/audit-exemptions.js` | exit 0 — 0 unexempted, 10 findings under exemption |

No published `image-size` escapes either advisory; no `metro` release drops the dependency.
`scripts/audit-exemptions.js:107` documents `expires` as the **first invalid day**, so both entries
in `security/audit-exemptions.json` are valid through **2026-08-17** and fail from **2026-08-18**.
`MAX_EXEMPTION_DAYS = 7` caps any renewal.

---

## New Concepts

**Community provider layer** — the set of provider profiles a given community has opted into
showing, filtered by that community's service-type allowlist and personal-trust floor. A provider
profile is global (one row, ADR-041); its *reach* into each community is computed per community.

**Reach gate** — the three-condition predicate deciding whether a provider profile surfaces in
community `C`:

1. `C.provider_services_enabled = TRUE`, and
2. the provider is an **active member** of `C`, and their ADR-037 personal trust score in `C`
   (`COALESCE(reputation.trust_scores.score, 0)`) is `>= C.provider_min_personal_trust_score`, and
3. `C.provider_services_list` is empty (meaning "all types allowed") **or** contains the profile's
   `service_type`.

**Fail-closed unknown standing** — a provider with no `reputation.trust_scores` row in `C` scores
`0`, not `50`. Per ADR-037: *"unknown people have trust score 0 (no information), not 50 (presumed
trustworthy)"*. This is what makes "earn standing first" true, and what lets the gate demonstrably
reject.

---

## Data Model

**No schema changes.** All three config columns, both trust tables, and `communities.members`
already exist. Sprint 125 is pure enforcement.

One index is warranted for the new endpoint's join:

```sql
-- infrastructure/postgres/migrations/20260813-provider-reach-index.sql
-- The community provider layer joins trust_scores by (user_id, community_id) for every
-- candidate provider in one community. The existing indexes cover neither pair.
CREATE INDEX IF NOT EXISTS idx_trust_scores_community_user
  ON reputation.trust_scores(community_id, user_id);
```

⚠️ `init.sql` is generated — add the migration, then run `scripts/regenerate-init-sql.sh` and
commit both, or `tests/regression/sprint-120-init-sql-drift-gate.test.ts` fails.

---

## API Endpoints

### New

| Method | Path (service-internal) | Public URL | Auth | Description |
|---|---|---|---|---|
| `GET` | `/providers/community/:communityId` | `/api/providers/community/:communityId` | required + active membership | The community provider layer. Applies the three-condition reach gate. `403` if the viewer is not an active member of `:communityId` (re-derived live, never from the JWT claim). `200` with `data: []` when the community has not opted in — an empty layer, not an error. Query: `service_type`, `limit`, `offset`. |

Owning service: **request-service** (owns `requests.provider_profiles`). It reads
`communities.community_configs` and `communities.members` cross-schema, as `providers.ts:64-82`
already does.

⚠️ **This endpoint is deliberately NOT `/communities/:id/providers`.** `nginx.conf:172-173` routes
`^/api/communities(/.*)?$` to **community_service**; that path could not reach request-service
without either a new nginx rule that shadows the community prefix, or moving provider ownership
into community-service. Hanging it off the existing `^/api/providers(/.*)?$` rule
(`nginx.conf:208-209` → `request_service/providers$1`) keeps ownership correct and needs **no nginx
change** — so no deploy-ordering hazard.

### Modified

| Method | Path | Change |
|---|---|---|
| `GET` | `/requests/providers` | **now requires auth.** Remains global and cross-community. `401` without a valid bearer token. `shared_communities` annotation retained, now always populated. |
| `GET` | `/requests/providers/:providerId` | **now requires auth.** `401` without a valid bearer token. |
| `GET` | `/requests/providers/:providerId/rate-cards` | **now requires auth.** `401` without a valid bearer token. |

`decodeOptionalViewer` (`providers.ts:12-23`) becomes dead once these three routes carry
`authMiddleware`; delete it rather than leaving an unused optional-auth path.

### Unchanged

`POST /requests/providers` keeps open self-registration per ADR-041. No trust floor is added at
creation — at creation no community is selected, so a per-community threshold is not well-defined
there.

---

## Frontend Changes

| File | Change |
|---|---|
| `apps/frontend/src/pages/providers/index.tsx` | Directory now requires auth (already inside the authenticated shell; verify no anonymous render path). |
| `apps/frontend/src/lib/api/providerApi.ts` | Add `getCommunityProviders(communityId, params)`. |
| `apps/frontend/src/components/community/tabs/` | **New** `ProvidersTab.tsx` — renders the community provider layer; empty state reads "This community has not enabled provider services" when the gate returns an empty layer. |
| `apps/frontend/src/lib/communityTabs.ts` | Register the Providers tab, shown only when `provider_services_enabled`. |
| `apps/frontend/src/components/community/tabs/ProfileTab.tsx` | The switch now drives real behavior — add helper text stating what enabling does, and surface `provider_services_list` as an editable service-type allowlist (currently held in state at `:122` but not edited). |

---

## User Guide & Doc Updates

Mandatory this sprint:

| Doc | Change |
|---|---|
| `docs/guides/` provider guide | New section: how a community enables its provider layer, what the trust floor does, what the allowlist does. |
| `apps/frontend/src/lib/onboarding/workflows.ts` | Admin workflow step for enabling provider services. |
| `apps/landing/src/data/docs/concepts/adr-095-*.json` | ADR-095 landing page + `nav.json` wiring. |
| `apps/landing/src/data/docs/` concept page | "Provider standing" — why reach is gated and registration is not. |
| `services/request-service/CONTEXT.md` | New endpoint, the three modified routes, the reach gate; update the existing note at `:2989-2991` which describes the three columns as if enforced. |
| `services/community-service/CONTEXT.md` | Config columns now have a consumer; name it. |
| `services/registry.json` | `request-service.apis.provides` — add the new endpoint, mark the three as auth-required. |

⚠️ `apps/landing/src/data/docs/api.json` is **generated** by the landing prebuild — edit the
source, never that file. `npm test` regenerates landing docs; revert timestamp/HEAD-sha churn
before committing.

---

## ADR-095 — Authenticated provider directory and reach-gated standing

**Status**: Proposed → Accepted this sprint.

Records three things:

1. **The global directory requires authentication.** This narrows ADR-041's *"Publicly visible
   (not community-gated)"* to **"visible to any authenticated member, still not community-gated"**.
   The cross-community reach ADR-041 wanted (a rickshaw stand serves the neighborhood) is preserved
   in full; only anonymous access is withdrawn. Rationale: it is the most marketplace-shaped
   surface in the system and the public story says "It is not a marketplace". Verified safe — no
   unauthenticated consumer exists (landing only documents the routes; mobile has no provider
   surface).
2. **Standing gates reach, not registration.** ADR-041's self-registration decision stands
   unamended. The manifesto's "earn standing first" is satisfied by
   `provider_min_personal_trust_score` at the community layer, which is where the shipped column
   was always meant to apply.
3. **Unknown standing fails closed at 0.** Per ADR-037. Noted explicitly: this does *not* change
   the `reputation.trust_scores.score` column default of 50, which remains a known inconsistency
   with ADR-037 scoped to a future sprint.

ADR-041 gets a status note pointing at ADR-095; it is **not** superseded.

---

## Critical Implementation Notes

1. **`expires` is the first INVALID day.** Both `image-size` exemptions are valid through
   2026-08-17 and fail from 2026-08-18. `scripts/audit-exemptions.js:107` is the authority.
   Any renewal is capped at 7 days by `MAX_EXEMPTION_DAYS` and requires fresh measurements and a
   written rationale — the monitor workflow must **never** edit
   `security/audit-exemptions.json`.
2. **Two trust scores, different grains.** The community gate filters on
   `reputation.trust_scores.score` (user × community, ADR-037). The directory ranks on
   `reputation.provider_trust_scores.trust_score` (provider profile, service quality). Do not
   substitute one for the other.
3. **`COALESCE(ts.score, 0)`, never `ts.score`.** A missing row must fail a non-zero floor. A bare
   `ts.score >= min` in a `LEFT JOIN` yields `NULL >= n` → `NULL` → row dropped, which happens to
   be right; but an `INNER JOIN` silently drops providers even when the floor is `0`. Use a
   `LEFT JOIN` plus explicit `COALESCE`.
4. **Membership is re-derived live.** Both the viewer's membership in `:communityId` and the
   provider's are read from `communities.members` with `status = 'active'`. The JWT `communities`
   claim is a login-time snapshot and must not gate visibility (CLAUDE.md; ADR-073).
5. **The JWT field is `communities`, not `communityMemberships`.**
5a. **Express route order decides whether the new endpoint is reachable at all.** `GET /:providerId`
   is registered at `providers.ts:315` and would swallow `/community/:communityId`. Register the
   new route **before** it — the same ordering `/providers/my` (`:108`) already relies on. A test
   must assert the endpoint returns the layer, not a "provider not found" 404.
6. **Empty `provider_services_list` means "all types allowed"**, not "no types allowed". The column
   default is `'{}'`, so treating empty as a deny-all would switch off every community that opted
   in without setting a list. Condition: `cardinality(c.provider_services_list) = 0 OR
   pp.service_type = ANY(c.provider_services_list)`.
7. **A community with no `community_configs` row is disabled**, not an error.
   `config.ts` 404s on a missing row; the reach gate must instead treat absence as
   `provider_services_enabled = FALSE` and return an empty layer.
8. **Gates must be proven to REJECT.** Every gate test asserts both directions: an eligible
   provider appears AND an ineligible one is absent, for each of the three conditions
   independently. A test that only asserts presence proves nothing — this is the recurring
   defect recorded in memory (`feedback_gates_assert_weaker_than_claimed`).
9. **RLS is on.** A query that skips `setDbContext` sees nothing rather than erroring. A silently
   empty provider layer in integration tests is the tell.
10. **`init.sql` is generated.** Add the migration, run `scripts/regenerate-init-sql.sh`, commit
    both — the drift gate blocks otherwise.
11. **Dependency edits are surgical.** No `npm install --workspace`, no `npm dedupe`, no lockfile
    scratch regeneration. Edit `package.json`, splice `package-lock.json`, prove with strict
    `npm ci`.
12. **Windows environment**: `jq` is unavailable and `curl` flag parsing is unreliable — use
    `node -e` for HTTP probes and JSON parsing. `| tail` masks exit codes.
