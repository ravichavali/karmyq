# Sprint 133: Skills Depth — Design Spec

**Date**: 2026-10-08
**Status**: Approved (maintainer, 2026-10-08 planning chat; ADR number still pending allocation)
**Version**: v11.81.0 on `origin/master` at planning time → each PR bumps the minor from
`origin/master` at merge time (the Sprint 132 closeout lands first and takes at least v11.82.0)
**Sprint Branch**: `feature/sprint-133-skills-depth` (planning docs only); per-PR branches below

---

## Overview

Sprint 132 gave Karmyq one source of truth for skills (`auth.user_tags` + `auth.skill_vocabulary`),
but skills are still private to their owner. `GET /auth/profile/tags` returns only the caller's own
tags (`services/auth-service/src/routes/profileTags.ts:22-39`), so a member cannot answer the most
basic mutual-aid question, "who in my community can fix a bike?", and a skill listed by a member
carries no signal that anyone has actually seen them use it.

This sprint makes skills **visible to co-members** (opt-out), adds **community skill search**, and
lets someone who has **completed a match** with a member **vouch** for one of that member's skills.
Vouches feed the trust graph's long-reserved but never-written `endorsement_count`
(`social_graph.trust_edges`; weight 5.0 in the curated baseline,
`services/simulation-service/src/fixtures/curatedDemo/baselineWriter.ts:214`).

Before any of that, a security PR closes three disclosures with dated obligations: BUG-056
(`GET /requests/:id` has no visibility gate and returns `requester_email`), BUG-062 (member email
disclosure, found in this planning chat) and BUG-058 (ADR-059's 30-day exemption cap has no live
monitor).

### Core Principle: Visible to the people you share a community with, and only while you do

Every skill read answers "who is the audience?" with one live membership predicate. Endorsements
count only as long as their source rows exist, so the trust graph is recomputed from facts and never
incremented by events.

---

## Multi-Sprint Arc

### Sprint 132 — Inventories + skills single source (shipped through v11.81.0; closeout pending)
PR S security (BUG-055/057), A skills vocabulary, B inventory catalog, C directed borrow. ADR-099.
**The closeout must finish before Sprint 133 executes:** `shell-quote` (critical) and `sharp` (high)
advisory fix, the BUG-061 PR (`4c709023`, branch `agent/claude/sprint-132-closeout`), the
`node-forge`/`braces` exemption decisions (expiring 2026-10-08 and 2026-10-09; each needs explicit
maintainer authorization), ADR-099 → Implemented, and archiving the Sprint 132 handoff.

### Sprint 133 — Skills depth (this sprint)
PR S security (BUG-056, BUG-062, BUG-058) → PR A visibility + discovery → PR B endorsements →
PR D curated demo seed.

### Sprint 134+ — candidates (not committed)
- Endorsement notification to the endorsee ("Caleb vouched for your carpentry").
- Inventory-aware `BorrowMatcher` (`packages/shared`, its own PR).
- Lending lifecycle (on_loan, due dates, return confirmation).
- Endorsement-weighted matching (rank helpers with vouched skills higher).
- `match_completed` trust-edge increments are not idempotent either (`upsertTrustEdge`,
  `services/social-graph-service/src/database/trustEdgeDb.ts:117-134` uses `+ 1`); a redelivered
  completion over-counts. Out of scope here; log in IDEAS.

---

## New Concepts

| Term | Meaning |
|---|---|
| **Skill visibility** | `auth.user_privacy_settings.share_skills_with_communities` (default `true`, opt-out). When `true`, the member's skill tags are visible to every user who is currently an **active** member of at least one community the member is also actively in. When `false`, the skills are visible to the member only: they vanish from co-member views **and** from community search. |
| **Co-member** | Two users who both hold `communities.members.status = 'active'` rows in at least one common community, queried live. A JWT `communities` claim never decides this. |
| **Skill endorsement (vouch)** | A row in `auth.skill_endorsements`: one endorser vouching for one skill tag of one endorsee. Allowed only when the endorser has a **completed** match with the endorsee (either direction) and can currently see that skill. One row per (endorser, skill tag); withdrawing sets `withdrawn_at`, re-endorsing clears it. |
| **Pair endorsement count** | The trust-graph value: for the pair (a, b) in community c, the number of **distinct endorsers among {a, b}** with at least one active endorsement of the other whose qualifying match's request belongs to c. It is always 0, 1 or 2. Five vouches from a to b count once. |
| **Reconcile** | Recomputing a pair's `endorsement_count` (and `raw_weight`) from `auth.skill_endorsements` + `requests.request_communities`. It is idempotent: running it 1 or 10 times yields the same row. Events only say *which pair changed*; they never carry a delta. |

