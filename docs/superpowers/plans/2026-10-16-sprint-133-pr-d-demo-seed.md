# Sprint 133 PR D — Curated Demo Seed: Skills, Endorsements, Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **One PR, after PR V.** PR V (BUG-065/064, `docs/superpowers/plans/2026-10-16-sprint-133-pr-v-visibility.md`) merges and
> deploys first (done 2026-10-17: `05d29d28`, v11.89.0). The branch is **`agent/claude/sprint-133-pr-d-curated-seed`**, cut
> from `05d29d28` and carrying the handoff. The old `agent/claude/sprint-133-pr-d-demo-seed` (only `d5276e2c`, fully on master) is superseded.
> This plan supersedes the *PR D* sketch (Tasks D1–D6) in `docs/superpowers/plans/2026-10-08-sprint-133-skills-depth.md`.

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
  Discipline 5).
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
endorsements in or out. The viewer who proves it is hidden is Noah (protected, same community).

**Items:** personal items owned by people in the Tool Library, Portland Mutual Aid and Southeast PDX rosters, each shared
only to communities its owner actively belongs to (for example a ladder and a drill from James or Priya shared to the Tool
Library and Portland Mutual Aid, a camping stove from Sophia, a stand mixer from Maria). Four community-owned items with
`owner_community_id = community.tool-library`, `created_by = person.steward-tools` (its admin), and no shares.

## File map

### New files
| File | Responsibility |
|---|---|
| `services/simulation-service/tests/tdd/sprint-133-demo-skills-seed.test.ts` | Compiler rules (fail-closed cases), derived counts, writer SQL shape, verifier skills check |
| `services/simulation-service/tests/tdd/sprint-133-demo-seed-arbiters.test.ts` | Parses migrations/`init.sql`: vocabulary slugs, item CHECK sets vs compiler constants |

### Modified files
| File | Change |
|---|---|
| `services/simulation-service/src/fixtures/curatedDemo/types.ts` | `SkillFixture`, `EndorsementFixture`, `ItemFixture`, `shareSkills?: false` on `FixturePerson`; compiled counterparts; `CompiledDemoBaseline` gains `skills`, `skillSettings`, `endorsements`, `items`, `itemShares`, `endorsementCounts`; new `FixtureExpectation` kind `'skills'` |
| `.../curatedDemo/manifest.ts` | The seed content above; `skills`/`endorsements`/`items` arrays on `CURATED_DEMO_MANIFEST`; one `skills` expectation |
| `.../curatedDemo/compiler.ts` | Validation + compilation for the new kinds; `deriveEndorsementCounts()` |
| `.../curatedDemo/baselineWriter.ts` | Inserts (after users, communities, matches); `applyEndorsementCounts()` after `insertProjections` |
| `.../curatedDemo/verifier.ts`, `src/scripts/verifyDemoData.ts` | `skillsVisible` check + its live deps |
| `tests/tdd/sprint-117-demo-reset.integration.test.ts` | Skills-layer assertions after each reset, incl. the reconcile dry-run |
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
   shares go after communities and memberships. `auth.skill_endorsements` goes after user_tags **and** after the exchange
   matches (step 5). `applyEndorsementCounts` runs after `insertProjections`. All ids are `semanticUuid(key)`
   (`skill.<person>.<slug-or-value>`, `endorsement.*`, `item.*`), so they are stable across resets (the existing
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
   `GET /auth/skills/users/<ambient-09>` is 404, and ambient-09 is absent from the providers directory. `ready`
   requires it. Check that the existing `provider.contrast` expectation still holds with the extra endorsement weight on
   the Amina–Noah edge: read how `getProviderContext` decides contrast before assuming it ignores weights.
10. **Demo apply is the maintainer's call, at the time.** Never run `reset:demo --apply` without explicit authorization
    in that session for that operation, naming lane "PR D". The plan, the merge and the deploy don't authorize it.
    Use the Sprint 117 host runbook (`.claude/handoff/archive/2026-07-08-sprint-117-curated-demo-reset-COMPLETE.md:30-40`)
    and memory *Demo-host wiring traps*. The reset deletes all simulated activity since July. Say so in the request.
    A live endorse/withdraw round trip afterwards is a **separate** demo write needing its own authorization.

---

## Task D0: Branch and precondition

- [ ] PR V is merged and deployed green (`gh pr list --state merged --search "PR V"`; latest master deploy run
  succeeded). If not, stop: PR D waits.
- [x] Branch `agent/claude/sprint-133-pr-d-curated-seed` cut from `origin/master` `05d29d28` (2026-10-17) and carries the handoff.
  The old branch's only commit was verified on master. Before starting, `git fetch origin` and merge `origin/master` if it moved
  (merge commit, no rebase).
- [ ] Read `services/simulation-service/.claude/README.md` and `CONTEXT.md` (*Sprint 117* section) and
  `tests/claude.md`. Run `node scripts/gotcha-check.js --for services/simulation-service/src/fixtures/curatedDemo
  tests/tdd/sprint-117-demo-reset.integration.test.ts` and read every hit.

## Task D1: TDD tests first

**Files:** create the two workspace TDD files; modify `tests/tdd/sprint-117-demo-reset.integration.test.ts`.

- [ ] `sprint-133-demo-skills-seed.test.ts`:
  - compiled manifest: Maria has ≥ 3 skills and ≥ 1 active vouch; every exchange helper has 2–4 skills; exactly one
    opted-out person, with ≥ 1 skill and no endorsements; 7 endorsements, 1 withdrawn; personal items shared only within
    owner memberships; 4 Tool Library items with no shares;
  - `deriveEndorsementCounts` returns exactly {Maria–Sophia/PMA: 2, Maria–Wei/PMA: 1, Maria–James/PMA: 0 (or absent),
    Elena–Fatima/SE: 2, Amina–Noah/Providers: 1}, keyed by normalized ids;
  - fail-closed: one planted manifest per rule in Critical Notes 1, 6 and 8 throws, naming the key (no completed
    exchange between the pair, exchange community the endorser left, opted-out endorsee, self-vouch, duplicate
    (endorser, skill), vouch older than its exchange, withdrawal before creation, shared item to a non-member
    community, shared community item, community item created by a non-admin, unknown slug, duplicate tag value);
  - writer: with a recording client, the endorsement insert follows the matches insert and the user_tags insert; the
    count `UPDATE` follows the projection; a `rowCount` of 0 on the count update throws.
  - verifier: `skillsVisible` false makes `ready` false; each failing sub-read is reported.
- [ ] `sprint-133-demo-seed-arbiters.test.ts`: every manifest `skill_slug` occurs in an
  `INSERT INTO auth.skill_vocabulary` in `infrastructure/postgres/migrations/*.sql`. The compiler's item category,
  condition and status sets equal the `items_category_check`, `items_condition_check` and `items_status_check`
  arrays parsed from `infrastructure/postgres/init.sql`. Include a negative fixture proving the parser finds a planted
  extra value.
- [ ] Root `tests/tdd/sprint-117-demo-reset.integration.test.ts`: after each reset, the Critical Note 4 assertions,
  plus row counts **by key** for user_tags, endorsements (active/withdrawn), privacy settings, items and shares.
- [ ] **Verify red:** `npm exec --workspace=services/simulation-service -- jest tests/tdd/sprint-133` fails on the
  missing types and exports. The root file is proven red in CI's *Sprint 117 curated reset integration* step (no local
  Docker): confirm from the first CI log.

