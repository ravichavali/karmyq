# Sprint 140 PR A — archived post-merge record (v11.113.0)

Archived per the Claude review on PR #335 (2026-11-11). PR #334 merged on 2026-11-11 at 21:29:44Z as 24bed69b5eb714ef58de7784c750e2e2eaa2bcf6. Master CI/CD run [43103530588](https://github.com/ravichavali/karmyq/actions/runs/43103530588) completed successfully on that SHA (verified 2026-11-11).

The snapshot below is preserved verbatim from that merge commit. Its pending-review wording is historical and is superseded by this post-merge note. This archival restoration does not grant merge or deploy authority for PR #335.

Working navigation from this archive: [design](../../../docs/superpowers/specs/2026-11-10-sprint-140-security-and-wip-cleanup-design.md),
[plan](../../../docs/superpowers/plans/2026-11-10-sprint-140-security-and-wip-cleanup.md),
[previous sprint archive](2026-11-09-sprint-139-correctness-bundle-COMPLETE-v11.112.0.md).
Relative links inside the historical snapshot retain their original locations.

---

# Sprint 140 — PR A open, CI verified green; awaiting the maintainer's review and merge authorization

**Date**: 2026-11-11
**State**: **PR A Tasks 1–12 are done on `agent/claude/sprint-140-planning`. PR A is open as [#334](https://github.com/ravichavali/karmyq/pull/334), and its CI
was verified complete and green on `7f1fca5b`, including both new root integration suites (observed 2026-11-11, below).**
Not merged, not deployed. The merge is blocked only by branch protection's one required approving review (no human review
yet). PR B (twenty suites) is decision-gated and unplanned.

**Design**: [`docs/superpowers/specs/2026-11-10-sprint-140-security-and-wip-cleanup-design.md`](../../docs/superpowers/specs/2026-11-10-sprint-140-security-and-wip-cleanup-design.md)

**PR A execution plan**: [`docs/superpowers/plans/2026-11-10-sprint-140-security-and-wip-cleanup.md`](../../docs/superpowers/plans/2026-11-10-sprint-140-security-and-wip-cleanup.md)

> Git and PR state outrank this handoff. No parallel lanes were active. Sprint 139's post-merge record:
> [`archive/2026-11-09-sprint-139-correctness-bundle-COMPLETE-v11.112.0.md`](archive/2026-11-09-sprint-139-correctness-bundle-COMPLETE-v11.112.0.md).

---

## Quick Start (next chat)

