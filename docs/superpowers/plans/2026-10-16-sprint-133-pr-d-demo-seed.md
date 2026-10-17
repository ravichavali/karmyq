# Sprint 133 PR D — Curated Demo Seed: Skills, Endorsements, Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **One PR, after PR V.** PR V (BUG-065/064, `docs/superpowers/plans/2026-10-16-sprint-133-pr-v-visibility.md`) merges and
> deploys first (done 2026-10-17: `05d29d28`, v11.89.0). The branch is **`agent/claude/sprint-133-pr-d-curated-seed`**, cut
> from `05d29d28` and carrying the handoff. The old `agent/claude/sprint-133-pr-d-demo-seed` (only `d5276e2c`, fully on master) is superseded.
> This plan supersedes the *PR D* sketch (Tasks D1–D6) in `docs/superpowers/plans/2026-10-08-sprint-133-skills-depth.md`.
>
> **Revision 2 (2026-10-17, PR D planning chat, after PR V shipped).** (a) **Standing offers added** (maintainer decision 5
> below), so the BUG-064 boundary PR V shipped gets a live read-only smoke after the reset. (b) **Task D0b**: the
> `node-forge`/`braces` exemption renewal ships as its own short dependency PR right after D0, before D1 (maintainer,
> 2026-10-17). (c) The `provider.contrast` UNVERIFIED item is resolved (Critical Note 9). Re-checked on `05d29d28`: since
> `60bcc4cd` the only change to a file this plan cites is a UUID guard in `inventoryDb.ts` `isActiveMember` (`:66-72`),
> which doesn't affect the seed.
>
> **Revision 2.1 (2026-10-17, Codex plan review of `d089b8b3`; all three findings verified, then applied).** D0b's
> cutoff is UTC: **2026-10-21T00:00Z = October 20, 5:00 p.m. PDT**. The opt-out is proven by search with Amina as the
> positive control and by exact directory counts, since the directory carries no identities. D0b now ends by merging
> renewed `origin/master` back into PR D before D1.

**Goal:** After one authorized curated reset, the demo shows the skills features with real data. Maria sees her
co-members' skills and vouches, community skill directories have entries, one member's opt-out visibly hides them, and
people and the Tool Library have shared items. Every seeded trust-edge count is exactly what PR B's production
reconcile would compute.

**Architecture:** The Sprint 117 curated manifest gains four fixture kinds: skills, a skills-sharing opt-out,
endorsements and items. The compiler validates each against the same rules the live APIs enforce, and the transactional
baseline writer inserts them. The writer then sets `endorsement_count` and `raw_weight` on the projected trust edges. The
existing CI step that runs the full reset twice in migrated Postgres also runs **social-graph's real reconcile in
dry-run** over every seeded pair, and expects zero planned writes.

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture*. Simulation-service plus one root
integration test. No migration, no `packages/shared` change, no dependency edit, no change to any other service's code.

**Spec:** there is no separate spec document (PR Q / PR V precedent). This plan argues from the Sprint 133 spec
(`docs/superpowers/specs/2026-10-08-sprint-133-skills-depth-design.md`, Critical Notes 6 and 18), ADR-100, and the
maintainer decisions of **2026-10-16** (PR D planning chat, recorded in the handoff):

1. **Apply by full curated reset.** The existing guarded `reset:demo --apply --publish-config` (backup, lock, downtime,
   one transaction). It reconverges the demo to the manifest, which also clears drift since Sprint 117 (maria.reyes has 6
   live memberships, the manifest gives her 2) and refreshes the stories that expire 2026-11-12. **It is one demo data
   operation and needs its own explicit maintainer authorization at the time** (Critical Note 10).
2. **Skills, story core rich.** Everyone who helped in a seeded exchange gets 2–4 skills (vocabulary slugs plus a
   couple of free-text tags). About half of the ambient people get 1–2. **One ambient person opts out** of sharing.
3. **Story-shaped endorsements**, about 7 rows (table below), including one withdrawn vouch.
4. **Items:** five or six personal items shared to their owners' communities, plus four community-owned Tool Library
   items. **No borrow requests.**
5. **Standing offers (2026-10-17):** three `requests.help_offers` rows. Two are active in Portland Mutual Aid, where Maria
   is a member, and one is in PDX Rides Collective, where she isn't. The post-reset smoke then shows on live data that a
   member sees an offer and a non-member gets 404.

## Global Constraints

- **Simulation-service + `tests/tdd/sprint-117-demo-reset.integration.test.ts` only.** Never edit another service,
  `packages/shared`, `package.json` or `package-lock.json`. The root test may *import* social-graph and auth source (the
  PR B integration test already does).
- **Derived, never authored.** The manifest declares no trust counts or weights. `endorsement_count` and `raw_weight`
  are computed from the compiled endorsements, the way `projectCompletedExchanges` derives match counts.
- **Fail closed in the compiler.** Every fixture rule below is a compiler error with a message naming the semantic
  key. Never let the database reject a fixture first: on the demo that aborts a reset mid-downtime.
