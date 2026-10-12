# Sprint 133 — Skills Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
>
> **Four PRs, in order: S → A → B → D.** Run **one PR section per fresh chat**. Don't start a section
> until the previous PR is merged **and** its deploy and health verify are green. **Nothing here starts
> until the Sprint 132 closeout has shipped** (advisory fix, BUG-061 PR; see Task S0).

**Goal:** Members can see the skills of people they share a community with, search their community
for a skill, and vouch for a skill of someone they completed a match with. Vouches feed the trust
graph, and a security PR first closes BUG-056, BUG-062 and BUG-058.

**Architecture:** auth-service gains one live-membership skill-visibility predicate, the
`/auth/skills` routes and an `auth.skill_endorsements` table. social-graph recomputes a pair's
`endorsement_count` from source rows on a `skill_endorsement_changed` event, whose transport is
chosen after BUG-060 is reproduced.

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture*. Do not restate version numbers here — a pinned example goes stale and then gets copied into specs.

**Spec:** [`docs/superpowers/specs/2026-10-08-sprint-133-skills-depth-design.md`](../specs/2026-10-08-sprint-133-skills-depth-design.md)
(read it first; its *New Concepts*, *API Endpoints* and *Critical Implementation Notes* are normative).
**ADR:** **ADR-100**, allocated by the maintainer 2026-10-08.

> **Rev 1 (2026-10-08, maintainer review; each finding verified against the repo).** (1) Job ids use a
> monotonic `revision`, not a millisecond timestamp, which can collide (note 8). (2) Reconcile and the
> `match_completed` edge path are serialized by a pair advisory lock, and `raw_weight` is computed in-statement.
> Concurrency tests cover an older reconcile overlapping a withdrawal and a concurrent completion (note 6, Task B2/B5).
> (3) The BUG-060 reproduction uses `request_created`, which is actually handled, because `user_joined_community`
> has no handler. One clean run cannot refute competition (note 7, Task B1).

---

## File Map

### New files to create
| File | PR | Responsibility |
|------|----|---------------|
| `services/request-service/tests/tdd/sprint-133-request-detail-visibility.test.ts` | S | BUG-056 route tests |
| `services/auth-service/tests/tdd/sprint-133-user-profile-email.test.ts` | S | BUG-062: `/users/:userId` auth + self-only email |
| `services/community-service/tests/tdd/sprint-133-member-email-admin-only.test.ts` | S | BUG-062: community detail + members list |
| `tests/integration/sprint-133-request-detail-visibility.integration.test.ts` | S | Real SQL for BUG-056 (directed stays strict) |
| `infrastructure/postgres/migrations/20261008-skill-visibility.sql` | A | Opt-out column, slug index, drop `auth.user_skills` |
| `services/auth-service/src/db/skillVisibility.ts` | A | `skillVisibleToSql`, `activeMemberSql` (the one predicate) |
| `services/auth-service/src/routes/skills.ts` | A, B | `/auth/skills/*` routes |
| `services/auth-service/tests/tdd/sprint-133-skill-visibility.test.ts` | A | Route + predicate tests |
| `services/auth-service/tests/tdd/sprint-133-settings-route-order.test.ts` | A | `/users/me/settings` reaches its handler (guard; the route was never shadowed — note 14) |
| `apps/frontend/src/components/skills/MemberSkills.tsx` | A, B | Member skill list (+ vouch in B) |
| `apps/frontend/src/components/skills/FindASkillPanel.tsx` | A | Directory chips + search in People tab |
| `apps/frontend/tests/tdd/sprint-133-skills-discovery.test.tsx` | A | UI tests |
| `tests/integration/sprint-133-skill-visibility.integration.test.ts` | A | Real SQL: co-member, opt-out, pending, other community |
| `docs/adr/ADR-100-skill-visibility-and-endorsements.md` | A (B amends) | Decision record |
| `tests/integration/sprint-133-bug-060-shared-queue.integration.test.ts` | B | BUG-060 reproduction (real Redis) |
| `infrastructure/postgres/migrations/<date>-skill-endorsements.sql` | B | `auth.skill_endorsements` |
| `services/auth-service/src/events/endorsementEvents.ts` | B | Publish `skill_endorsement_changed` (transport per B1) |
| `services/social-graph-service/src/services/endorsementReconcile.ts` | B | Idempotent pair reconcile |
| `services/auth-service/tests/tdd/sprint-133-endorsements.test.ts` | B | Endorse/withdraw/eligibility routes |
| `services/social-graph-service/tests/tdd/sprint-133-endorsement-reconcile.test.ts` | B | Reconcile math |
| `tests/integration/sprint-133-endorsements.integration.test.ts` | B | Real SQL + queue end-to-end |
| `scripts/reconcile-endorsement-edges.js` | B | Operator backfill (dry-run default) |
| `docs/concepts/skill-endorsements.md` | B | Concept page |
| `services/simulation-service/tests/tdd/sprint-133-demo-skills-seed.test.ts` | D | Seed shape + count parity |