1. Read `CLAUDE.md` and this handoff. `git fetch origin`; `gh pr list`; `git log --oneline origin/master -3`.
2. Re-check PR A ([#334](https://github.com/ravichavali/karmyq/pull/334)) on its **current head**. The verified run is on `7f1fca5b`; the
   handoff-only commit after it re-triggers every workflow (no path filters in `ci.yml`, `test.yml` or `pr-contract.yml`).
   Confirm that run's conclusion and created-job count: CI/CD 14 (7 jobs + 7-image matrix, `Deploy to Demo` skipped),
   Tests 3, PR Contract 1. Do not rely on `gh pr checks` alone.
3. If the maintainer relays review findings, handle them with the `review-response` skill (verify each against the repo
   before fixing). Fix forward on the same branch (merge commit if `origin/master` moved; never rebase/force-push), re-run
   the gates, and update this handoff.
4. Report merge readiness and stop. **Merge, deploy, demo-host operations, alert dismissals, closing #333 and PR B each
   need separate explicit authorization**; none is granted. #333 must not be merged.

**Next unchecked task**: plan Task 14 (merge and deploy). It starts only on explicit merge authorization, after the
required approving review. node-forge must reach master by **2026-11-24**.

## What PR A contains (commits on the branch, oldest first)

| Commit | Content |
|---|---|
| `0086633c` | node-forge `>=1.4.3` override + single lock entry; D9 security-floor regression pins 1.4.3 (Dependabot #181–#184) |
| `cf7775a7` | BUG-100: `GET /communities/my/communities` uses the JWT id only; simulation nominate/ratify weight 0 in every profile |
| `da0ab0bd` | BUG-099: offers `status=all` via `($1::text IS NULL OR o.status = $1)`; page sends `all` |
| `641d81ee` | BUG-098: five frontend consumers read the intercepted response once; three raw-client controls pinned |
| `6ff00c29` | Eight frontend WIP suites repaired to current contracts and promoted (exact `git mv`) |
| `a4c57477` | Request `sprint-125-provider-reach-gate`: two bind-order expectations; promoted |
| `b6b01e93` | Root `sprint-36-commitment-depth` + `preferredProviderNotification` repaired; promoted |
| `47400aba` | ADR-103 (maintainer-allocated, Proposed), guides, BUGS.md, landing docs, onboarding copy, v11.113.0 |
| `1c047974` | SDLC gate fixes (response-boundary test, q2 assertion, CONTEXT line, /simplify cleanups) and this handoff |
| `7f1fca5b` | Handoff only: records PR #334 (the CI-verified head) |

## SDLC gates (all four ran on the branch diff)

- **Testing:** see *Evidence*. Required tiers green; TDD tier exit 1 with exactly the twenty PR-B suites.
- **/simplify** (one calibrated pass, 4 angles): four cleanups applied; reuse/altitude follow-ups recorded below.
- **/code-review high** (fresh forked reviewer, 10 findings, re-graded): three fixed — new
  `apps/frontend/tests/regression/sprint-140-response-boundary.test.ts` drives the **real** `api.ts` clients through stub
  adapters with raw envelopes (RED by mutation: interceptor disabled → 3/6 fail; invite moved to an intercepted client →
  its control fails; `api.ts` restored byte-identical), the q2-alone request-approval assertion, and the community
  CONTEXT line that leaked a mid-sentence wrap into landing `api.json`. Three minors deferred (below); rest ruled.
- **/security-review:** no high-confidence findings (identity, SQL predicate, frontend reads, simulation, node-forge
  provenance all verified against source and the registry).

## Evidence (local, Windows host)

- node-forge: regression RED→GREEN; `npx -y npm@11.19.0 ci` exit 0; full `npm ls --all` differs from baseline only in
  the two node-forge lines (pre-existing ELSPROBLEMS identical; run `npm ls` from an uppercase `C:` cwd — a lowercase
  `c:` cwd makes Arborist crash on the workspace junctions); `npm run audit` exit 0; low audit: only the 6 deepmerge lows
  (#178 chain), no node-forge. Lock delta vs master: node-forge entry + two root version fields; zero `libc` lines.
- Required tiers green: request, frontend, community, simulation, root (`npm test --workspace=…` each exit 0); `tsc
  --noEmit` clean for community, request, simulation, frontend.
- Final `npm run test:tdd`: exit 1 with **exactly the twenty PR-B suites** (103 failed tests; baseline 31 suites/148).
  Frontend TDD 428/428. None of the eleven repaired suites and no new failure.
- Root integration (two new suites): locally, discovered by `npm run test:integration` (30 suites) and failed only on
  `ECONNREFUSED :5433` (no local Postgres). Pre-fix RED is reasoned in each file header, not observed.

## Evidence (CI, head `7f1fca5b`, observed 2026-11-11)

- CI/CD run [43079861784](https://github.com/ravichavali/karmyq/actions/runs/43079861784): 14/14 jobs created, which matches `ci.yml`'s 7 jobs plus the
  7-service image matrix. Every job succeeded except `Deploy to Demo`, which was skipped as expected (`ci.yml:413`:
  push to master only). Tests run 43079861867: 3/3 success. PR Contract run 43079861822: 1/1 success.
- The `Integration Tests` job log (job 130731558214) shows `sprint-140-offer-status-all` passing 6/6 and
  `sprint-140-community-membership-identity` passing 6/6. The tier totals were 30/30 suites and 481/481 tests, with 0
  skipped or todo.
- The Sprint 117 exact-path step ran after the integration tier and passed 2/2. Only artifact upload and cleanup follow it.
- Code scanning: 0 open alerts on `refs/pull/334/merge` and 0 on master. `origin/master` is still `8aabc50c` (v11.112.0), an
  ancestor of the branch, so v11.113.0 is still correct and no merge commit is needed.
- Branch protection requires 1 approving review, and `enforce_admins` is false. The only review so far is an advisory
  `graphify-labs[bot]` COMMENTED review on `7f1fca5b`: "no issues found", partial coverage, coupling-hotspot notes only.
  It is not a human review and needs no response.
- Commits after the verified head: one handoff-only commit (this update). The PR body's `## Validation` ledger carries the
  same evidence.

## PR B boundary — twenty suites remain visible

Request (8) `sprint-101-actionability-state`, `sprint-107-offered-awaiting-truth`, `sprint-89-community-pulse`,
`sprint-100-pulse-truth`, `sprint-85-unified-feed`, `sprint-97-community-pulse`, `sprint-108-admin-proposed-decision`,
`admin-schemas-api`; community (2) `sprint-100-split-reexecute`, `sprint-67-governance`; social-graph (4)
`sprint-66-trust-graph-visualization`, `sprint-67-ego-network`, `sprint-68-halflife`, `sprint-100-connection-reconcile`;
root (6) `sprint-42-dibs`, `rateCards`, `sprint-43-feed-ranking`, `preSelectProvider`, `trust-evolution-flow`,
`sprint-117-demo-reset.integration.test` (stays at its exact path; CI runs it last).

Before PR B implementation the maintainer must approve (1) a required-CI execution design for any service integration
tier and (2) a per-suite repair/rewrite/retire ledger. Retirement needs separate written approval plus replacement
coverage. Plan it in a fresh chat on a fresh branch from then-current `origin/master`.

## Ownership and base

| Field | Value |
|---|---|
| **PR A branch** | `agent/claude/sprint-140-planning` |
| **Base** | `origin/master` `8aabc50c` (#332, v11.112.0), unchanged at Task 10 and at the CI verification (2026-11-11) |
| **Version** | v11.113.0 (re-derive from `origin/master` at merge time) |
| **ADR** | **ADR-103**, allocated by the maintainer 2026-11-10; status Proposed until deployed |
| **Dependency lane** | **Claude**, node-forge 1.4.3 only — done on this branch. #333 inspected read-only, not merged/closed/pushed |

## Authorization boundaries

- **Not authorized:** merge, deploy, demo-host reads/writes, alert dismissals, closing/merging/pushing #333, other
  dependency work, PR-B implementation, obsolete-test retirement.
- Branch audits do not close GitHub alerts: re-query #181–#184 only after a patched master, never dismiss instead.
- Deploy restarts the simulation: verify the deployed artifact carries the zero weights before claiming containment.

## Dated obligations

- **node-forge #181–#184:** patched on this branch; must reach master by **2026-11-24** (SLA).
- **`deepmerge` alert #178** (dismissed `tolerable_risk`, state verified 2026-11-11): re-check at the next Expo SDK move
  or by **2026-12-01**. (Not to be confused with the closed Dependabot *PR* #178.)
- **#329 Expo SDK drift:** stays open, out of scope.

## Carry-forward (new this sprint)

- `node scripts/generate-service-context.js` rewrites all ten `services/*/.claude/README.md` with pre-existing drift
  (e.g. auth's dependent count, `bull-queue`, dates). Not caused or fixed by PR A; reverted locally.
- Frontend callers still send the now-ignored `user_id` to `/communities/my/communities` (harmless; optional cleanup).
- BUG-098's class-wide fix (typed `api.ts` wrappers or a `.data.data` gate) remains a spec-forbidden follow-up.
- Sprint 101's request-detail withdraw test (`apps/frontend/tests/tdd/sprint-101-request-detail-action.test.tsx`) is green
  in TDD but unpromoted; it is the replacement coverage cited by the sprint-39 S108 conversion.
- `GET /schemas/:type` reads `req.query.user_id` for its A/B bucket (`services/request-service/src/routes/schemas.ts:46`)
  — same client-asserted-identity pattern as BUG-100, lower impact (bucket choice only). Not in PR A scope; candidate bug.
- `tests/fixtures/index.ts:223,270` (`UserFactory`) signs JWTs with `communityMemberships` — the wrong field per CLAUDE.md;
  any test relying on it sees no memberships. Fix before PR B leans on the factory.
- Simulation nominate/ratify: the durable fix is workflow-level (pass a real user id, behind an enable flag) once the
  ratification-quorum decision lands; weight 0 is containment only (ADR-103).
- Reuse follow-ups from /simplify (all outside PR A's diff): shared frontend Layout mock/`beforeEach`, shared request SQL
  `norm`/AUDIENCE/EXPIRY test helpers, community db-mock boilerplate, integration bearer helpers, a shared status-filter
  parser.
- Deferred minors from /code-review: preferences add-interest `isNew:false` is a silent no-op when local state is stale;
  sprint-38-trust-profile's pre-existing "Trust tier computation"/"Completion rate display" cases test local copies, not
  production code (now in the blocking tier); `MessagingContext` `setConversations(response.data)` has no array fallback.
  From the final process review of `sprint-140-response-boundary.test.ts`:
  - the token-refresh control is a source pin (it could be driven through a stub 401 adapter);
  - only the first `serve()` call's URLs are asserted;
  - `global.fetch` is never restored (harmless, since each Jest file gets its own environment).
- Earlier carry-forward (Sprint 138/139 items, BUG-087/073, PR C/D items, per-community health weight) is unchanged —
  see the Sprint 139 archive.

## Standing rules

See `CLAUDE.md` and the Sprint 138 archive's *Standing rules*. One editor on the shared Windows tree; clean handoffs;
no docs-only master push. Deliberate promotions use exact `git mv`, never a direct broad promoter run.