- **Live arbiters for enums.** The skill-vocabulary slugs come from `INSERT INTO auth.skill_vocabulary` in
  `infrastructure/postgres/migrations/*.sql`, and the item category, condition and status sets come from the
  `items_*_check` constraints in `infrastructure/postgres/init.sql`. A regression test parses those files and fails if
  the manifest or the compiler's constants disagree. No hand-written shadow list goes unchecked (CLAUDE.md
  Discipline 5). `requests.help_offers.category` has **no** CHECK (`init.sql:2388-2405`). Its live arbiter is the
  offer form's type `<option>` list (`apps/frontend/src/pages/offers/new.tsx:149-154`), which `POST /offers` stores as
  `category` (`routes/offers.ts:147-151`). The offer TTL's arbiter is `offer_ttl_days integer DEFAULT 60`
  (`init.sql:1339`), and the writer seeds `communities.settings` with defaults (`baselineWriter.ts:137-141`).
- **Tests:** workspace tests start in `services/simulation-service/tests/tdd/`. The real-DB proof extends the CI-gated
  root file named above. The CI step runs that single file (`.github/workflows/ci.yml:341-353`), so a new root file
  would not run. Promote when green; restore any unrelated files the promoter sweeps.
- **Before every push:** `npm exec --workspace=tests -- jest regression` (about 1 min).
- **Version:** the minor from `origin/master` at merge time (after PR V, most likely 11.90.0).
- **Demo:** the deploy never runs the reset. Dry-run, `verify:demo` and the read-only smokes are reads; still ask before
  running anything on the shared demo host, and name lane "PR D".

## Seed content (defaults; the implementer may tune names, values and items, not the rules)

**Endorsements.** Each sits on one seeded exchange between the pair. The community is that exchange's community.

