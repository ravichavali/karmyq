# Sprint 132 — Inventories and Skills — Handoff

**Date**: 2026-10-02
**Status**: PR N is merged and deployed as v11.76.0 ([#289](https://github.com/ravichavali/karmyq/pull/289), squash `02d720b3`; [CI/CD 37053659544](https://github.com/ravichavali/karmyq/actions/runs/37053659544), deployment and health checks successful, verified 2026-10-02). PR S shipped v11.75.0 (#288). Maintainer instruction 2026-10-02: Codex finishes PR A before starting PR B. PR A implementation is committed as `e2dc9043`; origin/master is being merged, final reviews and checks are in progress, release version 11.77.0. No merge or deploy is authorized.

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
2. **PR S shipped** (#288). **Exemption PR shipped:** #289 (v11.76.0). Finish PR A next. **PR A:** the branch `agent/claude/sprint-132-pr-a-skills` already exists (cut from
   `origin/master` `b169472b`): `git fetch origin && git switch agent/claude/sprint-132-pr-a-skills`. **PR B / C:** once the
   previous PR has deployed, `git fetch origin` then `git switch -c agent/claude/sprint-132-pr-b-inventory origin/master`
   (or `…-pr-c-directed-borrow`). The planning branch `agent/claude/sprint-132-inventories-skills`
   is retired once PR S merges; never commit on it after that. Never branch off a stale local master; unpushed local-master commits
   leak in through the squash-merge.
3. Open the plan: [`docs/superpowers/plans/2026-09-30-sprint-132-inventories-and-skills.md`](../../docs/superpowers/plans/2026-09-30-sprint-132-inventories-and-skills.md).
   PR S first; then **one PR section per fresh chat** (A, then B, then C).
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
| A | Skills single source: `auth.skill_vocabulary` + `user_tags.skill_slug`; matching reads tags; remove the fixed picker and `/users/:id/skills`; ADR-099 | `agent/claude/sprint-132-pr-a-skills` (cut from `origin/master` `b169472b` 2026-09-30) | A1–A7 committed as `e2dc9043`; Codex finalizing A8–A10 after the deployed N merge. Version 11.77.0; not pushed yet |
| **N** | **node-forge exemption (2026-10-01):** a 7-day ADR-059 exemption for GHSA-86w9-cpqp-85rv (no patched release), an ADR-059 amendment, a sprint-125 coverage gate that admits an unwatched package only for ≤ 7 days, and BUG-058 | `agent/claude/sprint-132-node-forge-exemption` (cut from `origin/master` `b169472b`) | **MERGED + DEPLOYED v11.76.0** (#289, `02d720b3`; CI/CD 37053659544 and health check green, verified 2026-10-02) |
| B | Inventory catalog: `inventory` schema, `/requests/inventory/*`, item audience predicate, My things page, community Shared things tab | `agent/claude/sprint-132-pr-b-inventory` (cut after A deploys) | planned |
| C | Directed *Ask to borrow*: `is_directed` + targets on `help_requests`; `notDirectedSql` on browse surfaces and `directedAudienceSql` on private-access surfaces, with a live-scan gate; `directed_request_created` event; directed predicate on match views (C4b); the incoming-asks query plus the Helping *Asked of you* section (C5b, C7); `requester_id`-gated `GET /requests` | `agent/claude/sprint-132-pr-c-directed-borrow` (cut after B deploys) | planned |

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
| **Branch** | `agent/claude/sprint-132-inventories-skills`, cut 2026-09-30 from `origin/master` `c187aa87` (v11.74.0) |
| **Merged, never commit on them** | every Sprint 131 branch, including `agent/claude/sprint-131-dependabot-security-only` (#287) |
| **Active editor** | **Codex for PR A finalization** (maintainer, 2026-10-02: finish A, then start B). Claude remains sprint orchestrator and merge authority. |
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

1. **PR N is deployed.** Finish PR A reviews and verification, then push/open its PR. The merged exemption branch must receive no further commits.
2. **PR A:** existing branch `agent/claude/sprint-132-pr-a-skills`; the fetched `origin/master` merge is in progress
   (a merge commit, never a rebase or force-push; take this handoff from master, then update the PR A row).
   Re-bump to 11.77.0 from live `origin/master`.
3. PR A gates: `/simplify`, `/code-review` **high** (schema, auth route removal, matching), `/security-review`, full
   `npm test` (exit code captured), `tsc --noEmit` for auth, request and frontend. Revert landing churn. Then push and open the PR.
   Confirm from the CI *Integration Tests* log that the sprint-132 files ran, and that the fresh-install step is green.
4. Merge authorization, `/deploy`, the Task A10 smoke, then this handoff. PR B in a fresh chat after A deploys.

## PR A finalization (2026-10-02)

Maintainer assigned Codex to finish A before B. Tree was clean at handoff. PR N live GitHub status is MERGED, with no open PRs; the CI/CD Deploy to Demo job and Health check all services step passed for 02d720b3. The merge conflicts only in this handoff; resolved using the master copy as prescribed above, then reconciled. Version-only manifest edits target 11.77.0. Independent code/security and migration reviews completed; preservation/normalization fixes remain pending. All affected TypeScript checks passed. Full forced local unit/regression verification passed (exit 0, 27/27 tasks) on the pre-commit merge tree of e2dc9043 and 02d720b3 with staged version/test changes; local log .superpowers/sdd/2026-09-30-sprint-132-inventories-and-skills/pr-a-npm-test-path.log. CI database evidence is pending. No new demo-host operation is authorized.

Review checkpoint: independent code/security and migration reviews confirmed unmapped legacy selections are omitted by the current inner join, and existing tags normalize whitespace differently from new tags. Root test tests/integration/sprint-132-skills.integration.test.ts is added BEFORE the fix for real CI RED evidence; no local PostgreSQL execution is claimed. The draft PR checkpoint must not merge. Both failing Windows shell suites pass with Git/usr/bin prepended; corrected full unit/regression run passed; this does not prove CI database behavior. The PR Validation ledger will carry the final tested head and CI links. Onboarding now identifies Profile → About You → Skills as the matching source.