### Existing files to modify
| File | PR | Change |
|------|----|--------|
| `services/request-service/src/routes/requests.ts` | S, A | `GET /:id` gate + drop `requester_email` (S); delete `/matched/for-user` (A) |
| `services/auth-service/src/routes/users.ts` | S, A | auth + self-only email (S); skills setting (A) |
| `services/auth-service/src/index.ts` | S, A | `authMiddleware` for `/users` GET (S); mount `/auth/skills` (A) |
| `services/community-service/src/routes/communities.ts`, `routes/members.ts` | S | Email only for live admin/self; non-admin `status` restricted |
| `apps/frontend/src/components/community/tabs/ActiveTab.tsx`, `community/StewardRequestsAdmin.tsx` | S | Tolerate missing `user_email` |
| `scripts/audit-exemptions.js`, `security/audit-exemptions.json` (`$comment`) | S | Cap 7 (BUG-058) |
| `.github/workflows/image-size-advisory-watch.yml`, `scripts/check-image-size-upstream.js`, `tests/regression/sprint-125-image-size-monitor.test.ts` | S | Delete (monitor retired) |
| `tests/regression/sprint-123-audit-exemption-gate.test.ts` | S | `MAX_EXEMPTION_DAYS` expectation 30 → 7 |
| `docs/adr/ADR-059-dependency-security-gate.md` | S | Amendment |
| `services/auth-service/src/routes/profileTags.ts` | B | Tag delete publishes endorsement changes |
| `services/social-graph-service/src/events/subscriber.ts`, `src/database/trustEdgeDb.ts` | B | Consume event; `withPairLock` + in-place `raw_weight` recompute on both edge-write paths |
| `services/simulation-service/src/fixtures/curatedDemo/tablePolicy.ts` | A, B | Remove `auth.user_skills`; add `auth.skill_endorsements` |
| `services/simulation-service/src/fixtures/curatedDemo/{types,manifest,compiler,baselineWriter,verifier}.ts` | D | Skills, items, endorsements in the curated baseline |
| `apps/frontend/src/pages/profile.tsx`, `src/pages/communities/[id].tsx` (People tab), `src/pages/matches/[id].tsx`, `src/lib/api.ts`, `src/lib/onboarding/workflows.ts` | A, B | UI |
| `infrastructure/postgres/init.sql` | A, B | **Regenerated only** (note 12) |
| `services/registry.json`, service `CONTEXT.md`s, `docs/BUGS.md`, `docs/IDEAS.md`, guides, `scripts/generate-docs.ts`, `docs/adr/README.md` | all | Docs feedback loop |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

Copied verbatim from the spec.

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
   endorsement whose `match_id`'s request is in that community (`requests.request_communities`). It
   must **not** call `upsertTrustEdge` (which does `+ 1` and grows `stability`). Reconcile does not
   change `stability`; it sets `last_interaction_at = now()` only when the count increased; it inserts
   an edge only when the count is > 0 and the edge is missing. The pair count (0–2) measures mutual
   vouching; per-skill counts on the profile keep the detail. Proofs: (a) the same event delivered 3×
   leaves the count at 1; (b) endorse → withdraw → re-endorse gives 1, 0, 1; (c) five skills vouched
   by one endorser give 1; (d) both directions give 2; (e) deleting the endorsed tag (cascade)
   followed by its event gives 0 and `raw_weight` drops by exactly the endorsement weight.

   **Serialization (maintainer review, 2026-10-08).** Each reconcile runs in **one transaction** that
   (1) takes `pg_advisory_xact_lock` on a key derived from the normalized pair
   (`hashtextextended('trust-pair:' || user_id_a || ':' || user_id_b, 0)`), (2) reads the source rows,
   (3) `SELECT … FOR UPDATE`s the pair's edge rows, and (4) writes them. The `match_completed` edge
   path (`upsertTrustEdge`, `trustEdgeDb.ts:117-181`) takes the **same** pair lock in its own
   transaction. **`raw_weight` is computed inside the `UPDATE` statement from the row's current
   columns** (`SET raw_weight = match_completed_count * $w1 + endorsement_count * $w2 + …`), on both
   paths. Today `upsertTrustEdge` reads the counts and writes `raw_weight` in separate statements, so
   a reconcile that commits between them would be overwritten with the stale endorsement count.
   Weights still come from `getInteractionWeightsForCommunity` (`trustEdgeDb.ts:106`).
   `upsertTrustEdge` keeps its observable result: its existing tests stay green. **Concurrency tests
   (real Postgres, two clients, a barrier hook between read and write):**
   (f) an **older** reconcile reads "active", a withdrawal commits and its reconcile starts, then the
   older one is released; the final count is 0, never 1; (g) a `match_completed` edge update runs
   while a reconcile holds the lock; the final row has the incremented `match_completed_count`, the
   reconciled `endorsement_count`, and `raw_weight` equal to the formula over the final columns.