| Key | Endorser → endorsee (skill) | Exchange | Community | State |
|---|---|---|---|---|
| `endorsement.sophia-maria-cooking` | Sophia → Maria (cooking) | `exchange.maria-sophia-4` | Portland Mutual Aid | active |
| `endorsement.maria-sophia-tutoring` | Maria → Sophia (tutoring) | `exchange.maria-sophia-3` | Portland Mutual Aid | active |
| `endorsement.wei-maria-cooking` | Wei → Maria (cooking) | `exchange.maria-wei-2` | Portland Mutual Aid | active |
| `endorsement.james-maria-driving` | James → Maria (driving) | `exchange.maria-james-2` | Portland Mutual Aid | **withdrawn** |
| `endorsement.helper-fatima` | Elena → Fatima (one of Fatima's skills) | `exchange.helper-fatima-1` | Southeast PDX | active |
| `endorsement.fatima-helper` | Fatima → Elena (one of Elena's skills) | `exchange.helper-fatima-2` | Southeast PDX | active |
| `endorsement.amina-noah-handyman` | Amina → Noah (handyman) | `exchange.amina-provider-1` | PDX Service Providers | active |

Expected reconciled pair counts: Maria–Sophia **2**, Maria–Wei **1**, Maria–James **0** (edge exists from exchanges,
count stays 0), Elena–Fatima **2**, Amina–Noah **1**. Maria's cooking skill shows **2** vouches.

**Opt-out:** `person.ambient-09` (PDX Service Providers): 1–2 skills, `share_skills_with_communities = false`, no
endorsements in or out. One of its skills (*X*) is also held by Amina (`person.bridge`), the positive control. The viewer
who proves ambient-09 is hidden is Noah (protected, same community), through the *X* search and the exact directory
counts (Critical Note 9).

**Items:** personal items owned by people in the Tool Library, Portland Mutual Aid and Southeast PDX rosters, each shared
only to communities its owner actively belongs to (for example a ladder and a drill from James or Priya shared to the Tool
Library and Portland Mutual Aid, a camping stove from Sophia, a stand mixer from Maria). Four community-owned items with
`owner_community_id = community.tool-library`, `created_by = person.steward-tools` (its admin), and no shares.

**Standing offers** (`requests.help_offers`, status `active`, `expired = false`, privacy columns left at their defaults):

| Key | Offerer | Community | Category | Created | Maria can read? |
|---|---|---|---|---|---|
| `offer.sophia-meal-prep` | `person.shared-sophia` | Portland Mutual Aid | `physical_help` | `P5D` | yes (member) |
| `offer.priya-tutoring` | `person.shared-priya` | Portland Mutual Aid | `skills` | `P9D` | yes (member) |
| `offer.rides-airport` | `person.ambient-13` | PDX Rides Collective | `transportation` | `P7D` | **no**: 404, absent from her list |

Rosters (`manifest.ts:95-150`): Maria is in Portland Mutual Aid and Southeast PDX only. Sophia and Priya are Portland
Mutual Aid members, and ambient-13 is a PDX Rides Collective member.

## File map

### New files
| File | Responsibility |
|---|---|
| `services/simulation-service/tests/tdd/sprint-133-demo-skills-seed.test.ts` | Compiler rules (fail-closed cases), derived counts, writer SQL shape, verifier skills check |
| `services/simulation-service/tests/tdd/sprint-133-demo-seed-arbiters.test.ts` | Parses migrations/`init.sql`: vocabulary slugs, item CHECK sets, `offer_ttl_days` default vs compiler constants; offer categories vs `offers/new.tsx` options |

### Modified files
| File | Change |
|---|---|
| `services/simulation-service/src/fixtures/curatedDemo/types.ts` | `SkillFixture`, `EndorsementFixture`, `ItemFixture`, `OfferFixture`, `shareSkills?: false` on `FixturePerson`; compiled counterparts; `CompiledDemoBaseline` gains `skills`, `skillSettings`, `endorsements`, `items`, `itemShares`, `offers`, `endorsementCounts`; new `FixtureExpectation` kinds `'skills'` and `'offer-boundary'` |
| `.../curatedDemo/manifest.ts` | The seed content above; `skills`/`endorsements`/`items`/`offers` arrays on `CURATED_DEMO_MANIFEST`; one `skills` and one `offer-boundary` expectation |
| `.../curatedDemo/compiler.ts` | Validation + compilation for the new kinds; `deriveEndorsementCounts()` |
| `.../curatedDemo/baselineWriter.ts` | Inserts (after users, communities, memberships, matches); `applyEndorsementCounts()` after `insertProjections` |
| `.../curatedDemo/verifier.ts`, `src/scripts/verifyDemoData.ts` | `skillsVisible` and `offerBoundary` checks + their live deps |
| `services/simulation-service/src/api-client.ts` | `listOffers()` (`GET /offers`) and `getOffer(id)` (`GET /offers/:id`) for the verifier |
| `tests/tdd/sprint-117-demo-reset.integration.test.ts` | Skills-layer and offer assertions after each reset, incl. the reconcile dry-run |
| `services/simulation-service/tests/regression/sprint-117-api-verifier.test.ts`, `sprint-117-verification-logic.test.ts` | New dep / check in fixtures (each edit noted in the ledger) |
| `docs/guides/demo-data.md`, `services/simulation-service/CONTEXT.md` | What the demo now shows and why counts are derived |

---

## ⚠️ Critical Implementation Notes (read before Task D2)

1. **Endorsement eligibility = the live API's write rule (ADR-100), enforced by the compiler.** For every endorsement:
   endorser ≠ endorsee; the skill belongs to the endorsee and is `tag_type='skill'`; the named exchange is between the
   pair in either direction (so its match, `exchangeMatchId(exchange)`, is `completed` with these two as requester and
   responder); both are **active** members of the exchange's community at the anchor (the vouch was visible when it
   was written); the endorsee is not opted out; `createdAge` is younger than the exchange's `completedAge`;
   `withdrawnAge`, if set, is younger than `createdAge`; at most one endorsement per (endorser, skill)
   (`skill_endorsements_one_per_tag`). A test plants a violation of each rule and expects the compiler to throw,
   naming the key.
2. **Counts follow PR B's reconcile exactly.** `deriveEndorsementCounts` returns, per normalized pair
   (`user_id_a < user_id_b`, the `trust_edges` order) and community, the number of **distinct endorsers** among the two
   with ≥ 1 **non-withdrawn** endorsement of the other whose match's request is in that community. That's
   `ENDORSEMENT_TARGETS_SQL` in `services/social-graph-service/src/services/endorsementReconcile.ts`, values 0–2.
   Because demo exchanges are single-community (compiler-enforced since Sprint 117), the endorsement's community is
   its exchange's community.
3. **`applyEndorsementCounts` writes count and weight in one statement, reading weights from the table.** For each
   derived entry with n > 0:
   `UPDATE social_graph.trust_edges SET endorsement_count = $n, raw_weight = match_completed_count * $w1::float8 +
   $n * $w2::float8 + karma_given_count * $w3::float8 + event_count * $w4::float8 WHERE user_id_a=$a AND user_id_b=$b
   AND community_id=$c`. Read `$w1..$w4` in the same transaction from `social_graph.interaction_weights` with the
   resolution order of `getInteractionWeightsForCommunity` (`trustEdgeDb.ts:111-124`: the community row overrides
   the global row, and an absent type defaults to 1.0). Don't copy the constants 10.0/5.0. **Throw if `rowCount !== 1`**:
   every endorsement sits on an exchange, so its edge must exist. Leave `stability` and `last_interaction_at` as the
   projection set them.
4. **The proof is production code, not a mirror.** After each of the two resets in
   `tests/tdd/sprint-117-demo-reset.integration.test.ts`, for every pair with a seeded endorsement (including the
   withdrawn Maria–James pair): open a client, `BEGIN`, take the pair lock the way `withPairLock` does (or call
   `reconcileEndorsementPairLocked(client, a, b, { dryRun: true })` inside the transaction), and assert the plan has
   **no updates and no inserts**; `ROLLBACK`. Then, for every seeded edge, assert `raw_weight` equals the formula over
   its stored columns and the table weights. Also assert the exact pair counts from the content table **by pair
   identity**. A sum or a row count doesn't qualify (memory: *Gates that assert weaker than they claim*). Prove the
   check can fail: a temporary negative case bumps one count by 1 inside a rolled-back transaction and expects a
   planned update.
5. **Insert order and FKs.** `auth.user_tags` and `auth.user_privacy_settings` go after users. Inventory items and
   shares go after communities and memberships, and so do `requests.help_offers`. `auth.skill_endorsements` goes after user_tags **and** after the exchange
   matches (step 5). `applyEndorsementCounts` runs after `insertProjections`. All ids are `semanticUuid(key)`
   (`skill.<person>.<slug-or-value>`, `endorsement.*`, `item.*`, `offer.*`), so they are stable across resets (the existing
   twice-applied determinism test then covers them). A withdrawn endorsement has `withdrawn_at` set and `revision = 2`
   (one change after creation); active ones have `revision = 1`.
6. **Skills.** `tag_value` ≤ 100 chars, unique per (user, `'skill'`, value) (`user_tags_unique`). `skill_slug` is
   either a vocabulary slug or `NULL` for a deliberate free-text tag. A `tag_value` for a slugged skill uses the
   vocabulary label. Every person who appears as `helper` in an exchange has 2–4 skills; Maria ≥ 3.
7. **The opt-out row.** `INSERT INTO auth.user_privacy_settings (user_id, share_skills_with_communities) VALUES ($1,
   false)` for the opted-out person only. Everyone else keeps no row, so the `COALESCE(..., true)` default in
   `auth-service/src/db/skillVisibility.ts` applies, as for a real new user.
8. **Items follow `inventory`'s write rules** (`services/request-service/src/db/inventoryDb.ts`). Exactly one owner
   (`items_exactly_one_owner`). A personal item is shared only to communities its owner actively belongs to
   (`replaceShares`). A community-owned item has **no** shares ("Community-owned items cannot be shared") and its
   `created_by` is an active admin of that community. Category, condition and status are in the CHECK sets. The
   compiler enforces each rule, and the arbiter test locks the sets to `init.sql`.
9. **Verifier.** Add one check, `skillsVisible`, through ordinary APIs (read `services/auth-service/src/routes/skills.ts`
   for the exact response fields first). As Maria: `GET /auth/skills/users/<sophia>` is 200 and shows a skill with a
   vouch. Maria's own `GET /auth/skills/users/<maria>` shows cooking with endorsement count 2.
   `GET /auth/skills/communities/<portland-mutual-aid>` lists a non-zero member count. As Noah:
   `GET /auth/skills/users/<ambient-09>` is 404. **The opt-out is proven by search, not the directory** (finding
   2026-10-17): `GET /auth/skills/communities/:id` returns only `skill_key`, `label` and `member_count` per skill, with
   no user identities (`services/auth-service/src/routes/skills.ts:56-71`), so "absent from the directory" can't be
   asserted. Instead:
   - **Fixture:** ambient-09 holds a skill (call it *X*) that **Amina** (`person.bridge`, a visible PDX Service
     Providers member who isn't the viewer) also holds. *X* is a vocabulary slug, or a free-text value both share
     exactly.
   - **Search, positive control plus absence by id:** as Noah,
     `GET /auth/skills/communities/<providers>/search?skill=<X>` (`skills.ts:73-93`; rows carry `user_id`) **contains
     Amina's `user_id`** and **doesn't contain ambient-09's `user_id`**. An empty result fails: an empty result would
     also "not contain" ambient-09.
   - **Directory counts are exact:** as Noah, the providers directory's `{skill_key → member_count}` map **equals** the
     expected map computed from the compiled baseline: per skill key, the distinct active Providers members holding it
     who share skills, plus Noah himself (the owner always sees his own, `skillVisibleToSql`). Opted-out members are
     excluded. For *X* that's exactly the visible holders, one fewer than its raw holders. Export that expectation from
     the compiler (`expectedSkillDirectory(baseline, communityKey, viewerKey)`) so the verifier and the root
     integration test use one derivation, not a hand-typed number.
   `ready` requires all of it. **`provider.contrast` is unaffected (resolved 2026-10-17):** the expectation is declarative only, since
   no source or test reads `provider-contrast` (`types.ts:157`, `manifest.ts:312` are its only occurrences), and the
   live provider pick ranks by `sharedConnections`, not weights (`mariaRelationshipStory.ts:260-265`). The Amina→Noah
   vouch changes only that edge's count and weight, and adds no edge (Critical Note 3 throws on a missing one), so no
   connection set changes.
   **Second check, `offerBoundary`** (read `routes/offers.ts:25-104` for the exact fields first): as Maria,
   `GET /offers` contains both Portland Mutual Aid offer ids and **not** `offer.rides-airport`; `GET /offers/<rides
   offer>` is **404** (never 403: PR V made foreign and missing identical); `GET /offers/<sophia offer>` is 200. As the
   existing **unrelated** persona (`DEMO_UNRELATED_EMAIL` = Marcus Lee, `person.outsider`, a PDX Rides Collective member
   and not the offerer; `verifyDemoData.ts:50,122-123`, `docs/guides/demo-data.md:204`), `GET /offers/<rides offer>` is
   200. That makes the 404 non-vacuous: the row exists, and the membership half (not just the owner half) grants
   access. No new host env var. `ready` requires it.
10. **Demo apply is the maintainer's call, at the time.** Never run `reset:demo --apply` without explicit authorization
    in that session for that operation, naming lane "PR D". The plan, the merge and the deploy don't authorize it.
    Use the Sprint 117 host runbook (`.claude/handoff/archive/2026-07-08-sprint-117-curated-demo-reset-COMPLETE.md:30-40`)
    and memory *Demo-host wiring traps*. The reset deletes all simulated activity since July. Say so in the request.
    A live endorse/withdraw round trip afterwards is a **separate** demo write needing its own authorization.
11. **Offers follow `POST /offers`'s write rule** (`routes/offers.ts:106-162`): the offerer is an **active** member of the
    offer's community at the anchor. The compiler enforces it and names the key. `category` is in the offer-form set
    (Global Constraints). `status = 'active'`, `expired = false`, `created_at = updated_at = ageFrom(anchor,
    createdAge)`, `expires_at = created_at + 60 days`, mirroring `offer_ttl_days`. The arbiter test locks the 60 to
    `init.sql`. The compiler throws if `expires_at` is less than **30 days** after the anchor. The cleanup job marks an
    offer expired once `expires_at <= now` (`cleanup-service/src/jobs/expirationJob.ts:29-34`), and `GET /offers` lists
    only `status = 'active'`, so an offer about to expire would leave the smoke empty a few days after the reset. Leave
    `is_public` and `offerer_visibility_consent` at their column defaults: PR V doesn't consult them, and the seed
    mustn't suggest it does. No `offer_created` event is published (the writer is SQL, as for requests).
    `requests.help_offers` is already `reset` (`tablePolicy.ts:83`), so no policy change.

---

## Task D0: Branch and precondition

- [x] PR V is merged and deployed green: `05d29d28` is `origin/master`, and CI/CD 38985813305 passed on attempt 1
  (handoff header, 2026-10-17).
- [x] Branch `agent/claude/sprint-133-pr-d-curated-seed` cut from `origin/master` `05d29d28` (2026-10-17) and carries the handoff.
  The old branch's only commit was verified on master. Before starting, `git fetch origin` and merge `origin/master` if it moved
  (merge commit, no rebase).
- [ ] Read `services/simulation-service/.claude/README.md` and `CONTEXT.md` (*Sprint 117* section) and
  `tests/claude.md`. Run `node scripts/gotcha-check.js --for services/simulation-service/src/fixtures/curatedDemo
  tests/tdd/sprint-117-demo-reset.integration.test.ts` and read every hit.

## Task D0b: Exemption renewal PR (separate, before D1)

**Hard deadline: deployed before 2026-10-21T00:00:00Z = 2026-10-20 at 17:00 PDT.** `expires: 2026-10-21` is the first
*invalid* day (`expires <= today`, `scripts/audit-exemptions.js:123`), and "today" is the **UTC** date
(`todayUtc`, `scripts/lib/exemption-registry.js:17-19`; `parseUtcDate` anchors `expires` at `T00:00:00Z`, `:4-6`).
Reproduced with the validator (2026-10-17): `2026-10-20T23:59:59Z` (16:59:59 PDT) validates clean;
`2026-10-21T00:00:00Z` (17:00 PDT on the 20th) reports both entries EXPIRED. From then on every push and deploy fails the
ADR-059 gate, PR D's included. Plan to merge by midday PDT on the 20th to leave room for a deploy rerun. Claude holds the dependency lane. This follows the #304 pattern: a short PR, never inside PR D.

- [ ] Branch `agent/claude/sprint-133-exemption-renewal-2` from fresh `origin/master`.
- [ ] Re-check upstream by hand: `npm view node-forge version`, `npm view braces version`, each GHSA page
  (`first_patched_version`, withdrawn?), `npm view @expo/cli dependencies.node-forge`, and `npm ls --all node-forge braces`.
  Planning chat, 2026-10-17: still node-forge 1.4.0 and braces 3.0.3, no fix. If upstream fixed one, **remove** that
  exemption and bump surgically (CLAUDE.md *Dependency edits are surgical*) instead of renewing it.
- [ ] **Ask the maintainer to authorize the renewal**, quoting the re-check. Only on yes: set `created` to today and
  `expires` to at most 7 days later, update each `decision`, and add the ADR-059 renewal amendment line, as #304 did.
- [ ] Version: the minor from `origin/master` (11.90.0 if nothing else merged). PR D then re-bumps at its own merge.
- [ ] `npm exec --workspace=tests -- jest regression` (includes the audit-exemption gate); push; CI green; ask "admin
  merge, yes/no?"; wait for deploy + health.
- [ ] **Return to PR D and take the renewal before D1.** `git switch agent/claude/sprint-133-pr-d-curated-seed`,
  `git fetch origin`, `git merge origin/master` (merge commit, no rebase). Then prove the branch carries it:
  `git diff origin/master -- security/audit-exemptions.json` is empty, and
  `npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-123-audit-exemption-gate.test.ts` passes. This
  is required, not hygiene: that test validates the **branch's own** registry against `new Date()`
  (`sprint-123-audit-exemption-gate.test.ts:67`). Without the merge, PR D keeps the 2026-10-21 entries, and from the
  cutoff the pre-push regression fails on every PR D push, even though the renewal is live on master. (PR CI uses
  the merge ref, `ci.yml:6`, so CI alone could look green.) Record the renewal in the handoff on the PR D branch, not
  on master.

## Task D1: TDD tests first

**Files:** create the two workspace TDD files; modify `tests/tdd/sprint-117-demo-reset.integration.test.ts`.

- [ ] `sprint-133-demo-skills-seed.test.ts`:
  - compiled manifest: Maria has ≥ 3 skills and ≥ 1 active vouch; every exchange helper has 2–4 skills; exactly one
    opted-out person, with ≥ 1 skill and no endorsements; 7 endorsements, 1 withdrawn; personal items shared only within
    owner memberships; 4 Tool Library items with no shares; 3 offers, two in Portland Mutual Aid and one in PDX Rides
    Collective, each with `expires_at` at least 30 days after the anchor;
  - `deriveEndorsementCounts` returns exactly {Maria–Sophia/PMA: 2, Maria–Wei/PMA: 1, Maria–James/PMA: 0 (or absent),
    Elena–Fatima/SE: 2, Amina–Noah/Providers: 1}, keyed by normalized ids;
  - fail-closed: one planted manifest per rule in Critical Notes 1, 6 and 8 throws, naming the key (no completed
    exchange between the pair, exchange community the endorser left, opted-out endorsee, self-vouch, duplicate
    (endorser, skill), vouch older than its exchange, withdrawal before creation, shared item to a non-member
    community, shared community item, community item created by a non-admin, unknown slug, duplicate tag value,
    offer by a non-member of its community, unknown offer category, offer expiring within 30 days of the anchor);
  - writer: with a recording client, the endorsement insert follows the matches insert and the user_tags insert; the
    count `UPDATE` follows the projection; a `rowCount` of 0 on the count update throws.
  - verifier: `skillsVisible` false makes `ready` false; each failing sub-read is reported, including the three opt-out
    failure modes: ambient-09's id present in the *X* search, Amina's id missing (an empty search must fail), and a
    directory map that differs from `expectedSkillDirectory` by one count.
  - `expectedSkillDirectory` for Providers as Noah: *X*'s count equals its raw holder count minus 1 (ambient-09), and
    flipping ambient-09 to sharing raises it by exactly 1. The same for
    `offerBoundary`, including two cases: a 403 for the foreign offer fails the check (only 404 passes), and a 404 for
    the unrelated persona's read fails it (a vacuous boundary).
- [ ] `sprint-133-demo-seed-arbiters.test.ts`: every manifest `skill_slug` occurs in an
  `INSERT INTO auth.skill_vocabulary` in `infrastructure/postgres/migrations/*.sql`. The compiler's item category,
  condition and status sets equal the `items_category_check`, `items_condition_check` and `items_status_check`
  arrays parsed from `infrastructure/postgres/init.sql`. The compiler's offer TTL equals the parsed `offer_ttl_days`
  default, and its offer category set equals the `<option value>`s of the type select in
  `apps/frontend/src/pages/offers/new.tsx`. Include a negative fixture proving each parser finds a planted extra value.
- [ ] Root `tests/tdd/sprint-117-demo-reset.integration.test.ts`: after each reset, the Critical Note 4 assertions,
  plus row counts **by key** for user_tags, endorsements (active/withdrawn), privacy settings, items, shares and offers.
  Run the directory and search SQL for Providers as Noah, by importing auth-service's `skillVisibleToSql` and
  `activeMemberSql` (`auth-service/src/db/skillVisibility.ts`, exported). The directory must equal
  `expectedSkillDirectory`, and the *X* search must contain Amina's id and not ambient-09's.
  For offers, run PR V's boundary predicate on the reset database. `offerReadableSql` isn't exported (`offers.ts:18`),
  so read its body out of `services/request-service/src/routes/offers.ts` at run time and substitute the alias and
  parameter. Don't paste a copy: a pasted copy would be a shadow that never fails. With Maria as the viewer it returns exactly the
  two Portland Mutual Aid offer ids. With `person.outsider` (a member, not the offerer) it includes the rides offer.
- [ ] **Verify red:** `npm exec --workspace=services/simulation-service -- jest tests/tdd/sprint-133` fails on the
  missing types and exports. The root file is proven red in CI's *Sprint 117 curated reset integration* step (no local
  Docker): confirm from the first CI log.

## Task D2: Types and manifest

**Files:** `types.ts`, `manifest.ts`.

- [ ] Add the fixture and compiled types (File map). `SkillFixture { key; owner; value; slug?: string }`,
  `EndorsementFixture { key; endorser; skill; exchange; createdAge; withdrawnAge? }`,
  `ItemFixture { key; owner; name; description?; category; condition?; status?; sharedWith?: SemanticKey[];
  createdBy? }` (owner is a person or a community key), `OfferFixture { key; offerer; community; title; description;
  category; createdAge }`, and `shareSkills?: false` on `FixturePerson`.
- [ ] Author the seed content (the tables above). Keep every story floor intact; add no person, community, membership
  or exchange.
- [ ] **Verify:** `npx tsc --noEmit -p services/simulation-service`.

## Task D3: Compiler

**Files:** `compiler.ts`.

- [ ] Validation for every rule in Critical Notes 1, 6, 8 and 11, in the existing `fail(...)` style with the key in the
  message. Wire it into `compileManifest` beside `validateReferences`.
- [ ] Compile the new rows (stable `semanticUuid` ids, anchor-relative timestamps via `ageFrom`) and
  `deriveEndorsementCounts` (Critical Note 2) into the baseline.
- [ ] **Verify:** the compiler and count cases of D1 are green; `sprint-117-manifest-compiler` and
  `sprint-117-protected-core` are green unedited.

## Task D4: Writer

**Files:** `baselineWriter.ts`.

- [ ] Inserts in the Critical Note 5 order, and `applyEndorsementCounts` (Critical Note 3). Parameterized queries only,
  as the file requires.
- [ ] **Verify:** D1 writer cases green; `sprint-117-reset-safety` green (the four tables and `user_privacy_settings`
  are already `reset` in `tablePolicy.ts:48-53,38-39`; no policy change expected; if the scan reports drift, stop and
  classify, never silence).

## Task D5: Verifier

**Files:** `verifier.ts`, `src/scripts/verifyDemoData.ts`, the two Sprint 117 verifier tests.

- [ ] `skillsVisible` and `offerBoundary` and their deps (Critical Note 9), authenticated as Maria, Noah (provider
  client) and the unrelated persona, like the existing deps. No new persona login. Add `listOffers`/`getOffer` to `api-client.ts`, with errors surfacing the HTTP status the way
  `statusOf` already reads it (`verifyDemoData.ts`). Add the `'skills'` and `'offer-boundary'` expectations to the manifest.
- [ ] **Verify:** verifier TDD cases green; existing verifier regressions updated only to supply the new dep (each
  edit in the ledger).

## Task D6: Docs

**Files:** `docs/guides/demo-data.md`, `services/simulation-service/CONTEXT.md`.

- [ ] *demo-data.md*: what a visitor can now try (co-member skills and vouches on Maria's and Sophia's profiles,
  community skill search, the Tool Library's shared items, an opted-out member who doesn't appear, standing offers in
  Maria's community, and none from a community she isn't in) and that counts are derived from seeded vouches, never typed in.
- [ ] *CONTEXT.md*: a Sprint 133 PR D section under *Sprint 117: Curated Demo Reset* (new fixture kinds, the count
  derivation and its reconcile proof, the verifier check); Recent Changes.
- [ ] Regenerate landing docs; `git add -f` new generated pages only; revert timestamp/HEAD-sha churn.
- [ ] No ADR (this extends the Sprint 117 fixture design and ADR-100's rule). No `registry.json` endpoint change;
  add one sentence to simulation-service `notes` if the registry describes the curated baseline.

## Task D7: Promotion and feedback

- [ ] Promote both workspace TDD files; restore unrelated sweeps.
- [ ] `git add -A && npm run feedback:check` (it reads the staged diff).

## Task D8: SDLC quality gates

- [ ] `/simplify` on the branch diff (one pass). **Verify:** findings applied or dismissed in
  `.superpowers/sdd/2026-10-16-sprint-133-pr-d-demo-seed/progress.md`.
- [ ] `/code-review` **medium** (fixture code, no live request path). **Verify:** every correctness finding fixed
  RED→GREEN or ruled in the ledger.
- [ ] `/security-review`. **Verify:** findings fixed or dismissals justified (the seed holds no secret; the credential
  hash still comes from the coordinator; check that no new fixture text leaks into an ordinary-scope API the privacy
  checks don't cover). The seeded offer text is fixture copy and names no real person.

## Task D9: Final verification

```bash
npx tsc --noEmit -p services/simulation-service; echo "tsc=$?"
npm exec --workspace=services/simulation-service -- jest --testPathPatterns "tests/(unit|regression)"; echo "sim=$?"
npm exec --workspace=tests -- jest regression; echo "root=$?"
npm test; echo "all=$?"
git status --short
npm run feedback:check
```

Every exit code is 0, and `git status` shows only intended files.

## Task D10: PR, merge, deploy

- [ ] Push; open the PR (content tables, the reconcile-dry-run proof, verifier change, ledger rulings). In CI, confirm the
  *Sprint 117 curated reset integration* step ran the new assertions on **both** resets and passed. **`ubuntu-latest`
  moves to Ubuntu 26 from 2026-10-19:** if that step or the Postgres service fails on a no-dep diff, check the runner
  image first (handoff *Persistent obligations*) before debugging the seed.
- [ ] D0b's renewal PR must already be merged and deployed (one merge at a time), and PR D's version re-derives from
  `origin/master` after it.
- [ ] Version bump from `origin/master` at merge time. Land the handoff (PR D awaiting merge) **before** asking for
  merge authorization; ask "admin merge, yes/no?". Then `/deploy`. The deploy doesn't touch demo data.

## Task D11: Demo apply and verification (each step needs authorization)

- [ ] **Ask the maintainer** for the reset: "Lane PR D requests a full curated reset of karmyq.com (downtime; deletes
  all simulated activity since July; reseeds the manifest including skills, vouches and items). Authorize, yes/no?"
  Only on yes: the Sprint 117 runbook, dry-run first (`reset:demo` without `--apply`), show the plan, then
  `reset:demo -- --apply --publish-config`.
- [ ] **Real-data guard before `--apply`.** `auth.founding_circle_submissions` (real karmyq.org/join notes) is classified
  `reset` (`tablePolicy.ts:56`), so the reset deletes it. The maintainer confirmed on 2026-10-16 that it was empty and
  accepted the reset on that basis. Re-check at apply time, read-only:
  `SELECT count(*) FROM auth.founding_circle_submissions;`. If it is **not 0**, stop and ask the maintainer: export
  the rows first, or reclassify the table `preserve` in a follow-up PR. Never apply over real submissions.
- [ ] Read-only afterwards: `verify:demo` reports `ready: true` with `skillsVisible`; re-run the PR A (10 checks) and
  PR B (7 checks) read-only smokes from the handoff, now on non-empty data. Add the **BUG-064 live smoke** (read-only):
  as Maria, `GET /offers` lists the two Portland Mutual Aid offers and not the rides offer; `GET /offers/<rides offer>`
  is 404; as Marcus Lee (Rides member) the same id is 200. Record the result on BUG-064 ("smoke-covered live"), on the next branch.
- [ ] Optional, **separately authorized**: one live endorse → withdraw round trip as a protected persona on a seeded
  exchange, checking the edge count goes up then back, cleaned up by API.

## Task D12: Sprint 133 closeout

- [ ] On the next branch (no docs-only master push): ADR-100 is already Implemented, so no ADR flip. Archive the
  handoff to `.claude/handoff/archive/` with a COMPLETE suffix, move Sprint 134 candidates (IDEAS Sprint 133
  follow-ups, BUG-069) into the next planning chat's agenda, and update memory `project_current_state`.
- [ ] **Not part of closeout:** PR L (ADR-101 legacy removal + BUG-068 retirement, due 2026-10-29) is a separate PR
  and may have shipped before PR D.

## Self-review (2026-10-16)

- Facts read on `60bcc4cd` this session: manifest people, rosters and exchanges (`manifest.ts`); writer order and
  constants (`baselineWriter.ts`); `ENDORSEMENT_TARGETS_SQL` and `reconcileEndorsementPairLocked`
  (`endorsementReconcile.ts`); `rawWeightSql` and `getInteractionWeightsForCommunity` (`trustEdgeDb.ts:111-145`); the
  schemas and constraints of `auth.user_tags`, `auth.skill_endorsements`, `auth.user_privacy_settings`,
  `inventory.items` and `inventory.item_shares` (`init.sql`); `replaceShares` and `itemAudienceSql`
  (`inventoryDb.ts`); `skillVisibleToSql` (`skillVisibility.ts`); the CI reset step (`ci.yml:341-353`); and table
  policy (`tablePolicy.ts`).
- **UNVERIFIED:** why maria.reyes has 6 live memberships (simulation, fission/fusion, or a manual change). The reset
  makes it moot, but if the dry-run plan shows unexpected tables or rows, stop and ask.
- ~~**UNVERIFIED:** whether `provider.contrast` reads edge weights~~ **Resolved 2026-10-17:** no code reads it (Critical Note 9).

## Self-review, revision 2 (2026-10-17, on `05d29d28`)

- Facts read this session: `requests.help_offers` columns (`init.sql:2388-2405`, no CHECK); `offer_ttl_days DEFAULT
  60` (`init.sql:1339`); `POST /offers` membership rule and insert (`routes/offers.ts:106-162`); `offerReadableSql` and
  `GET /offers` status filter (`:18-40`); cleanup offer expiry (`expirationJob.ts:29-34`); offer form categories
  (`offers/new.tsx:149-154`); `tablePolicy.ts:83`; rosters (`manifest.ts:95-150`); provider-contrast consumers (none);
  `selectProvider` (`mariaRelationshipStory.ts:260-265`); `security/audit-exemptions.json` expiries; `npm view` latest
  node-forge 1.4.0 and braces 3.0.3.
- **Verified:** `offerReadableSql` is **not exported** (a module-local `function` at `offers.ts:18`, used only at `:40,90`).
  So the root test reads the predicate out of the source at run time (D1) and must not export it from request-service,
  since that would change another service's code (Global Constraints). If the extraction finds no match, the test fails.
- **Verified:** the verifier's personas come from env (`verifyDemoData.ts:44-56`). `DEMO_UNRELATED_EMAIL` is Marcus Lee
  (`person.outsider`, `manifest.ts:52`), a PDX Rides Collective member (`manifest.ts:134-139`; Sprint 117 archive
  `:205`). He's the offer positive control, with no new env var.
- Maria shares no community with PDX Rides Collective, so the "unrelated" guide rule (`demo-data.md:204`) still holds.
