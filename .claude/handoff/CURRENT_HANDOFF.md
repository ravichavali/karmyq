# Sprint 128 PR C — Standing preview parity — Handoff

**Date**: 2026-09-10
**Outcome**: implementation complete, all four SDLC gates run, **PR [#233](https://github.com/ravichavali/karmyq/pull/233) OPEN with all 20 checks green** — awaiting the required approving review and explicit maintainer merge authorization

> Single stream. `CURRENT_HANDOFF.md` **is** the state, not a router — there is no second machine.
> This file is branch-local and reserves nothing; contended resources are allocated by the
> maintainer (`CLAUDE.md` → *Parallel Development*).

---

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-128-c-standing-preview` |
| **Base** | `origin/master` at `bcb7617e` (fetched 2026-09-10), version **v11.49.0** |
| **Active editor** | Claude — implementation complete |
| **Reviewer role** | GitHub required approving review still owed; it cannot be self-provided |
| **Owned paths** | reputation service, root `tests/integration/`, `docs/gotchas/`, ADR-096, trust docs |
| **Shared resources needed** | D1 provisioned and **still running** (see teardown below). No ADR minted. Version bump re-derived from `origin/master` **at merge time** |

## Links

- **Spec**: `docs/superpowers/specs/2026-09-07-sprint-128-single-stream-design.md`
- **Plan**: `docs/superpowers/plans/2026-09-07-sprint-128-c-standing-preview.md`
- **PR**: [#233](https://github.com/ravichavali/karmyq/pull/233) — OPEN, head `c606662b`

## Quick Start

1. Confirm live state before trusting this file: `git fetch origin`, `gh pr view 233`,
   `git log --oneline origin/master -3`.
2. **Reuse this branch.** Work is committed and pushed as `c606662b`.
3. Remaining: the approving review and merge authorization, then deploy and health verify, then
   **tear down the D1 resources** (they are still up).

**Next unchecked task**: Plan Task 8 — the approving review on #233 (cannot be self-provided),
explicit merge authorization, deploy, then D1 teardown and the sprint retrospective.

## PR #233 status — verified 2026-09-10

**All 20 checks PASS**; `Deploy to Demo` SKIPPING, which is expected — it runs only on a `master`
push. `mergeStateStatus` is **BLOCKED** solely on `REVIEW_REQUIRED`.

Each workflow run's `headSha` was queried directly rather than read off the rollup, which is the
check PR A's handoff says to make: CI/CD Pipeline, Tests and PR Contract all report `success`
against `c606662b`, and that is still the PR head. `pr-contract` passing confirms the full template
body was supplied rather than `--fill`.

Codex reviewed the pushed branch independently and confirmed the remote commit, the template and
the contract check, and flagged that this handoff still said "PR not yet opened" — corrected here.
That staleness is the blocking defect `CLAUDE.md` → *Session Workflow* names explicitly.

## What this PR fixes

`analyzeStandingBackfill` derived its trust inputs from the **replayed match list**, which is not
what the score writer reads. It therefore saw neither pre-existing canonical history nor activity in
other communities, and zeroed a membership's metrics whenever its local pair had no replayed match.
Because breadth is global, those memberships stored **1** while the report printed **0**, and the
same gap propagated into `providerEligibility`.

Reproduced exactly on the disposable database before any code changed:

| | preview | writer |
|---|---|---|
| score buckets | `{'0': 7, '1-19': 2}` | `{'0': 1, '1-19': 8}` |
| provider floor 1 | 2 | 4 |

Six of nine memberships were misreported. After the fix both sides agree exactly, and `LONELY`
(no history anywhere) still stores 0 — **1 is not a new floor**.

**The provider discrepancy is diagnosed, not guessed**: running `PROVIDERS_QUERY`'s own filters
verbatim against real stored scores gave 4 where the preview said 2, with an identical filter set
and pair unit. The difference comes **entirely from score inputs**. No filter change was needed or
made, exactly as the spec predicted.

## What changed

- **New `src/services/standingPreview.ts`** — `buildPreviewIndex(rows)` once per projected dataset,
  then `computePreviewMetrics(index, userId, communityId, nowMs)` per membership.
- **It reproduces the writer's SQL, not the replay map**: global community count; local recent row
  count with an inclusive boundary; counterparty join on non-null match id with the `other` side
  **not** community-filtered; repeats by distinct match id. It filters on exactly
  `('Provided help', 'Received help')` — **narrower than `CANONICAL_REASONS`**, which also holds the
  first-help and milestone reasons the writer's SQL ignores.
- **`calculateDistributions` scores the post-apply karma view**, mirroring apply's three mutations
  in order: normalize unattributable legacy reasons, delete legacy rows attributable to a replayed
  match, overlay planned canonical rows by identity so an already-projected row is not double-counted.
- **`sourcedPairs` semantics corrected** — "sourced" now means any local canonical history. The old
  test (recent interactions or counterparties) reported two real cases as zero-history: history
  older than the window, and rows with a NULL match id, which is what legacy normalization produces.
  Ordinary data is unaffected; Sprint 126's expectation of 3 is unchanged.
- **`attributableMatchIds` / `normalizedReasonFor` extracted** so preview and apply share one
  predicate rather than two copies of it.
- Unchanged: the trust formula, provider floors, `PROVIDERS_QUERY` filters, the report's fields, the
  apply authorization boundary, every endpoint, schema and event.

## Review rounds

### `/simplify` — 4 parallel agents

Applied: merged two pair-keyed maps and added an `addTo` helper (~30 lines and one nesting level);
named `PreviewPairEntry`; counterparty tracker became a counter rather than a `Set` (provably
equivalent — each pair is visited once); shared apply predicate extracted; a comment that overclaimed
was corrected; dead `return` removed.

Skipped deliberately: dropping the binary search and the `communitiesByUser` count shape (both are
the approved plan's named mechanism and interface), the `PreviewMetrics` field rename
(plan-specified), and a shared test-helper module (would edit Sprint 126's file, outside this diff).

### `/code-review` (high) — 3 findings

1. **CONFIRMED bug, fixed.** The normalization collapse in `projectedKarmaRows` was
   **row-order dependent**. The guard only fired when the legacy row was visited second; with the
   legacy row first, both it and its canonical twin survived and the pair counted as two
   interactions where apply produces one. Now resolved in a second pass, after every untouched row
   has claimed its identity — order-independent, as the SQL is. Pinned by a regression test that was
   **proven to fail against the old logic**.
2. `sourcedPairs` semantics — fixed, above.
3. Generated-file churn — `build.json` reverted.

### `/security-review` — no findings

Verified: the preview issues only SELECTs and `analyzeSnapshot` is synchronous so it cannot await a
write; no new SQL and no interpolation; the report's field set is byte-for-byte unchanged and emits
only integer aggregates; `standingPreview.ts` has no logger, no `console`, no `throw`; the preview
never reaches the projector or the score writer; no new secrets. Exporting the static
`PROVIDERS_QUERY` constant adds no sink.

## The most important lesson from this PR

**Score buckets are too coarse to be an equivalence oracle.** The first version of the integration
test compared `preview.scoreBuckets` against stored buckets. A deliberately broken reason set was
injected — and the test still passed, because an extra community moves a score by about one point
and the pair stays inside the same bucket. The original 0-versus-1 defect was caught by buckets only
because bucket `'0'` happens to be exactly `score <= 0`.

The oracle now compares **all four metrics per membership** against the real `getTrustMetrics` SQL on
real rows. Re-injecting the same fault fails it immediately (`distinctCommunities` 2 versus 3). Both
the weak and the strong version were run against the injected fault; only the strong one caught it.

The fixture is now seeded so each dimension differs from what the plausible wrong implementation
would produce, with four `saw*` guards asserting the fixture has not degenerated back to the trivial
case.

## Deferred — worth a following PR, not this one

- **One definition instead of two.** `feedbackDb.ts` already splits `calculateWeightedAvgFeedback`
  (pure) from `getWeightedAvgFeedback` (fetch), and both the writer and the dry run call the pure
  half. `getTrustMetrics` has the same shape and could be split the same way, collapsing
  `standingPreview.ts` to a thin adapter. It edits the live writer, so it needs its own PR and its
  own regression coverage first.
- **A single `projectApply(snapshot, replayed)`** owning "what the karma table looks like after
  apply", with `compareStoredProjection` deriving `predictedKarma` from it. There are currently two
  in-memory models of post-apply state; unifying them touches the convergence signal the demo
  backfill already relies on.
- **The reason-set derivation runs one way.** `standingPreview.ts` builds its filter from
  `COMPLETED_MATCH_REASONS`, but the writer's SQL hardcodes the literals, so renaming the constant
  would move the projector and the preview and silently leave the SQL matching a dead string.
  Recorded in the new gotcha; interpolating the constants into the SQL is the real fix.

## D1 resources are STILL RUNNING — tear down after deploy

Provisioned 2026-09-10 under the approved D1 scope, verified free beforehand:

| Resource | Id / detail |
|---|---|
| `s128-preview-pg` | `c4691774d4d3` … `StartedAt=2026-09-10T19:23:46.670695332Z`, `127.0.0.1:55438` |
| `s128-preview-redis` | `24f19f645f2e` … `StartedAt=2026-09-10T19:23:46.911398035Z`, `127.0.0.1:63808` |
| `s128-preview-net` | task-labeled bridge, only these two attached |

All three carry `karmyq.task=sprint128-preview`. Every run compared container ids, running state,
start times and restart counts before and after, with authenticated DB and Redis health — all
identical throughout, so no result rests on a restarted dependency. Remote temp files were removed
after the schema load. Credentials are in the session scratchpad and were never echoed.

**Teardown is owed**: remove only those two containers and that one network, after verifying ids and
labels, and close the recorded SSH tunnel. No broad prune, no compose down, no demo-container
restart. Do it even if PR C is abandoned.

## Open, not caused by this sprint

- **BUG-039** — `POST /api/auth/demo-session` returns 503 `DEMO_UNAVAILABLE` on deployed karmyq.com.
- **4 vulnerabilities on the default branch** (1 high, 3 moderate). The high is inside the ≤ 1 week SLA.
- **`enforce_admins: false`** on `master` — six required checks and one approval are admin-bypassable.
- **`apps/landing/src/data/docs/` is only PARTIALLY git-tracked.** `apps/landing/.gitignore:2`
  ignores the directory, but ~160 files were committed before that and are still tracked; ADRs 095+
  are not. CLAUDE.md calls the directory "git-tracked" without qualification, which is misleading —
  an ADR edit appears not to propagate when in fact it reaches the site via the build-time prebuild.
- **The committed landing docs were stale**, last generated at `8777c5dd` (2026-08-08).

## Verification references

Recorded before this file's final edit; re-run if anything changes after it.

- Reputation service, direct: **16 suites, 276 passed, 3 todo**. `npx tsc --noEmit` exit 0.
- Integration on the disposable DB: **17/17**, no `--forceExit`, clean teardown, container
  continuity OK before and after.
- Drift gate direct **41/41**. `node scripts/gotcha-check.js` clean, **7 entries**.
- Root standing-projection equivalence regression **32/32**.
- Falsifiability proven three times by injection, each reverted: the recency-window gate, the
  order-independence regression, and the integration oracle.
- Pre-commit and pre-push hooks both **actually ran** on this clone (gotcha credential screening at
  commit; the blocking suite across 15 packages at push). That is worth recording — `MEMORY.md` had
  them as inert on this checkout.
- **Caveat on one gate**: the `process-reviewer` agent was killed mid-run by a session rate limit,
  so its checklist was run directly instead — CONTEXT.md updated, registry a one-line valid-JSON
  diff, the one new logic file covered by two new test files, no never-hand-edit generated file
  staged. Every item passed, but that gate was self-administered rather than independently run.

⚠️ GitHub status is a dated observation. Re-derive with `gh pr view` and `git log origin/master`.
