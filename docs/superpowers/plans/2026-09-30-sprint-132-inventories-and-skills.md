# Sprint 132 — Inventories and Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
>
> **Four PRs.** PR S (security, rev 2) goes first and is executed in the planning chat on maintainer
> instruction. After that, run **one PR section per fresh chat**: PR A (after S deploys), PR B (after A
> deploys), then PR C (after B deploys). Each section is self-contained and ends in its own
> gates and merge/deploy task. Don't start a section until the previous PR is merged **and** its
> deploy and health verify are green.

**Goal:** Members and communities can list shareable items (private until shared), "Ask to borrow"
opens a request only the owner can see that runs the existing match → karma loop, and skills have
one source of truth that matching reads.

**Architecture:** A new `inventory` schema, served by request-service under `/requests/inventory`,
gates every read through one live-membership audience predicate. Directed requests are ordinary
`help_requests` rows with a fail-closed `is_directed` flag that every read surface filters through
a second shared predicate, and skills collapse onto `auth.user_tags` plus a canonical vocabulary.

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture*. Do not restate version numbers here — a pinned example goes stale and then gets copied into specs.

**Spec:** [`docs/superpowers/specs/2026-09-30-sprint-132-inventories-and-skills-design.md`](../specs/2026-09-30-sprint-132-inventories-and-skills-design.md)
(read it first; its *Audience predicates* and *Surfaces* sections are normative).
**ADR:** ADR-099 (maintainer-allocated 2026-09-30).

> **Rev 1 (2026-09-30), after a plan review relayed by the maintainer.** Eight findings, all CONFIRMED
> against the repo: notification routes trust client user ids (BUG-055); match views are not
> participant-scoped (BUG-057); the vocabulary seed was lost on fresh installs; the integration tests
> were placed where no CI job runs them; unavailable community items leaked to members; browse and
> private access were conflated; request-service has no zod; and the regen output needs promotion.
> See critical notes 14-19 and the revised Tasks A1, A2, B1, B3, B4, B10, C1, C3, C4, C4b and C11.
>
> **Rev 2 (2026-09-30, maintainer).** BUG-055/BUG-057 are pulled out of C4b into a standalone **PR S**
> that ships before PR A. Traced: `GET /requests` doubles as "my requests" through a client-controlled
> `requester_id`, and Helping has no inbox for unanswered asks, so PR C gets an incoming-asks query and
> section. The fresh-install proof becomes a blocking CI step before the migration replay. BUG-056 now
> has a severity, owner and deadline. See critical notes 20-22, the *PR S* section, and Tasks A2, C1, C4b, C5b and C7.

---

## File Map

### New files to create
| File | PR | Responsibility |
|------|----|---------------|
| `infrastructure/postgres/migrations/20260930-skill-vocabulary.sql` | A | `auth.skill_vocabulary`, `user_tags.skill_slug`, backfills, deprecation comment |
| `services/auth-service/src/services/skillVocabulary.ts` | A | `resolveSkillSlug(text)`, `listSkillSuggestions()` |
| `services/auth-service/tests/tdd/sprint-132-skill-vocabulary.test.ts` | A | resolution + suggestions + removed routes |
| `services/request-service/tests/tdd/sprint-132-skills-from-tags.test.ts` | A | `getUserProfile` reads tags; matched-for-user repoint |
| `apps/frontend/tests/tdd/sprint-132-single-skills-editor.test.tsx` | A | one editor; payload; "matched to" hint |
| `docs/adr/ADR-099-inventories-and-directed-requests.md` | A | the sprint's ADR (amended in B, C) |
| `infrastructure/postgres/migrations/2026MMDD-inventory-schema.sql` | B | `inventory.items`, `inventory.item_shares` |
| `services/request-service/src/db/inventoryDb.ts` | B | item audience predicate + all inventory queries |
| `services/request-service/src/routes/inventory.ts` | B | `/requests/inventory/*` handlers (hand-validated like the existing routes; **no zod**, note 19) |
| `services/auth-service/tests/tdd/sprint-132-vocabulary-seed-parity.test.ts` | A | exact slug/label/synonym parity between the migration and `seed-data.sql` (note 15) |
| `services/notification-service/tests/tdd/sprint-132-notification-caller-scope.test.ts` | **S** | BUG-055: every user route caller-scoped (URL, query and body spoofs) |
| `services/request-service/tests/tdd/sprint-132-match-participant-scope.test.ts` | **S** |
| `services/request-service/tests/tdd/sprint-132-incoming-asks.test.ts` | C | incoming asks + `requester_id` rule (notes 20, 21) |
| `scripts/ci-check-fresh-install-reference-data.sh` | A | blocking fresh-install check, run before the migration replay (note 15) | BUG-057: `GET /matches` + `/matches/:id` participant-scoped |
| `services/request-service/tests/tdd/sprint-132-inventory-routes.test.ts` | B | route contract, auth, 404-not-403, mount order |
| `tests/integration/sprint-132-inventory-audience.integration.test.ts` | B | audience truth against a real DB |
| `apps/frontend/src/pages/inventory/index.tsx` | B | "My things" |
| `apps/frontend/src/components/community/tabs/InventoryTab.tsx` | B | "Shared things" community tab |
| `apps/frontend/tests/tdd/sprint-132-inventory-ui.test.tsx` | B | page + tab coverage per CLAUDE.md table |
| `docs/guides/sharing-your-things-guide.md` | B | user guide |
| `docs/concepts/inventories.md` | B | concept page |
| `infrastructure/postgres/migrations/2026MMDD-directed-requests.sql` | C | `is_directed`, targets, `inventory_item_id` |
| `services/request-service/src/db/directedAudience.ts` | C | directed-request audience predicate |
| `services/request-service/tests/tdd/sprint-132-directed-audience-gate.test.ts` | C | live-scan gate over every `help_requests` read |
| `services/request-service/tests/tdd/sprint-132-directed-borrow.test.ts` | C | borrow endpoint, event, POST /requests rejection |
| `tests/integration/sprint-132-directed-audience.integration.test.ts` | C | per-surface: audience sees, third member doesn't |
| `services/notification-service/tests/tdd/sprint-132-directed-request-notify.test.ts` | C | exactly the recipients, never community fan-out |
| `apps/frontend/tests/tdd/sprint-132-ask-to-borrow.test.tsx` | C | button gating, payload, banner |

