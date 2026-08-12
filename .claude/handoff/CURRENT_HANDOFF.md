# Sprint 124 — Exemption Mechanism & The Drift Gate (IMPLEMENTATION COMPLETE, awaiting PR → merge)

> ## State as of 2026-08-12
>
> **All 11 implementation tasks are done and committed.** 23 commits on
> `feature/sprint-124-exemption-mechanism` (branched from `origin/master` `9dd080af`).
> Version **v11.43.0 → v11.44.0**.
>
> Remaining: **push, open the PR, merge, deploy** (plan Tasks 12–13). Nothing else is outstanding.
>
> ⏰ **HARD DEADLINE — the exemption expires `2026-08-18` (6 days).** The span is already at the
> ADR-059 7-day maximum, so it **cannot be renewed again** without breaking the SLA. If this PR does
> not land before that date, `scripts/audit-exemptions.js` starts failing and blocks **every PR and
> every push**. This is the single most important fact on this page.

---

## Quick Start

```bash
git checkout feature/sprint-124-exemption-mechanism
git log --oneline origin/master..HEAD    # expect 23 commits
npm test                                  # expect exit 0
```

1. Push the branch and open the PR (see "Exact remaining steps" below).
2. Wait for CI green, then **request merge authorization explicitly** — never merge without it.
3. Merge with the GitHub MCP `merge_pull_request` tool (the Bash `gh pr merge` form is blocked by
   the permission classifier).
4. Post-deploy smoke test, close issue #196, archive this handoff.

| Artifact | Path |
|---|---|
| Design spec | `docs/superpowers/specs/2026-08-11-sprint-124-exemption-mechanism-drift-gate-design.md` |
| Implementation plan | `docs/superpowers/plans/2026-08-11-sprint-124-exemption-mechanism-drift-gate.md` |
| New ADR | `docs/adr/ADR-094-generalized-exemption-registries.md` (**Implemented**) |

---

## What shipped

| Deliverable | State |
|---|---|
| `image-size` exemption renewed | `2026-08-11 → 2026-08-18`, 7-day span, measured rationale recorded |
| `scripts/lib/exemption-registry.js` | Shared schema-driven core; knows no GHSA id, severity, or SDK |
| `scripts/audit-exemptions.js` | Consumes the core; the frozen 36-test proof passes **unchanged** |
| `scripts/expo-divergences.js` + `security/expo-divergences.json` | New gate; SDK-generation expiry derived from the live manifest |
| Five Expo patch bumps + lockfile | All five resolve exactly as declared; `apps/mobile` `tsc` clean |
| `.github/workflows/expo-sdk-drift.yml` | Calls the gate as the verdict; schedule-only; no bashisms |
| ADR-094 + ADR-059 amendment; ADR-092/093 → Implemented | Indexed, landing docs regenerated, `nav.json` verified |
| BUG-035 → fixed; `package.json` → 11.44.0 | Done |
| Services / `registry.json` / service `CONTEXT.md` | **Untouched — 0 files**, as designed |

---

## Decisions taken during execution (do not re-debate)

1. **`image-size` was renewed, not removed.** `npm view image-size version` returned **2.0.2** —
   still the latest, still inside the advisory range `<=2.0.2`. There is nothing to upgrade to.
   Splitting `apps/mobile` out of the root lockfile was rejected as gate-avoidance: it stops the
   gate *looking* at the vulnerability rather than removing it.
2. **The 36-test audit proof was never edited.** `git diff origin/master...HEAD --
   tests/regression/sprint-123-audit-exemption-gate.test.ts` prints nothing. That is the
   behaviour-preservation evidence.
3. **`MAX_EXEMPTION_DAYS` is untouched at 7** and stays audit-specific, per the plan.
4. **Two stray files kept deliberately** (maintainer decision, 2026-08-12):
   `.github/copilot-instructions.md` and `.github/instructions/mermaid.instructions.md` are
   VS Code Mermaid-extension output that rode in on `2ef6b459`. Kept in this PR rather than dropped.

---

## Four defects found and fixed during the gates — the substance of this session

**1. The parity contract was tautological** (`c6e1c333`). `sprint-124-registry-core-parity.test.ts`
declared its *own* `auditSpec`/`expoSpec` literals and asserted against them, so every "both
registries share one core" claim proved only that a local object matched itself. The replicas had
already drifted from the shipped specs in four places, and the replica's `checkExpiry: () => []`
omitted the **SDK-generation expiry entirely** — the sprint's headline feature was covered by
nothing. Fixed by exporting `AUDIT_SPEC` / `expoSpec` and binding the table to them.

**2. The core was not actually schema-driven** (`fbad9c93`). It parsed `created` **by name** and
derived the duplicate-error noun by trimming an `s` off the collection name. Both shipped registries
happening to have `created` is exactly what hid it. Now spec fields (`dateFields`, `entryName`); the
core names no field of its own.

**3. 🔒 The ADR-059 cap was bypassable** (`088bee81`, from `/security-review`). The 7-day cap
constrained only the **span** `expires - created`, and nothing constrained `created` against today.
Demonstrated against the shipped validator: an entry `created 2027-01-01 / expires 2027-01-08` spans
exactly 7 days, **validates clean, and suppresses a high-severity advisory for 149 days**. Fixed by
rejecting a future `created` — with `created ≤ today` and span ≤ 7, `expires` cannot exceed
today + 7, which is the invariant ADR-059 always claimed. Pre-existing on master; fixed here because
this is the sprint that owns the mechanism.