---

## Data Model

### PR S — no schema change

### PR A — `infrastructure/postgres/migrations/20261008-skill-visibility.sql`

```sql
-- Opt-out skill visibility (Sprint 133, ADR-<pending>)
ALTER TABLE auth.user_privacy_settings
  ADD COLUMN IF NOT EXISTS share_skills_with_communities boolean NOT NULL DEFAULT true;

-- Community skill search filters on skill_slug for skill tags.
CREATE INDEX IF NOT EXISTS idx_user_tags_skill_slug
  ON auth.user_tags (skill_slug) WHERE tag_type = 'skill';

-- Deprecated in Sprint 132 (ADR-099) and kept only for image-rollback safety. No image since
-- v11.78.0 reads it (verified 2026-10-08: the only repo reference is the curated reset table policy).
DROP TABLE IF EXISTS auth.user_skills;
```

A member with **no** `user_privacy_settings` row is visible (the opt-out default). Every predicate
reads `COALESCE(ps.share_skills_with_communities, true)` through a `LEFT JOIN`.

### PR B — `infrastructure/postgres/migrations/20261012-skill-endorsements.sql` (date = authoring day)

```sql
CREATE TABLE IF NOT EXISTS auth.skill_endorsements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endorser_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endorsee_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_tag_id   uuid NOT NULL REFERENCES auth.user_tags(id) ON DELETE CASCADE,
  -- requests.matches(id) of the qualifying completed match. No cross-schema FK (schema ownership).
  match_id      uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  withdrawn_at  timestamptz,
  CONSTRAINT skill_endorsements_not_self CHECK (endorser_id <> endorsee_id),
  CONSTRAINT skill_endorsements_one_per_tag UNIQUE (endorser_id, user_tag_id)
);
CREATE INDEX IF NOT EXISTS idx_skill_endorsements_pair
  ON auth.skill_endorsements (endorser_id, endorsee_id) WHERE withdrawn_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_skill_endorsements_tag
  ON auth.skill_endorsements (user_tag_id) WHERE withdrawn_at IS NULL;
```

`social_graph.trust_edges` is unchanged: `endorsement_count` already exists.

**Demo reset policy** (`services/simulation-service/src/fixtures/curatedDemo/tablePolicy.ts`):
PR A removes the `'auth.user_skills'` entry (`:45`); PR B adds `'auth.skill_endorsements': 'reset'`.
`services/simulation-service/tests/regression/sprint-117-reset-safety.test.ts` must pass after each.

`init.sql` is regenerated (never hand-edited) after each migration; see Critical Note 12.

---

## API Endpoints

All responses follow ADR-074. "Live" means queried from `communities.members` at request time.

### PR S — security

| Method | Path | Change |
|---|---|---|
| GET | `/requests/:id` | **BUG-056.** 404 unless the caller is (1) the requester, (2) a responder on **any** match for this request (any status), or (3) for a **non-directed** request, reachable under `getRequestReachability` (same community, sister community, `trust_network`/`platform` scope). **Directed requests keep exactly today's stricter rule:** `directedAudienceSql` alone decides; reachability never widens it. `requester_email` is removed from the response. |
| GET | `/users/:userId` | **BUG-062.** Requires `authMiddleware` (it is currently anonymous: no auth at the mount, `services/auth-service/src/index.ts:59`, or the route, `routes/users.ts:16`). `email` is returned only when `:userId` is the caller. No in-repo caller exists (repo scan 2026-10-08). |
| GET | `/communities/:id` | **BUG-062.** Each member row's `user_email` is included only when the caller is a **live active admin** of that community, or the row is the caller's own. Everyone else gets the row without the field. |
| GET | `/communities/:communityId/members` | **BUG-062.** Same email rule. Non-admins may list only `status=active`; `status=pending` (or any other value) returns 403 for non-admins. |
| — | `scripts/audit-exemptions.js` | **BUG-058 option (b).** `MAX_EXEMPTION_DAYS` back to 7; delete `.github/workflows/image-size-advisory-watch.yml`, `scripts/check-image-size-upstream.js` and the monitor-specific regression; ADR-059 amendment; close issue #236. |

