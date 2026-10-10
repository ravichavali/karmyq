# Sprint 133 — Skills Depth — Handoff

**Date**: 2026-10-09 (reconciled for #299 after the maintainer-relayed review)
**Status**: **PLANNED, not started.** Spec, plan and this handoff are committed on
`feature/sprint-133-skills-depth` (cut from `origin/master` `6041c92c`, v11.81.0). **Blocked on the
Sprint 132 closeout**. [#299](https://github.com/ravichavali/karmyq/pull/299) (advisories and renewals, v11.82.0) is the
PR that made this file `CURRENT_HANDOFF.md`. **One closeout step remains: the BUG-061 PR (v11.83.0)**, pushed from
`agent/claude/sprint-132-closeout` after #299 deploys. #299 also archived the Sprint 132 handoff to
`.claude/handoff/archive/2026-10-08-sprint-132-inventories-and-skills-SHIPPED-v11.83.0.md`.

> **Merge-conflict rule for this file.** The Sprint 132 closeout branch carries a newer Sprint 132
> handoff. The closeout **archives** it to `.claude/handoff/archive/` before or with its last PR. When
> this branch later merges `origin/master` (merge commit, no rebase), resolve `CURRENT_HANDOFF.md` by
> keeping **this** Sprint 133 file and confirming the Sprint 132 archive exists on master.

> **No parallel lanes are active.** Git and PR state (`gh pr list`, `git log origin/master`) outrank
> anything written here.

## Quick Start

1. Read this handoff.
2. **Check the precondition first (plan Task S0):** the Sprint 132 closeout PRs (the `shell-quote`/`sharp` + `node-forge`-decision
   advisory fix and BUG-061, commit `4c709023`) are MERGED and deployed, and the Sprint 132 handoff is
   archived. If not, switch to `agent/claude/sprint-132-closeout` and follow its handoff instead.
3. Reuse the existing PR branch if one exists; otherwise `git fetch origin` then
   `git switch -c agent/claude/sprint-133-pr-s-security origin/master` and
   `git merge --no-ff feature/sprint-133-skills-depth` (planning docs ride with PR S). Never branch off
   a stale local master; unpushed local-master commits leak in via the squash-merge.
4. Open the plan: [`docs/superpowers/plans/2026-10-08-sprint-133-skills-depth.md`](../../docs/superpowers/plans/2026-10-08-sprint-133-skills-depth.md).
   **One PR section per fresh chat**, in order S → A → B → D.
5. Invoke `superpowers:subagent-driven-development` directly (or `superpowers:executing-plans`).
   There is no `/execute-plan` slash command; superpowers removed it as a deprecated stub.

## Sprint goal

Members can see the skills of people they share a community with, search their community for a skill,
and vouch for a skill of someone they completed a match with; vouches feed the trust graph. A
security PR first closes BUG-056, BUG-062 and BUG-058.

## Links

- Spec: [`docs/superpowers/specs/2026-10-08-sprint-133-skills-depth-design.md`](../../docs/superpowers/specs/2026-10-08-sprint-133-skills-depth-design.md)
- Plan: [`docs/superpowers/plans/2026-10-08-sprint-133-skills-depth.md`](../../docs/superpowers/plans/2026-10-08-sprint-133-skills-depth.md)
- ADR: **ADR-100**, allocated by the maintainer 2026-10-08 (`docs/adr/ADR-100-skill-visibility-and-endorsements.md`, written in PR A Task A7).

## PR table

| PR | Scope | Branch | State |
|---|---|---|---|
| **S** | BUG-056 (`GET /requests/:id` gate + drop `requester_email`, directed rules unchanged), BUG-062 (member email: `/users/:userId` auth + self-only; community detail/members admin-only), BUG-058 (cap → 7, monitor retired, #236) | `agent/claude/sprint-133-pr-s-security` | Not started (blocked on S132 closeout) |
| A | Opt-out skill visibility to co-members, `/auth/skills` directory + search, `/users/me/settings` route-order fix, drop `auth.user_skills`, retire `/requests/matched/for-user` | `agent/claude/sprint-133-pr-a-skill-visibility` | Not started |
| B | BUG-060 reproduction → transport choice; `auth.skill_endorsements`; reconcile-not-increment `endorsement_count`; vouch UI | `agent/claude/sprint-133-pr-b-endorsements` | Not started |
| D | Curated demo seed: skills, items, endorsements (demo apply needs per-operation authorization) | `agent/claude/sprint-133-pr-d-demo-seed` | Not started |

Versions: each PR bumps the minor from `origin/master` at merge time. Nothing is reserved.

## Maintainer decisions (planning chat, 2026-10-08)

1. **Theme:** skills depth (endorsements + discovery + drop `auth.user_skills`).
2. **Dated obligations** (BUG-056 by 2026-10-14, BUG-058 by 2026-10-15) fold in as **PR S**, first.
3. **BUG-056 policy:** gate (own ∨ match participant ∨ reachable) **and drop `requester_email`**.
   **Preserve the stricter directed-request audience rules** when adding general visibility.
4. **BUG-062** (found in planning: anonymous `GET /users/:userId` returns email; community detail and
   members list return every member's email to any viewer) **folds into PR S**.
5. **BUG-058:** option **(b)**, revert the cap to 7 and retire the image-size monitor.
6. **Who may endorse:** completed-match partners only.
7. **Trust graph:** endorsements feed `endorsement_count` via an event. **Withdrawal reverses the
   contribution; retries and re-endorsement cannot inflate the count** (reconcile, not increment).
   **Reproduce BUG-060 before choosing the transport.**
8. **Visibility:** co-members, opt-out. **Opting out hides skills from both co-member views and
   community search.**
9. **Extras:** curated demo seed (PR D), BUG-060 reproduction (PR B Task B1), retire `/matched/for-user` (PR A).
10. **Demo writes** stay subject to per-operation authorization (PR D and any live smoke write).
11. **Order:** S → A → B → D; the **Sprint 132 closeout finishes first**.
12. **Plan review rev 1 (same day):** the 0–2 pair count and per-change job ids are confirmed. Fixes:
    monotonic `revision` job ids (no millisecond collision; retries reuse the change id); a pair advisory
    lock that serializes reconcile with the `match_completed` edge path, with an in-statement `raw_weight`
    and concurrency tests; and a BUG-060 reproduction that uses `request_created` (a handled event), where one clean
    run cannot refute competition.
13. **ADR-100 allocated.**

## Critical implementation notes (verbatim from the spec)

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

## Carry-forward and open items

- **Sprint 132 closeout, remaining (precondition, branch `agent/claude/sprint-132-closeout`):** the BUG-061
  PR. Its gates are done: /security-review (no findings), /simplify (`0128d181`) and /code-review medium (no
  findings). ADR-099 → Implemented (`fef1ab54`) rides with it. Steps: after #299 deploys, merge `origin/master`
  into that branch, resolve both handoff files to **master's** versions, re-bump to v11.83.0, push, open the PR
  and get merge authorization. #299 covers the `shell-quote`/`handlebars`/`next`/`sharp` fixes and the renewals.
- **Exemptions RENEWED (maintainer, 2026-10-08, shipped in #299):** `node-forge` and `braces` now run 2026-10-08 → **2026-10-15**.
  Re-check both before then (`npm view`, the GHSA page, `npm ls --all`); remove each if upstream ships a fix.
  History of the ordering decision follows.
- **Exemptions (closeout ordering, maintainer review 2026-10-08):** `node-forge` is **already invalid**
  (`expires: 2026-10-08` is the first invalid day; `expires <= today`, `scripts/audit-exemptions.js:126`),
  so every push and deploy fails the gate until it is decided. **Its decision (renew with explicit
  maintainer authorization, or remove if upstream fixed) must ship in the same PR as the
  `shell-quote`/`sharp` advisory fix**, before any closeout push is expected to pass. `braces` becomes
  invalid **2026-10-09**; decide it in the same PR if it lands on or after that day.
- **BUG-062** (HIGH, member email disclosure) logged in `docs/BUGS.md` on this branch; deadline
  **2026-10-15**, with BUG-056 (2026-10-14) and BUG-058 (2026-10-15). If PR S cannot merge by then,
  write dated risk acceptances for the maintainer (plan Task S0). `docs/BUGS.md` conflicts with the
  closeout branch's BUG-061 entry on merge: keep both, 061 before 062.
- **BUG-060** (UNVERIFIED shared-queue competition): reproduced or refuted in PR B Task B1.
- **New finding for IDEAS (PR B Task B7):** `match_completed` trust-edge increments are not idempotent
  (`upsertTrustEdge` `+ 1`); a redelivered completion over-counts.
- **Directed-notify lookup `expires_at > NOW()`** and the standing rollback policy (fix-forward once
  directed rows exist) remain open from Sprint 132.
- **Sprint-number collision:** `origin/lane/lanes-provenance` (`557bb547`) still says "Sprint 132";
  it renumbers when scheduled.

## Ownership and base

| Field | Value |
|---|---|
| **Planning branch** | `feature/sprint-133-skills-depth`, base `origin/master` `6041c92c` (docs only) |
| **Active editor** | Claude (no assignment to Codex yet) |
| **Reviewer role** | A non-author reviews each completed diff |
| **Shared resources** | ADR-100 allocated to this sprint. Dependency lane: Claude. No demo data operation is authorized. |

## Persistent obligations (carried from Sprint 132, unchanged)

- Demo stories expire **2026-11-12**; BUG-041 recheck is due **2026-11-14**.
- GitHub posts a notice on every CI run: the `ubuntu-latest` label migrates to Ubuntu 26 from **2026-10-19**.
  Watch the first CI runs after that date, especially the Docker, Node and Postgres jobs.
- No docs-only master push.
- CodeQL PR scans are incremental; master rescans establish closure of existing master alerts.
- Windows: use Node for JSON/HTTP probes; no local Docker. Demo data operations require separate
  explicit authorization.
- Root tests can promote unrelated TDD files and regenerate landing timestamps; inspect the tree
  after verification and preserve only intended changes.
- Contributor agents never self-merge; only Claude marks the sprint complete after actual delivery.

## Next unchecked action

1. Merge and deploy #299 (maintainer authorization) and check health.
2. Ship the BUG-061 PR from `agent/claude/sprint-132-closeout` (above), then merge and deploy it with separate authorization.
3. Then, in a fresh chat, start Sprint 133 at plan Task S0 → S1.
4. Re-check `node-forge` and `braces` before **2026-10-15**.