**4. That security fix planted a time-bomb, caught by `/code-review`** (`c49da96f`).
`sprint-124-registry-independence.test.ts` froze `NOW = 2026-08-11` while validating the **shipped**
time-boxed registry — which must be renewed before 2026-08-18. Simulated the next renewal against
the real suite: two "must not be in the future" errors, blocking tier red on a *renewal* rather than
a defect. The clock is now derived from the registry's own `created`, and the same simulation passes.

> **The through-line:** three of these four are the *assert-weaker-than-claimed* pattern. Every gate
> in this sprint was proven able to fail by injection — nine defects injected into the real specs and
> workflow, each reverted after, all nine red. A gate that has not been watched go red is not
> evidence.

---

## Exact remaining steps

```bash
# 1. Push (hooks ARE live on this clone — core.hooksPath = .husky, verified 2026-08-12).
#    A push that finishes silently and instantly means no hook ran — treat that as a red flag.
git push -u origin feature/sprint-124-exemption-mechanism

# 2. Open the PR. Body must carry the PR-contract headers (pr-contract.yml blocks without them).
```

Then:
- [ ] CI green: unit + regression, dependency audit (ADR-059), CodeQL (ADR-060), PR contract
      headers, doc/context drift gate
- [ ] **Request merge authorization explicitly** — required every time, no standing approval
- [ ] Squash-merge via GitHub MCP `merge_pull_request`
- [ ] Post-deploy smoke test: `POST /api/auth/login` (`/health` is **not** exposed via nginx)
- [ ] **Close issue #196** referencing the PR
- [ ] Confirm the next scheduled `Expo SDK drift` run (07:15 UTC) is green — `workflow_dispatch` is
      only a rehearsal; the scheduled run is the real proof
- [ ] Archive this handoff and reconcile against real state (`gh pr list`, `git log`)

---

## Carried debt (unchanged — none of this is in Sprint 124)

| Item | Detail |
|---|---|
| **`/simplify` items deferred with justification** | Collapsing the workflow's base64/`sed` transport into a `--json` mode, and unifying the `unused`/`stale` result naming across the two gates. Both real; both larger than a deadline-bound PR warrants; neither verifiable locally except by `workflow_dispatch` |
| **BUG-033** | TDD promoter's `findTestFiles()` matches only `*.test.ts`; `apps/frontend/tests/tdd/` is 72 `.tsx` vs 2 `.ts`. Extending it moves ~442 tests into the blocking tier in one change — maintainer decision |
| **BUG-034** | `services/messaging-service` has zero tests and no `test` script, on a **Critical** service |
| **`redisClient.publish` UNPROVEN** | Needs a seeded conversation; `maria.reyes@` has zero. Targeted at S125 |
| **`mark-read` has no implementation** | `markMessagesAsRead` exists, is imported, and is never called |
| **`README.md:2` version badge** | Hardcoded `version-10.11.0`; the drift gate only guards CLAUDE.md's version line |
| **ADR-028's Dockerfile template** | Still shows `node:18-alpine`; the runtime-floor gate will fail any new service copying it |
| **`@types/node` floor** | `messaging-service` declares `^20.10.5` against a Node 24 runtime |
| **Platform-floor arc** | `@types/node` 20→26 → TypeScript 5.9→7 → ESLint 9→10, in that order. Unblocked by ADR-090. Its own sprint |
| **Open Dependabot PRs** | **#199** production-deps and **#200** dev-deps, neither triaged. ⚠️ **Numbers churn on regeneration — match on what a PR bumps, never the number** |
| **~90 stale remote branches** | Squash-merged branches always read as "unmerged", so this never self-clears. **Verify PR state per branch; never bulk-delete by name pattern** |

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
- **Every merge needs EXPLICIT authorization**, every time. Use the GitHub MCP
  `merge_pull_request` tool — the Bash `gh pr merge` form is blocked by the permission classifier.
- **No docs-only master pushes** — every master push is a full deploy → demo 502s.
- **Land the handoff BEFORE requesting merge authorization** (this file is being landed on the
  branch for exactly that reason; a handoff pushed after the merge is stranded — that happened on #194).
- Surgical in-place lockfile edits only; never `npm dedupe`, never a scratch regen on Windows.
  **Assert the resolved version after every command** — npm prints "up to date" while leaving a
  vulnerable pin in place.
- **`npm test` dirties `apps/landing/src/data/docs/`** via the landing prebuild. `architecture.json`
  and `build.json` are pure timestamp/HEAD-sha churn — revert them; keep genuine content changes.
- **`npm test` under Turbo can be red on this Windows box** with `Exceeded timeout of 5000 ms` on
  long suites. Confirm any suspect workspace directly with `cd tests && npx jest regression/<file>`.
  Never `| tail` the run — it masks the exit code.
- **`curl` and `jq` are unusable here.** Use `node -e` with `fetch`.
- **Check `#!/bin/sh` scripts with `dash -n`.** `[[ ]]` is *"not found"* there, and inside an `if`
  that is not fatal even under `set -e` — it silently takes the else branch.
- **CodeQL: remove the sink, don't guard it.** An allowlist of constant paths keyed by the env var
  clears it; a resolve-plus-prefix-check on an env-provided path was rejected.
- **Git hooks only enforce after `npm run hooks:install` has run on this clone.** Verified live on
  2026-08-12: `core.hooksPath` = `.husky`, `pre-commit` and `pre-push` both present.