Admin screens that read `user_email` keep working because they run as admins:
`apps/frontend/src/components/community/tabs/ActiveTab.tsx:134,233`,
`apps/frontend/src/components/community/StewardRequestsAdmin.tsx:558`. Each must tolerate a
missing field (`member.user_email ?? ''`).

### PR A — visibility and discovery (auth-service; nginx already routes `/api/auth/*`)

| Method | Path | Description | Auth | Response `data` |
|---|---|---|---|---|
| GET | `/users/me/settings` | **Fix:** today it is shadowed by `GET /users/:userId` (`users.ts:16` is registered before `:71`), so `'me'` reaches the uuid query. Move both `/me/*` routes above `/:userId`. Adds `share_skills_with_communities`. | JWT | `{ user_id, show_my_karma_to_me, share_skills_with_communities, … }` |
| PATCH | `/users/me/settings` | Accepts either or both booleans; at least one is required; a non-boolean value → 400. The upsert writes only the fields provided. | JWT | same |
| GET | `/auth/skills/users/:userId` | A member's visible skills. Self: always. Others: 404 unless co-member **and** sharing is on. The 404 does not distinguish "not a co-member", "hidden" and "no such user". | JWT | `[{ tag_id, label, skill_slug }]` (PR B adds `endorsement_count`, `endorsed_by_me`, `can_endorse`) |
| GET | `/auth/skills/communities/:communityId` | Skill directory: each visible skill in the community with the count of members sharing it. The caller must be a live active member; otherwise 404. | JWT | `[{ skill_key, label, member_count }]` |
| GET | `/auth/skills/communities/:communityId/search?skill=<text>` | Members of the community with a matching visible skill. `skill` is resolved with the existing `resolveSkillSlug` (exact after lower+trim against slug/label/synonym, `services/auth-service/src/services/skillVocabulary.ts`); unresolved text matches the same normalized key matching uses. No substring search. Caller must be a live active member; otherwise 404. Limit 50, ordered by name. | JWT | `[{ user_id, name, skills: [{ tag_id, label }] }]` |
| — | `GET /requests/matched/for-user` | **Removed** (route `services/request-service/src/routes/requests.ts:216-217`; unused wrapper `apps/frontend/src/lib/api.ts:524`). | | |

`skill_key` = `skill_slug` when present, else `lower(regexp_replace(trim(tag_value), '[^a-z0-9]+', '_', 'gi'))`
(the same normalization Sprint 132 matching uses; Critical Note 9 of the Sprint 132 spec).

### PR B — endorsements (auth-service)

| Method | Path | Description | Auth | Body | Response |
|---|---|---|---|---|---|
| POST | `/auth/skills/endorsements` | Vouch for a skill tag. 404 unless the caller can see the tag (PR A predicate) **and** has a completed match with its owner (either direction, live). Self → 400. Re-endorsing a withdrawn row clears `withdrawn_at` (same row); endorsing an active row is a 200 no-op. | JWT | `{ tag_id }` | `{ id, tag_id, endorsee_id, created_at }` (201 new / 200 existing) |
| DELETE | `/auth/skills/endorsements/:tagId` | Withdraw the caller's endorsement of that tag. Idempotent (200 when already withdrawn or absent). | JWT | — | `{ withdrawn: true }` |
| GET | `/auth/skills/users/:userId` | Extended: per skill, `endorsement_count` (active endorsers), `endorsed_by_me`, `can_endorse`. | JWT | — | see PR A |

**Event:** `skill_endorsement_changed` `{ endorser_id, endorsee_id }`, published after commit by
POST, DELETE **and** `DELETE /auth/profile/tags/:tagId` when the deleted tag had endorsements. Its
only subscriber is social-graph, which runs **reconcile** for the pair. The transport (shared
`karmyq-events` or a dedicated queue) is chosen in Task B1 **after** BUG-060 is reproduced or
refuted; see Critical Note 7. Registered in `services/registry.json` and both services' CONTEXT.md.