### Existing files to modify
| File | PR | Change |
|------|----|--------|
| `services/auth-service/src/routes/profileTags.ts` | A | resolve `skill_slug` on POST; return it on GET; skill suggestions from vocabulary |
| `services/auth-service/src/routes/users.ts` | A | delete `/:userId/skills` GET/POST/DELETE (`:69-140`) |
| `services/request-service/src/routes/requests.ts` | A, C | A: `getUserProfile` (`:302-329`) + `/matched/for-user` EXISTS (`:262-279`) → tags. C: predicate on every listing; 404 on `/:id`; reject directed fields on `POST /` |
| `apps/frontend/src/pages/profile.tsx` | A | remove `AVAILABLE_SKILLS` picker + state + fetch |
| `apps/frontend/src/components/ProfileTagsSection.tsx` | A | "matched to" hint; vocabulary suggestions |
| `services/simulation-service/src/fixtures/curatedDemo/tablePolicy.ts` | A, B | A: `auth.skill_vocabulary: 'preserve'`. B: `'inventory'` in `MANAGED_SCHEMAS`; both tables `'reset'` |
| `services/request-service/src/index.ts` | B | mount inventory router **before** `requestsRouter` |
| `apps/frontend/src/lib/api.ts` | B, C | `inventoryService` (+ `askToBorrow` in C) |
| `apps/frontend/src/pages/communities/[id].tsx` | B | wire `InventoryTab` |
| `apps/frontend/src/components/Layout.tsx` | B | "My things" nav |
| `apps/frontend/src/lib/onboarding/workflows.ts` | A, B | skills copy check; inventory step |
| `services/request-service/src/db/eligibility.ts` | C | directed predicate inside `getRequestReachability` |
| request-service feed/dibs/admin/matches/offers files (spec *Surfaces*) | C | apply predicate or 404 |
| `services/community-service/src/routes/stats.ts`, `routes/export.ts` | C | exclude directed rows from lists |
| `services/notification-service/src/events/subscriber.ts` | C | `directed_request_created` handler |
| `services/*/CONTEXT.md`, `services/registry.json` | A, B, C | endpoints, schema, events |
| `infrastructure/postgres/init.sql` | A, B, C | **regenerated** via `scripts/regenerate-init-sql.sh` (`REGEN_PG_CONTAINER`; review, then promote `init.sql.generated`; note 18), never hand-edited |
| `infrastructure/postgres/seed-data.sql` | A | the same vocabulary `INSERT` as the migration (note 15) |
| `services/notification-service/src/routes/notifications.ts` | **S** | caller-scope every user route (BUG-055, note 14) |
| `.github/workflows/ci.yml` | A | fresh-install step before *Prove init.sql matches the full migrated schema* |
| `apps/frontend/src/components/CommitmentsTab.tsx` | C | *Asked of you* section |
| `services/request-service/src/utils/queryBuilder.ts` | C | `requester_id`-gated directed admission (note 20) |
| `services/request-service/src/routes/matches.ts` | S, C | S: participant-scope `GET /` and `GET /:id` (BUG-057). C: add `directedAudienceSql` |
| `docs/BUGS.md` | planning | BUG-055, BUG-056, BUG-057 logged 2026-09-30 |
| `infrastructure/claude.md`, `CLAUDE.md` *Database* | B | 13 live schemas (+ `inventory`); keep AGENTS.md in sync if it repeats the count |
| `docs/guides/profile-guide.md`, `fulfilling-requests-guide.md`, `making-requests-guide.md`, `community-admin-guide.md` | A–C | per spec *Doc Updates* |
| `scripts/generate-docs.ts` | A, B | `ADR_GROUPS` (A); `GUIDE_ORDER`, `CONCEPT_ORDER` + `howItWorks` (B) |
| `docs/adr/README.md` | A | index ADR-099 |
| `package.json`, `package-lock.json` | A, B, C | minor bump from `origin/master` at merge time |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

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

**Standing process notes (from memory; each has bitten before):**
- New tests start in the **changed workspace's** `tests/tdd/`. The promoter does not auto-run
  (BUG-053), and running it by hand sweeps unrelated files. Promote **only this PR's** files, with `git mv`.
- `npm test` regenerates landing docs with timestamp/sha churn. Revert that churn before every commit.
- **`scripts/regenerate-init-sql.sh` needs Docker** (`docker exec … pg_dump` / `psql`, lines 50–152).
  On the Windows box there is no local Docker. Per CLAUDE.md, use a disposable container on the demo
  server over SSH (**ask the maintainer first**: it is the shared host, although not a data operation)
  or regenerate on the Mac checkout. Never hand-edit `init.sql` to dodge this; the drift gate catches it.