7. **Reproduce BUG-060 before choosing the transport (Task B1).** Use an event that **is** handled,
   by exactly one service: **`request_created`**, which only notification-service processes
   (`services/notification-service/src/events/subscriber.ts:176`). Reputation-service
   (`subscriber.ts:137-141`) and social-graph-service (`subscriber.ts:84`) attach workers to the same
   `karmyq-events` queue without that name. (`user_joined_community` has no handler anywhere in the
   checked source, so it cannot show competition.) The root integration test runs the real
   subscribers of all three services, asserts that each queue worker is attached before publishing
   (`queue.getWorkers()` / client list), publishes **N ≥ 50** jobs, and records each job's final state
   and the error text. **Decision rule:** any job that fails with a missing-handler error, or never
   reaches the notification handler, **confirms** competition. Successful delivery in one run
   **cannot refute** it. "Not reproduced" is possible only together with a mechanism trace from the
   installed Bull source (`node_modules/bull/lib`, not docs or changelogs) showing that a worker with
   named processors cannot take a job of another name. Without both, treat competition as possible.
   **Transport:** a dedicated queue (`karmyq-skill-endorsement-social-graph`, following
   `services/request-service/src/events/completionEvents.ts`) unless B1 produces that mechanism proof.
   Update BUG-060 with the evidence either way and record it in ADR-100. No other event's transport
   changes in this sprint.
8. **Job IDs are per change and collision-free.** Completion uses a stable `jobId` per match
   (`completionEvents.ts:28-31`) with `removeOnComplete: { age: 86400 }`, so a second add with the
   same id inside 24 h is silently dropped. A pair-stable id would drop a withdrawal's reconcile, and a
   timestamp-based id can collide when two changes share a millisecond. **Use a monotonic revision.**
   `auth.skill_endorsements.revision bigint NOT NULL DEFAULT 1` is incremented
   (`revision = revision + 1`) by the same `UPDATE`/upsert that changes state, under that row's lock.
   The id comes from `RETURNING`: `endorsement-<row id>-r<revision>`. A tag-deletion cascade uses
   `endorsement-<row id>-deleted` (a row is deleted once). **A retry of the same change reuses that
   change's id**, so Bull dedupes retries and never distinct changes. Test: two changes in one
   millisecond (frozen clock) produce two distinct ids; re-publishing one change reuses its id.
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
14. **Route order — corrected 2026-10-11.** `/me/settings` is **not** shadowed: a real-router probe returned 200 from the settings handler on both the base and PR S heads (2026-10-11): `/:userId` matches one path segment, so it cannot capture `/me/settings`. Do
    not present a reorder as a fix. Keep a real-router test that `GET /users/me/settings` reaches the
    settings handler, as a guard only. New skills routes are mounted at `/auth/skills` in
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

**Standing:** read `tests/claude.md` before placing any test; read each touched service's
`.claude/README.md` + `CONTEXT.md`; run `node scripts/gotcha-check.js --for <paths>` before editing.
Windows: Node for HTTP/JSON probes, no local Docker; `| tail` masks exit codes.

---

# PR S — Security: BUG-056, BUG-062, BUG-058

Branch: `agent/claude/sprint-133-pr-s-security`, cut from `origin/master` after the Sprint 132 closeout
deploys. Merge `feature/sprint-133-skills-depth` into it (planning docs ride with PR S). Run
`/code-review` at **high** (authorization changes across three services + a security gate).

## Task S0: Precondition check

- [ ] `git fetch origin && gh pr list --state all --limit 10`: the BUG-061 PR and the advisory-fix PR
  are **MERGED** and their CI/CD runs ended `DEPLOYMENT SUCCESSFUL`; the Sprint 132 handoff is archived.
  If not, stop and finish the closeout first.
- [ ] Re-check the BUG-056 deadline (2026-10-14) and BUG-058 (2026-10-15). If PR S cannot merge by
  then, write a dated risk acceptance in `docs/BUGS.md` for the maintainer to approve.

```bash
git switch -c agent/claude/sprint-133-pr-s-security origin/master
git merge --no-ff feature/sprint-133-skills-depth
```

## Task S1: TDD tests first

**Files:** the three workspace `tests/tdd/sprint-133-*` files and the root integration file in the File Map.

- [ ] **Request detail (BUG-056)**, supertest on the real router with `query` mocked only at the DB
  boundary: the SQL still contains `/* directed-audience */`; a non-directed request with
  `getRequestReachability` → `reachable:false`, no own/match → **404**; own → 200; match responder
  (any status, including `completed`) → 200; reachable → 200; the response never contains
  `requester_email`.
- [ ] **Root integration (real SQL):** community-scope request: same-community member 200,
  other-community user 404; `platform` scope: any user 200; directed ask: same-community
  non-audience member **404** (note 2), owner 200; completed-match helper removed from the community → 200.
- [ ] **Users (BUG-062):** anonymous `GET /users/:id` → 401; another user → 200 **without** `email`;
  self → 200 with `email`.