---

## Frontend Changes

| Surface | PR | Change |
|---|---|---|
| `apps/frontend/src/components/community/tabs/ActiveTab.tsx`, `StewardRequestsAdmin.tsx` | S | Tolerate a missing `user_email`. |
| `apps/frontend/src/pages/profile.tsx` (privacy section near `:299-314`) | A | "Show my skills to people in my communities" toggle (on by default), wired to `PATCH /users/me/settings`. Copy explains it also removes you from community skill search. |
| `apps/frontend/src/lib/api.ts` | A/B | Add `skillsService` (`getUserSkills`, `getCommunitySkillDirectory`, `searchCommunitySkills`, `endorse`, `withdrawEndorsement`); extend settings types; delete `getMatchedRequests` (`:524`). |
| Community page People tab (`apps/frontend/src/pages/communities/[id].tsx`, People tab component) | A | "Find a skill" panel: directory chips (label + count) and a search box; results list members with their matching skills. Members only (the server 404s non-members; the panel is hidden for them). |
| New `apps/frontend/src/components/skills/MemberSkills.tsx` | A/B | Renders a member's visible skills; PR B adds the vouch count and a "Vouch" / "Withdraw vouch" button when `can_endorse`/`endorsed_by_me`. Used in the People tab member detail and on match detail (`apps/frontend/src/pages/matches/[id].tsx`) for completed matches, where vouching is most natural. |
| `apps/frontend/src/lib/onboarding/workflows.ts` | A/B | Mention skill visibility and vouching in the profile/skills step. |

---

## User Guide & Doc Updates

| Doc | PR | Change |
|---|---|---|
| `docs/guides/profile-guide.md` | A, B | New sections: "Who can see your skills" (co-members, opt-out toggle, what hiding does) and "Vouching for skills" (who can vouch, withdrawing, what the count means). |
| `docs/guides/finding-communities-guide.md` or the community member section of `docs/guides/community-admin-guide.md` | A | "Finding someone with a skill in your community". |
| `docs/guides/community-admin-guide.md` | S | Member emails are now visible to admins only. |
| `docs/guides/trust-connections-guide.md`, `docs/concepts/trust-and-karma.md` | B | Vouches contribute to the trust edge, capped at one per direction, and disappear when withdrawn. |
| **New** `docs/concepts/skill-endorsements.md` | B | Concept page. Add the slug to `CONCEPT_ORDER` **and** `howItWorks` in `scripts/generate-docs.ts`, then regenerate. |
| **New ADR** `docs/adr/ADR-<allocated>-skill-visibility-and-endorsements.md` | A (written), B (amended to Implemented) | Opt-out co-member visibility, endorsement eligibility, pair-capped reconcile-not-increment trust contribution, transport choice after BUG-060. Index in `docs/adr/README.md` and add to an `ADR_GROUPS` group in `scripts/generate-docs.ts`. **The number is allocated by the maintainer; ADR-100 is the candidate, not allocated.** |
| ADR-059 | S | Amendment: cap back to 7 days, monitor retired (BUG-058). |
| `docs/guides/demo-data.md` | D | Curated personas now have skills, items and vouches. |
| Service docs | all | `services/{auth,community,request,social-graph,simulation}-service/CONTEXT.md`, `services/registry.json` (endpoints, event), `docs/BUGS.md` (BUG-056/058/060/062 status). |

---

## Critical Implementation Notes

1. **Sprint 132 closeout is a hard precondition.** Do not cut any Sprint 133 PR branch until the
   closeout PRs (advisories, BUG-061) are merged and deployed. Then cut each PR branch from fresh
   `origin/master`. This planning branch merges `origin/master` (merge commit, no rebase) before its
   docs ride along with PR S.
2. **BUG-056 must not loosen directed requests.** `GET /requests/:id` already filters with
   `directedAudienceSql('r', '$2')` (`requests.ts:1717`). Keep that predicate in the SQL. Add the
   non-directed gate on top: own ∨ any-status match responder ∨ `getRequestReachability(...).reachable`.
   `getRequestReachability` already returns `exists:false` for a directed request outside its
   audience (`services/request-service/src/db/eligibility.ts:69-79`). Tests: a directed ask stays
   404 for a same-community non-audience member even though that member is "reachable" for ordinary
   requests; a completed-match helper still gets 200 after leaving the community; an outsider gets
   404 for a `community`-scope request; anyone authenticated gets 200 for a `platform`-scope request.
