# Sprint 124 — Exemption Mechanism & The Drift Gate (PLANNED, ready to execute)

> ## State as of 2026-08-11
>
> Sprint 123 is **SHIPPED, DEPLOYED and ARCHIVED at v11.43.0** (`9dd080af`). `master` is deployed
> and healthy. **Sprint 124 is now scoped, spec'd and planned** — nothing is implemented yet.
>
> Planning branch: `docs/sprint-124-planning`, cut from `origin/master` `9dd080af`.
> Execution branch (to create): `feature/sprint-124-exemption-mechanism`, off `origin/master`.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-124-exemption-mechanism origin/master`
3. Open plan: `docs/superpowers/plans/2026-08-11-sprint-124-exemption-mechanism-drift-gate.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

**Task 1 is deadline-critical — do it first, on day one.** See below.

---

## Sprint goal

**Resolve the `image-size` exemption before it expires 2026-08-17, extract the exemption-registry
validator into a genuinely schema-driven core, and use it to give the Expo drift workflow a
divergence registry that expires with the SDK generation — so a permanently-red gate can go green
without lying.**

v11.43.0 → **v11.44.0**. Single PR, 13 tasks. No service, database, or frontend code is touched.

| Artifact | Path |
|---|---|
| Design spec | `docs/superpowers/specs/2026-08-11-sprint-124-exemption-mechanism-drift-gate-design.md` |
| Implementation plan | `docs/superpowers/plans/2026-08-11-sprint-124-exemption-mechanism-drift-gate.md` |
| New ADR | **ADR-094** (093 is the highest today) |

### Decisions taken in planning (maintainer, 2026-08-11)

1. **Spine** = exemption mechanism + BUG-035. Chosen over the provider question and the
   platform-floor arc because the deadline and BUG-035 are *the same mechanism*.
2. **image-size** = investigate, then decide in-sprint, with the measurement as the rationale.
3. **Reuse shape** = extract a generic core + per-registry schema. The audit gate's 36 tests
   passing **unchanged** is the behaviour-preservation proof.
4. **Expo expiry** = expires with the **SDK generation**, derived from the live manifest — not a
   hand-written date.
5. **Shape** = one PR.

---

## ⏰ THE DEADLINE — Task 1, day one

**Both `image-size` exemptions expire `2026-08-17`.** On that date `scripts/audit-exemptions.js`
starts failing, which fails `Security Audit` **and** `tests/regression/sprint-75-security-gate.test.ts`,
which blocks **every PR and every push**.

**Option 1 from the previous handoff is already eliminated.** `npm view image-size version` returned
**2.0.2** on 2026-08-11 — still the latest, still inside the advisory range `<=2.0.2`. There is
nothing to upgrade to. Re-measure anyway on the day; that measurement *is* the renewal rationale.

Remaining options: **renew** with a fresh `created`/`expires` pair and a rationale saying what was
re-measured and what it showed, or **remove the need**.

> ⚠️ **"Remove the need" has a trap.** The gate runs `npm audit --package-lock-only` at the repo
> root (`scripts/audit-exemptions.js:293`). Moving `apps/mobile` out of the root lockfile does not
> remove the vulnerable code — **it makes the gate stop looking at it**, permanently and silently,
> for every future advisory. That is gate-avoidance wearing the costume of a fix, and it is worse
> than an honest renewal. It is legitimate only if the maintainer decides on independent merits
> that `apps/mobile` should be separately resolved. Do not let the deadline make that decision.

**Do not** widen the exemption, drop the gate to `critical`, or `--no-verify` past it.

Registry: `security/audit-exemptions.json` · evaluator: `scripts/audit-exemptions.js` ·
proofs: `tests/regression/sprint-123-audit-exemption-gate.test.ts` (36 tests, almost all asserting
refusals).

---

## Critical implementation notes (copied verbatim from the spec)

1. **The audit gate's 36 tests are the behaviour-preservation proof and must pass UNCHANGED.**
   `tests/regression/sprint-123-audit-exemption-gate.test.ts` (377 lines) is not to be edited to
   accommodate the refactor. If a test needs editing, the refactor changed behaviour — fix the
   refactor. This includes **exact error-message strings**: several assertions match on message
   text, so the generic core must emit byte-identical messages for the audit spec.