- [ ] **Community (BUG-062):** `GET /communities/:id` and `/:id/members` as a live admin → rows include
  `user_email`; as a plain member and as a non-member → no `user_email` key on any row except the
  caller's own; non-admin `?status=pending` → 403; admin `?status=pending` → 200. The admin check
  must come from a live `communities.members` query (assert a JWT claiming admin without a DB admin
  row gets no emails).
- [ ] **BUG-058:** in `tests/regression/sprint-123-audit-exemption-gate.test.ts` change the expectation to
  `MAX_EXEMPTION_DAYS === 7` and add 7-day accepted / 8-day rejected cases derived from the constant.
- [ ] **Verify red** for the right reason:

```bash
npm exec --workspace=services/request-service -- jest tests/tdd/sprint-133 ; echo "exit=$?"
npm exec --workspace=services/auth-service -- jest tests/tdd/sprint-133 ; echo "exit=$?"
npm exec --workspace=services/community-service -- jest tests/tdd/sprint-133 ; echo "exit=$?"
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-123-audit-exemption-gate.test.ts ; echo "exit=$?"
```

## Task S2: Request detail gate (BUG-056)

- [ ] In `services/request-service/src/routes/requests.ts` `GET /:id`: remove `u.email as requester_email`
  (select + `GROUP BY`). Keep the `directedAudienceSql` WHERE. Add a lateral/EXISTS
  `viewer_any_match` (any status, `responder_id = $2`). After the row loads, compute
  `allowed = isOwn || viewerAnyMatch || row.is_directed || (await getRequestReachability(id, userId)).reachable`
  (directed rows already passed the stricter SQL predicate, so `row.is_directed` is allowed here). If not
  allowed, return the **same** 404 body as "not found". Reuse a single reachability call for both the
  gate and `viewer_relation`.
- [ ] Grep every in-repo consumer of `requester_email` (`apps/`, `services/`, mobile) and remove reads.
- [ ] **Verify:** S1 request tests green; `npx tsc --noEmit -p services/request-service; echo "exit=$?"`.

## Task S3: Member email (BUG-062)

- [ ] `services/auth-service/src/index.ts:59` / `routes/users.ts`: `GET /:userId` gets `authMiddleware`;
  select `email` only when `userId === req.user.userId` (two queries or a conditional projection).