3. **Strip email everywhere it now leaks (BUG-062), and grep for others.** Known sites:
   `requests.ts:1699` (removed outright), `auth-service routes/users.ts:21` (self only),
   `community-service routes/communities.ts:344` and `routes/members.ts:28` (live admin or self only).
   `matches.ts:99` (`GET /matches/:id`) is participant-scoped since PR S of Sprint 132 and stays.
   Before PR S, re-run `grep -rn "\.email" services/*/src` untruncated and classify every hit in the
   PR description. Messaging participants' emails (`ChatWindow.tsx:153`) are out of scope; log any
   new class found.
4. **One visibility predicate.** Create `services/auth-service/src/db/skillVisibility.ts` exporting
   a SQL fragment `skillVisibleToSql(ownerAlias, viewerParam)` = owner is viewer **or** (sharing on
   **and** an active co-membership exists). Every PR A/B read and the endorsement eligibility check
   use it. Tests prove both halves for every endpoint: a co-member sees it; a non-co-member, a
   member of a *different* community, a pending member and an opted-out member's co-member get 404
   or absence. **Opting out hides the member from co-member views AND from community search and the
   directory counts.** A test opts a member out and asserts all three surfaces.
5. **Live membership only.** Co-membership, community-search membership, admin email visibility and
   endorsement eligibility all query `communities.members` (`status='active'`, `role='admin'` where
   relevant). Never read `req.user.communities` for a decision (CLAUDE.md *Authentication*).
6. **Endorsements reconcile; they never increment.** The social-graph handler recomputes, for the
   pair, `endorsement_count` per community = number of distinct endorsers (0–2) with an active
   endorsement whose `match_id`'s request is in that community (`requests.request_communities`), then
   recomputes `raw_weight` with the existing `computeRawWeight` + `getInteractionWeightsForCommunity`
   (`trustEdgeDb.ts:85,106`). It must **not** call `upsertTrustEdge` (which does `+ 1` and grows
   `stability`). Extract the raw-weight recompute into a shared helper and write the count with
   `UPDATE … SET endorsement_count = $n`. Reconcile does not change `stability`; it sets
   `last_interaction_at = now()` only when the count increased. It upserts an edge only when the count
   is > 0 and the edge is missing. Proofs: (a) the same event delivered 3× leaves the count at 1;
   (b) endorse → withdraw → re-endorse gives 1, 0, 1; (c) five skills vouched by one endorser give 1;
   (d) both directions give 2; (e) deleting the endorsed tag (cascade) followed by its event gives 0
   and `raw_weight` drops by exactly the endorsement weight.
7. **Reproduce BUG-060 before choosing the transport (Task B1).** Write a real-Redis integration
   test in ROOT `tests/integration/` that publishes a job named for an event that only one service
   handles onto `karmyq-events` while every service's subscriber is running, and record whether the
   job is delivered or fails with a missing-handler error. **If competition is confirmed:**
   `skill_endorsement_changed` uses a dedicated queue (`karmyq-skill-endorsement-social-graph`),
   following `services/request-service/src/events/completionEvents.ts`, and BUG-060 is updated with
   the evidence (broader repair stays later scope). **If refuted:** publish on `karmyq-events` and
   close BUG-060 as not reproducible with the evidence. Either way, record the result in the ADR.
8. **Bull jobIds must not dedupe distinct changes.** Completion uses a stable `jobId` per match
   (`completionEvents.ts:28-31`) with `removeOnComplete: { age: 86400 }`, so a second add with the
   same id inside 24 h is silently dropped. An endorse → withdraw within a day with a pair-stable id
   would drop the withdrawal's reconcile and leave a stale count. Use
   `endorsement-<endorsement row id>-<updated_at epoch ms>` (unique per change); reconcile's
   idempotence makes duplicate delivery harmless.