2. **`scripts/audit-exemptions.js` must keep exporting `validateRegistry`.**
   `tests/regression/sprint-75-security-gate.test.ts:60` requires the module and
   `.github/workflows/ci.yml:99` runs it by path. Re-export a spec-bound wrapper with the original
   one-argument signature.

3. **`npx expo install --check` output is the arbiter — and parsing it is the fragile part.**
   Capture real output into a committed fixture and unit-test the parser against it. The parser
   must **fail closed on unrecognized output**: zero parsed lines from a non-zero exit is "I could
   not tell", never "clean" (`audit-exemptions.js:206-208` is the pattern to copy).

4. **Apply the five Expo patch bumps; do not exempt them.** Re-read the live map on the day —
   BUG-035's list was captured 2026-08-06 and Expo revised its map twice during a single Sprint 122
   review.

5. **Lockfile: `npm install --package-lock-only` reports "up to date" while leaving the nested node
   stale.** Delete the affected entries, re-resolve, then **assert the resolved version**. Surgical
   in-place only — never `npm dedupe`, `npm install --workspace`, or a scratch regen on Windows.

6. **Do not touch `MAX_EXEMPTION_DAYS`.** The 7-day cap is the ADR-059 high-severity SLA and stays
   audit-specific. Sharing a validator core is not sharing rules. `critical` stays never-exemptible.

7. **"Remove the need" for image-size is gate-avoidance unless independently justified.**

8. **`nav.json` is GENERATED.** Edit `scripts/generate-docs.ts:438-463`, regenerate, grep-verify.
   This is why it has "silently reverted" on past sprints.

9. **`npm test` dirties `apps/landing/src/data/docs/`** via the landing prebuild. Revert
   timestamp/HEAD-sha churn before committing; keep the genuine ADR-094 content.

10. **Windows.** `jq` absent, `curl` returns spurious `000` — use `node -e` with `fetch`. `npm test`
    under Turbo is red here with `Exceeded timeout of 5000 ms` on long suites; confirm directly with
    `cd tests && npx jest regression/<file>`. Never `| tail` a test run.

11. **Keep the drift workflow schedule-only** (`expo-sdk-drift.yml:17-21`) — a PR trigger would make
    every merge depend on `api.expo.dev`. Verify with `workflow_dispatch`.

12. **Issue #196 should be closed by the sprint**, not left to rot.

---

## The three findings that shaped the plan (read from source at `b5d4cb79`)

**F1 — the `validateRegistry()` reuse claim is false as written.** `audit-exemptions.js:29-30` says
it is audit-independent so BUG-035 can reuse it. It hard-codes a GHSA-id regex (`:104`),
`severity === 'high'` (`:107`), and both fields in `REQUIRED_FIELDS` (`:43-52`). An Expo divergence
has neither. This is the assert-weaker-than-claimed pattern; the sprint converts it into a proof.

**F2 — not everything BUG-035 reports is a divergence.** jest / `@types/jest` are a deliberate
choice. The other five are **unapplied patch releases** — verified still declared at the old
versions in `apps/mobile/package.json` on 2026-08-11 (`expo ~57.0.10`, `expo-router ~57.0.10`,
`expo-image-picker ~57.0.7`, `expo-location ~57.0.7`, `expo-notifications ~57.0.8`). Those get
**applied**, not exempted.

**F3 — the jest divergence looks safe, and the reasoning must be recorded and re-verified.**
`jest-expo` is not declared and `apps/mobile/jest.config.js` uses no Expo preset. Expo's jest pin
exists to keep its own preset in sync. Re-verify in Task 4 rather than copying this forward.

---

## Carried debt (not in this sprint — see the plan's "Deliberately out of scope")