- Windows host: no local Docker/Postgres. Integration tests run in CI (full migrated schema since #143).
  Use `node -e` for HTTP probes, and capture exit codes separately (`| tail` masks them).
- Gates you write must be shown able to fail: inject, see red, restore from a **byte copy** of a
  **committed** tree (`git checkout --` wiped uncommitted edits in S131).
- `feedback:check` reads `git diff --cached` and is clean on any committed branch. Run it before
  committing, not after.
- Editing `apps/frontend/src/lib/api.ts` re-raises the CodeQL `js/request-forgery` FP under new ids,
  and that **blocks the master deploy**. Expect it in PR B and PR C, and surface it for UI dismissal.

---

# PR S — Security: caller and participant scoping (BUG-055, BUG-057)

Branch: `agent/claude/sprint-132-security-authz`, cut from the planning branch
(`agent/claude/sprint-132-inventories-skills`, itself on `origin/master` `c187aa87`), so the Sprint 132
spec, plan, handoff and BUG entries reach master with it. No schema, no dependency change. It is small
but security-relevant, so run `/code-review` at **medium**, then `/security-review`.

## Task S1: TDD tests first
- Create: `services/notification-service/tests/tdd/sprint-132-notification-caller-scope.test.ts`: through
  the real `notificationRoutes` behind `authMiddleware`, each `/:userId` route: another user's id → 403,
  own id → 200 (the DB boundary mocked; assert the SQL is issued only with the **JWT** id).
  `PUT /:notificationId/read` and `DELETE /:notificationId` with a body `user_id` naming someone else:
  the DB helper receives the JWT id, never the body id.
- Create: `services/request-service/tests/tdd/sprint-132-match-participant-scope.test.ts`: `GET /matches`
  with no filters, and with `?user_id=<other>`, issues SQL constrained to the JWT caller as requester,
  responder or offerer (assert the bound parameter is the JWT id and the predicate is present).
  `GET /matches/:id`: the query binds the caller, and no row → 404.
- [ ] **Verify red** for the right reason.

## Task S2: Fix notifications
- [ ] `services/notification-service/src/routes/notifications.ts`: every `/:userId` route returns 403 when
  `req.params.userId !== req.user.userId` (the SSE route's shape, `:19-35`). `read` and `delete` use the
  JWT id, and the body `user_id` is no longer required or read. Leave `apps/frontend/src/lib/api.ts`
  alone: the extra body field is harmless, and editing that file re-raises the CodeQL FP that blocks deploys.
- [ ] **Verify:** S1 notification test green; notification-service suite green; `tsc --noEmit` 0.

## Task S3: Fix match views
- [ ] `services/request-service/src/routes/matches.ts`: `GET /` always adds
  `AND (r.requester_id = $caller OR m.responder_id = $caller OR o.offerer_id = $caller)` and ignores the
  `user_id` param (the caller is the subject). `GET /:id` adds the same predicate, and no row → 404.
- [ ] **Verify:** S1 match test green; request-service suite green; `tsc --noEmit` 0.

## Task S4: Docs
- [ ] `docs/BUGS.md`: BUG-055 and BUG-057 → fixed (mechanism, tests). BUG-056 keeps its severity/owner/deadline.
- [ ] notification-service and request-service `CONTEXT.md`: the auth contract of each route; *Recent Fixes*.
- [ ] Guides: no user-visible behaviour change for legitimate callers. Record that in the PR body instead of editing guides.

## Task S5: Promote, gates, verify
- [ ] `git mv` the two tdd files to their workspace `tests/regression/`.
- [ ] `/simplify` → `/code-review` medium → `/security-review`, with each finding resolved or justified.
- [ ] `npm test` (exit code captured), `npm run feedback:check` (staged), `tsc --noEmit` for both services;
  revert any landing-docs churn.

## Task S6: PR, merge, deploy, smoke
- [ ] Version bump from `origin/master` at merge time; the PR with its contract headers; CI green.
  **Maintainer merge authorization.** `/deploy`.
- [ ] **Smoke (read-only, as maria.reyes):** her own `GET /api/notifications/<her id>` → 200; `GET /api/notifications/<another user id>` → 403;
  `GET /api/matches?user_id=<another user id>` returns only matches maria is party to; the standard four-endpoint smoke → 200.
- [ ] Update the handoff (PR S shipped; next = PR A in a fresh chat).

---

# PR A — Skills single source (auth + request + frontend)

Branch: `agent/claude/sprint-132-pr-a-skills`, cut from `origin/master` **after PR S deploys** (the planning
commits reach master with PR S). Scope is small and well-specified, so run `/code-review` at **medium**.

## Task A1: TDD tests first

**Files:**
- Create: `services/auth-service/tests/tdd/sprint-132-skill-vocabulary.test.ts`
- Create: `services/request-service/tests/tdd/sprint-132-skills-from-tags.test.ts`
- Create: `apps/frontend/tests/tdd/sprint-132-single-skills-editor.test.tsx`

- [ ] **Auth tests.** Unit-test `resolveSkillSlug` against a vocabulary fixture: `'Carpentry'` → `carpentry`;
  `'  pet care '` → `pet_care` (synonym/label); `'Spanish tutoring'` → `tutoring`; `'underwater basket'` →
  `null`; `'carp'` → `null` (**no substring at write time**, note 9). Route test (supertest on an
  express app that mounts `profileTags` the way `src/index.ts:61` does): POST a skill tag and get back
  `skill_slug` resolved; POST `tag_type:'interest'` and get `skill_slug: null`. Assert that
  `GET /users/:id/skills` is now **404** through the users router.
- [ ] **Request tests.** `getUserProfile` (export it for test, or test through `/requests/curated` with the
  `query` module mocked **only at the DB boundary**) issues SQL reading `auth.user_tags` with
  `tag_type = 'skill'` and **never** `auth.user_skills`. Assert the exact skill array returned for rows
  `[{skill:'carpentry'}, {skill:'underwater_basket'}]`.
- [ ] **Frontend tests.** The profile page renders **one** skills editor (no `AVAILABLE_SKILLS` options).
  Adding "carpentry" posts exactly `{ tag_type: 'skill', tag_value: 'carpentry' }` to `/auth/profile/tags`.
  A tag with `skill_slug` shows "matched to", and one without doesn't. A failed tag fetch still renders
  (graceful fallback).
- [ ] **Seed parity test (no DB)** `services/auth-service/tests/tdd/sprint-132-vocabulary-seed-parity.test.ts`:
  parse the `auth.skill_vocabulary` `INSERT` tuples out of `infrastructure/postgres/migrations/20260930-skill-vocabulary.sql`
  **and** `infrastructure/postgres/seed-data.sql`, then assert **exact equality** of the `(slug, label, sorted synonyms)`
  sets, and that both are non-empty. Inject once (drop a row from `seed-data.sql` on a committed tree),
  see red, and restore from a byte copy (note 15).
- [ ] **Verify red.**

```bash
npm exec --workspace=services/auth-service -- jest --runTestsByPath tests/tdd/sprint-132-skill-vocabulary.test.ts tests/tdd/sprint-132-vocabulary-seed-parity.test.ts; echo "exit=$?"
npm exec --workspace=services/request-service -- jest --runTestsByPath tests/tdd/sprint-132-skills-from-tags.test.ts; echo "exit=$?"
npm exec --workspace=apps/frontend -- jest --runTestsByPath tests/tdd/sprint-132-single-skills-editor.test.tsx; echo "exit=$?"
```
Expected: each fails for the *right* reason (a missing module or function, or the wrong table), not a config error.

## Task A2: Migration + init.sql + reset policy

**Files:**
- Create: `infrastructure/postgres/migrations/20260930-skill-vocabulary.sql`
- Modify: `infrastructure/postgres/init.sql` (regenerated), `services/simulation-service/src/fixtures/curatedDemo/tablePolicy.ts`

- [ ] Write the migration exactly as in the spec's *Data Model → PR A*. The seed rows are the 24 legacy
  slugs from `profile.tsx:22-46` (`driving, moving, childcare, pet_care, tech_support, coding,
  home_repair, handyman, electrical, plumbing, carpentry, gardening, cooking, baking, tutoring,
  languages, career_advice, design, writing, photography, music, art, cleaning, organizing`) with human
  labels, plus `elder_care` and `bookkeeping` (new, from `TAG_SUGGESTIONS`). The remaining 13 suggestions
  go in as synonyms of their slug (`'spanish tutoring'`→tutoring, `'moving help'`→moving, `'web design'`→design,
  `'music lessons'`→music, …). Synonyms are stored lower-cased. The CHECK constraint is added through a
  guarded `DO $$ … IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_tags_skill_slug_only_on_skills') …`.
- [ ] Make the migration idempotent: running it twice changes nothing (`ON CONFLICT DO NOTHING` on both
  inserts, and a `skill_slug IS NULL` guard on the UPDATE).
- [ ] **Put the identical vocabulary `INSERT … ON CONFLICT (slug) DO NOTHING` in `infrastructure/postgres/seed-data.sql`**
  (note 15). `init.sql` is schema-only, plus this file, plus a ledger marking every migration applied, so
  without this a fresh install has an empty vocabulary. The A1 parity test goes green.
- [ ] `tablePolicy.ts`: `'auth.skill_vocabulary': 'preserve'`.
- [ ] Regenerate, review, promote (note 18). This needs a **dedicated disposable** Postgres 15 container;
  there's no Docker on the Windows box (see *Standing process notes*):

```bash
REGEN_PG_CONTAINER=<disposable-pg15-container> bash scripts/regenerate-init-sql.sh; echo "exit=$?"
diff -u infrastructure/postgres/init.sql infrastructure/postgres/init.sql.generated | less   # review: new table/column/constraint, vocabulary rows via seed-data, ledger row for 20260930-skill-vocabulary.sql
cp infrastructure/postgres/init.sql.generated infrastructure/postgres/init.sql && rm infrastructure/postgres/init.sql.generated
```
- [ ] **Fresh-install proof as a blocking CI step (rev 2, note 15).** In `.github/workflows/ci.yml` job
  `test-integration`, insert a step **after** *Check service health* and **before** *Prove init.sql matches the
  full migrated schema* (`ci.yml:316`). `karmyq-postgres-test` is initialized from `init.sql`
  (`tests/docker-compose.test.yml:24`) and nothing has replayed migrations yet:

```yaml
      # Sprint 132: reference data must survive a FRESH install (init.sql = schema-only + seed-data.sql +
      # an all-applied ledger). Runs before the replay below, which would otherwise mask a missing seed.
      - name: Prove fresh-install reference data (before migration replay)
        run: bash scripts/ci-check-fresh-install-reference-data.sh
```
  Create `scripts/ci-check-fresh-install-reference-data.sh` (`set -euo pipefail`;
  `docker exec -i karmyq-postgres-test psql -U karmyq_test -d karmyq_test -tA`). It compares the **exact**
  `slug|label|synonyms` rows of `auth.skill_vocabulary` (ordered by slug) against the expected set
  parsed from the migration file, and asserts that `public.schema_migrations` contains
  `20260930-skill-vocabulary.sql`. Exit non-zero on any difference, and print the diff but no secrets.
  Prove it can fail: on a PR commit (reverted before merge) drop one row from `seed-data.sql`'s
  vocabulary and regenerate (or edit only the check's expectation), then see the step go red in CI.
  Record the red and green run URLs in the PR's Validation.
- [ ] Run the `migration-validator` agent on the new migration and resolve its findings.
- [ ] **Verify:**

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-120-init-sql-drift-gate.test.ts; echo "exit=$?"
npm exec --workspace=services/simulation-service -- jest --runTestsByPath tests/regression/sprint-117-reset-safety.test.ts; echo "exit=$?"
```

## Task A3: auth-service — vocabulary, resolution, route removal

**Files:**
- Create: `services/auth-service/src/services/skillVocabulary.ts`
- Modify: `services/auth-service/src/routes/profileTags.ts`, `services/auth-service/src/routes/users.ts`

- [ ] `skillVocabulary.ts`:

```typescript
import { query } from '../database/db';

export function normalizeSkillText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Exact match on slug, label or synonym after normalization. No substring matching (plan note 9). */
export async function resolveSkillSlug(text: string): Promise<string | null> {
  const n = normalizeSkillText(text);
  const r = await query(
    `SELECT slug FROM auth.skill_vocabulary
      WHERE slug = replace($1, ' ', '_') OR lower(label) = $1 OR $1 = ANY (synonyms)
      LIMIT 1`,
    [n]
  );
  return r.rows[0]?.slug ?? null;
}

export async function listSkillSuggestions(): Promise<string[]> {
  const r = await query('SELECT label FROM auth.skill_vocabulary ORDER BY label ASC');
  return r.rows.map((row: { label: string }) => row.label);
}
```

- [ ] `profileTags.ts`: `GET /suggestions?tag_type=skill` → `listSkillSuggestions()`; POST resolves
  `skill_slug` only for `tag_type === 'skill'` and inserts it; both GET and POST return `skill_slug`.
  Keep the `(user_id, tag_type, tag_value)` uniqueness as it is.
- [ ] `users.ts`: delete the three `/:userId/skills` handlers (`:69-140`) and any imports they alone used.
  Grep the repo for `/skills` callers first (expected: `profile.tsx` only, removed in A5).
- [ ] **Verify:** the A1 auth test is green, and `npx tsc --noEmit -p services/auth-service` exits 0.

## Task A4: request-service — matching reads tags

**Files:**
- Modify: `services/request-service/src/routes/requests.ts`

- [ ] `getUserProfile` (`:302-329`):

```sql
SELECT COALESCE(skill_slug, lower(regexp_replace(trim(tag_value), '[^a-zA-Z0-9]+', '_', 'g'))) AS skill
  FROM auth.user_tags
 WHERE user_id = $1 AND tag_type = 'skill'
```
- [ ] `/matched/for-user` (`:262-279`): replace `auth.user_skills s … s.skill` with
  `auth.user_tags s … s.tag_type = 'skill' AND s.skill_slug` and keep the category map as it is.
- [ ] Grep that no `auth.user_skills` reference remains in `services/*/src` except the
  simulation `tablePolicy.ts` entry (the table still exists).
- [ ] **Verify:** the A1 request test is green; the whole request-service suite stays green; `tsc --noEmit` exits 0.

## Task A5: Frontend — one skills editor

**Files:**
- Modify: `apps/frontend/src/pages/profile.tsx`, `apps/frontend/src/components/ProfileTagsSection.tsx`

- [ ] Remove `AVAILABLE_SKILLS`, the `UserSkill` interface, the `skills`/`selectedSkill` state,
  `fetchUserSkills`, add/remove handlers and the picker JSX. Leave `ProfileTagsSection` as the only editor.
- [ ] `ProfileTagsSection`: carry `skill_slug` in tag state. Render a muted "matched to {label}" (or
  the slug, humanized) when present.
- [ ] **Verify:** the A1 frontend test is green; the frontend suite and `npx tsc --noEmit -p apps/frontend` are green.

## Task A6: ADR-099 + docs

**Files:**
- Create: `docs/adr/ADR-099-inventories-and-directed-requests.md`
- Modify: `docs/adr/README.md`, `scripts/generate-docs.ts` (`ADR_GROUPS`), `docs/guides/profile-guide.md`,
  `docs/guides/fulfilling-requests-guide.md`, `apps/frontend/src/lib/onboarding/workflows.ts` (only if its copy references the picker)

- [ ] ADR-099, status **Accepted**: context (split skill stores; no inventories; the `request_created`
  fan-out), decisions (spec *Core Principle*, the two predicates, fail-closed `is_directed`,
  request-service + `inventory` schema, no RLS reliance, `user_skills` deprecation), consequences, and
  alternatives rejected (a new inventory-service; community-visible borrow asks; the `user_skills` fixed list).
- [ ] Index it in `docs/adr/README.md`, add the slug to an `ADR_GROUPS` group, and regenerate landing docs (`git add -f` the new page).
- [ ] Update the guides per the spec table.
- [ ] **Verify:**

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/doc-context-drift-gate.test.ts; echo "exit=$?"
```

## Task A7: CONTEXT.md + registry + promotion

- [ ] `services/auth-service/CONTEXT.md`: remove the `/users/:userId/skills` endpoints, document
  `skill_slug` + suggestions, add the `auth.skill_vocabulary` table, and mark `auth.user_skills` deprecated.
- [ ] `services/request-service/CONTEXT.md`: skills now come from `user_tags`.
- [ ] `services/registry.json`: drop the removed auth endpoints from `apis.provides`.
- [ ] `git mv` **only** this PR's three tdd files into their workspace `tests/regression/`.
- [ ] **Verify:** `npm run feedback:check` (on staged changes) is clean or justified; `node scripts/gotcha-check.js` exits 0.

## Task A8: SDLC quality gates

- [ ] `/simplify` on the PR diff (one pass). **Verify:** edits applied or skipped with written reasons.
- [ ] `/code-review` **medium** on the branch diff. **Verify:** every correctness finding fixed or dismissed with justification.
- [ ] `/security-review` on the branch diff. **Verify:** findings resolved or justified. (The route removal closes an unauthenticated read; confirm nothing else exposes `user_tags` cross-user.)

## Task A9: Final verification

- [ ] **Verify:**

```bash
npm test; echo "exit=$?"            # unit + regression, blocking pair
git status --short                   # revert landing-docs timestamp/sha churn
npm run feedback:check
npx tsc --noEmit -p services/auth-service && npx tsc --noEmit -p services/request-service && npx tsc --noEmit -p apps/frontend; echo "exit=$?"
```

## Task A10: PR, merge, deploy, smoke

- [ ] Version bump from `origin/master` at merge time (both manifests' root version); open the PR with
  the contract headers `pr-contract.yml` requires.
- [ ] After CI is green, **ask the maintainer for merge authorization** (per PR). Use the `/deploy` skill;
  watch the CI/CD run through `DEPLOYMENT SUCCESSFUL`, with no rollback.
- [ ] **Smoke (read-only, as maria.reyes):** login 200; `GET /api/auth/profile/tags/suggestions?tag_type=skill`
  returns vocabulary labels; `GET /api/requests/curated` 200; `GET /api/users/<id>/skills` → 404.
  Adding a tag is a write, so it needs per-operation authorization or is skipped.
- [ ] Update the handoff (PR A shipped, next = PR B in a fresh chat).

---

# PR B — Inventory catalog (request-service + frontend)

Branch: `agent/claude/sprint-132-pr-b-inventory`, cut from `origin/master` **after PR A deploys**. This
PR is larger and security-relevant, so run `/code-review` at **high**.

## Task B1: TDD tests first

**Files:**
- Create: `services/request-service/tests/tdd/sprint-132-inventory-routes.test.ts`
- Create: `tests/integration/sprint-132-inventory-audience.integration.test.ts`
- Create: `apps/frontend/tests/tdd/sprint-132-inventory-ui.test.tsx`

- [ ] **Route contract (tdd).** Build the real app the way `src/index.ts` mounts it (or extract the
  mount so the test uses the same order). `GET /requests/inventory/mine` reaches the inventory handler,
  **not** `GET /requests/:id` (note 3). Test the hand-written validation's rejections (empty name, bad category, 51 share ids; note 19),
  a 401 without JWT, and that POST with `owner_community_id` for a non-admin gets 403. Mock only the DB boundary.
- [ ] **Audience truth (integration, real DB), in ROOT `tests/integration/`** (note 16: the only
  directory CI's *Integration Tests* job runs). Mirror an existing root integration test for the pool
  (`createPool()` from `tests/fixtures`) and for how it reaches the compose test services. **Guard:**
  when `process.env.CI` is set and the DB or service is unreachable, `throw` in `beforeAll`; never
  `describe.skip`. Seed users O (owner), M (member of C1), X (member of C2 only), A (admin of C1), and
  communities C1 and C2. Each case varies exactly one condition:
  1. A new personal item is visible to O only: M 404, X 404.
  2. Shared to C1: M sees it, X gets 404.
  3. O leaves C1 (status ≠ active): M gets 404; O rejoins: M sees it again (share persisted).
  4. `status='unavailable'`: M gets 404, O still sees it.
  5. A community item in C1: M sees it, X gets 404. A can PATCH, and M's PATCH gets 403.
  6. Share to C2 when O is not a member of C2: 400. Share on a community item: 400.
  7. `/community/C1` as X: 403. As M: the two sections hold the exact expected ids.
  8. A JWT whose `communities` claim says admin of C1 while the DB says member: 403 on a community-item write (live check, note 2).
  9. **An unavailable community item in C1** (spec *Item predicates*, rev 1): A (admin) sees it on
     `/community/C1` and by id; M (ordinary member) gets 404 by id and it is absent from M's
     `/community/C1`; X (outsider) gets 404. Flip it back to `available` and M sees it. Only `status` changes between the two halves.
- [ ] **Frontend (tdd).** The My-things page renders items and the empty state, and a fetch error
  falls back gracefully. Create posts the exact payload; the share checklist PUTs the exact
  `community_ids`. The community tab shows **Add community item** for an admin and hides it for a member.
- [ ] **Verify red** (as in A1). The integration test can't run locally without a DB (Windows box).
  It runs in CI's *Integration Tests* job, and under `CI` it fails rather than skips if its prerequisites are missing.

## Task B2: Migration + init.sql + reset policy + schema docs

**Files:**
- Create: `infrastructure/postgres/migrations/2026MMDD-inventory-schema.sql` (the execution date)
- Modify: `init.sql` (regenerated), `tablePolicy.ts`, `infrastructure/claude.md`, `CLAUDE.md` (+ `AGENTS.md` if it repeats the count)

- [ ] Write the DDL exactly as in the spec. **First** grep account deletion (`DELETE FROM auth.users`)
  and decide `created_by`'s `ON DELETE` (spec *Data Model*). Record the decision in ADR-099.
- [ ] `tablePolicy.ts`: add `'inventory'` to `MANAGED_SCHEMAS`; set `'inventory.items': 'reset'` and `'inventory.item_shares': 'reset'`.
- [ ] Docs: CLAUDE.md's *Database* paragraph says "12 live schemas". Make it 13 and add `inventory`;
  add an `inventory` row to `infrastructure/claude.md`'s schema table.
- [ ] Regenerate, review and promote `init.sql` exactly as in Task A2 (note 18); run `migration-validator`.
- [ ] **Verify:** the init-sql drift gate, `sprint-117-reset-safety`, and the doc drift gate are green.

## Task B3: `inventoryDb.ts` — the audience predicate and queries

**Files:**
- Create: `services/request-service/src/db/inventoryDb.ts`

- [ ] Export `itemManagerSql(alias, viewerParam)` and `itemAudienceSql(alias, viewerParam)`, returning
  the spec's *Item predicates* (rev 1). The audience **composes** the manager predicate, and a non-manager
  sees only `available` items, for community-owned **and** personal items. Every read below uses
  `itemAudienceSql`, and every write authorization uses `itemManagerSql`. No query writes its own version.
- [ ] Export `listMine(userId)`, `listForCommunity(communityId, viewerId)`, `getVisible(itemId, viewerId)`,
  `create(...)`, `update(...)`, `remove(...)`, `replaceShares(itemId, ownerId, communityIds)` (in one
  transaction: validate every id is an active membership of the owner, delete the old set, insert the new),
  and `isActiveAdmin(communityId, userId)` / `isActiveMember(...)` (live `communities.members`).
- [ ] **Verify:** `tsc --noEmit` exits 0 (behavior is proven in B4 and the integration test).

## Task B4: Routes + mount

**Files:**
- Create: `services/request-service/src/routes/inventory.ts`
- Modify: `services/request-service/src/index.ts`

- [ ] Handlers per the spec's PR B table, with **hand-written** validation in the style of the existing
  request-service routes (no zod: it isn't declared, note 19) and the ADR-074 envelope. Return 404, not 403,
  for items outside the audience, and 403 only for "you can see it but can't change it" and for a non-member on `/community/:id`.
- [ ] Mount it in `index.ts` **before** the `requestsRouter` block, with the same chain as `/requests/feed`:
  `app.use('/requests/inventory', rateLimiters.standard, authMiddleware, optionalTenantMiddleware, dbContextMiddleware(pool), inventoryRouter)`.
- [ ] **Verify:** the B1 route tdd test is green; the full request-service suite stays green.

## Task B5: Frontend — api client + My things page

**Files:**
- Modify: `apps/frontend/src/lib/api.ts`, `apps/frontend/src/components/Layout.tsx`, `apps/frontend/src/lib/onboarding/workflows.ts`
- Create: `apps/frontend/src/pages/inventory/index.tsx`

- [ ] `inventoryService` on the request-service client. Remember that the interceptor unwraps the
  envelope: use `res.data`, never `res.data.data`.
- [ ] Page: list, add/edit form (category/condition selects use the spec vocabularies), an available
  toggle, a *Share with…* checklist from the user's communities (fetch them through the existing
  community API, noting that `getMyCommunities` returns `{communities,count,total}`), and the private-by-default empty state.
- [ ] A nav entry and an onboarding step.
- [ ] **Verify:** the B1 frontend page tests are green; `tsc --noEmit` exits 0.

## Task B6: Frontend — community "Shared things" tab

**Files:**
- Create: `apps/frontend/src/components/community/tabs/InventoryTab.tsx`
- Modify: `apps/frontend/src/pages/communities/[id].tsx`

- [ ] Two sections from `/requests/inventory/community/:id`, and an admin-only **Add community item**
  that posts with `owner_community_id`. Follow the existing tab patterns (`BrowseTab`/`ActiveTab`) for
  layout and loading/error states.
- [ ] **Verify:** the B1 tab tests are green (shown for admin, hidden for member).

## Task B7: Docs + ADR amendment

- [ ] Create `docs/guides/sharing-your-things-guide.md` and `docs/concepts/inventories.md`. Add the slugs to
  `GUIDE_ORDER`, and to `CONCEPT_ORDER` **and** `howItWorks`, in `scripts/generate-docs.ts`. Regenerate, and `git add -f` the new pages.
- [ ] Add a "Community-owned items" section to `community-admin-guide.md`.
- [ ] ADR-099: an implementation note for PR B (`created_by` decision, mount order, 404-vs-403 rule).
- [ ] **Verify:** the doc drift gate is green.

## Task B8: CONTEXT.md + registry + promotion

- [ ] request-service `CONTEXT.md`: the endpoints table, the `inventory` schema, the audience rule, and the mount-order warning.
- [ ] `services/registry.json`: the request-service `apis.provides` gains the seven inventory routes, and the `inventory` schema is listed where schemas are.
- [ ] `npm run analyze:services` only if dependencies changed (they shouldn't).
- [ ] `git mv` only this PR's tdd files to `regression/`. The integration test lives in root `tests/integration/` and is not promoted.
- [ ] **Verify:** `npm run feedback:check` (staged) is clean or justified.

## Task B9: SDLC quality gates

- [ ] `/simplify` on the PR diff. **Verify:** applied or skipped with reasons.
- [ ] `/code-review` **high** on the branch diff. **Verify:** correctness findings are resolved. Pay particular attention to any read path that skips `itemAudienceSql`.
- [ ] `/security-review` on the branch diff. **Verify:** findings are resolved or justified. Explicitly confirm: no claim-based authorization, no existence leak (404s), share validation is live, the hand-written validation bounds hold, and an unavailable community item is invisible to non-admins.

## Task B10: Final verification

- [ ] Same commands as A9, plus the integration test in CI. Read the **`Integration Tests`** job log
  (`ci.yml` `test-integration`, step *Run integration tests*; **not** `Test Backend Services`, which
  runs only unit and regression) and confirm `sprint-132-inventory-audience.integration.test.ts` is
  listed, **ran** (not skipped) and passed (note 16).

## Task B11: PR, merge, deploy, smoke

- [ ] Version bump at merge time; PR; CI green. Expect the CodeQL `js/request-forgery` FP on `api.ts`
  and surface it for UI dismissal before merge. **Maintainer merge authorization.** `/deploy`; wait for `DEPLOYMENT SUCCESSFUL`.
- [ ] **Smoke (read-only):** login; `GET /api/requests/inventory/mine` → 200 `{items: []}` (proves the
  mount order in the real image); `GET /api/requests/inventory/community/<maria's community>` → 200;
  `GET /api/requests/inventory/items/<random uuid>` → 404; `GET /api/requests` still 200. Creating an item is
  a demo write, so it needs per-operation authorization.
- [ ] Update the handoff (PR B shipped, next = PR C in a fresh chat).

---

# PR C — Directed "Ask to borrow" (request + notification + community + frontend)

Branch: `agent/claude/sprint-132-pr-c-directed-borrow`, cut from `origin/master` **after PR B deploys**.
It changes reachability, so run `/code-review` at **high** and use a fresh non-author reviewer before merge.

## Task C1: TDD tests first

**Files:**
- Create: `services/request-service/tests/tdd/sprint-132-directed-audience-gate.test.ts`
- Create: `services/request-service/tests/tdd/sprint-132-directed-borrow.test.ts`
- Create: `tests/integration/sprint-132-directed-audience.integration.test.ts`
- Create: `services/notification-service/tests/tdd/sprint-132-directed-request-notify.test.ts`
- Create: `apps/frontend/tests/tdd/sprint-132-ask-to-borrow.test.tsx`
- Create: `services/request-service/tests/tdd/sprint-132-incoming-asks.test.ts`

- [ ] **Gate (live scan).** Walk `services/*/src/**/*.ts` with `fs` (not `git ls-files` with a bare `**`;
  see the `git-pathspec-double-star-needs-glob-magic` gotcha) and collect every SQL string or template
  containing `help_requests`. Each hit must either contain one of the two marker comments
  (`/* not-directed */` from `notDirectedSql`, `/* directed-audience */` from `directedAudienceSql`), or match an `ALLOWLIST` entry `{file, needle, reason}` whose `needle` still occurs (**a stale
  allowlist entry fails**). Negative fixture: an in-memory file with an unguarded
  `SELECT … FROM requests.help_requests r WHERE …` must be reported. A count floor is not enough: assert
  the exact reported file on the fixture. The gate can't see notifications or messages (other tables);
  the caller-scope tests below cover those.
- [ ] **Borrow endpoint (tdd, DB boundary mocked).** 201 creates the row with `is_directed=true`, the
  right target, `inventory_item_id`, `request_type='borrow'`, `payload.item_category` = item category,
  and one `request_communities` row; it publishes `directed_request_created` with the exact
  `recipient_user_ids`, and **`request_created` is never published** (assert on the publisher mock).
  400 on your own item, 400 on an `unavailable` item, 404 if the item isn't in your audience **via `community_id`**.
  `POST /requests` with `is_directed`/`directed_to_user_id`/`inventory_item_id` → 400.
- [ ] **Audience per surface (integration, real DB, ROOT `tests/integration/`, fail-not-skip under `CI`; note 16).**
  Users R (requester), O (owner), M (third member of the same community), A (admin); a personal item of O
  shared to C1; R asks to borrow. **Browse surfaces** (spec *Surfaces*, kind = browse): the ask is absent
  for **R, O and M alike**. In particular, **O's own** `/requests/feed`, `/requests/curated` and
  `/community/C1/open-asks` don't contain it (note 17). **Private-access surfaces:** R and O reach it
  (detail, R's own requests, O's Helping inbox *selects* it), and M doesn't. `GET /requests/:id` as M → 404. `POST /matches` as M → 403 `NOT_IN_AUDIENCE`, and as O → 201.
  Complete the match and check that the `match_completed` flow is unchanged (karma recorded as for any match).
  **Fail-closed:** set `directed_to_user_id = NULL`, and M still gets 404 while R still sees it.
  A community item: A sees the ask, and a non-admin member of the owning community doesn't.
- [ ] **Notification (tdd).** The `directed_request_created` handler inserts notifications for exactly
  `recipient_user_ids` and runs **no** `communities.members` fan-out query.
- [ ] **`GET /requests` with `requester_id` (tdd, note 20).** As R: `?requester_id=R` → R's directed ask **included**;
  no `requester_id` → **excluded**; `?requester_id=O` (another user) → O's directed asks **excluded** and
  R's never present. Exact id sets.
- [ ] **Incoming asks (tdd + integration, note 21).** O's `GET /requests/inventory/asks/incoming` lists R's ask;
  M's and R's don't. O offers (`POST /matches`) → the ask **leaves** O's incoming list and **appears** in
  O's `GET /matches`. For a community item: A (admin) sees it in incoming; an ordinary member doesn't.
- [ ] **(Moved to PR S in rev 2; kept for the record.) Notification caller scope (tdd, BUG-055; note 14).** Through the real router with `authMiddleware`,
  for each of `GET /:userId`, `GET /:userId/unread-count`, `PUT /:userId/read-all`, `GET/PUT /:userId/preferences`:
  another user's id in the URL → 403, and the caller's own id → 200. For `PUT /:notificationId/read`
  and `DELETE /:notificationId`: a body `user_id` naming the notification's owner, sent by a different
  caller, → 404 (the body is ignored; ownership comes from the JWT). No body `user_id` → works for the owner.
- [ ] **(Participant scoping moved to PR S in rev 2; PR C keeps only the directed half.) Match participant scope (tdd, BUG-057; note 14).** `GET /matches` with **no filters** as an
  unrelated user → only that user's own matches (an exact id set, not a count). `?user_id=<someone else>`
  → ignored/403, never their rows. `GET /matches/:id` as an unrelated user → 404, and as requester,
  responder or offerer → 200. For a directed ask's match, an unrelated community member → 404.
- [ ] **Frontend (tdd).** The Ask-to-borrow button is hidden on your own item and on an unavailable one, and
  shown otherwise. Submit posts the exact body. The request detail shows the "Private request to …" banner when `is_directed`.
- [ ] **Verify red.**

## Task C2: Migration

- [ ] `infrastructure/postgres/migrations/2026MMDD-directed-requests.sql` per the spec. Regenerate, review and promote `init.sql` as in Task A2 (note 18), run `migration-validator`, and check that the drift gate is green.

## Task C3: `directedAudience.ts` + reachability

**Files:**
- Create: `services/request-service/src/db/directedAudience.ts`
- Modify: `services/request-service/src/db/eligibility.ts`

- [ ] Export **two** fragments (spec rev 1): `notDirectedSql(alias)` → `/* not-directed */ NOT <alias>.is_directed`
  for **browse** surfaces, and `directedAudienceSql(alias, viewerParam)` → `/* directed-audience */ …` for
  **private-access** surfaces. The marker comments are what the gate looks for.
- [ ] `getRequestReachability`: select `is_directed` and the audience boolean. When the request is directed,
  `reachable` equals **audience membership minus the requester** (the requester can't offer on their own
  ask), and none of the community/sister/wide-scope reasons apply. Add `'directed'` to the `reachability` union.
- [ ] **Verify:** the existing `eligibility` tests are unchanged and green, and new cases pass.

## Task C4: Apply the predicate on every surface

- [ ] Re-run the **untruncated** grep (`grep -rn "help_requests" services/*/src`), and write the full
  classification into the plan's Execution notes (file:line, surface, treatment, reason).
- [ ] Classify each surface as **browse** or **private access** (spec *Surfaces*; if unsure, browse). Apply
  `notDirectedSql` to browse surfaces (feed, curated, open-asks, pulse, matched, dibs, admin lists) and
  `directedAudienceSql` to private-access ones. `GET /requests/:id` checks the audience **before** building
  the response. Admin actions 404 on directed requests. Check whether `GET /requests` doubles as the
  requester's own list; if it does, only that branch is private access.
- [ ] `community-service` `stats.ts`/`export.ts`: exclude directed rows from lists. Decide the counts and record the decision in ADR-099.
- [ ] Fill the gate's `ALLOWLIST` for true non-listings (karma, expiry, retention, paths, message joins), each with a reason.
- [ ] **Verify:** the gate is green; **inject** an unguarded query into a committed tree, see red, and restore from the byte copy.

## Task C4b: Directed predicate on match views (rev 2: the caller/participant scoping itself shipped in PR S)

- [ ] Precondition: PR S is merged and deployed. **Verify** on master that `notifications.ts` and
  `matches.ts` carry the PR S scoping; if not, stop.
- [ ] Add `directedAudienceSql` to `GET /matches` and `GET /matches/:id` on top of PR S's participant
  predicate. Test: an unrelated member → the directed ask's match is absent, and `/:id` → 404.

<details><summary>Superseded rev 1 text (for the record)</summary>

## (rev 1) Task C4b: Close the existing read holes (BUG-055, BUG-057)

**Files:**
- Modify: `services/notification-service/src/routes/notifications.ts`, `services/request-service/src/routes/matches.ts`

- [ ] Notifications: every `/:userId` route compares `req.params.userId` with the JWT `userId` and returns 403
  on a mismatch (copy the SSE route's existing check, `notifications.ts:19-35`). `PUT /:notificationId/read`
  and `DELETE /:notificationId` take the owner from the JWT and **ignore** any body `user_id`. Update
  `apps/frontend/src/lib/api.ts:648-655` to stop sending `user_id` (harmless if left, but dead).
- [ ] Matches: `GET /` always constrains rows to the caller as requester, responder or offerer (the JWT
  `userId`; a query `user_id` that differs is ignored), plus `directedAudienceSql`. `GET /:id` returns 404
  unless the caller is a participant.
- [ ] Mark BUG-055 and BUG-057 fixed in `docs/BUGS.md`, with the mechanism and the test names.
- [ ] **Verify:** the C1 caller-scope and participant-scope tests are green; the notification-service and request-service suites are green.

</details>

## Task C5: Borrow endpoint + event

**Files:**
- Modify: `services/request-service/src/routes/inventory.ts`, `services/request-service/src/routes/requests.ts` (`POST /` rejection)

- [ ] `POST /requests/inventory/items/:id/borrow` per the spec, in one transaction. Resolve recipients
  live (the owner, or the active admins of the owning community) and publish `directed_request_created` after commit.
- [ ] **Verify:** the C1 borrow tdd test is green.

## Task C5b: Incoming-asks query (rev 2, note 21)

- [ ] `inventoryDb.ts`: `listIncomingAsks(viewerId)` (open, unexpired, `is_directed`, `directedAudienceSql`,
  `requester_id <> viewer`, and `NOT EXISTS` a `proposed`/`matched` match by the viewer), plus the route
  `GET /requests/inventory/asks/incoming` in `routes/inventory.ts`, carrying the gate's marker.
- [ ] `GET /requests` (`queryBuilder.ts:87-91`): when `requester_id` equals the JWT caller, use
  `directedAudienceSql` (keeping the requester filter); otherwise `notDirectedSql` (note 20).
- [ ] **Verify:** the C1 incoming and `requester_id` tests are green.

## Task C6: Notification subscriber

- [ ] `eventQueue.process('directed_request_created', …)`: insert one notification per recipient
  (type/title copy: "{requester} asked to borrow your {item}"), and add nothing to the `request_created` path.
- [ ] **Verify:** the C1 notification test is green, and the notification-service suite is green.

## Task C7: Frontend — Ask to borrow

- [ ] `api.ts`: `inventoryService.askToBorrow(itemId, body)`. Put the button + compact form on item cards
  (community tab and item view), then navigate to `/requests/<id>`.
- [ ] Request detail: a "Private request to …" banner from `directed_to`.
- [ ] Helping tab (rev 2, traced): `CommitmentsTab.tsx` builds from `GET /matches` (`:165`) plus the curated
  decision band (`:147-149`), so an unanswered ask can't appear there. Add an **"Asked of you"** section
  fed by `inventoryService.incomingAsks()`, rendered before any offer exists, with an **Offer** button
  (`POST /matches`). After the offer, refetch both lists: the ask leaves the section and shows as a commitment.
  Frontend tests: the section renders the asks, the empty state, and graceful error fallback; Offer posts the
  exact payload; the transition after offer is covered.
- [ ] **Verify:** the C1 frontend test is green; `tsc --noEmit` exits 0.

## Task C8: Docs + ADR

- [ ] The sharing guide gets "Asking to borrow"; `making-requests-guide.md` covers general vs directed borrow; the concept page gets directed requests + fail-closed.
- [ ] ADR-099: an amendment for PR C (the surfaces classification summary, the stats/export count decision, the event).
- [ ] **Verify:** the doc drift gate is green.

## Task C9: CONTEXT.md + registry + promotion

- [ ] request-service, notification-service and community-service `CONTEXT.md`; `services/registry.json`
  events: `directed_request_created` (publisher request-service → subscriber notification-service) and the new route.
- [ ] `npm run analyze:services` (the event graph changed).
- [ ] `git mv` only this PR's tdd files to `regression/`.
- [ ] **Verify:** `npm run feedback:check` (staged) is clean or justified.

## Task C10: SDLC quality gates

- [ ] `/simplify` on the PR diff. **Verify:** applied or skipped with reasons.
- [ ] `/code-review` **high** on the branch diff. **Verify:** correctness findings are resolved.
- [ ] `/security-review` on the branch diff. **Verify:** findings are resolved or justified. Explicitly cover the
  BUG-055/BUG-057 caller scoping (notifications, match views), browse-vs-private classification, the
  audience predicate on every surface, the fail-closed null target, the event recipients, no title leak, and the `POST /requests` field rejection.
- [ ] A fresh non-author whole-branch review (maintainer-relayed), because reachability changed.

## Task C11: Final verification

- [ ] Same as A9. In the **`Integration Tests`** job log (not `Test Backend Services`), confirm that **both**
  `tests/integration/sprint-132-*.integration.test.ts` files ran (not skipped) and passed (note 16).

## Task C12: PR, merge, deploy, smoke

- [ ] Version bump at merge time; PR; CI green; the CodeQL `api.ts` FP surfaced; **maintainer merge authorization**; `/deploy`.
- [ ] **Smoke:** the read-only four-endpoint smoke. A live directed-borrow round trip needs two demo
  accounts and writes rows, so it needs **explicit per-operation authorization**. If authorized: O's item
  shared to C1, R asks, M's `GET /api/requests/<id>` → 404, O sees the notification, and cleanup
  follows what the maintainer approves.
- [ ] ADR-099 → **Implemented**. Archive the sprint handoff, and capture Sprint 133 candidates in `docs/IDEAS.md`.