9. **Publish after commit; the lost-enqueue gap is accepted and documented.** If the enqueue fails
   after the DB commit, the API still returns success (the endorsement is real), logs an error
   carrying both user ids (operator-legible; feedback memory "opaque to the client, legible to the
   operator"), and the pair heals on its next endorsement change. Ship
   `scripts/reconcile-endorsement-edges.js` (dry-run by default) for an operator backfill. The ADR
   states this gap; no outbox this sprint.
10. **Tag deletion is an endorsement change.** `DELETE /auth/profile/tags/:tagId`
    (`profileTags.ts:67-78`) cascades endorsements. Select the distinct active endorsers in the same
    transaction before deleting, then publish one event per pair after commit. Hiding skills
    (opt-out) does **not** delete endorsements and does **not** change the trust graph: visibility is
    a display rule, the vouch remains a fact. Say so in the ADR and the guide.
11. **Endorsement eligibility is checked at write time only.** A completed match is permanent, so an
    endorser keeps their vouch even after leaving the community; the PR A predicate decides only who
    can *see* it. Ineligible POSTs return the same 404 whether the tag is hidden, missing or the
    caller has no completed match (no existence oracle).
12. **`init.sql` regeneration needs Docker.** There is none on the Windows box. Use the manual
    `Regenerate init.sql` workflow dispatch (as Sprint 132 PR B/C did) or the Mac checkout, review
    the artifact diff (only the PR's migration objects + one ledger line), promote it, and never
    hand-edit. A disposable demo-host container needs separate maintainer authorization.
13. **Dropping `auth.user_skills` is rollback-safe only because nothing reads it.** Before merging PR
    A, re-run `grep -rn "user_skills" services apps packages infrastructure/postgres/seed-data.sql scripts`
    untruncated. Only the migration, the generated `init.sql` and history docs may remain. A failed
    deploy rolls back images, not schema; the previous image (≥ v11.78.0) does not read the table.
14. **Route order.** In auth-service `routes/users.ts`, register `/me/settings` (GET, PATCH) **before**
    `/:userId`. A test hits `GET /users/me/settings` through the real router and asserts the settings
    handler answered (not a 500 from a uuid cast). New skills routes are mounted at `/auth/skills` in
    `services/auth-service/src/index.ts`, beside `/auth/profile/tags` (`:61`), with `authMiddleware`.
15. **No `packages/shared` change this sprint.** Matching already reads `user_tags`; endorsements do
    not change scoring yet (Sprint 134 candidate).
16. **Integration tests live in ROOT `tests/integration/*.integration.test.ts`** (the only place
    CI's Integration Tests job looks) and must fail, not skip, under `CI=true` without a database.
    Confirm from the job log that the sprint-133 files ran. Workspace TDD tests start in the changed
    workspace's `tests/tdd/`.
17. **BUG-058 removal is a security-gate change: prove it can still fail.** After the cap returns to
    7, the regression must show an 8-day exemption is rejected and a 7-day one accepted, deriving the
    span from `MAX_EXEMPTION_DAYS` (as `tests/regression/sprint-124-registry-core-parity.test.ts:177-189`
    already does). Remove the "unwatched package ≤ 7 days" special case from
    `sprint-125-image-size-monitor.test.ts` together with the monitor; the general cap now enforces
    it. Delete only after `grep -rn "image-size-advisory-watch\|check-image-size-upstream"` is
    classified; the landing docs copy is regenerated, never edited. Read
    `docs/gotchas/adr-059-cannot-tell-no-answer-from-no-advisories.md` first.
18. **Demo data (PR D).** Skills, items and endorsements are added to the curated manifest
    (`curatedDemo/manifest.ts`, types in `types.ts`, writer `baselineWriter.ts`, verifier
    `verifier.ts`). The writer sets `endorsement_count` on seeded `trust_edges` using exactly the
    reconcile rule (distinct endorsers per community), and a regression proves seeded counts equal a
    reconcile over the seeded rows. **Every demo write (curated reset/apply on karmyq.com) requires its
    own explicit maintainer authorization at the time of the operation**; the plan never pre-authorizes
    one, and a deploy does not imply one.
19. **Version and merges.** Each PR bumps the minor from `origin/master`'s `package.json` at merge
    time (root `package.json` + `package-lock.json` root version). One merge at a time; wait for
    deploy and health verify. Each merge needs explicit maintainer authorization.
