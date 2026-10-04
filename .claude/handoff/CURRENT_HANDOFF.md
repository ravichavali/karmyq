# Sprint 132 — Inventories and Skills — Handoff

**Date**: 2026-10-04
**Status**: **PR B SHIPPED and LIVE v11.79.0**, [#292](https://github.com/ravichavali/karmyq/pull/292), merge `235b5446`. [CI/CD 37180421165](https://github.com/ravichavali/karmyq/actions/runs/37180421165) and [Demo health 37202424111](https://github.com/ravichavali/karmyq/actions/runs/37202424111) succeeded; read-only inventory smoke passed (maintainer, 2026-10-04). **PR C IN PROGRESS**, Codex executing on `agent/claude/sprint-132-pr-c-directed-borrow`, cut from `origin/master` `235b5446`. Earlier: A live v11.78.0 via #291; N v11.76.0 (#289); S v11.75.0 (#288).

> 🧭 **First product sprint after the maintenance freeze** (maintainer, 2026-09-30: dependency work
> needs a security advisory or a feature need; product is the default). Seed idea: `docs/IDEAS.md`
> [2026-09-30] architecture, *inventories for individuals and communities, and the skills work*.
>
> Sprint 131 shipped everything through **v11.74.0** (#287, `c187aa87`, deploy run 36745990078 green,
> smoke 200s, 0 open Dependabot alerts or PRs). Its full handoff is archived at
> [`archive/2026-09-30-sprint-131-maintenance-SHIPPED-v11.74.0.md`](archive/2026-09-30-sprint-131-maintenance-SHIPPED-v11.74.0.md).

> **No parallel lanes are active.** Git and PR state (`gh pr list`, `git log origin/master`) outrank
> anything written here.

## Quick Start

1. Read this handoff.
2. **PR C is draft [#293](https://github.com/ravichavali/karmyq/pull/293)** on `agent/claude/sprint-132-pr-c-directed-borrow`, based on `origin/master` `235b5446`. Codex owns C implementation; Claude owns merge-readiness validation. Check `git status` before editing. B/#292 is shipped, deployed and smoke-tested. PR #293 is the current review packet; its Validation ledger carries final-head evidence.
3. Open the plan: [`docs/superpowers/plans/2026-09-30-sprint-132-inventories-and-skills.md`](../../docs/superpowers/plans/2026-09-30-sprint-132-inventories-and-skills.md).
   Execute PR C tasks C1–C12; this is the fresh PR C chat. Merge/deploy still require separate maintainer authorization.
4. Invoke `superpowers:subagent-driven-development` directly (or `superpowers:executing-plans`).
   There is no `/execute-plan` slash command; superpowers removed it as a deprecated stub.

## Sprint goal

Members and communities can list shareable items (private until shared). "Ask to borrow" opens a
request only the owner (or the owning community's admins) can see, which runs the existing
match → message → karma loop. Skills have one source of truth that matching actually reads.

## Links

- Spec: [`docs/superpowers/specs/2026-09-30-sprint-132-inventories-and-skills-design.md`](../../docs/superpowers/specs/2026-09-30-sprint-132-inventories-and-skills-design.md)
- Plan: [`docs/superpowers/plans/2026-09-30-sprint-132-inventories-and-skills.md`](../../docs/superpowers/plans/2026-09-30-sprint-132-inventories-and-skills.md)
- ADR: **ADR-099** `docs/adr/ADR-099-inventories-and-directed-requests.md` (to be written in PR A)

## PR table

| PR | Scope | Branch | State |
|---|---|---|---|
| **S** | **Security (rev 2):** caller-scope notification routes (BUG-055) + participant-scope `GET /matches`, `/matches/:id` (BUG-057). No schema | `agent/claude/sprint-132-security-authz` | **SHIPPED v11.75.0** (#288, `b169472b`) |
| A | Skills single source, vocabulary-backed matching and ADR-099 | `agent/claude/sprint-132-pr-a-skills` (retired) | **SHIPPED**, #290 `244291eb`; live as v11.78.0 through #291 `f90b9916`, deploy 37169859212; A10 read-only smoke passed |
| **N** | **node-forge exemption (2026-10-01):** a 7-day ADR-059 exemption for GHSA-86w9-cpqp-85rv (no patched release), an ADR-059 amendment, a sprint-125 coverage gate that admits an unwatched package only for ≤ 7 days, and BUG-058 | `agent/claude/sprint-132-node-forge-exemption` (cut from `origin/master` `b169472b`) | **MERGED + DEPLOYED v11.76.0** (#289, `02d720b3`; CI/CD 37053659544 and health check green, verified 2026-10-02) |
| B | Inventory catalog, audience predicates, My things and community Shared things | `agent/claude/sprint-132-pr-b-inventory` (retired) | **SHIPPED v11.79.0**, [#292](https://github.com/ravichavali/karmyq/pull/292), `235b5446`; CI/CD + demo health green; read-only inventory smoke passed 2026-10-04 |
| C | Directed *Ask to borrow*: `is_directed` + targets on `help_requests`; `notDirectedSql` on browse surfaces and `directedAudienceSql` on private-access surfaces, with a live-scan gate; `directed_request_created` event; directed predicate on match views (C4b); the incoming-asks query plus the Helping *Asked of you* section (C5b, C7); `requester_id`-gated `GET /requests` | `agent/claude/sprint-132-pr-c-directed-borrow` (base `235b5446`) | **DRAFT #293**; implementation pushed, generated schema checkpoint and real CI SQL pending |

Versions: each PR bumps the minor from `origin/master` at merge time (S = 11.75.0, shipped; N = 11.76.0; A = 11.77.0
if nothing else merges in between). Nothing is reserved.

## Maintainer decisions (planning chat, 2026-09-30)

1. **Scope:** inventory v1 plus a bounded skills cleanup (consolidate the two stores). Deeper skills
   work (endorsements, verification, discovery) moves to Sprint 133+.
2. **Inventory depth:** a catalog, with lending through a borrow request. **No** new lending state machine
   (no `on_loan` state, due dates or return flow in v1).
3. **Community inventory:** both kinds, community-owned items (admins manage them) **and** members'
   items shared with the community.
4. **Skills store:** `auth.user_tags` wins, with a normalized vocabulary (`skill_slug`). `auth.user_skills`
   is deprecated and **not dropped** this sprint (image-rollback safety).
5. **Borrow ask visibility:** **directed to the owner only** (or the owning community's admins). It is
   never on a feed.
6. **Default item visibility:** **private until shared**, per community, with membership checked live.
7. **Placement:** request-service, with a new `inventory` schema (13th live schema). No new service.
8. **ADR number:** **ADR-099**, allocated by the maintainer.
9. **Shipping:** **3 PRs** (A skills, B catalog, C directed borrow), so the reachability change
   gets isolated review.
10. **Rev 2:** BUG-055/057 ship as a standalone **PR S** before PR A, and are executed now ("Include the required tests
    and documentation updates. Merge and deployment still require maintainer authorization."). The fresh-install proof is
    a blocking CI step before the replay. Incoming asks get their own query and Helping section.

## Critical implementation notes (verbatim from the spec)

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
13. **Demo data / reset policy.** The curated reset walks only `MANAGED_SCHEMAS`
    (`services/simulation-service/src/fixtures/curatedDemo/tablePolicy.ts:11`), and an unclassified
    table in a managed schema is a hard failure. PR A classifies `auth.skill_vocabulary` as
    `'preserve'`. PR B adds `'inventory'` to `MANAGED_SCHEMAS` with both tables `'reset'`. Prove both
    with `sprint-117-reset-safety.test.ts`. Any demo data operation needs per-operation authorization.

**Added in rev 1 (plan review relayed by the maintainer, 2026-09-30; each finding verified against the repo):**

14. **Close the existing read holes BEFORE the first directed ask can exist (PR C, BUG-055, BUG-057).**
    Notification routes trust a URL or body user id (`notification-service/src/routes/notifications.ts:75,108,127,163,184,219,238`),
    and `GET /matches` / `GET /matches/:id` aren't participant-scoped (`request-service/src/routes/matches.ts:15-40,83-104`).
    PR C caller-scopes all of them, with cross-user tests for each route: an unrelated viewer, omitted
    filters, and a spoofed `user_id` in the URL, query or body. The `help_requests` gate can't see these,
    because notifications live in another table.
15. **Reference data goes in `seed-data.sql` as well as the migration.** `init.sql` is schema-only
    plus `seed-data.sql` plus a ledger marking every migration applied, so a migration-only seed is
    lost on fresh installs. An exact-parity regression test guards it (see *Data Model → PR A*).
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

Also in the plan's standing notes: **`scripts/regenerate-init-sql.sh` needs Docker.** There is none on
the Windows box, so use a disposable container on the demo host (ask first) or the Mac checkout.

## Carry-forward and open items

- **Sprint-number collision.** The unmerged branch `origin/lane/lanes-provenance` (`557bb547`, never
  opened as a PR) labels its lanes/stages/provenance work "Sprint 132" (maintainer, 2026-09-16). The
  maintainer named *this* product sprint 132 on 2026-09-30, so lanes-provenance renumbers whenever it
  is scheduled. Its spec, plan and lane file live only on that branch.
- **Logged 2026-09-30:** **BUG-055** (HIGH: notification routes trust a URL or body user id), **BUG-056**
  (`GET /requests/:id` has no visibility check and returns `requester_email`; out of scope, maintainer
  triage), and **BUG-057** (HIGH: `GET /matches` and `/matches/:id` aren't participant-scoped). **Decided (maintainer, 2026-09-30): 055 and 057 ship first
  as PR S.** BUG-056: MEDIUM, owner = maintainer (policy) / Claude (implementation), deadline **2026-10-14**, and kept separate.
- **Sprint number:** the maintainer's naming stands at 132 (the reviewer also recommends keeping it).
  lanes-provenance renumbers when scheduled.
- `/requests/matched/for-user` has no frontend caller (`api.ts:488` is unused). PR A repoints it, and
  it goes to IDEAS as a removal candidate.
- `apps/mobile` moderate audit chain (decode-uri-component ← query-string ← expo-router): no alert,
  and no non-downgrade fix. See `docs/IDEAS.md` [2026-09-30] tooling. Not an ADR-059 blocker.
- Sprint 131 follow-ups (fonts back to Turbopack, BUG-053 promoter, BUG-054 landing docs freshness,
  and the others) are in `docs/IDEAS.md` / `docs/BUGS.md`. They are not scheduled here.

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-132-pr-c-directed-borrow`, base `origin/master` `235b5446` |
| **Merged, never commit on them** | every Sprint 131 branch, including `agent/claude/sprint-131-dependabot-security-only` (#287) |
| **Active editor** | **Codex for PR C** (maintainer assignment, 2026-10-04). Owns the PR C file map in the plan; Claude remains sprint orchestrator and merge authority. |
| **Reviewer role** | A non-author reviews each completed diff; PR C additionally gets a fresh whole-branch review |
| **Shared resources** | ADR-099 is allocated. Dependency lane: Claude. The **node-forge advisory** earned the exemption PR. There is no lockfile or override change, because no fix exists. No demo data operation is planned; each needs its own authorization. |

## Persistent obligations (carried from Sprint 131, unchanged)

- Demo stories expire **2026-11-12**; BUG-041 recheck is due **2026-11-14**.
- GitHub posts a notice on every CI run: the `ubuntu-latest` label migrates to Ubuntu 26 from **2026-10-19**.
  Watch the first CI runs after that date, especially the Docker, Node and Postgres jobs.
- No docs-only master push; preserve the Sprint 130 archive in PR A. *(This was Sprint 131's PR A,
  now done: the archive is on master. It is not an instruction for Sprint 132's PR A.)*
- CodeQL PR scans are incremental; master rescans establish closure of existing master alerts.
- Windows: use Node for JSON/HTTP probes; no local Docker. Demo data operations require separate
  explicit authorization, and none are planned here.
- Root tests can promote unrelated TDD files and regenerate landing timestamps; inspect the tree
  after verification and preserve only intended changes.
- **`node-forge` exemption expires 2026-10-08** (first invalid day). Before then: `npm view node-forge version`, the GHSA page and
  `npm ls node-forge --all`, then remediate or renew with a fresh maintainer decision. Otherwise every PR blocks again.
- **BUG-058** (deadline 2026-10-15): the image-size watch is obsolete and red (#236). Generalize it or revert the 30-day cap.
- Contributor agents never self-merge; only Claude marks the sprint complete after actual delivery.

## PR A execution (2026-10-01)

Codex is the active executor on the existing `agent/claude/sprint-132-pr-a-skills` branch,
starting from `83d6ab0a`; the working tree was clean and `gh pr list` returned no open PRs
after fetching origin. Scope is PR A only, tasks A1–A10, with ADR-099 already allocated.
PR S's shipped record remains on this branch and must be carried forward if the branch is replaced.
Windows was confirmed with `uname -s` (`MINGW64_NT-10.0-26200`). BUG-056 remains separate,
due 2026-10-14.

The PR A code, migration, seed, generated `init.sql`, ADR, registry, service contexts, generated
landing docs and tests are staged. An earlier complete local `npm test` run passed
27/27 tasks (root regression 39 suites, 916 tests). A later unrestricted full run reached 26/27:
two security-gate suites now fail on newly reported HIGH `node-forge` advisory
`GHSA-86w9-cpqp-85rv` in the Expo CLI/signing chain. The upstream advisory lists no patched
version as of 2026-10-01. **Superseded 2026-10-01:** the maintainer at first chose to wait for an upstream fix, then accepted
a time-boxed exemption (the exemption PR, 7 days). The gate is not bypassed. Auth/request/frontend TypeScript checks passed;
focused tests added afterward passed, including red/green suggestion-filter and caller-scope tests.
The seed parity test went red after one vocabulary row was temporarily removed and green after
exact byte restoration. Migration static review found no issues. The broader review agent hit a
usage limit, so direct diff review continues. **Superseded 2026-10-01:** Claude committed the staged work locally as `e2dc9043`
(no push). The PR waits until the exemption PR is on master.
No merge or deploy is authorized.

The maintainer explicitly approved uploading the inspected 549 KB SQL/scripts archive to an
isolated `/tmp` scratch directory on the demo host after automatic review initially rejected
the less specific authorization. A network-disabled, 512 MB/1 CPU PostgreSQL 15 container
regenerated `init.sql`; the fresh-install vocabulary/ledger check and full-schema drift check
both passed. The generated diff is 64 insertions and one ledger-line replacement, limited to
the skill schema, seed, deprecation comment and ledger. The container and remote scratch
directory were removed and their absence checked. The maintainer also authorized caller-scoping
the pre-existing `/requests/matched/for-user?user_id=` disclosure in PR A. Its query now binds
to the JWT caller; a spoofed `user_id` is ignored, and absent identity returns 401. Three
route tests went red before and green after the fix; docs and the unused frontend wrapper were
updated.

## Next unchecked action

**PR C draft checkpoint (2026-10-04):** [#293](https://github.com/ravichavali/karmyq/pull/293),
implementation `2df7a7b7` pushed with normal hooks (27/27 tasks, 24 cached). C1/C3–C9 code, source docs and the full SQL
surface inventory are prepared. First handoff-only commit is `595ae7bb`. Next: complete local
generated-schema process review and push, then inspect real integration and independent-base parity
CI evidence. [Schema generation 37232333945](https://github.com/ravichavali/karmyq/actions/runs/37232333945)
passed determinism, fresh boot, recorded migrations and replay drift at `2df7a7b7`; its artifact
is promoted without edits (39 insertions/1 deletion: four columns, two indexes, three SET NULL
foreign keys and one ledger entry). Manual dispatch skips independent-base byte parity; PR CI
must prove it. Local unit/regression does not prove SQL. The injected unguarded query on committed
`2df7a7b7` failed exactly at requests.ts:2340; restoring the byte copy made the gate pass, and
the tree was clean before push. Runtime privacy and CI evidence remain in the PR packet.
Focused backend/UI/notification tests pass. Final source full-suite process verification exited 0:
27/27 tasks, 22 cached; root 39 suites/917 tests; request regression 325 plus one existing skip.
Independent high code/security review found no critical/important production issue; two minor
findings (community-admin banner and calendar overflow) were fixed with coverage. Static migration
review passed; real PostgreSQL execution remains unproven. A fresh maintainer-relayed whole-branch
review is required before readiness. No merge, deployment, demo write or alert dismissal is authorized.
Privacy rollout constraint: a pre-C image lacks directed guards; after the first directed row,
rollback must preserve the guards or disable affected reads (ADR-099). Choose this before deployment.
The master Expo SDK drift run 37204717864 failed; cause is UNVERIFIED and outside C scope.

Validation logs live in the ignored sprint SDD directory: `pr-c-implementation-process-test.log`,
`c-feedback-final.log`, and focused RED/GREEN logs. All four affected TypeScript checks passed;
the final request-only recheck passed after the relationship-context fix. Only this PR's TDD files
were promoted. Generated ADR-059 catches up to its already-shipped braces amendment; its source
and security policy are unchanged. Root SQL remains pending CI. Do not infer generated-schema
or runtime SQL correctness from local mocks or the static migration review.

1. **PR A SHIPPED and LIVE as v11.78.0.** #290 merged as `244291eb` (v11.77.0), but its master run [37077914525](https://github.com/ravichavali/karmyq/actions/runs/37077914525) never deployed. Attempt 1 was blocked by CodeQL #592/#593, master re-raises of the `js/request-forgery` false positive (PR-ref dismissals do not carry to master; the maintainer dismissed them in the UI). Attempt 2 was blocked by the newly reviewed `braces` GHSA-vfj7-8cjw-p6xm, which has no fix. The exemption PR [#291](https://github.com/ravichavali/karmyq/pull/291) (7-day `braces` exemption, ADR-059 amendment, BUG-059, plus a sprint-124 parity-test fix for multi-entry registries) merged as `f90b9916` (v11.78.0). [CI/CD 37169859212](https://github.com/ravichavali/karmyq/actions/runs/37169859212) ended in DEPLOYMENT SUCCESSFUL with no rollback, deploying PR A's code with it.
2. **Task A10 read-only smoke PASSED (2026-10-03, maria.reyes):** login 200; `GET /api/auth/profile/tags/suggestions?tag_type=skill` 200 with 26 vocabulary labels, matching the 26 rows the migration seeds; `GET /api/requests/curated` 200; `GET /api/users/<id>/skills` 404 (route removed). The tag-add write was skipped (it needs per-operation authorization).
3. **CURRENT: PR C implementation**, tasks C1–C12 on the branch above. B11 finished: #292 merged
   as `235b5446`; CI/CD 37180421165 and Demo health 37202424111 succeeded (verified GitHub,
   2026-10-04); inventory read-only smoke passed (maintainer report). Historical PR B checkpoints
   below are superseded by this shipped record. Continue from the PR C checkpoint above.
4. **Owed next week (dependency lane, Claude):** renew or remove the `node-forge` exemption (expires 2026-10-08) and the `braces` exemption (expires 2026-10-09; BUG-059); BUG-058 (monitor) is due 2026-10-15. Both renewals need the maintainer's explicit go-ahead, because the auto-mode classifier blocks exemption work as "Security Weaken".

## PR A finalization (2026-10-02)

Maintainer assigned Codex to finish A before B. Tree was clean at handoff. PR N live GitHub status is MERGED, with no open PRs; the CI/CD Deploy to Demo job and Health check all services step passed for 02d720b3. The merge conflicts only in this handoff; resolved using the master copy as prescribed above, then reconciled. Version-only manifest edits target 11.77.0. Independent code/security and migration reviews completed; preservation/normalization fixes remain pending. All affected TypeScript checks passed. Full forced local unit/regression verification passed (exit 0, 27/27 tasks) on the pre-commit merge tree of e2dc9043 and 02d720b3 with staged version/test changes; local log .superpowers/sdd/2026-09-30-sprint-132-inventories-and-skills/pr-a-npm-test-path.log. CI database evidence is pending. No new demo-host operation is authorized.

Review checkpoint: independent code/security and migration reviews confirmed unmapped legacy selections are omitted by the current inner join, and existing tags normalize whitespace differently from new tags. Root test tests/integration/sprint-132-skills.integration.test.ts is added BEFORE the fix for real CI RED evidence; no local PostgreSQL execution is claimed. The draft PR checkpoint must not merge. Both failing Windows shell suites pass with Git/usr/bin prepended; corrected full unit/regression run passed; this does not prove CI database behavior. The PR Validation ledger will carry the final tested head and CI links. Onboarding now identifies Profile → About You → Skills as the matching source.

Draft checkpoint pushed as 224aa21b and PR #290 opened. Normal pre-push blocking gate passed 27/27 tasks (22 cached); reporter-only TDD hook could not find task test:tdd, so it is not counted as verification. CI/CD run 37061292832: unit/regression, lint/type checks and security audit green. The authoritative host Integration Tests run proved the intended RED: three migration tests failed, 81 tests passed; the six real resolver SQL cases passed. The fresh-install step and regeneration run 37061293172 passed. CodeQL #585–591 independently verified false positives (fixed API destinations; SQL read from fixed repository migration path); maintainer UI dismissal requested under ship skill Phase 2. No alerts have been dismissed by Codex.

Reviewed draft checkpoint (5fcec96f, historical): repaired preservation and normalization, expanded collision/rerun coverage, and included SQL migration files in the integration runner Docker context. Independent code/security and migration re-review found no remaining production findings. Local `npm test` passed exit 0, 27/27 tasks (22 cached; root regression 39 suites/917 tests), log `pr-a-fix-test.log` in the same SDD scratch directory. Per plan A2, that checkpoint deliberately omitted Driving from the fresh-install expected rows to prove that CI rejects a missing expectation before migration replay. It remained draft; the restoration is recorded below, and final CI evidence belongs in PR Validation. The backup is `.superpowers/sdd/2026-09-30-sprint-132-inventories-and-skills/fresh-check-original.sh`. PR Validation carries checkpoint URLs and latest-head database results.

**Restoration checkpoint:** `5fcec96f` was pushed with normal hooks (unit/regression 27/27, 24 cached; `pr-a-negative-push.log`). Its [fresh-install CI step](https://github.com/ravichavali/karmyq/actions/runs/37063659921/job/111026957713) failed exactly on the omitted `driving|Driving|["driving"]` row, before schema replay; [schema regeneration](https://github.com/ravichavali/karmyq/actions/runs/37063659862) passed. The checker is restored byte-identically to the backup (SHA-256 `D423E475AF36C5DA39AA0A5E22F23FA861CF5F16E2953F940D564CC8CC15498C`) and has no diff against `224aa21b`. Only the checker restoration and handoff changed after the reviewed fixes; final local/CI runs are recorded against their actual heads in [PR #290 Validation](https://github.com/ravichavali/karmyq/pull/290). No demo write, deployment or smoke is claimed. `origin/master` is still `02d720b3` and #290 is the only open PR (live reconciliation 2026-10-02).

## PR A security clearance (2026-10-02)

The maintainer independently verified all seven false positives and expressly authorized Codex to dismiss them through the GitHub API, overriding the ship skill UI requirement. All seven dismissal states/comments were verified. Each alert and approved reason is recorded in PR #290 Security dismissals; no other alerts were changed. GitHub CodeQL became SUCCESS and the diagnosed Code Scanning Gate rerun passed at bf17b6cf ([job 111055876651](https://github.com/ravichavali/karmyq/actions/runs/37064984163/job/111055876651)). Code and database evidence at bf17b6cf remains valid; the only subsequent repository change is this handoff. The PR Validation ledger carries latest-head checks. No merge, deploy, admin override or demo write is authorized. PR #290 was marked ready for review after all checks passed at bf17b6cf. Verify the subsequent handoff-only commit's latest-head checks, then obtain explicit per-PR merge authorization; B waits for A deployment and read-only smoke.

## PR B execution checkpoint (2026-10-03)

Catalog implementation and source docs are prepared on the assigned branch. Specific TDD files
were promoted to regression after route22/22 and UI18/18 focused passes; real SQL is unproven until
CI runs the13-case root integration file. Non-author static migration review passed; high code and
security review found no server bypass, and the stale community/shared-panel response findings
were reproduced RED and fixed GREEN. Multi-community and forced-insert-failure rollback cases
are included for CI. Do not infer SQL correctness from the mocked route boundary.

Local full-suite verification PASSED on the final source worktree at HEAD `9564913d`: `npm test`
exited 0, 27/27 tasks (22 cached), root regression 39 suites/917 tests, frontend regression 370,
request unit 161/regression 289. Both affected TypeScript checks passed. The required process
reviewer approved this checkpoint. Logs are in the ignored sprint SDD directory, including
`b10-process-npm-test-final.log`. This proves local unit/regression and builds, not real SQL.

Checkpoint `8537a319` pushed with normal hooks: `npm test` exit 0, 27/27 tasks (26 cached),
log `b11-checkpoint-push.log`. [Schema generation 37178304829](https://github.com/ravichavali/karmyq/actions/runs/37178304829)
PASSED at that commit: deterministic output, fresh installation, recorded migrations and no drift
after replay. Its artifact was downloaded and promoted without hand editing. The inspected diff
is limited to the inventory schema, two tables, keys/indexes and one migration-ledger entry
(107 insertions/1 deletion). No seeds or unrelated objects changed.

Snapshot `a4f9e12a` was pushed with normal hooks (27/27 tasks, 26 cached). PR #292 was opened as
a draft. Final-head CI, current draft/check state, and any security findings are recorded in
[PR #292 Validation](https://github.com/ravichavali/karmyq/pull/292) rather than duplicated here.
At readiness, confirm all 13 inventory cases ran/passed in the Integration Tests job and
independent-base byte parity passed in PR regeneration; manual dispatch skipped that parity step.
This final handoff changes no runtime or schema; the source reviews still apply. No demo-host
operation is needed. Live reconciliation: #292 is the only open PR, master remains `f90b9916`.
Version-only bump targets 11.79.0 from master 11.78.0; recheck at readiness if master advances.
No merge, deployment, alert dismissal or demo write is authorized.