| Item | Detail |
|---|---|
| **ADR-092 / ADR-093 → `Implemented`** | ⚠️ **This one IS in scope** — Task 9. Both shipped in #198 and are still `Accepted`; flip them on this PR, never a docs-only master push |
| **BUG-033** | TDD promoter's `findTestFiles()` matches only `*.test.ts`; `apps/frontend/tests/tdd/` is 72 `.tsx` vs 2 `.ts`. Extending it moves ~442 tests into the blocking tier in one change — maintainer decision |
| **BUG-034** | `services/messaging-service` has zero tests and no `test` script, on a **Critical** service |
| **`redisClient.publish` UNPROVEN** | Needs a seeded conversation; `maria.reyes@` has zero. Targeted at S125 |
| **`mark-read` has no implementation** | `markMessagesAsRead` exists in `messageService.ts`, is imported by `messageHandler.ts`, and is never called |
| **`README.md:2` version badge** | Hardcoded `version-10.11.0`. The drift gate only guards CLAUDE.md's version line |
| **ADR-028's Dockerfile template** | Still shows `node:18-alpine`; the runtime-floor gate will fail any new service that copies it |
| **`@types/node` floor** | `messaging-service` declares `^20.10.5` against a Node 24 runtime |
| **Claim-scan precision trade** | Two paths allowlisted where *"Internal use only"* annotates endpoint visibility, not a license (`notification-service` `CONTEXT.md`, `routes/push.ts`) |
| **Platform-floor arc** | `@types/node` 20→26 → TypeScript 5.9→7 → ESLint 9→10, in that order. Unblocked by ADR-090. Deserves its own sprint |
| **Open Dependabot PRs** | **#199** production-deps (11 updates) and **#200** dev-deps (9 updates), both regenerated 2026-08-11, neither triaged. ⚠️ **Numbers churn on every regeneration — match on what a PR bumps, never the number** |
| **~90 stale remote branches** | Squash-merged branches always read as "unmerged", so this never self-clears. Safe to prune where the PR is MERGED/CLOSED; **verify PR state per branch, never bulk-delete by name pattern.** Candidates: `fix/adr-060-gate-pr-head-ref`, `docs/sprint-123-planning`, `feature/sprint-123-licensing-and-audit`, `docs/sprint-122-pr5-shipped`, `agent/codex/sprint-122-pr6-zustand5` |

---

## After this sprint

**Sprint 125** — manifesto arc step 2, the provider question (ADR-041 enforcement: the three
shipped-but-unread config columns). Two product decisions are still open and must be made in that
sprint's planning chat: (a) does standing gate *global registration* or only community reach?
(b) what happens to the unauthenticated global provider directory? See
`docs/superpowers/specs/2026-08-06-sprint-123-126-manifesto-alignment-arc-design.md`.

---

## Standing mechanics (carried forward, unchanged)

- **Branch off `origin/master`, never local master.** Never force-push; never direct-push to master.
- **Every merge needs EXPLICIT authorization**, every time. The Bash `gh pr merge` form is blocked
  by the permission classifier — use the GitHub MCP `merge_pull_request` tool.
- **No docs-only master pushes** — every master push is a full deploy → demo 502s.
- **Land the handoff BEFORE requesting merge authorization**, or put it on the follow-up branch. A
  handoff pushed after the merge lands is stranded on a closed branch — that happened on #194.
- Surgical in-place lockfile edits only; never `npm dedupe`, never a scratch regen on Windows.
  **Assert the resolved version after every command** — npm prints "up to date" while leaving a
  vulnerable pin in place, and an open-ended override range (`>=x`) will happily cross a major.
- **`npm test` under Turbo is red on this Windows box** with `Exceeded timeout of 5000 ms` on
  suites taking 230–285 s. Confirm any suspect workspace by running it directly before believing it.
  Never `| tail` the run — it masks the exit code.
- **`curl` and `jq` are unusable here** (`curl` returns 000 with a libcurl error even against
  api.github.com). Use `node -e` with `fetch`.
- **Check `#!/bin/sh` scripts with `dash -n` and run them under real `dash`.** `[[ ]]` is *"not
  found"* there, and inside an `if` that is not fatal even under `set -e` — it silently takes the
  else branch. That shipped a bug that tests could not see.
- **CodeQL: remove the sink, don't guard it.** A resolve-plus-prefix-check on an env-provided path
  was rejected; an allowlist of constant paths keyed by the env var cleared it.
- **Git hooks only enforce after `npm run hooks:install` has run on this clone.** A push that
  finishes silently and instantly means **no hook ran** — treat that silence as a red flag.