## Task D2: Types and manifest

**Files:** `types.ts`, `manifest.ts`.

- [ ] Add the fixture and compiled types (File map). `SkillFixture { key; owner; value; slug?: string }`,
  `EndorsementFixture { key; endorser; skill; exchange; createdAge; withdrawnAge? }`,
  `ItemFixture { key; owner; name; description?; category; condition?; status?; sharedWith?: SemanticKey[];
  createdBy? }` (owner is a person or a community key), and `shareSkills?: false` on `FixturePerson`.
- [ ] Author the seed content (the tables above). Keep every story floor intact; add no person, community, membership
  or exchange.
- [ ] **Verify:** `npx tsc --noEmit -p services/simulation-service`.

## Task D3: Compiler

**Files:** `compiler.ts`.

- [ ] Validation for every rule in Critical Notes 1, 6 and 8, in the existing `fail(...)` style with the key in the
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

- [ ] `skillsVisible` and its deps (Critical Note 9), authenticated as Maria and Noah like the existing deps. Add the
  `'skills'` expectation to the manifest.
- [ ] **Verify:** verifier TDD cases green; existing verifier regressions updated only to supply the new dep (each
  edit in the ledger).

## Task D6: Docs

**Files:** `docs/guides/demo-data.md`, `services/simulation-service/CONTEXT.md`.

- [ ] *demo-data.md*: what a visitor can now try (co-member skills and vouches on Maria's and Sophia's profiles,
  community skill search, the Tool Library's shared items, an opted-out member who doesn't appear) and that counts are
  derived from seeded vouches, never typed in.
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
  checks don't cover).

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
  *Sprint 117 curated reset integration* step ran the new assertions on **both** resets and passed.
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
  PR B (7 checks) read-only smokes from the handoff, now on non-empty data.
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
- **UNVERIFIED:** whether `provider.contrast` reads edge weights (Critical Note 9 says to check).