- [ ] `services/community-service/src/routes/communities.ts:~318-350` and `routes/members.ts:19-53`:
  look up the caller's live role (`communities.members`, `status='active'`); include `user_email` only for
  admins (or the caller's own row); restrict non-admin `status` to `active` (403 otherwise).
- [ ] Frontend: `ActiveTab.tsx:134,233` and `StewardRequestsAdmin.tsx:558` use `member.user_email ?? ''`
  (types: make `user_email` optional).
- [ ] Run the untruncated `.email` grep (note 3); classify every hit in the PR body; log any new class.
- [ ] **Verify:** S1 users/community tests green; `tsc --noEmit` for auth, community and frontend.

## Task S4: Exemption cap back to 7 (BUG-058)

- [ ] Read `docs/gotchas/adr-059-cannot-tell-no-answer-from-no-advisories.md`.
- [ ] `scripts/audit-exemptions.js:58` → `7`; update its header comment (`:15`) and
  `security/audit-exemptions.json` `$comment`.
- [ ] `grep -rn "image-size-advisory-watch\|check-image-size-upstream\|sprint-125-image-size-monitor" --exclude-dir=node_modules .`;
  classify every hit. Delete the workflow, the script and the monitor test; edit live references (not
  archives or generated landing docs; regenerate those).
- [ ] ADR-059 amendment "Cap restored to 7 days (Sprint 133, BUG-058)"; BUG-058 → fixed. Close issue #236
  with a link to the PR **after** merge.
- [ ] **Verify (can still fail):** temporarily set an exemption's `expires` to `created + 8 days` on a
  committed tree; `npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-123-audit-exemption-gate.test.ts`
  is red; restore from a byte copy; green.

## Task S5: Docs

- [ ] `docs/BUGS.md`: BUG-056 fixed (rule, tests), BUG-062 logged **and** fixed (all three endpoints plus the
  side bug noted for PR A), BUG-058 fixed.
- [ ] request, auth, community `CONTEXT.md` (auth contract per route, Recent Fixes); `services/registry.json` notes.
- [ ] `docs/guides/community-admin-guide.md`: member emails are visible to admins only.

## Task S6: SDLC quality gates

- [ ] `/simplify` on the PR diff. **Verify:** edits applied or skipped with written reasons.
- [ ] `/code-review` **high**. **Verify:** every correctness finding fixed or dismissed with justification.
- [ ] `/security-review`. **Verify:** findings resolved or justified; confirm no other route returns another member's email.

## Task S7: Final verification

```bash
npm test; echo "exit=$?"
git status --short          # revert landing-docs timestamp/sha churn
npm run feedback:check
for p in services/request-service services/auth-service services/community-service apps/frontend; do npx tsc --noEmit -p $p || echo "TSC FAIL $p"; done
```

- [ ] Promote the green TDD files to each workspace's `tests/regression/` (`git mv`); restore any unrelated
  files the promoter swept.

## Task S8: PR, merge, deploy, smoke

- [ ] Version bump from `origin/master` at merge time; PR with `pr-contract.yml` headers; CI green, and
  the Integration Tests job log shows the sprint-133 file ran.
- [ ] **Ask the maintainer for merge authorization.** `/deploy`; watch through `DEPLOYMENT SUCCESSFUL`.
- [ ] **Smoke (read-only, as maria.reyes):** `GET /api/requests/<own id>` 200 without `requester_email`;
  `GET /api/requests/<a community-scope request in a community she is not in>` 404;
  `GET /api/users/<another id>` has no `email`; anonymous `GET /api/users/<id>` 401;
  `GET /api/communities/<id>/members` as a non-admin has no `user_email`.
- [ ] Update the handoff (PR S shipped; next = PR A in a fresh chat).

---

# PR A — Skill visibility and discovery (auth + request + community UI)

Branch: `agent/claude/sprint-133-pr-a-skill-visibility`, cut from `origin/master` **after PR S deploys**.
`/code-review` at **high** (a new cross-user read surface).

## Task A1: TDD tests first

- [ ] **Predicate + routes** (`services/auth-service/tests/tdd/sprint-133-skill-visibility.test.ts`, supertest
  through the real `/auth/skills` mount, DB mocked only at the boundary): every query contains the
  `/* skill-visible */` fragment bound to the **JWT** caller; `GET /users/:id` for a non-visible owner → 404
  with the same body as an unknown id; directory/search for a non-member → 404; search
  `?skill=Carpentry` resolves to the slug (no substring: `?skill=carp` does not match `carpentry`).
- [ ] **Settings route** (`sprint-133-settings-route-order.test.ts`, a guard — note 14): `GET /users/me/settings` returns
  `share_skills_with_communities: true` by default (no row); PATCH `{share_skills_with_communities:false}`
  persists only that field; PATCH `{}` → 400; PATCH a string → 400.
- [ ] **Root integration (real SQL)** `tests/integration/sprint-133-skill-visibility.integration.test.ts`:
  co-member sees skills; a member of a different community → 404; a **pending** member → 404 and is not
  counted; after the owner opts out: co-member view 404, absent from search, directory count drops by
  exactly one (note 4); owner always sees their own.
- [ ] **Frontend** (`apps/frontend/tests/tdd/sprint-133-skills-discovery.test.tsx`): the profile toggle calls
  `PATCH /users/me/settings` with exactly `{ share_skills_with_communities: false }`; the Find-a-skill
  panel renders directory chips, searching posts `skill` to the search endpoint and lists results; the
  panel is hidden for non-members; a failed directory fetch shows a graceful empty state.
- [ ] **Verify red.**

## Task A2: Migration + init.sql + reset policy

- [ ] Write `infrastructure/postgres/migrations/20261008-skill-visibility.sql` (spec *Data Model → PR A*).
  Run the `migration-validator` agent on it.
- [ ] Note 13: untruncated `user_skills` grep; remove `'auth.user_skills': 'reset'`
  (`tablePolicy.ts:45`); `sprint-117-reset-safety.test.ts` green.
- [ ] Regenerate `init.sql` (note 12), review the artifact diff (column, index, drop, one ledger line), promote.
- [ ] **Verify:** `npm exec --workspace=services/simulation-service -- jest --testPathPatterns sprint-117-reset-safety; echo "exit=$?"`.

## Task A3: Predicate + settings

- [ ] `services/auth-service/src/db/skillVisibility.ts`:
  `skillVisibleToSql(ownerAlias, viewerParam)` → `/* skill-visible */ (owner = viewer OR (COALESCE(ps.share_skills_with_communities, true) AND EXISTS (co-active membership)))`
  and `activeMemberSql(communityParam, viewerParam)`. Comment that identifiers are internal only; values stay bound.
- [ ] `routes/users.ts`: add the new field to `GET/PATCH /me/settings` (no reorder; note 14);
  the PATCH upsert writes only the provided booleans.
- [ ] **Verify:** settings test green.

## Task A4: `/auth/skills` routes

- [ ] `services/auth-service/src/routes/skills.ts`: `GET /users/:userId`, `GET /communities/:communityId`,
  `GET /communities/:communityId/search` (spec table). Validate UUID params by hand (no zod); `skill`
  is 1–100 chars after trim. Mount at `/auth/skills` with `rateLimiters.standard` + `authMiddleware` in `src/index.ts`.
- [ ] **Verify:** A1 auth tests green; `npx tsc --noEmit -p services/auth-service; echo "exit=$?"`.

## Task A5: Retire `/requests/matched/for-user`

- [ ] Delete the route (`services/request-service/src/routes/requests.ts:216+`) and its tests' expectations;
  delete `getMatchedRequests` (`apps/frontend/src/lib/api.ts:524`). Grep the repo (incl. mobile and
  simulation) for `matched/for-user`; zero code hits. Update the IDEAS entry (2026-10-01) to done.
  ⚠️ Editing `api.ts` re-raises the `js/request-forgery` CodeQL FP with new ids (memory); expect to
  surface it for UI dismissal before the master deploy.
- [ ] **Verify:** request-service suite + `tsc` green.

## Task A6: Frontend

- [ ] `api.ts`: `skillsService` (PR A methods) + settings type.
- [ ] `profile.tsx`: "Show my skills to people in my communities" toggle beside the karma toggle (`:299-314`).
- [ ] `components/skills/MemberSkills.tsx`, `components/skills/FindASkillPanel.tsx`; wire into the community
  People tab (members only). `onboarding/workflows.ts` skills step copy.
- [ ] **Verify:** A1 frontend tests green; `npx tsc --noEmit -p apps/frontend`.

## Task A7: ADR + guides + landing docs

- [ ] Write
  `docs/adr/ADR-100-skill-visibility-and-endorsements.md` (Status: Accepted): opt-out co-member visibility,
  one predicate, search semantics, `user_skills` drop; a placeholder section for endorsements (PR B).
  Index in `docs/adr/README.md`; add to an `ADR_GROUPS` group in `scripts/generate-docs.ts`.
- [ ] `docs/guides/profile-guide.md` "Who can see your skills"; community guide "Finding someone with a skill".
- [ ] Regenerate landing docs; `git add -f` new generated pages.

## Task A8: CONTEXT.md + registry + promotion

- [ ] auth-service CONTEXT (endpoints, predicate, schema), request-service CONTEXT (route removed),
  `services/registry.json` (endpoints). `npm run analyze:services` if dependencies changed.
- [ ] Promote green TDD files to `tests/regression/`.

## Task A9: SDLC quality gates

- [ ] `/simplify` on the PR diff. **Verify:** applied or skipped with reasons.
- [ ] `/code-review` **high**. **Verify:** correctness findings resolved or justified.
- [ ] `/security-review`. **Verify:** no skills read path bypasses `skillVisibleToSql`; findings resolved or justified.

## Task A10: Final verification

```bash
npm test; echo "exit=$?"
git status --short
npm run feedback:check
for p in services/auth-service services/request-service services/simulation-service apps/frontend; do npx tsc --noEmit -p $p || echo "TSC FAIL $p"; done
```

## Task A11: PR, merge, deploy, smoke

- [ ] Version bump at merge time; PR; CI green incl. schema regeneration parity and the sprint-133
  integration file in the job log; CodeQL FP surfaced if `api.ts` re-raised it.
- [ ] **Maintainer merge authorization**; `/deploy`.
- [ ] **Smoke (read-only, as maria.reyes):** `GET /api/users/me/settings` 200 with
  `share_skills_with_communities`; `GET /api/auth/skills/communities/<her community>` 200;
  `GET /api/auth/skills/communities/<a community she is not in>` 404; `GET /api/requests/matched/for-user` 404.
  Toggling the setting is a write: needs per-operation authorization or is skipped.
- [ ] Update the handoff (PR A shipped; next = PR B).

---

# PR B — Endorsements (auth + social-graph + UI)

Branch: `agent/claude/sprint-133-pr-b-endorsements`, cut from `origin/master` **after PR A deploys**.
`/code-review` at **high** (new event, trust-graph writes).

## Task B1: Reproduce BUG-060 (decides the transport)

- [ ] `tests/integration/sprint-133-bug-060-shared-queue.integration.test.ts` (note 7). Start the
  real subscribers of notification-, reputation- and social-graph-service against the test Redis.
  **Assert that each worker is attached before publishing.** Then add **N ≥ 50** `request_created`
  jobs. This event is handled only by notification-service
  (`services/notification-service/src/events/subscriber.ts:176`); `user_joined_community` has no
  handler and is **not** usable. Record every job's final state, its failure reason, and whether the
  notification handler ran (count the notification rows it writes). The test is evidence, not a fix.
- [ ] Trace the mechanism in the **installed** Bull source (`node_modules/bull/lib/queue.js`,
  `lib/job.js`; the version from `npm ls bull --all`). Can a worker that registered only other names
  take a `request_created` job, and what happens to that job? Cite `file:line` in the PR body.
- [ ] Run the test in CI (push the branch) and read the job log.
- [ ] **Decision (PR body, BUGS.md, ADR-100):** a missing-handler failure, or a job that never reaches
  notification → **confirmed**. A run where all jobs are delivered does **not** refute competition.
  "Not reproduced" needs that run **plus** a source trace proving that named workers cannot take
  foreign names. **The transport is the dedicated queue `karmyq-skill-endorsement-social-graph`
  unless that proof exists.** No other event's transport changes in this sprint.

## Task B2: TDD tests first

- [ ] **Auth routes** (`sprint-133-endorsements.test.ts`): POST with no completed match → 404; hidden tag → 404
  (same body); self → 400; first POST → 201; repeat → 200, no second row and **no revision bump**; DELETE → 200;
  DELETE again → 200 with no revision bump; re-POST after withdraw → 200, the **same** row id, revision +1.
  Each state change publishes exactly one event with job id `endorsement-<id>-r<revision>` (note 8). **Two
  changes in one frozen-clock millisecond give two distinct ids; re-publishing one change reuses its id.**
  A failed enqueue still returns success and logs both user ids. A tag delete with two endorsers publishes
  two events (`…-deleted`) after commit.
- [ ] **Reconcile** (`sprint-133-endorsement-reconcile.test.ts`): proofs (a)–(e) of note 6 against an
  in-memory fixture of rows; `stability` unchanged; the `raw_weight` expression equals `computeRawWeight`
  of the final counts.
- [ ] **Root integration (real SQL + queue)**: endorse → edge `endorsement_count` 1 in the match's community
  and unchanged elsewhere; same event redelivered 3× → 1; withdraw → 0; re-endorse → 1; both directions → 2;
  delete the tag → 0 and `raw_weight` drops by exactly the endorsement weight.
- [ ] **Root integration: concurrency (real Postgres, two pool clients, a test-only barrier hook between
  the source read and the edge write; note 6 (f)/(g)):**
  (f) reconcile R1 reads "active" and pauses; the withdrawal commits; R2 starts (it must block on the pair
  lock); R1 is released; **final `endorsement_count` = 0**. Also run it without the lock (inject a no-op
  lock on a committed tree): the test must go **red** with a final 1, then restore from a byte copy.
  (g) R1 holds the lock while a `match_completed` edge update for the same pair runs; after both finish,
  `match_completed_count` is incremented, `endorsement_count` is reconciled, and `raw_weight` equals the
  formula over the final columns, never the value computed from a stale read.
- [ ] **Frontend**: vouch button visible only when `can_endorse`; click posts `{ tag_id }`; withdraw calls
  DELETE; count updates.
- [ ] **Verify red.**

## Task B3: Migration + init.sql + reset policy

- [ ] `<date>-skill-endorsements.sql` (spec *Data Model → PR B*, including `revision`); `migration-validator`.
- [ ] `tablePolicy.ts`: `'auth.skill_endorsements': 'reset'`; reset-safety green.
- [ ] Regenerate and promote `init.sql` (note 12).

## Task B4: Endorsement routes + publisher

- [ ] `routes/skills.ts`: POST/DELETE `/endorsements`, extend `GET /users/:userId` (`endorsement_count`,
  `endorsed_by_me`, `can_endorse`). Eligibility in one SQL statement: `skillVisibleToSql` **and** EXISTS a
  `requests.matches` row with `status='completed'` between the pair (either direction via
  `requests.help_requests.requester_id`/`matches.responder_id`); record the most recent such `match_id`.
  The upsert on `skill_endorsements_one_per_tag` clears `withdrawn_at` and bumps `revision` **only when the
  state actually changes** (`WHERE skill_endorsements.withdrawn_at IS NOT NULL`); DELETE sets `withdrawn_at`
  and bumps `revision` only when the row was active. Take the job id from `RETURNING id, revision`.
- [ ] `src/events/endorsementEvents.ts` per the B1 decision; publish after commit (note 9); a retry of the
  same change reuses its job id.
- [ ] `profileTags.ts` DELETE: collect the active endorsement rows (id, endorser) in the transaction; after
  commit, publish one event per row with job id `endorsement-<id>-deleted` (note 10).
- [ ] **Verify:** B2 auth tests green; `tsc`.

## Task B5: social-graph reconcile (serialized)

- [ ] `trustEdgeDb.ts`: add `withPairLock(client, userIdA, userIdB, fn)`, which runs `fn` inside a transaction
  after `pg_advisory_xact_lock(hashtextextended('trust-pair:' || $1 || ':' || $2, 0))` on the normalized pair.
  Add `updateRawWeightInPlace(client, edgeIds, weights)`, which computes `raw_weight` inside the `UPDATE`
  from the row's current count columns. Rework `upsertTrustEdge` (`trustEdgeDb.ts:117-181`) to run under
  `withPairLock` and to use the in-place recompute. Its observable result (counts, stability growth,
  raw_weight) is unchanged, and its existing tests stay green.
- [ ] `src/services/endorsementReconcile.ts`: inside `withPairLock`, run the per-community count query
  (note 6) over the union of the pair's existing edges' communities and the active endorsements' match
  communities. `SELECT … FOR UPDATE` the edges, `UPDATE … SET endorsement_count = $n` (insert the edge only
  if count > 0 and missing), recompute in place, and set `last_interaction_at` only on increase. Expose a
  test-only barrier hook between the read and the write (no-op in production).
- [ ] Subscriber: consume `skill_endorsement_changed` on the chosen transport.
- [ ] `scripts/reconcile-endorsement-edges.js` (dry-run by default, `--apply` explicit, uses `withPairLock`;
  never run against the demo without per-operation authorization).
- [ ] **Verify:** B2 reconcile + concurrency tests green; social-graph suite + `tsc` green.

## Task B6: Frontend

- [ ] `MemberSkills.tsx`: vouch count, Vouch / Withdraw vouch; also on `pages/matches/[id].tsx` for completed
  matches (the partner's skills). `api.ts` endorse/withdraw. Onboarding copy.
- [ ] **Verify:** B2 frontend tests green; `tsc`.

## Task B7: Docs + ADR

- [ ] ADR-100: endorsement eligibility, pair-capped reconcile-not-increment, pair-lock serialization, revision job ids, opt-out does not
  remove vouches, transport decision with the B1 evidence, the lost-enqueue gap + backfill script.
- [ ] New `docs/concepts/skill-endorsements.md` → `CONCEPT_ORDER` + `howItWorks` in `scripts/generate-docs.ts`;
  regenerate; `git add -f`.
- [ ] `profile-guide.md` "Vouching for skills"; `trust-connections-guide.md`, `docs/concepts/trust-and-karma.md`.
- [ ] `docs/BUGS.md` BUG-060 updated with B1 evidence. `docs/IDEAS.md`: `match_completed` increment is not
  idempotent (spec arc); endorsement notification; endorsement-weighted matching.

## Task B8: CONTEXT.md + registry + promotion

- [ ] `services/registry.json`: endpoints + `skill_endorsement_changed` (publisher auth, subscriber
  social-graph, transport). auth + social-graph CONTEXT.md. `npm run analyze:services`.
- [ ] Promote green TDD files.

## Task B9: SDLC quality gates

- [ ] `/simplify` on the PR diff. **Verify:** applied or skipped with reasons.
- [ ] `/code-review` **high**. **Verify:** correctness findings resolved or justified (focus: double counting, job-id collisions, lock coverage on both edge-write paths, cascade path).
- [ ] `/security-review`. **Verify:** no endorsement without a completed match; no existence oracle; findings resolved or justified.

## Task B10: Final verification

```bash
npm test; echo "exit=$?"
git status --short
npm run feedback:check
for p in services/auth-service services/social-graph-service services/simulation-service apps/frontend; do npx tsc --noEmit -p $p || echo "TSC FAIL $p"; done
```

## Task B11: PR, merge, deploy, smoke

- [ ] Version bump at merge time; PR; CI green incl. both sprint-133 B integration files in the job log.
- [ ] **Maintainer merge authorization**; `/deploy`.
- [ ] **Smoke (read-only):** `GET /api/auth/skills/users/<a co-member>` 200 with `endorsement_count`,
  `can_endorse`. A live endorse/withdraw round trip is a demo write: **ask for per-operation authorization**
  and, if granted, verify the trust edge count goes 1 → 0 and clean up by API.
- [ ] ADR → Implemented after deploy. Update the handoff (PR B shipped; next = PR D).

---

# PR D — Curated demo seed: skills, items, endorsements

Branch: `agent/claude/sprint-133-pr-d-demo-seed`, cut from `origin/master` **after PR B deploys**.
`/code-review` at **medium**.

## Task D1: TDD tests first

- [ ] `services/simulation-service/tests/tdd/sprint-133-demo-skills-seed.test.ts`: the compiled manifest has
  skills for every curated persona that helps (each resolving to a vocabulary slug or a deliberate
  free-text tag), items owned by people and at least one community, and endorsements only between
  pairs with a seeded **completed** exchange (compiler rejects any other). Seeded `trust_edges.endorsement_count`
  equals the reconcile rule over seeded rows (note 18). maria.reyes has ≥ 3 skills and ≥ 1 vouch.
- [ ] **Verify red.**

## Task D2: Manifest, compiler, writer, verifier

- [ ] `types.ts` (fixture + compiled types), `manifest.ts` (data), `compiler.ts` (validation), `baselineWriter.ts`
  (inserts into `auth.user_tags`, `inventory.items`, `inventory.item_shares`, `auth.skill_endorsements`;
  `endorsement_count` on trust edges), `verifier.ts` (expectations). Reset-safety green.
- [ ] **Verify:** D1 green; simulation suite + `tsc` green.

## Task D3: Docs

- [ ] `docs/guides/demo-data.md`; simulation CONTEXT.md; promote D1.

## Task D4: SDLC quality gates

- [ ] `/simplify`, `/code-review` **medium**, `/security-review`, each with a verification line as above.

## Task D5: Final verification

```bash
npm test; echo "exit=$?"
git status --short
npm run feedback:check
npx tsc --noEmit -p services/simulation-service; echo "exit=$?"
```

## Task D6: PR, merge, deploy, demo apply

- [ ] Version bump; PR; CI green; **maintainer merge authorization**; `/deploy`.
- [ ] **Applying the new baseline to karmyq.com is a demo data operation. Ask for explicit per-operation
  authorization and name the lane.** Only if granted: run the curated reset, then verify read-only
  (maria.reyes sees co-member skills, the directory shows counts, a vouch count is visible).
- [ ] **Sprint closeout:** ADR Implemented, archive the handoff, Sprint 134 candidates into `docs/IDEAS.md`,
  update memory `project_current_state`.
